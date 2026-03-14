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

module.exports = { getSettings, updateSettings, uploadLogo };
