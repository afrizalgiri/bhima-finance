const prisma = require('../lib/prisma');

const canSeeAll = (user) => user.role === 'ADMIN' || user.canViewSalary;

const getAll = async (req, res) => {
  try {
    const { userId, month, year } = req.query;
    const where = {};

    if (canSeeAll(req.user)) {
      if (userId) where.userId = userId;
      if (month) where.month = parseInt(month);
      if (year) where.year = parseInt(year);
    } else {
      where.userId = req.user.id;
    }

    const payrolls = await prisma.payroll.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const result = payrolls.map(p => {
      if (!canSeeAll(req.user)) {
        return { ...p, baseSalary: null, allowances: null, deductions: null, netSalary: null };
      }
      return p;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    const { userId, month, year, baseSalary = 0, allowances = 0, deductions = 0, notes } = req.body;
    if (!userId || !month || !year) {
      return res.status(400).json({ success: false, message: 'userId, month, year wajib diisi' });
    }
    const netSalary = parseFloat(baseSalary) + parseFloat(allowances) - parseFloat(deductions);
    const payroll = await prisma.payroll.create({
      data: {
        userId, month: parseInt(month), year: parseInt(year),
        baseSalary: parseFloat(baseSalary), allowances: parseFloat(allowances),
        deductions: parseFloat(deductions), netSalary, notes,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json({ success: true, data: payroll });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'Slip gaji bulan ini sudah ada untuk karyawan tersebut' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const update = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    const { baseSalary = 0, allowances = 0, deductions = 0, notes } = req.body;
    const netSalary = parseFloat(baseSalary) + parseFloat(allowances) - parseFloat(deductions);
    const payroll = await prisma.payroll.update({
      where: { id: req.params.id },
      data: {
        baseSalary: parseFloat(baseSalary), allowances: parseFloat(allowances),
        deductions: parseFloat(deductions), netSalary, notes,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json({ success: true, data: payroll });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    await prisma.payroll.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Slip gaji dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, create, update, remove };
