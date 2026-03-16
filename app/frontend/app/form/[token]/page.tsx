'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Trash2, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../../../lib/api';

const CATEGORIES = [
  { value: 'SALTAB_EVENT', label: 'SALTAB EVENT' },
  { value: 'CLAIM_REIMBURSEMENT', label: 'CLAIM / REIMBURSEMENT' },
  { value: 'OTHERS', label: 'OTHERS' },
  { value: 'CASH_ADVANCE', label: 'CASH ADVANCE / UANG MUKA' },
  { value: 'SUPPORT_BUDGET', label: 'SUPPORT BUDGET' },
];

interface Item { description: string; amount: string; }
const initialItem = (): Item => ({ description: '', amount: '' });

export default function FormTokenPage() {
  const params = useParams();
  const token = params.token as string;

  const [tokenState, setTokenState] = useState<'loading' | 'valid' | 'invalid' | 'used'>('loading');
  const [tokenLabel, setTokenLabel] = useState('');

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    detailsOfPayment: '',
    project: '',
    description: '',
    name: '',
    email: '',
    beneficiary: '',
    bankNorek: '',
    rfpCategory: 'OTHERS',
    notes: '',
  });
  const [items, setItems] = useState<Item[]>([initialItem()]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Validate token on load
  useEffect(() => {
    if (!token) { setTokenState('invalid'); return; }
    api.get(`/form-tokens/validate/${token}`)
      .then(res => {
        if (res.data.success) {
          setTokenState('valid');
          setTokenLabel(res.data.label || '');
        } else {
          setTokenState(res.data.used ? 'used' : 'invalid');
        }
      })
      .catch(err => {
        const status = err?.response?.status;
        setTokenState(status === 410 ? 'used' : 'invalid');
      });
  }, [token]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i: number, k: keyof Item, v: string) =>
    setItems(its => its.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems(its => [...its, initialItem()]);
  const removeItem = (i: number) => setItems(its => its.filter((_, idx) => idx !== i));

  const total = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Nama wajib diisi');
    const validItems = items.filter(it => it.description.trim() && parseFloat(it.amount) > 0);
    if (validItems.length === 0) return setError('Minimal 1 item dengan deskripsi dan jumlah harus diisi');

    setLoading(true);
    try {
      const res = await api.post('/expense-requests/submit', {
        ...form,
        formToken: token,
        items: validItems.map(it => ({ description: it.description, amount: parseFloat(it.amount) })),
      });
      if (res.data.success) {
        setSuccess(res.data.message || 'Request berhasil dikirim!');
        setTokenState('used'); // link now consumed
      } else {
        setError(res.data.message || 'Gagal mengirim request');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      if (e?.response?.status === 410) {
        setTokenState('used');
      } else {
        setError(msg || 'Koneksi gagal. Coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ──
  if (tokenState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Invalid token ──
  if (tokenState === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <XCircle size={52} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Tidak Valid</h2>
          <p className="text-gray-500 text-sm">
            Link ini tidak ditemukan atau sudah dihapus oleh admin.
            Hubungi tim finance untuk mendapatkan link baru.
          </p>
        </div>
      </div>
    );
  }

  // ── Already used ──
  if (tokenState === 'used' && !success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <XCircle size={52} className="text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Sudah Digunakan</h2>
          <p className="text-gray-500 text-sm">
            Link ini hanya berlaku untuk 1 pengajuan dan sudah pernah digunakan.
            Hubungi tim finance untuk mendapatkan link baru.
          </p>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Terkirim!</h2>
          <p className="text-gray-600 mb-4">{success}</p>
          <p className="text-xs text-gray-400">
            Tim finance akan segera memproses pengajuan Anda.
            Link ini telah hangus dan tidak bisa digunakan lagi.
          </p>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 pt-6">
          <div className="inline-flex items-center gap-2 bg-blue-900 text-white px-5 py-2 rounded-full text-sm font-semibold tracking-wide mb-3">
            REQUEST FOR PAYMENT
          </div>
          {tokenLabel && (
            <p className="text-blue-700 font-medium text-sm mb-1">Untuk: {tokenLabel}</p>
          )}
          <p className="text-gray-500 text-sm">Isi form berikut untuk mengajukan permintaan pembayaran ke tim finance</p>
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
            ⚠ Link ini hanya berlaku 1 kali
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md overflow-hidden">
          {/* Section: Info */}
          <div className="px-6 py-5 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-4">Informasi Umum</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">DATE <span className="text-red-500">*</span></label>
                <input type="date" required value={form.date} onChange={e => set('date', e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">DUE DATE</label>
                <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">DETAILS OF PAYMENT</label>
                <input type="text" value={form.detailsOfPayment} onChange={e => set('detailsOfPayment', e.target.value)}
                  placeholder="Keperluan pembayaran..."
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">PROJECT</label>
                <input type="text" value={form.project} onChange={e => set('project', e.target.value)}
                  placeholder="Nama proyek..."
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">DESCRIPTION</label>
                <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="Keterangan tambahan..."
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Section: Pemohon */}
          <div className="px-6 py-5 border-b">
            <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-4">Data Pemohon</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">NAME / PIC <span className="text-red-500">*</span></label>
                <input type="text" required value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Nama lengkap pemohon..."
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">EMAIL <span className="text-xs font-normal text-gray-400">(untuk notifikasi persetujuan)</span></label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">BENEFICIARY</label>
                <input type="text" value={form.beneficiary} onChange={e => set('beneficiary', e.target.value)}
                  placeholder="Nama penerima..."
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">BANK / NO. REKENING</label>
                <input type="text" value={form.bankNorek} onChange={e => set('bankNorek', e.target.value)}
                  placeholder="BCA 1234567890..."
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Section: Items */}
          <div className="px-6 py-5 border-b">
            <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-4">Rincian Pembayaran</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase px-1">
                <div className="col-span-7">Description</div>
                <div className="col-span-4">Amount (Rp)</div>
                <div className="col-span-1"></div>
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input
                    className="col-span-7 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Item ${i + 1}...`}
                    value={item.description}
                    onChange={e => setItem(i, 'description', e.target.value)}
                  />
                  <input
                    className="col-span-4 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                    placeholder="0"
                    type="number"
                    min="0"
                    value={item.amount}
                    onChange={e => setItem(i, 'amount', e.target.value)}
                  />
                  <button type="button" onClick={() => removeItem(i)} disabled={items.length === 1}
                    className="col-span-1 flex items-center justify-center text-red-400 hover:text-red-600 disabled:opacity-20">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem}
              className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus size={15} /> Tambah Item
            </button>
            {total > 0 && (
              <div className="mt-4 flex justify-end">
                <div className="bg-blue-900 text-white px-5 py-2 rounded-lg text-sm font-semibold">
                  TOTAL: {fmt(total)}
                </div>
              </div>
            )}
          </div>

          {/* Section: Category */}
          <div className="px-6 py-5 border-b bg-gray-50">
            <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-4">Category</h3>
            <div className="flex flex-wrap gap-3">
              {CATEGORIES.map(cat => (
                <label key={cat.value}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                    form.rfpCategory === cat.value
                      ? 'bg-blue-900 text-white border-blue-900 font-semibold'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}>
                  <input type="radio" name="rfpCategory" value={cat.value} className="hidden"
                    checked={form.rfpCategory === cat.value}
                    onChange={() => set('rfpCategory', cat.value)} />
                  {cat.label}
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="px-6 py-5">
            <label className="block text-xs font-semibold text-gray-600 mb-1">NOTES / CATATAN (opsional)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="Catatan tambahan untuk tim finance..."
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {error && (
            <div className="mx-6 mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <div className="px-6 pb-6">
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-xl text-sm disabled:opacity-60 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? 'Mengirim...' : 'Kirim Request for Payment'}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4 pb-6">
          Form ini akan langsung masuk ke sistem finance untuk diproses.
        </p>
      </div>
    </div>
  );
}
