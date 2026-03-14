const prisma = require('../lib/prisma');

const canAccess = (user) => user.role === 'ADMIN' || user.canViewSalary;

const getAll = async (req, res) => {
  try {
    if (!canAccess(req.user)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    const { month, year, search } = req.query;
    const where = {};
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (search) where.employeeName = { contains: search, mode: 'insensitive' };

    const payrolls = await prisma.payroll.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { employeeName: 'asc' }],
    });

    res.json({ success: true, data: payrolls });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    const { employeeName, month, year, baseSalary = 0, allowances = 0, deductions = 0, notes } = req.body;
    if (!employeeName || !month || !year) {
      return res.status(400).json({ success: false, message: 'Nama karyawan, bulan, dan tahun wajib diisi' });
    }
    const netSalary = parseFloat(baseSalary) + parseFloat(allowances) - parseFloat(deductions);
    const payroll = await prisma.payroll.create({
      data: {
        employeeName: employeeName.trim(), month: parseInt(month), year: parseInt(year),
        baseSalary: parseFloat(baseSalary), allowances: parseFloat(allowances),
        deductions: parseFloat(deductions), netSalary, notes,
      },
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
    const { employeeName, baseSalary = 0, allowances = 0, deductions = 0, notes } = req.body;
    const netSalary = parseFloat(baseSalary) + parseFloat(allowances) - parseFloat(deductions);
    const data = { baseSalary: parseFloat(baseSalary), allowances: parseFloat(allowances), deductions: parseFloat(deductions), netSalary, notes };
    if (employeeName) data.employeeName = employeeName.trim();
    const payroll = await prisma.payroll.update({ where: { id: req.params.id }, data });
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
