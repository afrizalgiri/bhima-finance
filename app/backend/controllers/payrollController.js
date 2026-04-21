const prisma = require('../lib/prisma');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { sendSlipGajiEmail } = require('../services/emailService');

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const canAccess = (user) => user.role === 'ADMIN' || user.canViewSalary;

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(n || 0));

const fmtNum = (n) =>
  new Intl.NumberFormat('id-ID').format(Number(n || 0));

// ─── Terbilang ──────────────────────────────────────────────────────────────
function terbilang(angka) {
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
    'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas',
    'tujuh belas', 'delapan belas', 'sembilan belas'];

  function ratusan(n) {
    if (n < 20) return satuan[n];
    if (n < 100) {
      return satuan[Math.floor(n / 10)] + ' puluh' + (n % 10 > 0 ? ' ' + satuan[n % 10] : '');
    }
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const prefix = h === 1 ? 'seratus' : satuan[h] + ' ratus';
    return prefix + (rest > 0 ? ' ' + ratusan(rest) : '');
  }

  let n = Math.floor(Math.abs(angka));
  if (n === 0) return 'nol';

  let result = '';
  if (n >= 1000000000) { result += ratusan(Math.floor(n / 1000000000)) + ' miliar '; n %= 1000000000; }
  if (n >= 1000000)    { result += ratusan(Math.floor(n / 1000000)) + ' juta '; n %= 1000000; }
  if (n >= 1000)       { const r = Math.floor(n / 1000); result += (r === 1 ? 'seribu' : ratusan(r) + ' ribu') + ' '; n %= 1000; }
  if (n > 0)           { result += ratusan(n); }

  return result.trim();
}

// ─── PDF Generator ───────────────────────────────────────────────────────────
async function generatePayrollPdfBuffer(payroll, company) {
  return new Promise((resolve, reject) => {
    const NAVY   = '#1B3A5C';
    const GOLD   = '#C9A84C';
    const WHITE  = '#FFFFFF';
    const LIGHT  = '#F0F4F8';
    const GRAY   = '#6B7280';
    const DARK   = '#111827';
    const GREEN  = '#166534';
    const GREEN_BG = '#F0FDF4';

    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const bufs = [];
    doc.on('data', c => bufs.push(c));
    doc.on('end', () => resolve(Buffer.concat(bufs)));
    doc.on('error', reject);

    const PW = 595.28;
    const M  = 45;
    const CW = PW - M * 2;

    // ── KOP SURAT ────────────────────────────────────────────────────────────
    const logoPath = company?.logoUrl
      ? path.join(__dirname, '..', company.logoUrl)
      : null;
    const hasLogo = logoPath && fs.existsSync(logoPath);

    doc.rect(M, M, CW, 4).fillColor(NAVY).fill();
    doc.rect(M, M + 6, CW, 1.5).fillColor(GOLD).fill();

    const headerY = M + 14;
    const LOGO_W  = 80;
    const textX   = hasLogo ? M + LOGO_W + 10 : M;
    const textW   = hasLogo ? CW - LOGO_W - 10 : CW;

    if (hasLogo) {
      try { doc.image(logoPath, M, headerY, { fit: [LOGO_W, 50], align: 'left', valign: 'center' }); } catch {}
    }

    doc.fontSize(14).font('Helvetica-Bold').fillColor(NAVY)
      .text(company?.name || 'PT. NAMA PERUSAHAAN', textX, headerY + 2, { width: textW, align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#444')
      .text(company?.address || '', textX, doc.y + 3, { width: textW, align: 'center' })
      .text(`Telp: ${company?.phone || '-'}  |  Email: ${company?.email || '-'}`, textX, doc.y + 2, { width: textW, align: 'center' });
    if (company?.website) doc.text(company.website, textX, doc.y + 2, { width: textW, align: 'center' });

    const kopBottom = Math.max(doc.y, hasLogo ? headerY + 54 : 0) + 8;
    doc.rect(M, kopBottom, CW, 1.5).fillColor(GOLD).fill();
    doc.rect(M, kopBottom + 3, CW, 4).fillColor(NAVY).fill();

    let y = kopBottom + 20;

    // ── TITLE ────────────────────────────────────────────────────────────────
    doc.fontSize(16).font('Helvetica-Bold').fillColor(NAVY)
      .text('SLIP GAJI', M, y, { width: CW, align: 'center' });
    y = doc.y + 3;

    const monthName = MONTHS[payroll.month - 1];
    doc.fontSize(10).font('Helvetica').fillColor(GRAY)
      .text(`Periode: ${monthName} ${payroll.year}`, M, y, { width: CW, align: 'center' });
    y = doc.y + 4;

    // Divider
    doc.rect(M, y, CW, 0.75).fillColor('#D1D5DB').fill();
    y += 12;

    // ── EMPLOYEE INFO BOX ─────────────────────────────────────────────────────
    const BOX_LABEL_W = 130;
    const BOX_H = 18;
    const infoRows = [
      ['Nama Karyawan', payroll.employeeName.toUpperCase()],
      payroll.position ? ['Jabatan', payroll.position] : null,
      payroll.department ? ['Departemen', payroll.department] : null,
      ['Periode', `${monthName} ${payroll.year}`],
      ['Tanggal Terbit', new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })],
    ].filter(Boolean);

    const totalInfoH = infoRows.length * BOX_H + 16;
    // Box background
    doc.rect(M, y, CW, totalInfoH).fillColor(LIGHT).strokeColor('#D1D5DB').lineWidth(0.5).fillAndStroke();

    // Header
    doc.rect(M, y, CW, 22).fillColor(NAVY).fill();
    doc.fontSize(9).font('Helvetica-Bold').fillColor(WHITE)
      .text('DATA KARYAWAN', M + 10, y + 6, { width: CW - 20 });
    y += 22;

    infoRows.forEach(([label, value], idx) => {
      const rowY = y + idx * BOX_H;
      const bg = idx % 2 === 0 ? WHITE : LIGHT;
      doc.rect(M, rowY, CW, BOX_H).fillColor(bg).fill();
      // Label
      doc.fontSize(9).font('Helvetica').fillColor(GRAY)
        .text(label, M + 10, rowY + 4, { width: BOX_LABEL_W });
      // Divider between label and value
      doc.rect(M + BOX_LABEL_W + 10, rowY + 3, 0.5, BOX_H - 6).fillColor('#D1D5DB').fill();
      // Value
      const bold = idx === 0;
      doc.fontSize(9).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(DARK)
        .text(value, M + BOX_LABEL_W + 20, rowY + 4, { width: CW - BOX_LABEL_W - 30 });
    });

    y += infoRows.length * BOX_H + 16;

    // ── SALARY TABLE ──────────────────────────────────────────────────────────
    const COL1_W = CW - 160;
    const COL2_W = 160;
    const ROW_H  = 22;

    const drawSection = (title, rows, showTotal, totalLabel, totalVal) => {
      // Section header
      doc.rect(M, y, CW, 22).fillColor(NAVY).fill();
      doc.fontSize(9).font('Helvetica-Bold').fillColor(WHITE)
        .text(title, M + 10, y + 6);
      y += 22;

      rows.forEach(([label, val, isHighlight], idx) => {
        const bg = isHighlight ? '#EFF6FF' : (idx % 2 === 0 ? WHITE : LIGHT);
        doc.rect(M, y, CW, ROW_H).fillColor(bg).fill();
        doc.fontSize(9).font(isHighlight ? 'Helvetica-Bold' : 'Helvetica').fillColor(isHighlight ? NAVY : DARK)
          .text(label, M + 10, y + 6, { width: COL1_W - 10 });
        doc.fontSize(9).font(isHighlight ? 'Helvetica-Bold' : 'Helvetica').fillColor(isHighlight ? NAVY : DARK)
          .text(val, M + COL1_W, y + 6, { width: COL2_W - 10, align: 'right' });
        y += ROW_H;
      });

      if (showTotal) {
        doc.rect(M, y, CW, ROW_H + 2).fillColor('#E8F0FA').fill();
        doc.rect(M, y, 3, ROW_H + 2).fillColor(NAVY).fill();
        doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
          .text(totalLabel, M + 12, y + 7, { width: COL1_W - 12 });
        doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
          .text(totalVal, M + COL1_W, y + 7, { width: COL2_W - 10, align: 'right' });
        y += ROW_H + 2;
      }

      y += 10;
    };

    const totalPenghasilan = Number(payroll.baseSalary) + Number(payroll.allowances);

    drawSection('PENGHASILAN', [
      ['Gaji Pokok', fmt(payroll.baseSalary)],
      ['Tunjangan', fmt(payroll.allowances)],
    ], true, 'Total Penghasilan', fmt(totalPenghasilan));

    if (Number(payroll.deductions) > 0) {
      drawSection('POTONGAN', [
        ['Potongan', fmt(payroll.deductions)],
      ], true, 'Total Potongan', fmt(payroll.deductions));
    }

    // ── GAJI BERSIH ───────────────────────────────────────────────────────────
    const netH = 36;
    doc.rect(M, y, CW, netH).fillColor(NAVY).fill();
    doc.rect(M + 2, y + 2, CW - 4, netH - 4).fillColor(NAVY).fill();
    // Gold accent stripe left
    doc.rect(M, y, 5, netH).fillColor(GOLD).fill();

    doc.fontSize(11).font('Helvetica-Bold').fillColor(GOLD)
      .text('GAJI BERSIH DITERIMA', M + 14, y + 5, { width: COL1_W - 14 });
    doc.fontSize(13).font('Helvetica-Bold').fillColor(WHITE)
      .text(fmt(payroll.netSalary), M + COL1_W, y + 4, { width: COL2_W - 10, align: 'right' });
    y += netH + 10;

    // ── TERBILANG ─────────────────────────────────────────────────────────────
    const terbilangText = terbilang(Math.floor(payroll.netSalary));
    const capText = terbilangText.charAt(0).toUpperCase() + terbilangText.slice(1) + ' Rupiah';

    doc.rect(M, y, CW, 1).fillColor('#E5E7EB').fill();
    y += 8;
    doc.fontSize(8.5).font('Helvetica').fillColor(GRAY)
      .text('Terbilang:', M, y);
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(DARK)
      .text(`"${capText}"`, M + 60, y, { width: CW - 60 });
    y = doc.y + 12;

    // ── NOTES ─────────────────────────────────────────────────────────────────
    if (payroll.notes) {
      doc.rect(M, y, CW, 1).fillColor('#E5E7EB').fill();
      y += 8;
      doc.fontSize(8.5).font('Helvetica').fillColor(GRAY).text('Catatan:', M, y);
      doc.fontSize(8.5).font('Helvetica').fillColor(DARK).text(payroll.notes, M + 60, y, { width: CW - 60 });
      y = doc.y + 14;
    }

    // ── SIGNATURE ─────────────────────────────────────────────────────────────
    const sigY = y + 10;
    const sigBoxW = 180;
    // Right signature block
    const sigX = M + CW - sigBoxW;
    doc.rect(M, sigY, CW, 0.75).fillColor('#E5E7EB').fill();

    const nowDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.fontSize(8.5).font('Helvetica').fillColor(GRAY)
      .text(nowDate, sigX, sigY + 10, { width: sigBoxW, align: 'center' })
    doc.fontSize(8.5).font('Helvetica').fillColor(DARK)
      .text(company?.name || 'Perusahaan', sigX, doc.y + 2, { width: sigBoxW, align: 'center' });

    // Signature space
    doc.moveTo(sigX + 20, doc.y + 52).lineTo(sigX + sigBoxW - 20, doc.y + 52)
      .strokeColor('#555').lineWidth(0.7).stroke();

    doc.fontSize(8.5).font('Helvetica').fillColor(GRAY)
      .text('( HRD / Direktur )', sigX, doc.y + 56, { width: sigBoxW, align: 'center' });

    // ── FOOTER ────────────────────────────────────────────────────────────────
    const footerY = 841.89 - 28;
    doc.rect(M, footerY - 6, CW, 0.75).fillColor('#D1D5DB').fill();
    doc.fontSize(7).font('Helvetica').fillColor('#9CA3AF')
      .text(`Dokumen ini diterbitkan secara elektronik oleh sistem ${company?.name || 'Bhima Finance'} dan sah tanpa tanda tangan basah.`,
        M, footerY, { width: CW, align: 'center' });

    doc.end();
  });
}

// ─── CONTROLLERS ─────────────────────────────────────────────────────────────

const getAll = async (req, res) => {
  try {
    if (!canAccess(req.user)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    const { month, year, search } = req.query;
    const where = {};
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (search) where.employeeName = { contains: search, mode: 'insensitive' };

    const payrolls = await prisma.payroll.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { employeeName: 'asc' }],
    });

    res.json({ success: true, data: payrolls });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    const { employeeName, position, department, month, year, baseSalary = 0, allowances = 0, deductions = 0, notes } = req.body;
    if (!employeeName || !month || !year) {
      return res.status(400).json({ success: false, message: 'Nama karyawan, bulan, dan tahun wajib diisi' });
    }
    const netSalary = parseFloat(baseSalary) + parseFloat(allowances) - parseFloat(deductions);
    const payroll = await prisma.payroll.create({
      data: {
        employeeName: employeeName.trim(),
        position: position?.trim() || null,
        department: department?.trim() || null,
        month: parseInt(month), year: parseInt(year),
        baseSalary: parseFloat(baseSalary), allowances: parseFloat(allowances),
        deductions: parseFloat(deductions), netSalary, notes,
      },
    });
    res.status(201).json({ success: true, data: payroll });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Slip gaji bulan ini sudah ada untuk karyawan tersebut' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const update = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    const { employeeName, position, department, baseSalary = 0, allowances = 0, deductions = 0, notes } = req.body;
    const netSalary = parseFloat(baseSalary) + parseFloat(allowances) - parseFloat(deductions);
    const data = {
      baseSalary: parseFloat(baseSalary), allowances: parseFloat(allowances),
      deductions: parseFloat(deductions), netSalary, notes,
      position: position?.trim() || null,
      department: department?.trim() || null,
    };
    if (employeeName) data.employeeName = employeeName.trim();
    const payroll = await prisma.payroll.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: payroll });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    await prisma.payroll.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Slip gaji dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const generatePdf = async (req, res) => {
  if (!canAccess(req.user)) {
    return res.status(403).json({ success: false, message: 'Akses ditolak' });
  }
  try {
    const payroll = await prisma.payroll.findUnique({ where: { id: req.params.id } });
    if (!payroll) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });

    const company = await prisma.companySetting.findFirst();
    const pdfBuffer = await generatePayrollPdfBuffer(payroll, company);

    const monthStr = String(payroll.month).padStart(2, '0');
    const filename = `SlipGaji_${payroll.employeeName.replace(/\s+/g, '_')}_${payroll.year}_${monthStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error('[Payroll PDF]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

const sendEmail = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email tujuan wajib diisi' });

    const payroll = await prisma.payroll.findUnique({ where: { id: req.params.id } });
    if (!payroll) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });

    const company = await prisma.companySetting.findFirst();
    const pdfBuffer = await generatePayrollPdfBuffer(payroll, company);

    await sendSlipGajiEmail(payroll, email, pdfBuffer, company);

    res.json({ success: true, message: `Slip gaji berhasil dikirim ke ${email}` });
  } catch (e) {
    console.error('[Payroll Email]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { getAll, create, update, remove, generatePdf, sendEmail };
