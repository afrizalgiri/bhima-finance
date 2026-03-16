const prisma = require('../lib/prisma');
const crypto = require('crypto');

// Generate random URL-safe token
const makeToken = () => crypto.randomBytes(10).toString('hex'); // 20 chars

const getAll = async (req, res) => {
  try {
    const tokens = await prisma.formToken.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: tokens });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    const { label } = req.body;
    const token = await prisma.formToken.create({
      data: { token: makeToken(), label: label || null, createdById: req.user.id },
    });
    res.status(201).json({ success: true, data: token });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    await prisma.formToken.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUBLIC — validate token before showing form
const validate = async (req, res) => {
  try {
    const ft = await prisma.formToken.findUnique({ where: { token: req.params.token } });
    if (!ft) return res.status(404).json({ success: false, message: 'Link tidak valid' });
    if (ft.usedAt) return res.status(410).json({ success: false, message: 'Link ini sudah digunakan', used: true });
    res.json({ success: true, label: ft.label });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, create, remove, validate };
