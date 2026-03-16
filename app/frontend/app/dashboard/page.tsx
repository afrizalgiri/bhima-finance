'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { formatCurrency, formatDate, INVOICE_STATUS } from '../../lib/utils';
import { TrendingUp, TrendingDown, AlertCircle, Receipt, DollarSign, ClipboardList, Copy, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

interface FormToken { id: string; token: string; label: string | null; usedAt: string | null; createdAt: string; }

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<FormToken[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data.data)).finally(() => setLoading(false));
  }, []);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await api.get('/form-tokens');
      if (res.data.success) setTokens(res.data.data);
    } catch (e) {}
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const generateLink = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/form-tokens', { label: newLabel.trim() || null });
      if (res.data.success) {
        setNewLabel('');
        fetchTokens();
      }
    } catch (e) {}
    finally { setGenerating(false); }
  };

  const deleteToken = async (id: string) => {
    await api.delete(`/form-tokens/${id}`);
    fetchTokens();
  };

  const copyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/form/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

  const cards = [
    { title: 'Invoice Bulan Ini', value: formatCurrency(data?.invoicesThisMonth?.total || 0), sub: `${data?.invoicesThisMonth?.count || 0} invoice`, icon: Receipt, color: 'text-blue-600 bg-blue-50' },
    { title: 'Belum Dibayar', value: data?.unpaidInvoices || 0, sub: 'Invoice unpaid', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
    { title: 'Pemasukan Bulan Ini', value: formatCurrency(data?.totalIncomeMonth || 0), sub: 'Total pembayaran', icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { title: 'Pengeluaran Bulan Ini', value: formatCurrency(data?.totalExpensesMonth || 0), sub: 'Total operasional', icon: TrendingDown, color: 'text-orange-600 bg-orange-50' },
    { title: 'Cashflow', value: formatCurrency(data?.cashflow || 0), sub: 'Pemasukan - Pengeluaran', icon: DollarSign, color: (data?.cashflow || 0) >= 0 ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50' },
  ];

  const activeTokens = tokens.filter(t => !t.usedAt);
  const usedTokens = tokens.filter(t => t.usedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Ringkasan keuangan bulan berjalan</p>
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

      {/* RFP Link Generator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-600" />
            Link Request for Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generate new link */}
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Label (opsional, contoh: Budi - Bensin Maret)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateLink()}
            />
            <button
              onClick={generateLink}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
            >
              <Plus size={15} />
              {generating ? 'Membuat...' : 'Buat Link'}
            </button>
          </div>

          {/* Active tokens */}
          {activeTokens.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                <Clock size={12} /> Link Aktif ({activeTokens.length})
              </p>
              <div className="space-y-2">
                {activeTokens.map(t => {
                  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/form/${t.token}`;
                  return (
                    <div key={t.id} className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex-1 min-w-0">
                        {t.label && <p className="text-sm font-medium text-gray-800">{t.label}</p>}
                        <p className="text-xs text-gray-500 truncate font-mono">{url}</p>
                      </div>
                      <button
                        onClick={() => copyLink(t.token, t.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg shrink-0 transition-colors ${
                          copiedId === t.id
                            ? 'bg-green-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {copiedId === t.id ? <><CheckCircle2 size={12} /> Tersalin</> : <><Copy size={12} /> Salin</>}
                      </button>
                      <button onClick={() => deleteToken(t.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Used tokens */}
          {usedTokens.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1">
                <CheckCircle2 size={12} /> Sudah Digunakan ({usedTokens.length})
              </p>
              <div className="space-y-1.5">
                {usedTokens.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg opacity-60">
                    <div className="flex-1 min-w-0">
                      {t.label && <span className="text-sm text-gray-600">{t.label}</span>}
                      <span className="text-xs text-gray-400 ml-2">
                        digunakan {new Date(t.usedAt!).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <button onClick={() => deleteToken(t.id)}
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tokens.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">
              Belum ada link. Buat link baru untuk dibagikan ke anggota tim.
            </p>
          )}
        </CardContent>
      </Card>

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
