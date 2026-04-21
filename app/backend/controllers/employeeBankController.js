const prisma = require('../lib/prisma');

const getAll = async (req, res) => {
  try {
    const accounts = await prisma.employeeBankAccount.findMany({
      orderBy: { employeeName: 'asc' },
    });
    res.json({ success: true, data: accounts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  try {
    const { employeeName, bankName, accountNumber, accountHolder, notes } = req.body;
    if (!employeeName || !bankName || !accountNumber || !accountHolder) {
      return res.status(400).json({ success: false, message: 'Nama karyawan, bank, nomor rekening, dan atas nama wajib diisi' });
    }
    const account = await prisma.employeeBankAccount.create({
      data: { employeeName, bankName, accountNumber, accountHolder, notes: notes || null },
    });
    res.status(201).json({ success: true, data: account });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const update = async (req, res) => {
  try {
    const { employeeName, bankName, accountNumber, accountHolder, notes, isActive } = req.body;
    const account = await prisma.employeeBankAccount.update({
      where: { id: req.params.id },
      data: {
        employeeName: employeeName || undefined,
        bankName: bankName || undefined,
        accountNumber: accountNumber || undefined,
        accountHolder: accountHolder || undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });
    res.json({ success: true, data: account });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    await prisma.employeeBankAccount.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, create, update, remove };
