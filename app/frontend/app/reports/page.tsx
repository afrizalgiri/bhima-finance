'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { Download } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type Tab = 'cashflow' | 'invoices' | 'payments' | 'expenses' | 'rfp';

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  UNPAID:  { label: 'Belum Dibayar', cls: 'bg-red-100 text-red-700' },
  PARTIAL: { label: 'Sebagian',      cls: 'bg-yellow-100 text-yellow-700' },
  PAID:    { label: 'Lunas',         cls: 'bg-green-100 text-green-700' },
  OVERDUE: { label: 'Jatuh Tempo',   cls: 'bg-red-200 text-red-800' },
};

const RFP_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Menunggu',     cls: 'bg-yellow-100 text-yellow-800' },
  VERIFIED: { label: 'Terverifikasi',cls: 'bg-blue-100 text-blue-800' },
  APPROVED: { label: 'Disetujui',    cls: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Ditolak',      cls: 'bg-red-100 text-red-800' },
};

const METHODS: Record<string, string> = {
  TRANSFER: 'Transfer Bank', CASH: 'Tunai', CHECK: 'Cek', OTHER: 'Lainnya',
};

const EXPENSE_CATS: Record<string, string> = {
  TRANSPORT: 'Transport', MEALS: 'Makan & Minum', TRAVEL: 'Perjalanan Dinas',
  OFFICE: 'Operasional Kantor', UTILITIES: 'Utilitas', MARKETING: 'Marketing', OTHER: 'Lainnya',
};

const RFP_CATS: Record<string, string> = {
  SALTAB_EVENT: 'SALTAB EVENT', CLAIM_REIMBURSEMENT: 'CLAIM / REIMBURSE',
  CASH_ADVANCE: 'CASH ADVANCE', SUPPORT_BUDGET: 'SUPPORT BUDGET', OTHERS: 'OTHERS',
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'cashflow',  label: 'Cashflow' },
  { key: 'invoices',  label: 'Invoice' },
  { key: 'payments',  label: 'Pembayaran' },
  { key: 'expenses',  label: 'Pengeluaran' },
  { key: 'rfp',       label: 'Request for Payment' },
];

function SummaryCard({ label, value, color = '' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{typeof value === 'number' ? fmt(value) : value}</p>
    </div>
  );
}

function EmptyState({ text = 'Tidak ada data untuk periode ini' }) {
  return (
    <div className="text-center py-10 text-gray-400 text-sm">{text}</div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('cashflow');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xlLoading, setXlLoading] = useState(false);

  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await api.get(`/reports/${tab}`, { params: { month, year } });
      setData(r.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Gagal memuat laporan.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [tab, month, year]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const downloadExcel = async () => {
    setXlLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const url = `${API_BASE}/reports/export?type=${tab}&month=${month}&year=${year}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Gagal generate Excel');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Laporan_${tab}_${year}_${month.padStart(2,'0')}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      alert(e.message || 'Gagal download Excel');
    } finally {
      setXlLoading(false);
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan</h1>
        <p className="text-gray-500 text-sm">Semua dokumen keuangan per periode</p>
      </div>

      {/* Filter + Download */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bulan</label>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
          >
            {MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tahun</label>
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-28"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button
          onClick={downloadExcel}
          disabled={xlLoading || loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <Download size={15} />
          {xlLoading ? 'Generating...' : 'Download Excel'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button onClick={fetchReport} className="ml-3 underline text-red-600 hover:text-red-800">Coba lagi</button>
        </div>
      ) : !data ? null : (
        <>
          {/* ── CASHFLOW ── */}
          {tab === 'cashflow' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryCard label="Total Pemasukan" value={data.summary?.totalIncome ?? 0} color="text-green-600" />
                <SummaryCard label="Total Pengeluaran" value={data.summary?.totalExpense ?? 0} color="text-red-600" />
                <SummaryCard
                  label="Net Cashflow"
                  value={data.summary?.netCashflow ?? 0}
                  color={(data.summary?.netCashflow ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-semibold text-sm text-gray-700">Pembayaran Diterima</h3>
                  </div>
                  <div className="overflow-x-auto">
                    {!data.data?.payments?.length ? <EmptyState /> : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Tanggal</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Invoice</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Klien</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.data.payments.map((p: any) => (
                            <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-500">{fmtDate(p.date)}</td>
                              <td className="px-3 py-2 text-blue-600 font-medium">{p.invoice?.number}</td>
                              <td className="px-3 py-2">{p.invoice?.client?.name || '-'}</td>
                              <td className="px-3 py-2 text-right font-medium text-green-600">{fmt(p.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 bg-gray-50">
                            <td colSpan={3} className="px-3 py-2 font-bold text-right text-xs uppercase text-gray-500">Total</td>
                            <td className="px-3 py-2 text-right font-bold text-green-600">{fmt(data.summary?.totalIncome ?? 0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <h3 className="font-semibold text-sm text-gray-700">Pengeluaran</h3>
                  </div>
                  <div className="overflow-x-auto">
                    {!data.data?.expenses?.length ? <EmptyState /> : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Tanggal</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Nama</th>
                            <th className="px-3 py-2 text-right font-medium text-gray-600">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.data.expenses.map((e: any) => (
                            <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-500">{fmtDate(e.date)}</td>
                              <td className="px-3 py-2">{e.name}</td>
                              <td className="px-3 py-2 text-right font-medium text-red-600">{fmt(e.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 bg-gray-50">
                            <td colSpan={2} className="px-3 py-2 font-bold text-right text-xs uppercase text-gray-500">Total</td>
                            <td className="px-3 py-2 text-right font-bold text-red-600">{fmt(data.summary?.totalExpense ?? 0)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── INVOICES ── */}
          {tab === 'invoices' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard label="Jumlah Invoice" value={`${data.summary?.count ?? 0} doc`} />
                <SummaryCard label="Total Nilai" value={data.summary?.total ?? 0} />
                <SummaryCard label="Sudah Lunas" value={data.summary?.paid ?? 0} color="text-green-600" />
                <SummaryCard label="Belum Lunas" value={data.summary?.unpaid ?? 0} color="text-red-600" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {!data.data?.length ? <EmptyState /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-900 text-white">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Nomor</th>
                          <th className="px-3 py-2 text-left font-medium">Klien</th>
                          <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                          <th className="px-3 py-2 text-left font-medium">Jatuh Tempo</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                          <th className="px-3 py-2 text-center font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.data.map((inv: any, i: number) => {
                          const st = INVOICE_STATUS[inv.status];
                          return (
                            <tr key={inv.id} className={`border-t border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                              <td className="px-3 py-2 font-medium text-blue-600">{inv.number}</td>
                              <td className="px-3 py-2">{inv.client?.name || '-'}</td>
                              <td className="px-3 py-2 text-gray-500">{fmtDate(inv.date)}</td>
                              <td className="px-3 py-2 text-gray-500">{fmtDate(inv.dueDate)}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(inv.total)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st?.cls || 'bg-gray-100 text-gray-600'}`}>
                                  {st?.label || inv.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-blue-900 text-white">
                          <td colSpan={4} className="px-3 py-2 font-bold text-right text-xs uppercase">Total</td>
                          <td className="px-3 py-2 text-right font-bold">{fmt(data.summary?.total ?? 0)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {tab === 'payments' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard label="Jumlah Transaksi" value={`${data.summary?.count ?? 0} transaksi`} />
                <SummaryCard label="Total Pembayaran" value={data.summary?.total ?? 0} color="text-green-600" />
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {!data.data?.length ? <EmptyState /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-900 text-white">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                          <th className="px-3 py-2 text-left font-medium">No. Invoice</th>
                          <th className="px-3 py-2 text-left font-medium">Klien</th>
                          <th className="px-3 py-2 text-left font-medium">Metode</th>
                          <th className="px-3 py-2 text-left font-medium">Referensi</th>
                          <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.data.map((p: any, i: number) => (
                          <tr key={p.id} className={`border-t border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                            <td className="px-3 py-2 text-gray-500">{fmtDate(p.date)}</td>
                            <td className="px-3 py-2 text-blue-600 font-medium">{p.invoice?.number || '-'}</td>
                            <td className="px-3 py-2">{p.invoice?.client?.name || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{METHODS[p.method] || p.method}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{p.reference || '-'}</td>
                            <td className="px-3 py-2 text-right font-medium text-green-600">{fmt(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-blue-900 text-white">
                          <td colSpan={5} className="px-3 py-2 font-bold text-right text-xs uppercase">Total</td>
                          <td className="px-3 py-2 text-right font-bold">{fmt(data.summary?.total ?? 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EXPENSES ── */}
          {tab === 'expenses' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard label="Jumlah Transaksi" value={`${data.summary?.count ?? 0} transaksi`} />
                <SummaryCard label="Total Pengeluaran" value={data.summary?.total ?? 0} color="text-red-600" />
              </div>
              {data.summary?.byCategory && Object.keys(data.summary.byCategory).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(data.summary.byCategory).map(([cat, amt]: any) => (
                    <SummaryCard key={cat} label={EXPENSE_CATS[cat] || cat} value={amt} color="text-red-600" />
                  ))}
                </div>
              )}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {!data.data?.length ? <EmptyState /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-900 text-white">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                          <th className="px-3 py-2 text-left font-medium">Nama</th>
                          <th className="px-3 py-2 text-left font-medium">Kategori</th>
                          <th className="px-3 py-2 text-left font-medium">Departemen</th>
                          <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.data.map((e: any, i: number) => (
                          <tr key={e.id} className={`border-t border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                            <td className="px-3 py-2 text-gray-500">{fmtDate(e.date)}</td>
                            <td className="px-3 py-2 font-medium">{e.name}</td>
                            <td className="px-3 py-2 text-gray-600 text-xs">{EXPENSE_CATS[e.category] || e.category}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{e.department || '-'}</td>
                            <td className="px-3 py-2 text-right font-medium text-red-600">{fmt(e.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-blue-900 text-white">
                          <td colSpan={4} className="px-3 py-2 font-bold text-right text-xs uppercase">Total</td>
                          <td className="px-3 py-2 text-right font-bold">{fmt(data.summary?.total ?? 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RFP ── */}
          {tab === 'rfp' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard label="Jumlah RFP" value={`${data.summary?.count ?? 0} doc`} />
                <SummaryCard label="Total Nilai" value={data.summary?.total ?? 0} />
                <SummaryCard label="Total Disetujui" value={data.summary?.totalApproved ?? 0} color="text-green-600" />
                <SummaryCard label="Total Pending" value={data.summary?.totalPending ?? 0} color="text-yellow-600" />
              </div>
              {data.summary?.byStatus && Object.keys(data.summary.byStatus).length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(data.summary.byStatus).map(([st, cnt]: any) => {
                    const s = RFP_STATUS[st];
                    return (
                      <div key={st} className="bg-white rounded-lg border p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s?.cls || 'bg-gray-100 text-gray-600'}`}>
                          {s?.label || st}
                        </span>
                        <p className="mt-1 text-xl font-bold text-gray-800">{cnt}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {!data.data?.length ? <EmptyState /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-blue-900 text-white">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Nomor</th>
                          <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                          <th className="px-3 py-2 text-left font-medium">Pemohon</th>
                          <th className="px-3 py-2 text-left font-medium">Proyek</th>
                          <th className="px-3 py-2 text-left font-medium">Kategori</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                          <th className="px-3 py-2 text-center font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.data.map((r: any, i: number) => {
                          const st = RFP_STATUS[r.status];
                          return (
                            <tr key={r.id} className={`border-t border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                              <td className="px-3 py-2 font-medium text-blue-600">{r.number}</td>
                              <td className="px-3 py-2 text-gray-500">{fmtDate(r.date)}</td>
                              <td className="px-3 py-2">{r.name}</td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{r.project || '-'}</td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{RFP_CATS[r.rfpCategory] || r.rfpCategory}</td>
                              <td className="px-3 py-2 text-right font-medium">{fmt(r.total)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st?.cls || 'bg-gray-100 text-gray-600'}`}>
                                  {st?.label || r.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300 bg-blue-900 text-white">
                          <td colSpan={5} className="px-3 py-2 font-bold text-right text-xs uppercase">Total</td>
                          <td className="px-3 py-2 text-right font-bold">{fmt(data.summary?.total ?? 0)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
