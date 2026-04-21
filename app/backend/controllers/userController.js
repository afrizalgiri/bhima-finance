const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { sendWelcomeEmail } = require('../services/emailService');

const userSelect = { id: true, name: true, email: true, role: true, isActive: true, canViewHistory: true, canViewSalary: true, featureAccess: true, createdAt: true };

function parseFeatureAccess(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function serializeUser(u) {
  return { ...u, featureAccess: parseFeatureAccess(u.featureAccess) };
}

const listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'asc' } });
    res.json({ success: true, data: users.map(serializeUser) });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi' });
  }
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: role || 'STAFF' },
      select: userSelect,
    });
    // Send welcome email with credentials (non-blocking)
    sendWelcomeEmail({ name, email }, password).catch(() => {});
    res.status(201).json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== 'ADMIN' && req.user.id !== id) {
    return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
  }
  const { name, email, role, isActive } = req.body;
  try {
    const data = { name, email };
    if (req.user.role === 'ADMIN') {
      if (role) data.role = role;
      if (typeof isActive === 'boolean') data.isActive = isActive;
    }
    const user = await prisma.user.update({ where: { id }, data, select: userSelect });
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updatePermissions = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  const { id } = req.params;
  const { canViewHistory, canViewSalary, featureAccess } = req.body;
  try {
    const data = {};
    if (typeof canViewHistory === 'boolean') data.canViewHistory = canViewHistory;
    if (typeof canViewSalary === 'boolean') data.canViewSalary = canViewSalary;
    if (Array.isArray(featureAccess)) {
      data.featureAccess = JSON.stringify(featureAccess);
      // sync legacy flags for backward compat
      data.canViewHistory = featureAccess.includes('history');
      data.canViewSalary = featureAccess.includes('payroll');
    }
    const user = await prisma.user.update({ where: { id }, data, select: userSelect });
    res.json({ success: true, data: serializeUser(user) });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
  }
  try {
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hashed } });
    res.json({ success: true, message: 'Password berhasil direset' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (req.user.id === id) {
    return res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun sendiri' });
  }
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User dihapus' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listUsers, createUser, updateUser, updatePermissions, resetPassword, deleteUser };
