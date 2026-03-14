const prisma = require('../lib/prisma');

const getDateRange = (query) => {
  const { startDate, endDate, month, year } = query;
  const where = {};
  if (startDate && endDate) {
    where.gte = new Date(startDate);
    where.lte = new Date(endDate);
  } else if (month && year) {
    where.gte = new Date(parseInt(year), parseInt(month) - 1, 1);
    where.lte = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
  } else if (year) {
    where.gte = new Date(parseInt(year), 0, 1);
    where.lte = new Date(parseInt(year), 11, 31, 23, 59, 59);
  }
  return Object.keys(where).length ? where : undefined;
};

const invoiceReport = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    const where = dateRange ? { date: dateRange } : {};
    if (req.query.status) where.status = req.query.status;

    const invoices = await prisma.invoice.findMany({
      where,
      include: { client: { select: { name: true } }, items: true },
      orderBy: { date: 'desc' },
    });

    const summary = {
      total: invoices.reduce((s, i) => s + Number(i.total), 0),
      paid: invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.total), 0),
      unpaid: invoices.filter(i => i.status === 'UNPAID').reduce((s, i) => s + Number(i.total), 0),
      count: invoices.length,
    };

    res.json({ success: true, data: invoices, summary });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const paymentReport = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    const where = dateRange ? { date: dateRange } : {};

    const payments = await prisma.payment.findMany({
      where,
      include: { invoice: { include: { client: { select: { name: true } } } } },
      orderBy: { date: 'desc' },
    });

    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    res.json({ success: true, data: payments, summary: { total, count: payments.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const expenseReport = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    const where = dateRange ? { date: dateRange } : {};
    if (req.query.category) where.category = req.query.category;

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {});

    res.json({ success: true, data: expenses, summary: { total, count: expenses.length, byCategory } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const cashflowReport = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    const dateWhere = dateRange ? dateRange : undefined;

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: dateWhere ? { date: dateWhere } : {},
        include: { invoice: { include: { client: { select: { name: true } } } } },
        orderBy: { date: 'asc' },
      }),
      prisma.expense.findMany({
        where: dateWhere ? { date: dateWhere } : {},
        orderBy: { date: 'asc' },
      }),
    ]);

    const totalIncome = payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);

    res.json({
      success: true,
      data: { payments, expenses },
      summary: {
        totalIncome,
        totalExpense,
        netCashflow: totalIncome - totalExpense,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { invoiceReport, paymentReport, expenseReport, cashflowReport };
