const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(amount));
};
const formatDate = (date) => new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
const terbilang = (n) => {
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
    'sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas',
    'tujuh belas', 'delapan belas', 'sembilan belas'];
  if (n < 20) return satuan[n];
  if (n < 100) return satuan[Math.floor(n / 10) * 10 % 100 === 0 ? Math.floor(n / 10) : 0] +
    (satuan[Math.floor(n / 10)] === '' ? '' : satuan[Math.floor(n / 10)]) + ' puluh' +
    (n % 10 !== 0 ? ' ' + satuan[n % 10] : '');
  return '';
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 50;
const CW = PAGE_W - M * 2;

function getLogoBuffer(company) {
  if (!company?.logoUrl) return null;
  const p = path.join(__dirname, '..', company.logoUrl);
  if (fs.existsSync(p)) return p;
  return null;
}

function buildPdf(cb) {
  const doc = new PDFDocument({ size: 'A4', margin: M });
  const bufs = [];
  doc.on('data', c => bufs.push(c));
  doc.on('end', () => cb(null, Buffer.concat(bufs)));
  doc.on('error', cb);
  return doc;
}

// ═══════════════════════════════════════════════════════
//  SPH — FORMAT SURAT PENAWARAN HARGA FORMAL INDONESIA
// ═══════════════════════════════════════════════════════
const generateSphPdf = (sph, company, docName = 'Surat Penawaran Harga') => new Promise((resolve, reject) => {
  const doc = buildPdf((err, buf) => err ? reject(err) : resolve(buf));

  const logo = getLogoBuffer(company);
  const NAVY = '#1a3557';
  const GOLD = '#c9a84c';
  const HEADER_COLOR = sph.headerColor || NAVY;

  // ── KOP SURAT ─────────────────────────────────────
  // Garis atas kop (dua garis tebal-tipis)
  doc.rect(M, M, CW, 4).fillColor(NAVY).fill();
  doc.rect(M, M + 6, CW, 1.5).fillColor(GOLD).fill();

  let headerY = M + 18;

  if (logo) {
    try { doc.image(logo, M, headerY, { height: 55, fit: [90, 55] }); } catch (e) {}
  }

  // Nama perusahaan (tengah)
  doc.fontSize(16).font('Helvetica-Bold').fillColor(NAVY)
    .text(company?.name || 'PT. NAMA PERUSAHAAN', M, headerY + 2, { width: CW, align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#444')
    .text(company?.address || '', M, doc.y + 2, { width: CW, align: 'center' })
    .text(`Telp: ${company?.phone || '-'}  |  Email: ${company?.email || '-'}`, M, doc.y + 1, { width: CW, align: 'center' });
  if (company?.website) doc.text(`Website: ${company.website}`, M, doc.y + 1, { width: CW, align: 'center' });

  // Garis bawah kop
  const kopBottom = doc.y + 8;
  doc.rect(M, kopBottom, CW, 1.5).fillColor(GOLD).fill();
  doc.rect(M, kopBottom + 3, CW, 4).fillColor(NAVY).fill();

  // ── JUDUL SURAT ────────────────────────────────────
  let y = kopBottom + 20;
  doc.fontSize(13).font('Helvetica-Bold').fillColor(NAVY)
    .text(docName.toUpperCase(), M, y, { width: CW, align: 'center', underline: true });
  y = doc.y + 4;
  doc.fontSize(9).font('Helvetica').fillColor('#555')
    .text(`No. ${sph.number}`, M, y, { width: CW, align: 'center' });
  y = doc.y + 16;

  // ── INFO SURAT (kiri) ──────────────────────────────
  const col1 = M;
  const col2 = M + 80;
  const lineH = 14;
  const rows = [
    ['Nomor', sph.number],
    ['Tanggal', formatDate(sph.date)],
    ['Berlaku s/d', sph.validUntil ? formatDate(sph.validUntil) : '-'],
    ['Hal', 'Penawaran Harga'],
  ];
  rows.forEach(([label, val]) => {
    doc.fontSize(9).font('Helvetica').fillColor('#333')
      .text(label, col1, y, { width: 75 })
      .text(':', col1 + 75, y, { width: 10 })
      .text(val, col2, y, { width: 180 });
    y += lineH;
  });

  y += 10;
  // ── KEPADA ─────────────────────────────────────────
  doc.fontSize(9).font('Helvetica').fillColor('#333')
    .text('Kepada Yth.', col1, y);
  y = doc.y + 2;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
    .text(sph.client.name, col1, y);
  y = doc.y + 1;
  doc.fontSize(9).font('Helvetica').fillColor('#555')
    .text(sph.client.address, col1, y, { width: 260 });
  if (sph.client.pic) {
    y = doc.y + 1;
    doc.text(`u.p. ${sph.client.pic}`, col1, y);
  }
  y = doc.y + 14;

  // ── PARAGRAF PEMBUKA ───────────────────────────────
  doc.fontSize(9).font('Helvetica').fillColor('#333')
    .text('Dengan hormat,', col1, y);
  y = doc.y + 4;
  const openingText = sph.openingText ||
    `Bersama surat ini kami dari ${company?.name || 'perusahaan kami'} bermaksud menyampaikan penawaran harga untuk kebutuhan Bapak/Ibu sebagai berikut:`;
  doc.fontSize(9).font('Helvetica').fillColor('#333')
    .text(openingText, col1, y, { width: CW, align: 'justify', lineGap: 2 });
  y = doc.y + 14;

  // ── TABEL ITEM ────────────────────────────────────
  const cols = { no: M, nama: M + 22, qty: M + 250, sat: M + 305, harga: M + 355, total: M + 440 };
  const cw = { no: 22, nama: 228, qty: 55, sat: 50, harga: 85, total: CW - 440 };
  const rh = 18;

  // Header tabel
  doc.rect(M, y, CW, rh).fillColor(HEADER_COLOR).fill();
  [['No', 'no', 'center'], ['Uraian / Deskripsi', 'nama', 'left'], ['Qty', 'qty', 'center'],
    ['Sat.', 'sat', 'center'], ['Harga Satuan (Rp)', 'harga', 'right'], ['Jumlah (Rp)', 'total', 'right']
  ].forEach(([h, k, align]) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff')
      .text(h, cols[k] + 3, y + 5, { width: cw[k] - 6, align });
  });
  y += rh;

  // Baris item
  sph.items.forEach((item, i) => {
    const bg = i % 2 === 0 ? '#f7f9fc' : '#ffffff';
    doc.rect(M, y, CW, rh).fillColor(bg).fill();
    doc.rect(M, y, CW, rh).strokeColor('#dde3ea').lineWidth(0.5).stroke();

    doc.fontSize(8).font('Helvetica').fillColor('#222')
      .text(String(i + 1), cols.no + 3, y + 5, { width: cw.no - 6, align: 'center' });
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#222')
      .text(item.name, cols.nama + 3, y + 3, { width: cw.nama - 6 });
    if (item.description) {
      doc.fontSize(7).font('Helvetica').fillColor('#777')
        .text(item.description, cols.nama + 3, doc.y, { width: cw.nama - 6 });
    }
    doc.fontSize(8).font('Helvetica').fillColor('#222')
      .text(Number(item.quantity).toString(), cols.qty + 3, y + 5, { width: cw.qty - 6, align: 'center' })
      .text(item.unit, cols.sat + 3, y + 5, { width: cw.sat - 6, align: 'center' })
      .text(Number(item.price).toLocaleString('id-ID'), cols.harga + 3, y + 5, { width: cw.harga - 6, align: 'right' })
      .text(Number(item.total).toLocaleString('id-ID'), cols.total + 3, y + 5, { width: cw.total - 6, align: 'right' });
    y += rh;
  });

  // Total rows
  const totals = [['Subtotal', sph.subtotal]];
  if (Number(sph.taxRate) > 0) totals.push([`PPN ${Number(sph.taxRate)}%`, sph.taxAmount]);
  totals.push(['TOTAL', sph.total]);

  totals.forEach(([label, val], i) => {
    const isLast = i === totals.length - 1;
    if (isLast) doc.rect(M + CW - 250, y, 250, rh).fillColor(HEADER_COLOR).fill();
    else doc.rect(M + CW - 250, y, 250, rh).fillColor(isLast ? HEADER_COLOR : '#eef2f7').fill();
    doc.rect(M, y, CW - 250, rh).strokeColor('#dde3ea').lineWidth(0.5).stroke();
    doc.rect(M + CW - 250, y, 250, rh).strokeColor('#dde3ea').lineWidth(0.5).stroke();
    doc.fontSize(isLast ? 9 : 8).font(isLast ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(isLast ? '#fff' : '#333')
      .text(label, M + CW - 245, y + 5, { width: 160, align: 'left' })
      .text(`Rp ${Number(val).toLocaleString('id-ID')}`, M + CW - 85, y + 5, { width: 80, align: 'right' });
    y += rh;
  });

  y += 14;

  // ── CATATAN & SYARAT ──────────────────────────────
  if (sph.notes || sph.validUntil) {
    doc.rect(M, y, CW, 1).fillColor('#dde3ea').fill();
    y += 8;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(NAVY).text('Catatan & Syarat:', M, y);
    y = doc.y + 4;
    const syarat = [];
    if (sph.validUntil) syarat.push(`Penawaran ini berlaku sampai dengan ${formatDate(sph.validUntil)}.`);
    if (company?.bankName) syarat.push(`Pembayaran ditransfer ke ${company.bankName} a/n ${company.bankHolder} No. Rek. ${company.bankAccount}.`);
    if (sph.notes) syarat.push(sph.notes);
    syarat.forEach((s, i) => {
      doc.fontSize(8.5).font('Helvetica').fillColor('#444')
        .text(`${i + 1}. ${s}`, M + 10, y, { width: CW - 10, lineGap: 1 });
      y = doc.y + 3;
    });
    y += 6;
  }

  // ── PENUTUP ────────────────────────────────────────
  const closingText = sph.closingText ||
    'Demikian penawaran harga ini kami sampaikan. Atas perhatian dan kepercayaan Bapak/Ibu, kami ucapkan terima kasih.';
  doc.fontSize(9).font('Helvetica').fillColor('#333')
    .text(closingText, M, y, { width: CW, align: 'justify', lineGap: 2 });
  y = doc.y + 18;

  // ── TANDA TANGAN ──────────────────────────────────
  const sigX = PAGE_W - M - 140;
  doc.fontSize(9).font('Helvetica').fillColor('#333')
    .text('Hormat kami,', sigX, y, { width: 140, align: 'center' });
  y = doc.y + 2;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
    .text(company?.name || '', sigX, y, { width: 140, align: 'center' });
  y = doc.y + 40;
  doc.moveTo(sigX, y).lineTo(sigX + 140, y).lineWidth(0.8).strokeColor('#333').stroke();
  y += 4;
  doc.fontSize(8).font('Helvetica').fillColor('#555')
    .text(sph.signerTitle || 'Finance Department', sigX, y, { width: 140, align: 'center' });

  // Garis bawah halaman
  doc.rect(M, PAGE_H - M - 8, CW, 1.5).fillColor(GOLD).fill();
  doc.rect(M, PAGE_H - M - 4, CW, 4).fillColor(NAVY).fill();

  doc.end();
});

// ═══════════════════════════════════════════════════════
//  INVOICE — FORMAT INVOICE BISNIS PROFESIONAL
// ═══════════════════════════════════════════════════════
const generateInvoicePdf = (invoice, company, docName = 'INVOICE') => new Promise((resolve, reject) => {
  const doc = buildPdf((err, buf) => err ? reject(err) : resolve(buf));

  const logo = getLogoBuffer(company);
  const TEAL = '#0f766e';
  const TEAL_DARK = '#134e4a';
  const TEAL_LIGHT = '#f0fdfa';
  const INV_HEADER_COLOR = invoice.headerColor || TEAL;

  const statusLabel = { UNPAID: 'BELUM DIBAYAR', PARTIAL: 'DIBAYAR SEBAGIAN', PAID: 'LUNAS', OVERDUE: 'JATUH TEMPO' };
  const statusColor = { UNPAID: '#dc2626', PARTIAL: '#d97706', PAID: '#16a34a', OVERDUE: '#dc2626' };

  // ── HEADER INVOICE ────────────────────────────────
  // Blok kiri — info perusahaan
  let headerY = M;
  if (logo) {
    try { doc.image(logo, M, headerY, { height: 50, fit: [80, 50] }); headerY += 4; } catch (e) {}
  }
  doc.fontSize(15).font('Helvetica-Bold').fillColor(TEAL_DARK)
    .text(company?.name || 'PT. NAMA PERUSAHAAN', M, headerY + (logo ? 56 : 0));
  doc.fontSize(8).font('Helvetica').fillColor('#555')
    .text(company?.address || '', M, doc.y + 2, { width: 240 })
    .text(`Telp: ${company?.phone || '-'}`, M, doc.y + 1, { width: 240 })
    .text(`Email: ${company?.email || '-'}`, M, doc.y + 1, { width: 240 });
  if (company?.taxNumber) doc.text(`NPWP: ${company.taxNumber}`, M, doc.y + 1, { width: 240 });

  // Blok kanan — INVOICE title + nomor
  const rightX = PAGE_W - M - 200;
  doc.fontSize(32).font('Helvetica-Bold').fillColor(TEAL)
    .text(docName.toUpperCase(), rightX, M, { width: 200, align: 'right' });

  // Status badge
  const sc = statusColor[invoice.status] || '#666';
  const sl = statusLabel[invoice.status] || invoice.status;
  doc.rect(rightX + 200 - 120, doc.y + 4, 120, 18).fillColor(sc).fill();
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff')
    .text(sl, rightX + 200 - 120, doc.y + 8, { width: 120, align: 'center' });

  const infoY = doc.y + 14;
  // Detail invoice (kanan)
  const infoPairs = [
    ['No. Invoice', invoice.number],
    ['Tanggal', formatDate(invoice.date)],
    ['Jatuh Tempo', formatDate(invoice.dueDate)],
  ];
  let iy = infoY;
  infoPairs.forEach(([k, v]) => {
    doc.fontSize(8).font('Helvetica').fillColor('#555').text(k, rightX, iy, { width: 85 });
    doc.fontSize(8).font('Helvetica').fillColor('#555').text(':', rightX + 85, iy, { width: 10 });
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#111').text(v, rightX + 95, iy, { width: 105, align: 'right' });
    iy += 14;
  });

  // ── DIVIDER ───────────────────────────────────────
  let y = Math.max(doc.y, iy) + 10;
  doc.rect(M, y, CW, 3).fillColor(TEAL).fill();
  y += 10;

  // ── TAGIHAN KEPADA ────────────────────────────────
  doc.rect(M, y, 260, 80).fillColor(TEAL_LIGHT).fill();
  doc.rect(M, y, 3, 80).fillColor(TEAL).fill();
  doc.fontSize(7.5).font('Helvetica').fillColor(TEAL).text('TAGIHAN KEPADA:', M + 10, y + 8, { characterSpacing: 0.5 });
  doc.fontSize(11).font('Helvetica-Bold').fillColor(TEAL_DARK).text(invoice.client.name, M + 10, doc.y + 3, { width: 240 });
  doc.fontSize(8).font('Helvetica').fillColor('#555').text(invoice.client.address, M + 10, doc.y + 2, { width: 240 });
  if (invoice.client.email) doc.text(invoice.client.email, M + 10, doc.y + 1, { width: 240 });
  if (invoice.client.phone) doc.text(invoice.client.phone, M + 10, doc.y + 1, { width: 240 });
  if (invoice.client.pic) doc.text(`UP: ${invoice.client.pic}`, M + 10, doc.y + 1, { width: 240 });

  y += 90;

  // ── TABEL ITEM ────────────────────────────────────
  const cols = { no: M, desc: M + 22, qty: M + 265, sat: M + 320, price: M + 370, total: M + 450 };
  const cw = { no: 22, desc: 243, qty: 55, sat: 50, price: 80, total: CW - 450 };
  const rh = 20;

  doc.rect(M, y, CW, rh).fillColor(INV_HEADER_COLOR).fill();
  [['No', 'no', 'center'], ['Deskripsi', 'desc', 'left'], ['Qty', 'qty', 'center'],
    ['Sat.', 'sat', 'center'], ['Harga Satuan', 'price', 'right'], ['Jumlah', 'total', 'right']
  ].forEach(([h, k, align]) => {
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#fff')
      .text(h, cols[k] + 3, y + 6, { width: cw[k] - 6, align });
  });
  y += rh;

  invoice.items.forEach((item, i) => {
    const bg = i % 2 === 0 ? '#fff' : TEAL_LIGHT;
    doc.rect(M, y, CW, rh).fillColor(bg).fill();
    doc.rect(M, y, CW, rh).strokeColor('#b2dfdb').lineWidth(0.5).stroke();
    doc.fontSize(8.5).font('Helvetica').fillColor('#222')
      .text(String(i + 1), cols.no + 3, y + 6, { width: cw.no - 6, align: 'center' });
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111')
      .text(item.name, cols.desc + 3, y + 4, { width: cw.desc - 6 });
    if (item.description) {
      doc.fontSize(7.5).font('Helvetica').fillColor('#888')
        .text(item.description, cols.desc + 3, doc.y, { width: cw.desc - 6 });
    }
    doc.fontSize(8.5).font('Helvetica').fillColor('#222')
      .text(Number(item.quantity).toString(), cols.qty + 3, y + 6, { width: cw.qty - 6, align: 'center' })
      .text(item.unit, cols.sat + 3, y + 6, { width: cw.sat - 6, align: 'center' })
      .text(`Rp ${Number(item.price).toLocaleString('id-ID')}`, cols.price + 3, y + 6, { width: cw.price - 6, align: 'right' })
      .text(`Rp ${Number(item.total).toLocaleString('id-ID')}`, cols.total + 3, y + 6, { width: cw.total - 6, align: 'right' });
    y += rh;
  });

  y += 4;
  // Totals
  const totRows = [['Subtotal', invoice.subtotal, false]];
  if (Number(invoice.taxRate) > 0) totRows.push([`PPN ${Number(invoice.taxRate)}%`, invoice.taxAmount, false]);
  totRows.push(['TOTAL TAGIHAN', invoice.total, true]);
  if (Number(invoice.paidAmount) > 0) {
    totRows.push(['Sudah Dibayar', invoice.paidAmount, false, '#16a34a']);
    totRows.push(['Sisa Tagihan', Number(invoice.total) - Number(invoice.paidAmount), true, '#dc2626']);
  }

  totRows.forEach(([label, val, bold, color]) => {
    const bx = M + CW - 230;
    if (bold) {
      doc.rect(bx, y, 230, 20).fillColor(color || INV_HEADER_COLOR).fill();
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#fff')
        .text(label, bx + 8, y + 6, { width: 130 })
        .text(`Rp ${Number(val).toLocaleString('id-ID')}`, bx + 138, y + 6, { width: 84, align: 'right' });
    } else {
      doc.rect(bx, y, 230, 18).fillColor('#f8fffe').fill();
      doc.rect(bx, y, 230, 18).strokeColor('#b2dfdb').lineWidth(0.4).stroke();
      doc.fontSize(8.5).font('Helvetica').fillColor(color || '#333')
        .text(label, bx + 8, y + 5, { width: 130 })
        .text(`Rp ${Number(val).toLocaleString('id-ID')}`, bx + 138, y + 5, { width: 84, align: 'right' });
    }
    y += bold ? 20 : 18;
  });

  y += 14;
  // ── INFO BANK ─────────────────────────────────────
  if (company?.bankName) {
    doc.rect(M, y, CW, 46).fillColor('#f0fdf4').fill();
    doc.rect(M, y, CW, 46).strokeColor('#86efac').lineWidth(0.5).stroke();
    doc.rect(M, y, 4, 46).fillColor('#16a34a').fill();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#14532d').text('INFORMASI PEMBAYARAN', M + 12, y + 8);
    doc.fontSize(8.5).font('Helvetica').fillColor('#166534')
      .text(`Bank        : ${company.bankName}`, M + 12, doc.y + 3)
      .text(`No. Rekening: ${company.bankAccount}  a/n  ${company.bankHolder}`, M + 12, doc.y + 2);
    y += 54;
  }

  // ── NOTES ─────────────────────────────────────────
  if (invoice.notes) {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#444').text('Catatan:', M, y);
    doc.fontSize(8).font('Helvetica').fillColor('#666').text(invoice.notes, M, doc.y + 2, { width: CW });
    y = doc.y + 10;
  }

  // ── FOOTER ────────────────────────────────────────
  const footerY = PAGE_H - M - 55;
  doc.rect(M, footerY, CW, 1).fillColor('#ccc').fill();
  doc.fontSize(7.5).font('Helvetica').fillColor('#888')
    .text('Dokumen ini dibuat secara elektronik dan sah tanpa tanda tangan.', M, footerY + 6, { width: CW, align: 'center' })
    .text(`${company?.name || ''} | ${company?.email || ''} | ${company?.phone || ''}`, M, footerY + 16, { width: CW, align: 'center' });

  doc.end();
});

// ═══════════════════════════════════════════════════════
//  BUKTI PENGELUARAN KAS — FORM KAS KELUAR DENGAN TTD
// ═══════════════════════════════════════════════════════
const generateExpensePdf = (expenses, company, filters, docName = 'Bukti Pengeluaran Kas') => new Promise((resolve, reject) => {
  const doc = buildPdf((err, buf) => err ? reject(err) : resolve(buf));

  const NAVY = '#1a3557';
  const GOLD = '#c9a84c';

  // Nomor bukti
  const now = new Date();
  const prefix = company?.docPrefixExpense || 'BKK';
  const noBukti = `${prefix}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

  // ── KOP ────────────────────────────────────────────
  doc.rect(M, M, CW, 4).fillColor(NAVY).fill();
  doc.rect(M, M + 6, CW, 1.5).fillColor(GOLD).fill();

  const logo = getLogoBuffer(company);
  let headerY = M + 16;
  if (logo) {
    try { doc.image(logo, M, headerY, { height: 50, fit: [75, 50] }); } catch (e) {}
  }
  doc.fontSize(15).font('Helvetica-Bold').fillColor(NAVY)
    .text(company?.name || 'PT. NAMA PERUSAHAAN', M, headerY + 2, { width: CW, align: 'center' });
  doc.fontSize(8).font('Helvetica').fillColor('#444')
    .text(company?.address || '', M, doc.y + 2, { width: CW, align: 'center' })
    .text(`Telp: ${company?.phone || '-'}  |  Email: ${company?.email || '-'}`, M, doc.y + 1, { width: CW, align: 'center' });

  const kopBottom = doc.y + 8;
  doc.rect(M, kopBottom, CW, 1.5).fillColor(GOLD).fill();
  doc.rect(M, kopBottom + 3, CW, 4).fillColor(NAVY).fill();

  // ── JUDUL ─────────────────────────────────────────
  let y = kopBottom + 16;
  doc.fontSize(13).font('Helvetica-Bold').fillColor(NAVY)
    .text((company?.docNameExpense || docName).toUpperCase(), M, y, { width: CW, align: 'center', underline: true });
  y = doc.y + 4;
  doc.fontSize(9).font('Helvetica').fillColor('#666')
    .text('(Cash Disbursement Voucher)', M, y, { width: CW, align: 'center' });
  y = doc.y + 14;

  // ── INFO DOKUMEN ───────────────────────────────────
  // Kiri
  const lx = M, rx = M + CW / 2 + 10;
  const fw = CW / 2 - 20;

  const leftInfo = [
    ['No. Bukti', noBukti],
    ['Tanggal', formatDate(now)],
    ['Periode', filters?.period || formatDate(now)],
  ];
  const rightInfo = [
    ['Departemen', expenses[0]?.department || filters?.department || '-'],
    ['Diminta oleh', expenses[0]?.requestBy || filters?.requestBy || '-'],
  ];

  let ly = y, ry = y;
  leftInfo.forEach(([k, v]) => {
    doc.fontSize(9).font('Helvetica').fillColor('#444').text(k, lx, ly, { width: 80 }).text(':', lx + 80, ly).text(v, lx + 90, ly, { width: fw - 90 });
    ly += 14;
  });
  rightInfo.forEach(([k, v]) => {
    doc.fontSize(9).font('Helvetica').fillColor('#444').text(k, rx, ry, { width: 80 }).text(':', rx + 80, ry).text(v, rx + 90, ry, { width: fw - 90 });
    ry += 14;
  });
  y = Math.max(ly, ry) + 12;

  // ── TABEL PENGELUARAN ─────────────────────────────
  const rh = 18;
  doc.rect(M, y, CW, rh).fillColor(NAVY).fill();
  const tcols = [M, M + 22, M + 95, M + 230, M + 310, M + 390];
  const twids = [22, 73, 135, 80, 80, CW - 390];
  const theads = [['No', 'center'], ['Tanggal', 'center'], ['Nama Pengeluaran', 'left'],
    ['Kategori', 'center'], ['Departemen', 'center'], ['Jumlah (Rp)', 'right']];
  theads.forEach(([h, a], i) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#fff')
      .text(h, tcols[i] + 3, y + 5, { width: twids[i] - 6, align: a });
  });
  y += rh;

  let grandTotal = 0;
  expenses.forEach((exp, i) => {
    const bg = i % 2 === 0 ? '#f7f9fc' : '#fff';
    doc.rect(M, y, CW, rh).fillColor(bg).fill();
    doc.rect(M, y, CW, rh).strokeColor('#dde3ea').lineWidth(0.4).stroke();
    grandTotal += Number(exp.amount);
    doc.fontSize(8).font('Helvetica').fillColor('#222')
      .text(String(i + 1), tcols[0] + 3, y + 5, { width: twids[0] - 6, align: 'center' })
      .text(formatDate(exp.date), tcols[1] + 3, y + 5, { width: twids[1] - 6, align: 'center' })
      .text(exp.name, tcols[2] + 3, y + 5, { width: twids[2] - 6 })
      .text(exp.category || '-', tcols[3] + 3, y + 5, { width: twids[3] - 6, align: 'center' })
      .text(exp.department || '-', tcols[4] + 3, y + 5, { width: twids[4] - 6, align: 'center' })
      .text(Number(exp.amount).toLocaleString('id-ID'), tcols[5] + 3, y + 5, { width: twids[5] - 6, align: 'right' });
    y += rh;
  });

  // Total
  doc.rect(M, y, CW, rh + 2).fillColor(NAVY).fill();
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#fff')
    .text('TOTAL PENGELUARAN', tcols[0] + 3, y + 6, { width: twids[0] + twids[1] + twids[2] + twids[3] + twids[4] - 6 })
    .text(`Rp ${grandTotal.toLocaleString('id-ID')}`, tcols[5] + 3, y + 6, { width: twids[5] - 6, align: 'right' });
  y += rh + 2;

  y += 10;
  // Terbilang
  doc.rect(M, y, CW, 22).fillColor('#fffbeb').fill();
  doc.rect(M, y, CW, 22).strokeColor('#fbbf24').lineWidth(0.5).stroke();
  doc.fontSize(8.5).font('Helvetica').fillColor('#92400e')
    .text(`Terbilang: `, M + 8, y + 7, { continued: true })
    .font('Helvetica-Bold').text(`${grandTotal.toLocaleString('id-ID')} Rupiah`, { width: CW - 16 });
  y += 30;

  // ── TANDA TANGAN (3 kolom) ────────────────────────
  y += 6;
  const sigW = CW / 3 - 10;
  const sigPositions = [
    { x: M, label: 'Menyetujui', sublabel: '(Direktur / Manager)' },
    { x: M + CW / 3 + 5, label: 'Mengetahui', sublabel: '(Finance Manager)' },
    { x: M + (CW / 3) * 2 + 10, label: 'Penerima / PIC', sublabel: '(Nama & Tanda Tangan)' },
  ];

  sigPositions.forEach(({ x, label, sublabel }) => {
    // Box tanda tangan
    doc.rect(x, y, sigW, 75).fillColor('#fafafa').fill();
    doc.rect(x, y, sigW, 75).strokeColor('#ccc').lineWidth(0.5).stroke();

    // Header box
    doc.rect(x, y, sigW, 18).fillColor(NAVY).fill();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#fff')
      .text(label, x + 4, y + 5, { width: sigW - 8, align: 'center' });

    doc.fontSize(7.5).font('Helvetica').fillColor('#888')
      .text(sublabel, x + 4, y + 21, { width: sigW - 8, align: 'center' });

    // Garis tanda tangan
    doc.moveTo(x + 10, y + 65).lineTo(x + sigW - 10, y + 65).lineWidth(0.8).strokeColor('#999').stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor('#888')
      .text('(                                            )', x + 4, y + 67, { width: sigW - 8, align: 'center' });
  });

  y += 85;

  // ── CATATAN BAWAH ──────────────────────────────────
  doc.rect(M, y, CW, 1).fillColor('#ddd').fill();
  y += 6;
  doc.fontSize(7.5).font('Helvetica').fillColor('#999')
    .text('Dokumen ini merupakan bukti pengeluaran kas yang sah. Harap simpan sebagai arsip keuangan.', M, y, { width: CW, align: 'center' });

  // Garis bawah kop
  doc.rect(M, PAGE_H - M - 8, CW, 1.5).fillColor(GOLD).fill();
  doc.rect(M, PAGE_H - M - 4, CW, 4).fillColor(NAVY).fill();

  doc.end();
});

module.exports = { generateSphPdf, generateInvoicePdf, generateExpensePdf };
