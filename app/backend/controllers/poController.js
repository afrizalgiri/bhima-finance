const { generatePoNumber } = require('../utils/numberGenerator');
const { generatePoPdf } = require('../services/pdfService');
const { logActivity } = require('../utils/activityLog');
const prisma = require('../lib/prisma');

const PO_STATUS = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'COMPLETED'];

const getAll = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { supplier: { contains: search, mode: 'insensitive' } },
        { project: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [pos, total] = await Promise.all([
      prisma.po.findMany({
        where,
        include: { items: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.po.count({ where }),
    ]);
    res.json({ success: true, data: pos, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOne = async (req, res) => {
  try {
    const po = await prisma.po.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!po) return res.status(404).json({ success: false, message: 'PO tidak ditemukan' });
    res.json({ success: true, data: po });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    const {
      number: providedNumber, date, dueDate, supplier, supplierAddress, supplierPhone, supplierEmail,
      attention, project, description, items, taxRate = 0, notes, paymentTerms, headerColor,
    } = req.body;

    if (!supplier || !date || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Supplier, tanggal, dan minimal 1 item wajib diisi' });
    }
    const validItems = items.filter(i => i.name && Number(i.price) >= 0);
    if (validItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Minimal 1 item valid' });
    }

    const company = await prisma.companySetting.findFirst();
    const number = providedNumber || await generatePoNumber(company?.docPrefixPo || 'PO');
    const subtotal = validItems.reduce((s, i) => s + Number(i.quantity) * Number(i.price), 0);
    const taxAmt = subtotal * (Number(taxRate) / 100);
    const total = subtotal + taxAmt;

    const po = await prisma.po.create({
      data: {
        number, date: new Date(date),
        dueDate: dueDate ? new Date(dueDate) : null,
        supplier, supplierAddress: supplierAddress || null,
        supplierPhone: supplierPhone || null, supplierEmail: supplierEmail || null,
        attention: attention || null, project: project || null,
        description: description || null,
        subtotal, taxRate: Number(taxRate), taxAmount: taxAmt, total,
        notes: notes || null, paymentTerms: paymentTerms || null,
        headerColor: headerColor || null,
        items: {
          create: validItems.map((i, idx) => ({
            name: i.name,
            description: i.description || null,
            quantity: Number(i.quantity) || 1,
            unit: i.unit || 'pcs',
            price: Number(i.price),
            total: Number(i.quantity) * Number(i.price),
            sortOrder: idx,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    await logActivity(req.user.id, 'Membuat PO', 'PO', po.id, po.number);
    res.status(201).json({ success: true, data: po });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const update = async (req, res) => {
  try {
    const {
      number, date, dueDate, supplier, supplierAddress, supplierPhone, supplierEmail,
      attention, project, description, items, taxRate, notes, paymentTerms, status, headerColor,
    } = req.body;

    let updateData: any = {
      number: number || undefined,
      date: date ? new Date(date) : undefined,
      dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      supplier: supplier || undefined,
      supplierAddress: supplierAddress !== undefined ? (supplierAddress || null) : undefined,
      supplierPhone: supplierPhone !== undefined ? (supplierPhone || null) : undefined,
      supplierEmail: supplierEmail !== undefined ? (supplierEmail || null) : undefined,
      attention: attention !== undefined ? (attention || null) : undefined,
      project: project !== undefined ? (project || null) : undefined,
      description: description !== undefined ? (description || null) : undefined,
      notes: notes !== undefined ? (notes || null) : undefined,
      paymentTerms: paymentTerms !== undefined ? (paymentTerms || null) : undefined,
      status: status || undefined,
      headerColor: headerColor !== undefined ? (headerColor || null) : undefined,
    };

    if (items && items.length > 0) {
      const validItems = items.filter(i => i.name);
      const subtotal = validItems.reduce((s, i) => s + Number(i.quantity) * Number(i.price), 0);
      const rate = taxRate !== undefined ? Number(taxRate) : 0;
      const taxAmt = subtotal * (rate / 100);
      updateData = { ...updateData, subtotal, taxRate: rate, taxAmount: taxAmt, total: subtotal + taxAmt };

      await prisma.poItem.deleteMany({ where: { poId: req.params.id } });
      await prisma.poItem.createMany({
        data: validItems.map((i, idx) => ({
          poId: req.params.id,
          name: i.name,
          description: i.description || null,
          quantity: Number(i.quantity) || 1,
          unit: i.unit || 'pcs',
          price: Number(i.price),
          total: Number(i.quantity) * Number(i.price),
          sortOrder: idx,
        })),
      });
    }

    const po = await prisma.po.update({
      where: { id: req.params.id },
      data: updateData,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    await logActivity(req.user.id, 'Update PO', 'PO', po.id, po.number);
    res.json({ success: true, data: po });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const po = await prisma.po.findUnique({ where: { id: req.params.id } });
    await prisma.po.delete({ where: { id: req.params.id } });
    if (req.user) await logActivity(req.user.id, 'Hapus PO', 'PO', req.params.id, po?.number);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const generatePdf = async (req, res) => {
  try {
    const po = await prisma.po.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!po) return res.status(404).json({ success: false, message: 'PO tidak ditemukan' });

    const company = await prisma.companySetting.findFirst();
    const { signatureIds } = req.body;

    let signaturesData = [null, null];
    if (signatureIds && Array.isArray(signatureIds)) {
      for (let i = 0; i < 2; i++) {
        const sid = signatureIds[i];
        if (sid) {
          try { signaturesData[i] = await prisma.signature.findUnique({ where: { id: sid } }); } catch (e) {}
        }
      }
    }

    const pdfBuffer = await generatePoPdf(po, company, signaturesData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PO-${po.number.replace(/\//g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Gagal generate PDF' });
  }
};

module.exports = { getAll, getOne, create, update, remove, generatePdf };
