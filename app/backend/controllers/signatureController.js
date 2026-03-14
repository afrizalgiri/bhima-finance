const prisma = require('../lib/prisma');
const path = require('path');
const fs = require('fs');

const getAll = async (req, res) => {
  try {
    const signatures = await prisma.signature.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: signatures });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File gambar TTD wajib diupload' });
    const { name, title } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
    const imageUrl = `/uploads/signatures/${req.file.filename}`;
    const sig = await prisma.signature.create({ data: { name, title: title || null, imageUrl } });
    res.status(201).json({ success: true, data: sig });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const sig = await prisma.signature.findUnique({ where: { id: req.params.id } });
    if (!sig) return res.status(404).json({ success: false, message: 'TTD tidak ditemukan' });
    const filePath = path.join(__dirname, '..', sig.imageUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.signature.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, create, remove };
