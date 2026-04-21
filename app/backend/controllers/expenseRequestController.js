const { generateRfpPdf } = require('../services/pdfService');
const { generateRfpNumber } = require('../utils/numberGenerator');
const { logActivity } = require('../utils/activityLog');
const { sendRfpStatusEmail, sendBossApprovalEmail } = require('../services/emailService');
const prisma = require('../lib/prisma');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ATTACH_DIR = path.join(__dirname, '../uploads/rfp-attachments');
if (!fs.existsSync(ATTACH_DIR)) fs.mkdirSync(ATTACH_DIR, { recursive: true });

const _upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ATTACH_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','application/pdf'];
    cb(null, ok.includes(file.mimetype));
  },
}).single('file');

const uploadAttachment = (req, res) => {
  _upload(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || 'Upload gagal' });
    if (!req.file) return res.status(400).json({ success: false, message: 'File tidak ditemukan' });
    res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        fileUrl: `/uploads/rfp-attachments/${req.file.filename}`,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });
  });
};

const RFP_CATEGORIES = ['SALTAB_EVENT', 'CLAIM_REIMBURSEMENT', 'CASH_ADVANCE', 'SUPPORT_BUDGET', 'OTHERS'];
const RFP_STATUS = ['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED'];

const getAll = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { project: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [requests, total] = await Promise.all([
      prisma.expenseRequest.findMany({
        where,
        include: { items: true, attachments: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.expenseRequest.count({ where }),
    ]);
    res.json({ success: true, data: requests, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOne = async (req, res) => {
  try {
    const rfp = await prisma.expenseRequest.findUnique({
      where: { id: req.params.id },
      include: { items: true, attachments: true },
    });
    if (!rfp) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });
    res.json({ success: true, data: rfp });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// helper: save attachment records after RFP created
async function saveAttachments(requestId, attachments) {
  if (!attachments || !attachments.length) return;
  const valid = attachments.filter(a => a.fileUrl && a.fileName);
  if (valid.length) {
    await prisma.expenseRequestAttachment.createMany({
      data: valid.map(a => ({
        requestId,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        mimeType: a.mimeType || 'application/octet-stream',
        fileSize: a.fileSize ? Number(a.fileSize) : null,
      })),
    });
  }
}

// PUBLIC - no auth required, but requires valid one-time token
const create = async (req, res) => {
  try {
    const { date, dueDate, detailsOfPayment, project, description, name, email, beneficiary, bankNorek, rfpCategory, items, notes, formToken, attachments } = req.body;

    // Validate one-time token
    if (!formToken) {
      return res.status(401).json({ success: false, message: 'Link tidak valid atau sudah digunakan' });
    }
    const ft = await prisma.formToken.findUnique({ where: { token: formToken } });
    if (!ft) return res.status(404).json({ success: false, message: 'Link tidak valid' });
    if (ft.usedAt) return res.status(410).json({ success: false, message: 'Link ini sudah pernah digunakan', used: true });

    console.log('[RFP submit] items received:', JSON.stringify(items));
    if (!name || !date || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Nama, tanggal, dan minimal 1 item wajib diisi' });
    }
    const validItems = items.filter(i => i.description && i.amount > 0);
    console.log('[RFP submit] validItems after filter:', JSON.stringify(validItems));
    if (validItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Minimal 1 item dengan jumlah harus diisi' });
    }

    const number = await generateRfpNumber('RFP');
    const rfp = await prisma.expenseRequest.create({
      data: {
        number, date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        detailsOfPayment: detailsOfPayment || null,
        project: project || null,
        description: description || null,
        name, email: email || null,
        beneficiary: beneficiary || null,
        bankNorek: bankNorek || null,
        rfpCategory: rfpCategory || 'OTHERS',
        notes: notes || null,
        items: { create: validItems.map(i => ({ description: i.description, amount: Number(i.amount) })) },
      },
      include: { items: true },
    });

    // Mark token as used
    await prisma.formToken.update({ where: { token: formToken }, data: { usedAt: new Date() } });

    // Save attachments
    await saveAttachments(rfp.id, attachments);

    res.status(201).json({ success: true, data: rfp, message: `Request berhasil dikirim! No: ${rfp.number}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!RFP_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid' });
    }
    const rfp = await prisma.expenseRequest.update({
      where: { id: req.params.id },
      data: { status, notes: notes !== undefined ? notes : undefined },
      include: { items: true },
    });
    await logActivity(req.user.id, `Update Status RFP → ${status}`, 'RFP', rfp.id, rfp.number);

    // Send email notification if status is APPROVED, VERIFIED, or REJECTED
    if (['APPROVED', 'VERIFIED', 'REJECTED'].includes(status) && rfp.email) {
      const company = await prisma.companySetting.findFirst();
      sendRfpStatusEmail(rfp, status, notes, company).catch(e => console.error('[Email]', e));
    }

    res.json({ success: true, data: rfp });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const rfp = await prisma.expenseRequest.findUnique({ where: { id: req.params.id } });
    await prisma.expenseRequest.delete({ where: { id: req.params.id } });
    if (req.user) await logActivity(req.user.id, 'Hapus RFP', 'RFP', req.params.id, rfp?.number);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const generatePdf = async (req, res) => {
  try {
    const rfp = await prisma.expenseRequest.findUnique({
      where: { id: req.params.id },
      include: { items: true, attachments: true },
    });
    if (!rfp) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });

    const company = await prisma.companySetting.findFirst();
    const { signatureIds } = req.body;

    let signaturesData = [null, null, null, null];
    if (signatureIds && Array.isArray(signatureIds)) {
      for (let i = 0; i < 4; i++) {
        const sid = signatureIds[i];
        if (sid) {
          try { signaturesData[i] = await prisma.signature.findUnique({ where: { id: sid } }); } catch (e) {}
        }
      }
    }

    const pdfBuffer = await generateRfpPdf(rfp, company, signaturesData, rfp.attachments || []);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RFP-${rfp.number.replace(/\//g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Gagal generate PDF' });
  }
};

// AUTHENTICATED - employee submits their own RFP (no token needed)
const submitAuthenticated = async (req, res) => {
  try {
    const { date, dueDate, detailsOfPayment, project, description, beneficiary, bankNorek, rfpCategory, items, notes, attachments } = req.body;

    if (!date || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Tanggal dan minimal 1 item wajib diisi' });
    }
    const validItems = items.filter(i => i.description && Number(i.amount) > 0);
    if (validItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Minimal 1 item dengan jumlah harus diisi' });
    }

    const number = await generateRfpNumber('RFP');
    const rfp = await prisma.expenseRequest.create({
      data: {
        number,
        date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        detailsOfPayment: detailsOfPayment || null,
        project: project || null,
        description: description || null,
        name: req.user.name,
        email: req.user.email,
        beneficiary: beneficiary || null,
        bankNorek: bankNorek || null,
        rfpCategory: rfpCategory || 'OTHERS',
        notes: notes || null,
        submittedByUserId: req.user.id,
        items: { create: validItems.map(i => ({ description: i.description, amount: Number(i.amount) })) },
      },
      include: { items: true },
    });

    await saveAttachments(rfp.id, attachments);
    await logActivity(req.user.id, 'Submit RFP', 'RFP', rfp.id, rfp.number);
    res.status(201).json({ success: true, data: rfp, message: `Request berhasil dikirim! No: ${rfp.number}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// AUTHENTICATED - employee views their own submissions
const mySubmissions = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const where = { submittedByUserId: req.user.id };
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.expenseRequest.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.expenseRequest.count({ where }),
    ]);
    res.json({ success: true, data: requests, total });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ADMIN - update transfer info (beneficiary + bank norek) before approve
const updateTransferInfo = async (req, res) => {
  try {
    const { beneficiary, bankNorek } = req.body;
    const rfp = await prisma.expenseRequest.update({
      where: { id: req.params.id },
      data: {
        beneficiary: beneficiary !== undefined ? (beneficiary || null) : undefined,
        bankNorek: bankNorek !== undefined ? (bankNorek || null) : undefined,
      },
      include: { items: true, attachments: true },
    });
    res.json({ success: true, data: rfp });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ADMIN - send RFP to boss for approval
const sendToBoss = async (req, res) => {
  try {
    const { bossEmail, bossName } = req.body;
    if (!bossEmail) return res.status(400).json({ success: false, message: 'Email atasan wajib diisi' });

    const rfp = await prisma.expenseRequest.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!rfp) return res.status(404).json({ success: false, message: 'RFP tidak ditemukan' });

    // Create or update boss approval record
    const bossApproval = await prisma.bossApproval.create({
      data: {
        rfpId: rfp.id,
        bossEmail,
        bossName: bossName || null,
        status: 'PENDING',
        sentAt: new Date(),
      },
    });

    const company = await prisma.companySetting.findFirst();
    const frontendUrl = process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'http://localhost:3000';
    const approvalUrl = `${frontendUrl}/approval/${bossApproval.token}`;

    sendBossApprovalEmail(rfp, bossApproval, approvalUrl, company).catch(e => console.error('[Email]', e));
    await logActivity(req.user.id, `Kirim RFP ke Atasan (${bossEmail})`, 'RFP', rfp.id, rfp.number);

    res.json({ success: true, data: bossApproval, message: `Email persetujuan dikirim ke ${bossEmail}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUBLIC - boss views RFP details via approval token
const getBossApproval = async (req, res) => {
  try {
    const bossApproval = await prisma.bossApproval.findUnique({
      where: { token: req.params.token },
      include: {
        rfp: {
          include: { items: true },
        },
      },
    });
    if (!bossApproval) return res.status(404).json({ success: false, message: 'Link tidak valid' });
    res.json({ success: true, data: bossApproval });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUBLIC - boss decides (approve/reject)
const bossDecide = async (req, res) => {
  try {
    const { action, notes } = req.body; // action: 'APPROVED' | 'REJECTED'
    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action tidak valid' });
    }

    const bossApproval = await prisma.bossApproval.findUnique({
      where: { token: req.params.token },
      include: { rfp: { include: { items: true } } },
    });
    if (!bossApproval) return res.status(404).json({ success: false, message: 'Link tidak valid' });
    if (bossApproval.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'Pengajuan ini sudah diputuskan sebelumnya', status: bossApproval.status });
    }

    // Update boss approval + RFP status in transaction
    const [updatedApproval, updatedRfp] = await prisma.$transaction([
      prisma.bossApproval.update({
        where: { token: req.params.token },
        data: { status: action, notes: notes || null, decidedAt: new Date() },
      }),
      prisma.expenseRequest.update({
        where: { id: bossApproval.rfpId },
        data: { status: action === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
        include: { items: true },
      }),
    ]);

    // Notify requester
    if (updatedRfp.email) {
      const company = await prisma.companySetting.findFirst();
      sendRfpStatusEmail(updatedRfp, action, notes, company).catch(e => console.error('[Email]', e));
    }

    res.json({ success: true, data: updatedApproval, rfp: updatedRfp });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, getOne, create, updateStatus, remove, generatePdf, submitAuthenticated, mySubmissions, uploadAttachment, updateTransferInfo, sendToBoss, getBossApproval, bossDecide };
