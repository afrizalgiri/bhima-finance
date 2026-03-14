const { validationResult } = require('express-validator');
const { generateExpensePdf } = require('../services/pdfService');
const prisma = require('../lib/prisma');

const getAll = async (req, res) => {
  try {
    const { category, department, startDate, endDate, page = 1, limit = 20 } = req.query;
    const where = {};
    if (category) where.category = category;
    if (department) where.department = { contains: department };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * parseInt(limit), take: parseInt(limit) }),
      prisma.expense.count({ where }),
    ]);
    res.json({ success: true, data: expenses, total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getOne = async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  try {
    const expense = await prisma.expense.create({
      data: { ...req.body, date: new Date(req.body.date) },
    });
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const update = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);
    const expense = await prisma.expense.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Generate PDF Bukti Pengeluaran Kas
const generatePdf = async (req, res) => {
  try {
    const { ids, department, requestBy, period } = req.body;

    let expenses;
    if (ids && ids.length > 0) {
      expenses = await prisma.expense.findMany({ where: { id: { in: ids } }, orderBy: { date: 'asc' } });
    } else {
      expenses = await prisma.expense.findMany({ orderBy: { date: 'asc' } });
    }

    if (expenses.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data pengeluaran' });
    }

    const company = await prisma.companySetting.findFirst();
    const filters = { department, requestBy, period };
    const pdfBuffer = await generateExpensePdf(expenses, company, filters);

    const now = new Date();
    const prefix = company?.docPrefixExpense || 'BKK';
    const filename = `${prefix}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal generate PDF' });
  }
};

module.exports = { getAll, getOne, create, update, remove, generatePdf };
