const { validationResult } = require('express-validator');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');

const updateInvoiceStatus = async (invoiceId) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  const paidAmount = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  let status = 'UNPAID';
  if (paidAmount >= Number(invoice.total)) status = 'PAID';
  else if (paidAmount > 0) status = 'PARTIAL';

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount, status },
  });
};

const getAll = async (req, res) => {
  try {
    const { invoiceId } = req.query;
    const where = invoiceId ? { invoiceId } : {};
    const payments = await prisma.payment.findMany({
      where,
      include: { invoice: { include: { client: { select: { name: true } } } } },
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const { invoiceId, amount, date, method, reference, notes } = req.body;

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const payment = await prisma.payment.create({
      data: { invoiceId, amount, date: new Date(date), method: method || 'TRANSFER', reference, notes },
    });

    await updateInvoiceStatus(invoiceId);
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    await prisma.payment.delete({ where: { id: req.params.id } });
    await updateInvoiceStatus(payment.invoiceId);
    res.json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, create, remove };
