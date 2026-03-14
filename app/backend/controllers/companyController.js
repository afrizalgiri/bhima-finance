const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

const getSettings = async (req, res) => {
  try {
    const company = await prisma.companySetting.findFirst();
    res.json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const existing = await prisma.companySetting.findFirst();
    const data = { ...req.body };
    delete data.id;
    delete data.logoUrl;

    let company;
    if (existing) {
      company = await prisma.companySetting.update({ where: { id: existing.id }, data });
    } else {
      company = await prisma.companySetting.create({ data: { id: 'default', ...data } });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    const existing = await prisma.companySetting.findFirst();

    if (existing) {
      await prisma.companySetting.update({ where: { id: existing.id }, data: { logoUrl } });
    } else {
      await prisma.companySetting.create({ data: { id: 'default', name: 'Company', address: '', email: '', phone: '', logoUrl } });
    }

    res.json({ success: true, logoUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const exportBackup = async (req, res) => {
  try {
    const [company, clients, products, sphs, invoices, payments, expenses] = await Promise.all([
      prisma.companySetting.findFirst(),
      prisma.client.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.product.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.sPH.findMany({ include: { client: true, items: true }, orderBy: { createdAt: 'asc' } }),
      prisma.invoice.findMany({ include: { client: true, items: true }, orderBy: { createdAt: 'asc' } }),
      prisma.payment.findMany({ include: { invoice: { include: { client: true } } }, orderBy: { createdAt: 'asc' } }),
      prisma.expense.findMany({ orderBy: { date: 'asc' } }),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      data: { company, clients, products, sphs, invoices, payments, expenses },
    };

    const filename = `bhima-finance-backup-${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(backup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSettings, updateSettings, uploadLogo, exportBackup };
