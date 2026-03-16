'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { formatCurrency, formatDate, INVOICE_STATUS } from '../../lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, Receipt, DollarSign, ClipboardList, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  const cards = [
    { title: 'Invoice Bulan Ini', value: formatCurrency(data?.invoicesThisMonth?.total || 0), sub: `${data?.invoicesThisMonth?.count || 0} invoice`, icon: Receipt, color: 'text-blue-600 bg-blue-50' },
    { title: 'Belum Dibayar', value: data?.unpaidInvoices || 0, sub: 'Invoice unpaid', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
    { title: 'Pemasukan Bulan Ini', value: formatCurrency(data?.totalIncomeMonth || 0), sub: 'Total pembayaran', icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { title: 'Pengeluaran Bulan Ini', value: formatCurrency(data?.totalExpensesMonth || 0), sub: 'Total operasional', icon: TrendingDown, color: 'text-orange-600 bg-orange-50' },
    { title: 'Cashflow', value: formatCurrency(data?.cashflow || 0), sub: 'Pemasukan - Pengeluaran', icon: DollarSign, color: (data?.cashflow || 0) >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50' },
  ];

  const [copied, setCopied] = useState(false);
  const publicFormUrl = typeof window !== 'undefined' ? `${window.location.origin}/form` : '/form';
  const copyLink = () => { navigator.clipboard.writeText(publicFormUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">Ringkasan keuangan bulan berjalan</p>
        </div>
        {/* RFP Public Form Banner */}
        <div className="flex items-center gap-3 bg-blue-900 text-white px-4 py-2.5 rounded-xl shadow-sm">
          <ClipboardList size={18} className="shrink-0" />
          <div>
            <p className="text-xs font-semibold">Link Form Request for Payment</p>
            <p className="text-xs text-blue-300 truncate max-w-[200px]">{publicFormUrl}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={copyLink} title="Salin link"
              className="p-1.5 rounded-lg hover:bg-blue-800 transition-colors">
              <Copy size={14} />
            </button>
            <Link href="/form" target="_blank" title="Buka form"
              className="p-1.5 rounded-lg hover:bg-blue-800 transition-colors">
              <ExternalLink size={14} />
            </Link>
          </div>
          {copied && <span className="text-xs text-green-300 font-medium">Tersalin!</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{card.title}</p>
                    <p className="text-xl font-bold text-gray-900">{card.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                  </div>
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icon size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Invoice Terbaru
              <Link href="/invoices" className="text-xs text-blue-600 font-normal hover:underline">Lihat semua</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentInvoices?.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Belum ada invoice</p>
            ) : (
              <div className="space-y-2">
                {data?.recentInvoices?.map((inv: any) => {
                  const status = INVOICE_STATUS.find(s => s.value === inv.status);
                  return (
                    <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium">{inv.number}</p>
                        <p className="text-xs text-gray-500">{inv.client?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(inv.total)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status?.color}`}>{status?.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Pengeluaran Terbaru
              <Link href="/expenses" className="text-xs text-blue-600 font-normal hover:underline">Lihat semua</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentExpenses?.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Belum ada pengeluaran</p>
            ) : (
              <div className="space-y-2">
                {data?.recentExpenses?.map((exp: any) => (
                  <div key={exp.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium">{exp.name}</p>
                      <p className="text-xs text-gray-500">{formatDate(exp.date)} · {exp.category}</p>
                    </div>
                    <p className="text-sm font-medium text-red-600">-{formatCurrency(exp.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
