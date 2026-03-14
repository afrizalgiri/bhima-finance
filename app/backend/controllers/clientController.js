const { validationResult } = require('express-validator');
const { logActivity } = require('../utils/activityLog');
const prisma = require('../lib/prisma');

const getAll = async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const where = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { pic: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.client.count({ where }),
    ]);
    res.json({ success: true, data: clients, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOne = async (req, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const client = await prisma.client.create({ data: req.body });
    await logActivity(req.user.id, 'Menambah Klien', 'Klien', client.id, client.name);
    res.status(201).json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const client = await prisma.client.update({ where: { id: req.params.id }, data: req.body });
    await logActivity(req.user.id, 'Mengupdate Klien', 'Klien', client.id, client.name);
    res.json({ success: true, data: client });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    await prisma.client.update({ where: { id: req.params.id }, data: { isActive: false } });
    await logActivity(req.user.id, 'Menonaktifkan Klien', 'Klien', req.params.id, client ? client.name : null);
    res.json({ success: true, message: 'Client deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, getOne, create, update, remove };
