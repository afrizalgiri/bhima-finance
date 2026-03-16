const { generateRfpPdf } = require('../services/pdfService');
const { generateRfpNumber } = require('../utils/numberGenerator');
const { logActivity } = require('../utils/activityLog');
const prisma = require('../lib/prisma');

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
        include: { items: true },
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
      include: { items: true },
    });
    if (!rfp) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });
    res.json({ success: true, data: rfp });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUBLIC - no auth required
const create = async (req, res) => {
  try {
    const { date, dueDate, detailsOfPayment, project, description, name, beneficiary, bankNorek, rfpCategory, items, notes } = req.body;
    if (!name || !date || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Nama, tanggal, dan minimal 1 item wajib diisi' });
    }
    const validItems = items.filter(i => i.description && i.amount > 0);
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
        name, beneficiary: beneficiary || null,
        bankNorek: bankNorek || null,
        rfpCategory: rfpCategory || 'OTHERS',
        notes: notes || null,
        items: { create: validItems.map(i => ({ description: i.description, amount: Number(i.amount) })) },
      },
      include: { items: true },
    });
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
      include: { items: true },
    });
    if (!rfp) return res.status(404).json({ success: false, message: 'Tidak ditemukan' });

    const company = await prisma.companySetting.findFirst();
    const { signatureIds } = req.body;

    // Fetch 4 signatures [prepared, verified, sm_finance, approved]
    let signaturesData = [null, null, null, null];
    if (signatureIds && Array.isArray(signatureIds)) {
      for (let i = 0; i < 4; i++) {
        const sid = signatureIds[i];
        if (sid) {
          try { signaturesData[i] = await prisma.signature.findUnique({ where: { id: sid } }); } catch (e) {}
        }
      }
    }

    const pdfBuffer = await generateRfpPdf(rfp, company, signaturesData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RFP-${rfp.number.replace(/\//g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Gagal generate PDF' });
  }
};

module.exports = { getAll, getOne, create, updateStatus, remove, generatePdf };
