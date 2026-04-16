const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const prisma = require('../lib/prisma');
const { sendOtpEmail } = require('../services/emailService');

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }

    // Delete any existing OTPs for this user
    await prisma.otp.deleteMany({ where: { userId: user.id } });

    // Generate and save OTP (expires in 5 minutes)
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.otp.create({ data: { userId: user.id, code, expiresAt } });

    // Send OTP email (fire-and-forget)
    sendOtpEmail(user, code).catch(() => {});

    // Issue a short-lived temp token for OTP verification
    const tempToken = jwt.sign(
      { userId: user.id, purpose: 'otp' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({ success: true, status: 'otp_required', tempToken });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const verifyOtp = async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ success: false, message: 'Token dan kode OTP wajib diisi' });
  }

  try {
    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Sesi verifikasi tidak valid atau sudah kedaluwarsa. Silakan login ulang.' });
    }

    if (payload.purpose !== 'otp') {
      return res.status(401).json({ success: false, message: 'Token tidak valid' });
    }

    const { userId } = payload;

    // Find valid, unused, unexpired OTP
    const otp = await prisma.otp.findFirst({
      where: { userId, code, used: false, expiresAt: { gt: new Date() } },
    });

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Kode OTP tidak valid atau sudah kedaluwarsa' });
    }

    // Clean up all OTPs for this user
    await prisma.otp.deleteMany({ where: { userId } });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isActive: true, canViewHistory: true, canViewSalary: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Akun tidak aktif' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, canViewHistory: user.canViewHistory, canViewSalary: user.canViewSalary },
    });
  } catch (error) {
    console.error('[Auth] verifyOtp error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const resendOtp = async (req, res) => {
  const { tempToken } = req.body;
  if (!tempToken) {
    return res.status(400).json({ success: false, message: 'Token wajib diisi' });
  }

  try {
    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Sesi verifikasi tidak valid. Silakan login ulang.' });
    }

    if (payload.purpose !== 'otp') {
      return res.status(401).json({ success: false, message: 'Token tidak valid' });
    }

    const { userId } = payload;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan' });
    }

    // Replace old OTP with a new one
    await prisma.otp.deleteMany({ where: { userId } });
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.otp.create({ data: { userId, code, expiresAt } });

    sendOtpEmail(user, code).catch(() => {});

    res.json({ success: true, message: 'Kode OTP baru telah dikirim ke email Anda' });
  } catch (error) {
    console.error('[Auth] resendOtp error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};

const me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { login, verifyOtp, resendOtp, logout, me, changePassword };
