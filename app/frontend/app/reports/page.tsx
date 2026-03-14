'use client';
import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { formatCurrency, formatDate, INVOICE_STATUS, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../lib/utils';

type Tab = 'invoices' | 'payments' | 'expenses' | 'cashflow';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('cashflow');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const now = new Date();
  const [filters, setFilters] = useState({ month: String(now.getMonth() + 1), year: String(now.getFullYear()) });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/reports/${tab}`, { params: filters });
      setData(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, [tab, filters]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'cashflow', label: 'Cashflow' },
    { key: 'invoices', label: 'Invoice' },
    { key: 'payments', label: 'Pembayaran' },
    { key: 'expenses', label: 'Pengeluaran' },
  ];

  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Laporan Keuangan</h1>
        <p className="text-gray-500 text-sm">Laporan keuangan per periode</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div><Label>Bulan</Label><Select value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})} className="mt-1 w-36">{months.map((m,i) => <option key={i+1} value={String(i+1)}>{m}</option>)}</Select></div>
        <div><Label>Tahun</Label><Input type="number" value={filters.year} onChange={e => setFilters({...filters, year: e.target.value})} className="mt-1 w-24" min="2020" max="2099" /></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : (
        <>
          {tab === 'cashflow' && data && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Total Pemasukan</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.summary?.totalIncome || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Total Pengeluaran</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.summary?.totalExpense || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Net Cashflow</p><p className={`text-xl font-bold ${(data.summary?.netCashflow || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(data.summary?.netCashflow || 0)}</p></CardContent></Card>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card><CardHeader><CardTitle className="text-base">Pembayaran Diterima</CardTitle></CardHeader><CardContent>
                  <table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-1 font-semibold">Tanggal</th><th className="text-left py-1 font-semibold">Invoice</th><th className="text-right py-1 font-semibold">Jumlah</th></tr></thead>
                  <tbody>{data.data?.payments?.map((p: any) => <tr key={p.id} className="border-b border-gray-100"><td className="py-1.5 text-gray-600">{formatDate(p.date)}</td><td className="py-1.5 text-blue-600">{p.invoice?.number}</td><td className="py-1.5 text-right text-green-600 font-medium">{formatCurrency(p.amount)}</td></tr>)}</tbody>
                  </table>
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">Pengeluaran</CardTitle></CardHeader><CardContent>
                  <table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-1 font-semibold">Tanggal</th><th className="text-left py-1 font-semibold">Nama</th><th className="text-right py-1 font-semibold">Jumlah</th></tr></thead>
                  <tbody>{data.data?.expenses?.map((e: any) => <tr key={e.id} className="border-b border-gray-100"><td className="py-1.5 text-gray-600">{formatDate(e.date)}</td><td className="py-1.5">{e.name}</td><td className="py-1.5 text-right text-red-600 font-medium">{formatCurrency(e.amount)}</td></tr>)}</tbody>
                  </table>
                </CardContent></Card>
              </div>
            </div>
          )}

          {tab === 'invoices' && data && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Total Invoice</p><p className="text-xl font-bold">{formatCurrency(data.summary?.total || 0)}</p><p className="text-xs text-gray-400">{data.summary?.count} invoice</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Sudah Dibayar</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.summary?.paid || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Belum Dibayar</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.summary?.unpaid || 0)}</p></CardContent></Card>
              </div>
              <Card><CardContent className="p-4"><table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 font-semibold">Nomor</th><th className="text-left py-2 font-semibold">Klien</th><th className="text-left py-2 font-semibold">Tanggal</th><th className="text-right py-2 font-semibold">Total</th><th className="text-left py-2 font-semibold">Status</th></tr></thead>
                <tbody>{data.data?.map((inv: any) => { const st = INVOICE_STATUS.find(s => s.value === inv.status); return <tr key={inv.id} className="border-b border-gray-100"><td className="py-2 font-medium text-blue-600">{inv.number}</td><td className="py-2">{inv.client?.name}</td><td className="py-2 text-gray-500">{formatDate(inv.date)}</td><td className="py-2 text-right font-medium">{formatCurrency(inv.total)}</td><td className="py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${st?.color}`}>{st?.label}</span></td></tr>; })}</tbody>
              </table></CardContent></Card>
            </div>
          )}

          {tab === 'payments' && data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Total Pembayaran</p><p className="text-xl font-bold text-green-600">{formatCurrency(data.summary?.total || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Jumlah Transaksi</p><p className="text-xl font-bold">{data.summary?.count}</p></CardContent></Card>
              </div>
              <Card><CardContent className="p-4"><table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 font-semibold">Tanggal</th><th className="text-left py-2 font-semibold">Invoice</th><th className="text-left py-2 font-semibold">Klien</th><th className="text-right py-2 font-semibold">Jumlah</th><th className="text-left py-2 font-semibold">Metode</th></tr></thead>
                <tbody>{data.data?.map((p: any) => <tr key={p.id} className="border-b border-gray-100"><td className="py-2 text-gray-600">{formatDate(p.date)}</td><td className="py-2 text-blue-600">{p.invoice?.number}</td><td className="py-2">{p.invoice?.client?.name}</td><td className="py-2 text-right font-medium text-green-600">{formatCurrency(p.amount)}</td><td className="py-2 text-gray-600">{PAYMENT_METHODS.find(m => m.value === p.method)?.label}</td></tr>)}</tbody>
              </table></CardContent></Card>
            </div>
          )}

          {tab === 'expenses' && data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Total Pengeluaran</p><p className="text-xl font-bold text-red-600">{formatCurrency(data.summary?.total || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-xs text-gray-500">Jumlah Transaksi</p><p className="text-xl font-bold">{data.summary?.count}</p></CardContent></Card>
              </div>
              {data.summary?.byCategory && (
                <Card><CardHeader><CardTitle className="text-base">Per Kategori</CardTitle></CardHeader><CardContent>
                  <div className="space-y-2">{Object.entries(data.summary.byCategory).map(([cat, amt]: any) => {
                    const label = EXPENSE_CATEGORIES.find(c => c.value === cat)?.label || cat;
                    return <div key={cat} className="flex justify-between py-1 border-b border-gray-100"><span className="text-sm">{label}</span><span className="font-medium text-red-600">{formatCurrency(amt)}</span></div>;
                  })}</div>
                </CardContent></Card>
              )}
              <Card><CardContent className="p-4"><table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 font-semibold">Tanggal</th><th className="text-left py-2 font-semibold">Nama</th><th className="text-left py-2 font-semibold">Kategori</th><th className="text-right py-2 font-semibold">Nominal</th></tr></thead>
                <tbody>{data.data?.map((e: any) => <tr key={e.id} className="border-b border-gray-100"><td className="py-2 text-gray-600">{formatDate(e.date)}</td><td className="py-2">{e.name}</td><td className="py-2 text-gray-600 text-xs">{EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label}</td><td className="py-2 text-right font-medium text-red-600">{formatCurrency(e.amount)}</td></tr>)}</tbody>
              </table></CardContent></Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
