const prisma = require('../lib/prisma');
const ExcelJS = require('exceljs');

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const CATEGORY_LABELS = {
  TRANSPORT: 'Transport', MEALS: 'Makan & Minum', TRAVEL: 'Perjalanan Dinas',
  OFFICE: 'Operasional Kantor', UTILITIES: 'Utilitas', MARKETING: 'Marketing', OTHER: 'Lainnya',
};

const RFP_CATEGORY_LABELS = {
  SALTAB_EVENT: 'SALTAB EVENT', CLAIM_REIMBURSEMENT: 'CLAIM / REIMBURSEMENT',
  CASH_ADVANCE: 'CASH ADVANCE / UANG MUKA', SUPPORT_BUDGET: 'SUPPORT BUDGET', OTHERS: 'OTHERS',
};

const STATUS_LABELS = {
  PENDING: 'Menunggu', VERIFIED: 'Terverifikasi', APPROVED: 'Disetujui', REJECTED: 'Ditolak',
  PAID: 'Lunas', UNPAID: 'Belum Dibayar', PARTIAL: 'Sebagian', OVERDUE: 'Jatuh Tempo',
};

const getDateRange = (query) => {
  const { startDate, endDate, month, year } = query;
  const where = {};
  if (startDate && endDate) {
    where.gte = new Date(startDate);
    where.lte = new Date(endDate);
  } else if (month && year) {
    where.gte = new Date(parseInt(year), parseInt(month) - 1, 1);
    where.lte = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
  } else if (year) {
    where.gte = new Date(parseInt(year), 0, 1);
    where.lte = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
  }
  return Object.keys(where).length ? where : undefined;
};

const getPeriodLabel = (query) => {
  const { month, year } = query;
  if (month && year) return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
  if (year) return `Tahun ${year}`;
  return 'Semua Periode';
};

const fmtIDR = (n) => new Intl.NumberFormat('id-ID').format(Number(n || 0));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) : '-';

// ─── REPORT FUNCTIONS ──────────────────────────────────────────────────────────

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
      unpaid: invoices.filter(i => i.status !== 'PAID').reduce((s, i) => s + Number(i.total), 0),
      count: invoices.length,
    };
    res.json({ success: true, data: invoices, summary });
  } catch (e) {
    console.error('[Report invoices]', e);
    res.status(500).json({ success: false, message: e.message });
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
  } catch (e) {
    console.error('[Report payments]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

const expenseReport = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    const where = dateRange ? { date: dateRange } : {};
    if (req.query.category) where.category = req.query.category;

    const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } });

    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {});

    res.json({ success: true, data: expenses, summary: { total, count: expenses.length, byCategory } });
  } catch (e) {
    console.error('[Report expenses]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

const cashflowReport = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    const dateWhere = dateRange || undefined;

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
      summary: { totalIncome, totalExpense, netCashflow: totalIncome - totalExpense },
    });
  } catch (e) {
    console.error('[Report cashflow]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

const rfpReport = async (req, res) => {
  try {
    const dateRange = getDateRange(req.query);
    const where = dateRange ? { date: dateRange } : {};
    if (req.query.status) where.status = req.query.status;

    const rfps = await prisma.expenseRequest.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' },
    });

    const rfpsWithTotal = rfps.map(r => ({
      ...r,
      total: r.items.reduce((s, i) => s + Number(i.amount), 0),
    }));

    const grandTotal = rfpsWithTotal.reduce((s, r) => s + r.total, 0);
    const byStatus = rfps.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    const totalApproved = rfpsWithTotal.filter(r => r.status === 'APPROVED').reduce((s, r) => s + r.total, 0);
    const totalPending  = rfpsWithTotal.filter(r => r.status === 'PENDING').reduce((s, r) => s + r.total, 0);

    res.json({
      success: true,
      data: rfpsWithTotal,
      summary: { count: rfps.length, total: grandTotal, byStatus, totalApproved, totalPending },
    });
  } catch (e) {
    console.error('[Report rfp]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

// ─── EXCEL EXPORT ──────────────────────────────────────────────────────────────

const NAVY = 'FF1B3A5C';
const LIGHT_BLUE = 'FFE8EEF4';
const WHITE = 'FFFFFFFF';
const GREEN = 'FF166534';
const RED_TEXT = 'FFB91C1C';

function applyHeaderRow(ws, row, cols) {
  row.eachCell({ includeEmpty: true }, (cell, colNum) => {
    if (colNum > cols) return;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } } };
  });
  row.height = 22;
}

function applyDataRow(ws, row, idx, cols) {
  row.eachCell({ includeEmpty: true }, (cell, colNum) => {
    if (colNum > cols) return;
    cell.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: idx % 2 === 0 ? WHITE : LIGHT_BLUE },
    };
    cell.font = { size: 10 };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } };
  });
}

function applyTitleBlock(ws, title, period, companyName, colSpan) {
  const span = `A1:${String.fromCharCode(64 + colSpan)}3`;
  ws.mergeCells(`A1:${String.fromCharCode(64 + colSpan)}1`);
  const c1 = ws.getCell('A1');
  c1.value = companyName;
  c1.font = { bold: true, size: 14, color: { argb: NAVY } };
  c1.alignment = { horizontal: 'center', vertical: 'middle' };
  c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };

  ws.mergeCells(`A2:${String.fromCharCode(64 + colSpan)}2`);
  const c2 = ws.getCell('A2');
  c2.value = title;
  c2.font = { bold: true, size: 12, color: { argb: NAVY } };
  c2.alignment = { horizontal: 'center', vertical: 'middle' };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };

  ws.mergeCells(`A3:${String.fromCharCode(64 + colSpan)}3`);
  const c3 = ws.getCell('A3');
  c3.value = `Periode: ${period}`;
  c3.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
  c3.alignment = { horizontal: 'center', vertical: 'middle' };
  c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };

  ws.getRow(1).height = 22;
  ws.getRow(2).height = 20;
  ws.getRow(3).height = 18;
}

function addSummaryRow(ws, label, value, colSpan) {
  const row = ws.addRow([]);
  ws.mergeCells(`A${row.number}:${String.fromCharCode(64 + colSpan - 1)}${row.number}`);
  const lc = ws.getCell(`A${row.number}`);
  lc.value = label;
  lc.font = { bold: true, size: 10 };
  lc.alignment = { horizontal: 'right' };

  const vc = ws.getCell(`${String.fromCharCode(64 + colSpan)}${row.number}`);
  vc.value = value;
  vc.numFmt = '#,##0';
  vc.font = { bold: true, size: 10 };
  vc.alignment = { horizontal: 'right' };
  vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F8' } };
  row.height = 20;
}

const excelExport = async (req, res) => {
  try {
    const { type, month, year } = req.query;
    const dateRange = getDateRange({ month, year });
    const period = getPeriodLabel({ month, year });
    const safeMonth = month ? month.padStart(2, '0') : 'all';
    const filename = `Laporan_${type || 'all'}_${year || 'all'}_${safeMonth}.xlsx`;

    const company = await prisma.companySetting.findFirst();
    const companyName = company?.name || 'Bhima Finance';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bhima Finance';
    wb.created = new Date();

    // ── INVOICES ────────────────────────────────────────────────────
    if (!type || type === 'invoices') {
      const invoices = await prisma.invoice.findMany({
        where: dateRange ? { date: dateRange } : {},
        include: { client: { select: { name: true } }, items: true },
        orderBy: { date: 'desc' },
      });
      const ws = wb.addWorksheet('Invoice');
      ws.properties.defaultRowHeight = 18;
      applyTitleBlock(ws, 'LAPORAN INVOICE', period, companyName, 9);

      ws.addRow([]); // spacer
      const hRow = ws.addRow(['No', 'Nomor Invoice', 'Klien', 'Tanggal', 'Jatuh Tempo', 'Subtotal (Rp)', 'PPN (Rp)', 'Total (Rp)', 'Status']);
      applyHeaderRow(ws, hRow, 9);

      invoices.forEach((inv, i) => {
        const r = ws.addRow([
          i + 1,
          inv.number,
          inv.client?.name || '-',
          fmtDate(inv.date),
          fmtDate(inv.dueDate),
          Number(inv.subtotal || 0),
          Number(inv.taxAmount || 0),
          Number(inv.total || 0),
          STATUS_LABELS[inv.status] || inv.status,
        ]);
        applyDataRow(ws, r, i, 9);
        [6, 7, 8].forEach(c => { ws.getCell(r.number, c).numFmt = '#,##0'; ws.getCell(r.number, c).alignment = { horizontal: 'right', vertical: 'middle' }; });
        const statusCell = ws.getCell(r.number, 9);
        if (inv.status === 'PAID') { statusCell.font = { ...statusCell.font, color: { argb: GREEN }, bold: true }; }
        else if (inv.status === 'OVERDUE') { statusCell.font = { ...statusCell.font, color: { argb: RED_TEXT }, bold: true }; }
      });

      ws.addRow([]);
      const total = invoices.reduce((s, i) => s + Number(i.total), 0);
      const paid  = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.total), 0);
      addSummaryRow(ws, 'TOTAL INVOICE:', total, 9);
      addSummaryRow(ws, 'TOTAL LUNAS:', paid, 9);
      addSummaryRow(ws, 'TOTAL BELUM LUNAS:', total - paid, 9);

      ws.columns = [
        { width: 5 }, { width: 22 }, { width: 24 }, { width: 14 }, { width: 14 },
        { width: 18 }, { width: 16 }, { width: 18 }, { width: 14 },
      ];
    }

    // ── PAYMENTS ────────────────────────────────────────────────────
    if (!type || type === 'payments') {
      const payments = await prisma.payment.findMany({
        where: dateRange ? { date: dateRange } : {},
        include: { invoice: { include: { client: { select: { name: true } } } } },
        orderBy: { date: 'desc' },
      });
      const ws = wb.addWorksheet('Pembayaran Diterima');
      ws.properties.defaultRowHeight = 18;
      applyTitleBlock(ws, 'LAPORAN PEMBAYARAN DITERIMA', period, companyName, 7);

      ws.addRow([]);
      const hRow = ws.addRow(['No', 'Tanggal', 'Nomor Invoice', 'Klien', 'Metode', 'Referensi', 'Jumlah (Rp)']);
      applyHeaderRow(ws, hRow, 7);

      const METHODS = { TRANSFER: 'Transfer Bank', CASH: 'Tunai', CHECK: 'Cek', OTHER: 'Lainnya' };
      payments.forEach((p, i) => {
        const r = ws.addRow([
          i + 1,
          fmtDate(p.date),
          p.invoice?.number || '-',
          p.invoice?.client?.name || '-',
          METHODS[p.method] || p.method,
          p.reference || '-',
          Number(p.amount || 0),
        ]);
        applyDataRow(ws, r, i, 7);
        ws.getCell(r.number, 7).numFmt = '#,##0';
        ws.getCell(r.number, 7).alignment = { horizontal: 'right', vertical: 'middle' };
      });

      ws.addRow([]);
      addSummaryRow(ws, 'TOTAL PEMBAYARAN:', payments.reduce((s, p) => s + Number(p.amount), 0), 7);

      ws.columns = [
        { width: 5 }, { width: 14 }, { width: 22 }, { width: 24 }, { width: 16 }, { width: 20 }, { width: 18 },
      ];
    }

    // ── EXPENSES ────────────────────────────────────────────────────
    if (!type || type === 'expenses') {
      const expenses = await prisma.expense.findMany({
        where: dateRange ? { date: dateRange } : {},
        orderBy: { date: 'desc' },
      });
      const ws = wb.addWorksheet('Pengeluaran');
      ws.properties.defaultRowHeight = 18;
      applyTitleBlock(ws, 'LAPORAN PENGELUARAN', period, companyName, 7);

      ws.addRow([]);
      const hRow = ws.addRow(['No', 'Tanggal', 'Nama', 'Kategori', 'Departemen', 'Diminta Oleh', 'Jumlah (Rp)']);
      applyHeaderRow(ws, hRow, 7);

      expenses.forEach((e, i) => {
        const r = ws.addRow([
          i + 1,
          fmtDate(e.date),
          e.name,
          CATEGORY_LABELS[e.category] || e.category,
          e.department || '-',
          e.requestBy || '-',
          Number(e.amount || 0),
        ]);
        applyDataRow(ws, r, i, 7);
        ws.getCell(r.number, 7).numFmt = '#,##0';
        ws.getCell(r.number, 7).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(r.number, 7).font = { ...ws.getCell(r.number, 7).font, color: { argb: RED_TEXT } };
      });

      ws.addRow([]);
      addSummaryRow(ws, 'TOTAL PENGELUARAN:', expenses.reduce((s, e) => s + Number(e.amount), 0), 7);

      ws.columns = [
        { width: 5 }, { width: 14 }, { width: 28 }, { width: 22 }, { width: 20 }, { width: 20 }, { width: 18 },
      ];
    }

    // ── CASHFLOW ────────────────────────────────────────────────────
    if (!type || type === 'cashflow') {
      const [payments, expenses] = await Promise.all([
        prisma.payment.findMany({
          where: dateRange ? { date: dateRange } : {},
          include: { invoice: { include: { client: { select: { name: true } } } } },
          orderBy: { date: 'asc' },
        }),
        prisma.expense.findMany({
          where: dateRange ? { date: dateRange } : {},
          orderBy: { date: 'asc' },
        }),
      ]);

      const ws = wb.addWorksheet('Cashflow');
      ws.properties.defaultRowHeight = 18;
      applyTitleBlock(ws, 'LAPORAN CASHFLOW', period, companyName, 5);

      ws.addRow([]);
      // Pemasukan
      const h1 = ws.addRow(['', 'PEMASUKAN (PEMBAYARAN DITERIMA)', '', '', '']);
      ws.mergeCells(`B${h1.number}:E${h1.number}`);
      ws.getCell(h1.number, 2).font = { bold: true, size: 11, color: { argb: GREEN } };
      ws.getRow(h1.number).height = 20;

      const hIn = ws.addRow(['No', 'Tanggal', 'Invoice', 'Klien', 'Jumlah (Rp)']);
      applyHeaderRow(ws, hIn, 5);
      payments.forEach((p, i) => {
        const r = ws.addRow([i + 1, fmtDate(p.date), p.invoice?.number || '-', p.invoice?.client?.name || '-', Number(p.amount || 0)]);
        applyDataRow(ws, r, i, 5);
        ws.getCell(r.number, 5).numFmt = '#,##0';
        ws.getCell(r.number, 5).alignment = { horizontal: 'right', vertical: 'middle' };
      });
      const totalIncome = payments.reduce((s, p) => s + Number(p.amount), 0);
      addSummaryRow(ws, 'TOTAL PEMASUKAN:', totalIncome, 5);

      ws.addRow([]);
      ws.addRow([]);
      // Pengeluaran
      const h2 = ws.addRow(['', 'PENGELUARAN', '', '', '']);
      ws.mergeCells(`B${h2.number}:E${h2.number}`);
      ws.getCell(h2.number, 2).font = { bold: true, size: 11, color: { argb: RED_TEXT } };
      ws.getRow(h2.number).height = 20;

      const hOut = ws.addRow(['No', 'Tanggal', 'Nama', 'Kategori', 'Jumlah (Rp)']);
      applyHeaderRow(ws, hOut, 5);
      expenses.forEach((e, i) => {
        const r = ws.addRow([i + 1, fmtDate(e.date), e.name, CATEGORY_LABELS[e.category] || e.category, Number(e.amount || 0)]);
        applyDataRow(ws, r, i, 5);
        ws.getCell(r.number, 5).numFmt = '#,##0';
        ws.getCell(r.number, 5).alignment = { horizontal: 'right', vertical: 'middle' };
      });
      const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);
      addSummaryRow(ws, 'TOTAL PENGELUARAN:', totalExpense, 5);

      ws.addRow([]);
      ws.addRow([]);
      // Net
      const netRow = ws.addRow(['', '', '', 'NET CASHFLOW:', totalIncome - totalExpense]);
      ws.getCell(netRow.number, 4).font = { bold: true, size: 12 };
      ws.getCell(netRow.number, 4).alignment = { horizontal: 'right' };
      ws.getCell(netRow.number, 5).numFmt = '#,##0';
      ws.getCell(netRow.number, 5).font = { bold: true, size: 12, color: { argb: totalIncome >= totalExpense ? GREEN : RED_TEXT } };
      ws.getCell(netRow.number, 5).alignment = { horizontal: 'right' };
      netRow.height = 24;

      ws.columns = [{ width: 5 }, { width: 14 }, { width: 24 }, { width: 24 }, { width: 18 }];
    }

    // ── RFP ────────────────────────────────────────────────────────
    if (!type || type === 'rfp') {
      const rfps = await prisma.expenseRequest.findMany({
        where: dateRange ? { date: dateRange } : {},
        include: { items: true },
        orderBy: { date: 'desc' },
      });

      const ws = wb.addWorksheet('Request for Payment');
      ws.properties.defaultRowHeight = 18;
      applyTitleBlock(ws, 'LAPORAN REQUEST FOR PAYMENT (RFP)', period, companyName, 8);

      ws.addRow([]);
      const hRow = ws.addRow(['No', 'Nomor RFP', 'Tanggal', 'Pemohon', 'Proyek', 'Kategori', 'Status', 'Total (Rp)']);
      applyHeaderRow(ws, hRow, 8);

      let grandTotal = 0;
      rfps.forEach((r, i) => {
        const total = r.items.reduce((s, it) => s + Number(it.amount), 0);
        grandTotal += total;
        const row = ws.addRow([
          i + 1,
          r.number,
          fmtDate(r.date),
          r.name,
          r.project || '-',
          RFP_CATEGORY_LABELS[r.rfpCategory] || r.rfpCategory,
          STATUS_LABELS[r.status] || r.status,
          total,
        ]);
        applyDataRow(ws, row, i, 8);
        ws.getCell(row.number, 8).numFmt = '#,##0';
        ws.getCell(row.number, 8).alignment = { horizontal: 'right', vertical: 'middle' };

        const sc = ws.getCell(row.number, 7);
        if (r.status === 'APPROVED') sc.font = { ...sc.font, color: { argb: GREEN }, bold: true };
        else if (r.status === 'REJECTED') sc.font = { ...sc.font, color: { argb: RED_TEXT }, bold: true };
        else if (r.status === 'PENDING') sc.font = { ...sc.font, color: { argb: 'FF92400E' } };
      });

      ws.addRow([]);
      addSummaryRow(ws, 'TOTAL SELURUH RFP:', grandTotal, 8);
      addSummaryRow(ws, 'TOTAL DISETUJUI:', rfps.filter(r => r.status === 'APPROVED').reduce((s, r) => s + r.items.reduce((ss, i) => ss + Number(i.amount), 0), 0), 8);
      addSummaryRow(ws, 'TOTAL PENDING:', rfps.filter(r => r.status === 'PENDING').reduce((s, r) => s + r.items.reduce((ss, i) => ss + Number(i.amount), 0), 0), 8);

      ws.columns = [
        { width: 5 }, { width: 22 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 22 }, { width: 16 }, { width: 18 },
      ];
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('[Report export]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

module.exports = { invoiceReport, paymentReport, expenseReport, cashflowReport, rfpReport, excelExport };
