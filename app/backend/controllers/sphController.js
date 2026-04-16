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
        include: { client: { select: { id: true, name: true } }, items: { orderBy: { sortOrder: 'asc' } } },
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
      include: { client: true, items: { include: { product: true }, orderBy: { sortOrder: 'asc' } }, signature: true },
    });
    if (!sph) return res.status(404).json({ success: false, message: 'SPH not found' });
    res.json({ success: true, data: sph });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

function buildItemData(item, idx) {
  const price = item.price == null || item.price === '' ? null : Number(item.price);
  const perVal = item.perValue == null || item.perValue === '' ? null : Number(item.perValue);
  const itemTotal = price == null ? null : item.quantity * (perVal || 1) * price;
  return {
    productId: item.productId || null,
    name: item.name,
    description: item.description || null,
    quantity: item.quantity,
    unit: item.unit || 'pcs',
    price,
    total: itemTotal,
    sectionKey: item.sectionKey || 'main',
    nomor: item.nomor || null,
    sortOrder: item.sortOrder != null ? item.sortOrder : idx,
    perValue: perVal,
  };
}

function calcSubtotal(items) {
  return items.reduce((sum, item) => {
    const price = item.price == null ? 0 : Number(item.price);
    const perVal = item.perValue == null || item.perValue === '' ? 1 : Number(item.perValue);
    return sum + item.quantity * perVal * price;
  }, 0);
}

const create = async (req, res) => {
  try {
    const { clientId, date, validUntil, items, taxRate = 0, notes, openingText, closingText, headerColor, signerTitle, signatureId, total: providedTotal, sectionsConfig } = req.body;

    if (!clientId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Client and items required' });
    }

    const company = await prisma.companySetting.findFirst();
    const number = await generateSphNumber(company?.docPrefixSph || 'SPH');
    const subtotal = calcSubtotal(items);
    const taxAmount = subtotal * (taxRate / 100);
    const total = (providedTotal != null && providedTotal !== '') ? Number(providedTotal) : subtotal + taxAmount;

    const sph = await prisma.sph.create({
      data: {
        number, date: new Date(date), validUntil: validUntil ? new Date(validUntil) : null,
        clientId, subtotal, taxRate, taxAmount, total, notes,
        openingText: openingText || null, closingText: closingText || null,
        headerColor: headerColor || null, signerTitle: signerTitle || null,
        signatureId: signatureId || null,
        sectionsConfig: sectionsConfig || null,
        items: {
          create: items.map((item, idx) => buildItemData(item, idx)),
        },
      },
      include: { client: true, items: { orderBy: { sortOrder: 'asc' } }, signature: true },
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
    const { number, clientId, date, validUntil, items, taxRate = 0, notes, status, openingText, closingText, headerColor, signerTitle, signatureId, sectionsConfig } = req.body;

    let updateData = {
      status, notes,
      number: number || undefined,
      date: date ? new Date(date) : undefined,
      validUntil: validUntil ? new Date(validUntil) : null,
      openingText: openingText ?? undefined,
      closingText: closingText ?? undefined,
      headerColor: headerColor ?? undefined,
      signerTitle: signerTitle ?? undefined,
      signatureId: signatureId !== undefined ? (signatureId || null) : undefined,
      sectionsConfig: sectionsConfig !== undefined ? (sectionsConfig || null) : undefined,
    };

    if (items && items.length > 0) {
      const subtotal = calcSubtotal(items);
      const taxAmount = subtotal * (taxRate / 100);
      const providedTotal = req.body.total;
      const total = (providedTotal != null && providedTotal !== '') ? Number(providedTotal) : subtotal + taxAmount;
      updateData = { ...updateData, clientId, subtotal, taxRate, taxAmount, total };

      await prisma.sphItem.deleteMany({ where: { sphId: req.params.id } });
      await prisma.sphItem.createMany({
        data: items.map((item, idx) => ({ sphId: req.params.id, ...buildItemData(item, idx) })),
      });
    }

    const sph = await prisma.sph.update({
      where: { id: req.params.id },
      data: updateData,
      include: { client: true, items: { orderBy: { sortOrder: 'asc' } }, signature: true },
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
    const [sph, lampiranRows] = await Promise.all([
      prisma.sph.findUnique({
        where: { id: req.params.id },
        include: { client: true, items: { include: { product: true }, orderBy: { sortOrder: 'asc' } }, signature: true },
      }),
      prisma.dokumenLampiran.findMany({
        where: { dokumenType: 'sph', dokumenId: req.params.id },
        include: { lampiran: { select: { id: true, nama: true, fileName: true, tipe: true } } },
        orderBy: { urutan: 'asc' },
      }),
    ]);
    if (!sph) return res.status(404).json({ success: false, message: 'SPH not found' });

    const company = await prisma.companySetting.findFirst();
    const sphWithLampiran = { ...sph, lampiran: lampiranRows };
    const pdfBuffer = await generateSphPdf(sphWithLampiran, company, company?.docNameSph || 'Surat Penawaran Harga');

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
