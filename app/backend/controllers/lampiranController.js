const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel } = require('docx');
const { logActivity } = require('../utils/activityLog');
const prisma = require('../lib/prisma');

// ── Upload dir ─────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../uploads/lampiran');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
}).single('file');

// ── Helpers ────────────────────────────────────────────────
const fileUrl = (filename) => `/uploads/lampiran/${filename}`;
const filePath = (url) => url ? path.join(__dirname, '..', url) : null;
const deleteFile = (url) => { try { const p = filePath(url); if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {} };

// ── GET ALL ────────────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { search, tipe } = req.query;
    const where = {};
    if (tipe) where.tipe = tipe;
    if (search) where.OR = [
      { nama: { contains: search, mode: 'insensitive' } },
      { deskripsi: { contains: search, mode: 'insensitive' } },
    ];
    const lampiran = await prisma.lampiran.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, nama: true, deskripsi: true, tipe: true, fileUrl: true, fileName: true, fileSize: true, mimeType: true, createdAt: true },
    });
    res.json({ success: true, data: lampiran });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET ONE ────────────────────────────────────────────────
const getOne = async (req, res) => {
  try {
    const item = await prisma.lampiran.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ success: false, message: 'Lampiran tidak ditemukan' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── UPLOAD file ────────────────────────────────────────────
const uploadFile = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'File tidak ditemukan' });

    try {
      const { nama, deskripsi } = req.body;
      const item = await prisma.lampiran.create({
        data: {
          nama: nama || req.file.originalname,
          deskripsi: deskripsi || null,
          tipe: 'UPLOAD',
          fileUrl: fileUrl(req.file.filename),
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        },
      });
      await logActivity(req.user.id, 'Upload Lampiran', 'Lampiran', item.id, item.nama);
      res.status(201).json({ success: true, data: item });
    } catch (e) {
      deleteFile(fileUrl(req.file.filename));
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });
};

// ── GENERATE EXCEL ─────────────────────────────────────────
const generateExcel = async (req, res) => {
  try {
    const { nama, deskripsi, templateData } = req.body;
    // templateData: { sheets: [{ name, columns: [], rows: [[]] }] }
    const sheets = templateData?.sheets || [{ name: 'Sheet1', columns: [], rows: [] }];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bhima Finance';
    workbook.created = new Date();

    sheets.forEach(sheet => {
      const ws = workbook.addWorksheet(sheet.name || 'Sheet1');
      if (sheet.columns?.length) {
        ws.addRow(sheet.columns).eachCell(cell => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3557' } };
          cell.alignment = { horizontal: 'center' };
          cell.border = { bottom: { style: 'thin' } };
        });
        ws.columns = sheet.columns.map((c, i) => ({ key: String(i), width: 20 }));
      }
      (sheet.rows || []).forEach(row => ws.addRow(row));
    });

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`;
    const outPath = path.join(UPLOAD_DIR, filename);
    await workbook.xlsx.writeFile(outPath);
    const stat = fs.statSync(outPath);

    const item = await prisma.lampiran.create({
      data: {
        nama: nama || 'Lampiran Excel',
        deskripsi: deskripsi || null,
        tipe: 'EXCEL',
        fileUrl: fileUrl(filename),
        fileName: `${nama || 'lampiran'}.xlsx`,
        fileSize: stat.size,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        templateData,
      },
    });
    await logActivity(req.user.id, 'Buat Lampiran Excel', 'Lampiran', item.id, item.nama);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal generate Excel' });
  }
};

// ── GENERATE WORD ──────────────────────────────────────────
const generateWord = async (req, res) => {
  try {
    const { nama, deskripsi, templateData } = req.body;
    // templateData: { title, sections: [{ type: 'paragraph'|'table', content?, headers?, rows? }] }
    const title = templateData?.title || nama || 'Lampiran';
    const sections = templateData?.sections || [];

    const children = [
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: '' }),
    ];

    sections.forEach(sec => {
      if (sec.type === 'paragraph') {
        children.push(new Paragraph({ children: [new TextRun({ text: sec.content || '', size: 24 })], spacing: { after: 100 } }));
      } else if (sec.type === 'table' && sec.headers?.length) {
        const headerRow = new TableRow({
          children: sec.headers.map(h => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF' })] })],
            shading: { fill: '1a3557' },
            width: { size: Math.floor(9000 / sec.headers.length), type: WidthType.DXA },
          })),
        });
        const dataRows = (sec.rows || []).map(row => new TableRow({
          children: (sec.headers || []).map((_, i) => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(row[i] ?? ''), size: 22 })] })],
            width: { size: Math.floor(9000 / sec.headers.length), type: WidthType.DXA },
          })),
        }));
        children.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 9000, type: WidthType.DXA } }));
        children.push(new Paragraph({ text: '' }));
      }
    });

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.docx`;
    const outPath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(outPath, buffer);

    const item = await prisma.lampiran.create({
      data: {
        nama: nama || 'Lampiran Word',
        deskripsi: deskripsi || null,
        tipe: 'WORD',
        fileUrl: fileUrl(filename),
        fileName: `${nama || 'lampiran'}.docx`,
        fileSize: buffer.length,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        templateData,
      },
    });
    await logActivity(req.user.id, 'Buat Lampiran Word', 'Lampiran', item.id, item.nama);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Gagal generate Word' });
  }
};

// ── UPDATE (metadata only) ─────────────────────────────────
const update = async (req, res) => {
  try {
    const { nama, deskripsi } = req.body;
    const item = await prisma.lampiran.update({
      where: { id: req.params.id },
      data: { nama, deskripsi: deskripsi ?? undefined },
    });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DELETE ─────────────────────────────────────────────────
const remove = async (req, res) => {
  try {
    const item = await prisma.lampiran.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });
    if (item.fileUrl) deleteFile(item.fileUrl);
    await prisma.lampiran.delete({ where: { id: req.params.id } });
    await logActivity(req.user.id, 'Hapus Lampiran', 'Lampiran', req.params.id, item.nama);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DOWNLOAD ───────────────────────────────────────────────
const download = async (req, res) => {
  try {
    const item = await prisma.lampiran.findUnique({ where: { id: req.params.id } });
    if (!item || !item.fileUrl) return res.status(404).json({ success: false, message: 'File tidak ditemukan' });
    const absPath = filePath(item.fileUrl);
    if (!fs.existsSync(absPath)) return res.status(404).json({ success: false, message: 'File tidak ada di server' });
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.fileName || 'lampiran')}"`);
    res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
    res.sendFile(absPath);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── ATTACH to document ─────────────────────────────────────
const attachToDocument = async (req, res) => {
  try {
    const { dokumenType, dokumenId, lampiranIds } = req.body;
    // lampiranIds: string[]  — bulk attach
    if (!dokumenType || !dokumenId || !lampiranIds?.length) {
      return res.status(400).json({ success: false, message: 'dokumenType, dokumenId, lampiranIds required' });
    }

    // Get current max urutan
    const existing = await prisma.dokumenLampiran.findMany({ where: { dokumenType, dokumenId }, orderBy: { urutan: 'desc' } });
    let nextUrutan = (existing[0]?.urutan ?? -1) + 1;

    const existingIds = new Set(existing.map(e => e.lampiranId));
    const toInsert = lampiranIds.filter(id => !existingIds.has(id));

    if (toInsert.length) {
      await prisma.dokumenLampiran.createMany({
        data: toInsert.map(lampiranId => ({ dokumenType, dokumenId, lampiranId, urutan: nextUrutan++ })),
        skipDuplicates: true,
      });
    }

    const result = await prisma.dokumenLampiran.findMany({
      where: { dokumenType, dokumenId },
      include: { lampiran: { select: { id: true, nama: true, tipe: true, fileUrl: true, fileName: true, fileSize: true } } },
      orderBy: { urutan: 'asc' },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── DETACH from document ───────────────────────────────────
const detachFromDocument = async (req, res) => {
  try {
    const { dokumenType, dokumenId, lampiranId } = req.params;
    await prisma.dokumenLampiran.deleteMany({ where: { dokumenType, dokumenId, lampiranId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET lampiran by document ───────────────────────────────
const getByDocument = async (req, res) => {
  try {
    const { dokumenType, dokumenId } = req.params;
    const result = await prisma.dokumenLampiran.findMany({
      where: { dokumenType, dokumenId },
      include: { lampiran: { select: { id: true, nama: true, deskripsi: true, tipe: true, fileUrl: true, fileName: true, fileSize: true, mimeType: true } } },
      orderBy: { urutan: 'asc' },
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── REORDER ────────────────────────────────────────────────
const reorder = async (req, res) => {
  try {
    const { dokumenType, dokumenId, orderedIds } = req.body;
    // orderedIds: DokumenLampiran.id[] in new order
    await Promise.all(orderedIds.map((id, idx) =>
      prisma.dokumenLampiran.update({ where: { id }, data: { urutan: idx } })
    ));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, getOne, uploadFile, generateExcel, generateWord, update, remove, download, attachToDocument, detachFromDocument, getByDocument, reorder };
