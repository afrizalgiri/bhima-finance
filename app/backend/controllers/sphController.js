const { generateSphNumber } = require('../utils/numberGenerator');
const { generateSphPdf } = require('../services/pdfService');
const { logActivity } = require('../utils/activityLog');
const prisma = require('../lib/prisma');

const getAll = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [sphs, total] = await Promise.all([
      prisma.sph.findMany({
        where,
        include: { client: { select: { id: true, name: true } }, items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.sph.count({ where }),
    ]);
    res.json({ success: true, data: sphs, total });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOne = async (req, res) => {
  try {
    const sph = await prisma.sph.findUnique({
      where: { id: req.params.id },
      include: { client: true, items: { include: { product: true } } },
    });
    if (!sph) return res.status(404).json({ success: false, message: 'SPH not found' });
    res.json({ success: true, data: sph });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    const { clientId, date, validUntil, items, taxRate = 0, notes, openingText, closingText, headerColor, signerTitle } = req.body;

    if (!clientId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Client and items required' });
    }

    const company = await prisma.companySetting.findFirst();
    const number = await generateSphNumber(company?.docPrefixSph || 'SPH');
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const sph = await prisma.sph.create({
      data: {
        number, date: new Date(date), validUntil: validUntil ? new Date(validUntil) : null,
        clientId, subtotal, taxRate, taxAmount, total, notes,
        openingText: openingText || null, closingText: closingText || null,
        headerColor: headerColor || null, signerTitle: signerTitle || null,
        items: {
          create: items.map(item => ({
            productId: item.productId || null, name: item.name,
            description: item.description || null, quantity: item.quantity,
            unit: item.unit || 'pcs', price: item.price, total: item.quantity * item.price,
          })),
        },
      },
      include: { client: true, items: true },
    });

    await logActivity(req.user.id, 'Membuat SPH', 'SPH', sph.id, `${sph.number} untuk ${sph.client.name}`);
    res.status(201).json({ success: true, data: sph });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const update = async (req, res) => {
  try {
    const { clientId, date, validUntil, items, taxRate = 0, notes, status, openingText, closingText, headerColor, signerTitle } = req.body;

    let updateData = { status, notes, date: date ? new Date(date) : undefined, validUntil: validUntil ? new Date(validUntil) : null, openingText: openingText ?? undefined, closingText: closingText ?? undefined, headerColor: headerColor ?? undefined, signerTitle: signerTitle ?? undefined };

    if (items && items.length > 0) {
      const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;
      updateData = { ...updateData, clientId, subtotal, taxRate, taxAmount, total };

      await prisma.sphItem.deleteMany({ where: { sphId: req.params.id } });
      await prisma.sphItem.createMany({
        data: items.map(item => ({
          sphId: req.params.id, productId: item.productId || null, name: item.name,
          description: item.description || null, quantity: item.quantity,
          unit: item.unit || 'pcs', price: item.price, total: item.quantity * item.price,
        })),
      });
    }

    const sph = await prisma.sph.update({
      where: { id: req.params.id },
      data: updateData,
      include: { client: true, items: true },
    });

    await logActivity(req.user.id, 'Mengupdate SPH', 'SPH', sph.id, `${sph.number}`);
    res.json({ success: true, data: sph });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const sph = await prisma.sph.findUnique({ where: { id: req.params.id }, include: { client: true } });
    await prisma.sph.delete({ where: { id: req.params.id } });
    await logActivity(req.user.id, 'Menghapus SPH', 'SPH', req.params.id, sph ? `${sph.number}` : req.params.id);
    res.json({ success: true, message: 'SPH deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const generatePdf = async (req, res) => {
  try {
    const sph = await prisma.sph.findUnique({
      where: { id: req.params.id },
      include: { client: true, items: { include: { product: true } } },
    });
    if (!sph) return res.status(404).json({ success: false, message: 'SPH not found' });

    const company = await prisma.companySetting.findFirst();
    const pdfBuffer = await generateSphPdf(sph, company, company?.docNameSph || 'Surat Penawaran Harga');

    const prefix = company?.docPrefixSph || 'SPH';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${prefix}-${sph.number.replace(/\//g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
};

module.exports = { getAll, getOne, create, update, remove, generatePdf };
