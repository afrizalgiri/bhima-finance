const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const listUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: users });
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
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    res.status(201).json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  // Non-admin hanya bisa edit dirinya sendiri, dan hanya name/email
  if (req.user.role !== 'ADMIN' && req.user.id !== id) {
    return res.status(403).json({ success: false, message: 'Tidak diizinkan' });
  }
  const { name, email, role, isActive } = req.body;
  try {
    const data = { name, email };
    // Hanya admin yang bisa ubah role dan status
    if (req.user.role === 'ADMIN') {
      if (role) data.role = role;
      if (typeof isActive === 'boolean') data.isActive = isActive;
    }
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    res.json({ success: true, data: user });
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

module.exports = { listUsers, createUser, updateUser, resetPassword, deleteUser };
