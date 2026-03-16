'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import { Search, Eye, Trash2, Download, RefreshCw, ExternalLink, Copy } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

const CATEGORY_LABELS: Record<string, string> = {
  SALTAB_EVENT: 'SALTAB EVENT',
  CLAIM_REIMBURSEMENT: 'CLAIM / REIMBURSEMENT',
  CASH_ADVANCE: 'CASH ADVANCE / UANG MUKA',
  SUPPORT_BUDGET: 'SUPPORT BUDGET',
  OTHERS: 'OTHERS',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

interface RfpItem { id: string; description: string; amount: number; }
interface Rfp {
  id: string; number: string; date: string; dueDate?: string;
  detailsOfPayment?: string; project?: string; description?: string;
  name: string; beneficiary?: string; bankNorek?: string;
  rfpCategory: string; status: string; notes?: string;
  items: RfpItem[]; createdAt: string;
}
interface Signature { id: string; name: string; title?: string; imageUrl: string; }

export default function ExpenseRequestsPage() {
  const { user } = useAuth();
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Rfp | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [pdfSigIds, setPdfSigIds] = useState(['', '', '', '']);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState({ status: '', notes: '' });
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicFormUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/form`
    : '/form';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/expense-requests', { params });
      if (res.data.success) { setRfps(res.data.data); setTotal(res.data.total); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  const fetchSignatures = useCallback(async () => {
    try {
      const res = await api.get('/signatures');
      if (res.data.success) setSignatures(res.data.data);
    } catch (e) {}
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchSignatures(); }, [fetchSignatures]);

  const openDetail = (rfp: Rfp) => {
    setSelected(rfp);
    setStatusUpdate({ status: rfp.status, notes: rfp.notes || '' });
    setShowDetail(true);
  };

  const handleUpdateStatus = async () => {
    if (!selected) return;
    setUpdating(true);
    try {
      const res = await api.put(`/expense-requests/${selected.id}/status`, statusUpdate);
      if (res.data.success) {
        setSelected(res.data.data);
        fetchAll();
      }
    } catch (e) {}
    finally { setUpdating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus request ini?')) return;
    await api.delete(`/expense-requests/${id}`);
    fetchAll();
    if (selected?.id === id) setShowDetail(false);
  };

  const handleDownloadPdf = async () => {
    if (!selected) return;
    setPdfLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`${API_BASE}/api/expense-requests/${selected.id}/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ signatureIds: pdfSigIds.map(id => id || null) }),
      });
      if (!res.ok) throw new Error('Gagal');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RFP-${selected.number.replace(/\//g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setShowPdfDialog(false);
    } catch (e) { alert('Gagal download PDF'); }
    finally { setPdfLoading(false); }
  };

  const copyFormLink = () => {
    navigator.clipboard.writeText(publicFormUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const grandTotal = (rfp: Rfp) => rfp.items.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Request for Payment</h1>
          <p className="text-sm text-gray-500">{total} permintaan pembayaran</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyFormLink}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200"
          >
            {copied ? <><Copy size={15} /> Tersalin!</> : <><ExternalLink size={15} /> Link Form Public</>}
          </button>
          <button onClick={fetchAll} className="p-2 rounded-lg hover:bg-gray-100">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
            placeholder="Cari nomor, nama, proyek..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 text-sm border rounded-lg bg-white"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">Semua Status</option>
          <option value="PENDING">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">No. RFP</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Tanggal</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nama / PIC</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Proyek</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Kategori</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Memuat...</td></tr>
            ) : rfps.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Belum ada request</td></tr>
            ) : rfps.map(rfp => (
              <tr key={rfp.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs font-medium">{rfp.number}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(rfp.date)}</td>
                <td className="px-4 py-3 font-medium">{rfp.name}</td>
                <td className="px-4 py-3 text-gray-600">{rfp.project || '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{CATEGORY_LABELS[rfp.rfpCategory] || rfp.rfpCategory}</td>
                <td className="px-4 py-3 text-right font-medium">{fmt(grandTotal(rfp))}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[rfp.status] || 'bg-gray-100 text-gray-700'}`}>
                    {rfp.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => openDetail(rfp)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Detail">
                      <Eye size={15} />
                    </button>
                    <button onClick={() => { setSelected(rfp); setPdfSigIds(['', '', '', '']); setShowPdfDialog(true); }}
                      className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Download PDF">
                      <Download size={15} />
                    </button>
                    {user?.role === 'ADMIN' && (
                      <button onClick={() => handleDelete(rfp.id)} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="Hapus">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {showDetail && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{selected.number}</h2>
                <p className="text-sm text-gray-500">Request for Payment</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {([
                  ['Date', fmtDate(selected.date)],
                  ['Due Date', selected.dueDate ? fmtDate(selected.dueDate) : '-'],
                  ['Name / PIC', selected.name],
                  ['Beneficiary', selected.beneficiary || '-'],
                  ['Bank / Norek', selected.bankNorek || '-'],
                  ['Project', selected.project || '-'],
                  ['Details of Payment', selected.detailsOfPayment || '-'],
                  ['Description', selected.description || '-'],
                  ['Category', CATEGORY_LABELS[selected.rfpCategory] || selected.rfpCategory],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs text-gray-400 uppercase tracking-wide">{k}</div>
                    <div className="font-medium text-gray-800">{v}</div>
                  </div>
                ))}
              </div>

              {/* Items table */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</div>
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item, i) => (
                      <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2">{item.description}</td>
                        <td className="px-3 py-2 text-right">{fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-900 text-white">
                    <tr>
                      <td className="px-3 py-2 font-bold">TOTAL</td>
                      <td className="px-3 py-2 text-right font-bold">{fmt(grandTotal(selected))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Status update */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="text-sm font-semibold text-gray-700 mb-3">Update Status</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Status</label>
                    <select
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
                      value={statusUpdate.status}
                      onChange={e => setStatusUpdate(s => ({ ...s, status: e.target.value }))}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Catatan</label>
                    <input
                      className="w-full px-3 py-2 text-sm border rounded-lg"
                      placeholder="Catatan opsional..."
                      value={statusUpdate.notes}
                      onChange={e => setStatusUpdate(s => ({ ...s, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <button
                  onClick={handleUpdateStatus}
                  disabled={updating}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? 'Menyimpan...' : 'Update Status'}
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowDetail(false); setPdfSigIds(['', '', '', '']); setShowPdfDialog(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  <Download size={15} /> Download PDF
                </button>
                {user?.role === 'ADMIN' && (
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                  >
                    <Trash2 size={15} /> Hapus
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Signature Dialog */}
      {showPdfDialog && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Download PDF — {selected.number}</h2>
              <button onClick={() => setShowPdfDialog(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">Pilih tanda tangan untuk setiap blok approval (opsional):</p>
              {['PREPARED / PIC (Admin)', 'VERIFIED / FINANCE (AP/Treasury/AR)', 'SM FINANCE', 'APPROVED (Direktur Utama)'].map((label, idx) => (
                <div key={idx}>
                  <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">{label}</label>
                  <select
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
                    value={pdfSigIds[idx]}
                    onChange={e => setPdfSigIds(ids => ids.map((v, i) => i === idx ? e.target.value : v))}
                  >
                    <option value="">— Tanpa Tanda Tangan —</option>
                    {signatures.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.title ? ` (${s.title})` : ''}</option>
                    ))}
                  </select>
                  {pdfSigIds[idx] && (() => {
                    const sig = signatures.find(s => s.id === pdfSigIds[idx]);
                    return sig ? (
                      <img src={`${API_BASE}/${sig.imageUrl}`} alt="ttd" className="mt-1 h-10 object-contain" />
                    ) : null;
                  })()}
                </div>
              ))}
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowPdfDialog(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Batal</button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download size={15} />
                  {pdfLoading ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
