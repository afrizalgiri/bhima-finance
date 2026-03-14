const { generateInvoiceNumber } = require('../utils/numberGenerator');
const { generateInvoicePdf } = require('../services/pdfService');
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
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { client: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.invoice.count({ where }),
    ]);
    res.json({ success: true, data: invoices, total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOne = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { client: true, items: { include: { product: true } }, payments: true, signature: true },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    const { clientId, date, dueDate, items, taxRate = 0, notes, openingText, closingText, headerColor, signatureId } = req.body;

    if (!clientId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Client and items required' });
    }

    const company = await prisma.companySetting.findFirst();
    const number = await generateInvoiceNumber(company?.docPrefixInvoice || 'INV');
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        number, date: new Date(date), dueDate: new Date(dueDate),
        clientId, subtotal, taxRate, taxAmount, total, notes,
        openingText: openingText || null, closingText: closingText || null,
        headerColor: headerColor || null,
        signatureId: signatureId || null,
        items: {
          create: items.map(item => ({
            productId: item.productId || null, name: item.name,
            description: item.description || null, quantity: item.quantity,
            unit: item.unit || 'pcs', price: item.price, total: item.quantity * item.price,
          })),
        },
      },
      include: { client: true, items: true, signature: true },
    });

    await logActivity(req.user.id, 'Membuat Invoice', 'Invoice', invoice.id, `${invoice.number} untuk ${invoice.client.name}`);
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const update = async (req, res) => {
  try {
    const { clientId, date, dueDate, items, taxRate = 0, notes, status, openingText, closingText, headerColor, signatureId } = req.body;

    let updateData = {
      status, notes,
      date: date ? new Date(date) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      openingText: openingText ?? undefined,
      closingText: closingText ?? undefined,
      headerColor: headerColor ?? undefined,
      signatureId: signatureId !== undefined ? (signatureId || null) : undefined,
    };

    if (items && items.length > 0) {
      const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;
      updateData = { ...updateData, clientId, subtotal, taxRate, taxAmount, total };

      await prisma.invoiceItem.deleteMany({ where: { invoiceId: req.params.id } });
      await prisma.invoiceItem.createMany({
        data: items.map(item => ({
          invoiceId: req.params.id, productId: item.productId || null, name: item.name,
          description: item.description || null, quantity: item.quantity,
          unit: item.unit || 'pcs', price: item.price, total: item.quantity * item.price,
        })),
      });
    }

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: updateData,
      include: { client: true, items: true, signature: true },
    });

    await logActivity(req.user.id, 'Mengupdate Invoice', 'Invoice', invoice.id, `${invoice.number}`);
    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    await prisma.invoice.delete({ where: { id: req.params.id } });
    await logActivity(req.user.id, 'Menghapus Invoice', 'Invoice', req.params.id, invoice ? `${invoice.number}` : req.params.id);
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const generatePdf = async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { client: true, items: { include: { product: true } }, payments: true, signature: true },
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const company = await prisma.companySetting.findFirst();
    const pdfBuffer = await generateInvoicePdf(invoice, company, company?.docNameInvoice || 'INVOICE');

    const prefix = company?.docPrefixInvoice || 'INV';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${prefix}-${invoice.number.replace(/\//g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to generate PDF' });
  }
};

module.exports = { getAll, getOne, create, update, remove, generatePdf };
