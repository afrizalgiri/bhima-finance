const prisma = require('../lib/prisma');

const getSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      totalInvoicesMonth,
      unpaidInvoices,
      partialInvoices,
      totalExpensesMonth,
      totalPaidMonth,
      recentInvoices,
      recentExpenses,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.count({ where: { status: 'UNPAID' } }),
      prisma.invoice.count({ where: { status: 'PARTIAL' } }),
      prisma.expense.aggregate({
        where: { date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { date: { gte: startOfMonth, lte: endOfMonth } },
        _sum: { amount: true },
      }),
      prisma.invoice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { name: true } } },
      }),
      prisma.expense.findMany({
        take: 5,
        orderBy: { date: 'desc' },
      }),
    ]);

    const totalIncome = Number(totalPaidMonth._sum.amount || 0);
    const totalExpense = Number(totalExpensesMonth._sum.amount || 0);

    res.json({
      success: true,
      data: {
        invoicesThisMonth: {
          count: totalInvoicesMonth._count,
          total: Number(totalInvoicesMonth._sum.total || 0),
        },
        unpaidInvoices,
        partialInvoices,
        totalExpensesMonth: totalExpense,
        totalIncomeMonth: totalIncome,
        cashflow: totalIncome - totalExpense,
        recentInvoices,
        recentExpenses,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getSummary };
