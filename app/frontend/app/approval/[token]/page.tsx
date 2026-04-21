'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
import api from '../../../lib/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

const CATEGORY_LABELS: Record<string, string> = {
  SALTAB_EVENT: 'SALTAB EVENT',
  CLAIM_REIMBURSEMENT: 'CLAIM / REIMBURSEMENT',
  CASH_ADVANCE: 'CASH ADVANCE / UANG MUKA',
  SUPPORT_BUDGET: 'SUPPORT BUDGET',
  OTHERS: 'OTHERS',
};

interface RfpItem { id: string; description: string; amount: number; }
interface Rfp {
  id: string; number: string; date: string; dueDate?: string;
  detailsOfPayment?: string; project?: string; description?: string;
  name: string; email?: string; beneficiary?: string; bankNorek?: string;
  rfpCategory: string; status: string; items: RfpItem[];
}
interface BossApproval {
  id: string; token: string; bossEmail: string; bossName?: string;
  status: string; notes?: string; sentAt: string; decidedAt?: string;
  rfp: Rfp;
}

type PageState = 'loading' | 'ready' | 'not_found' | 'already_decided' | 'done';

export default function ApprovalPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [approval, setApproval] = useState<BossApproval | null>(null);
  const [action, setAction] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneAction, setDoneAction] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setPageState('not_found'); return; }
    api.get(`/expense-requests/boss-approval/${token}`)
      .then(res => {
        if (res.data.success) {
          setApproval(res.data.data);
          if (res.data.data.status !== 'PENDING') {
            setPageState('already_decided');
          } else {
            setPageState('ready');
          }
        } else {
          setPageState('not_found');
        }
      })
      .catch(() => setPageState('not_found'));
  }, [token]);

  const handleDecide = async (chosenAction: 'APPROVED' | 'REJECTED') => {
    if (!approval) return;
    if (chosenAction === 'REJECTED' && !notes.trim()) {
      setError('Mohon tuliskan alasan penolakan di kolom catatan');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/expense-requests/boss-approval/${token}/decide`, {
        action: chosenAction,
        notes: notes.trim() || undefined,
      });
      if (res.data.success) {
        setDoneAction(chosenAction);
        setPageState('done');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 409) {
        setPageState('already_decided');
      } else {
        setError(msg || 'Terjadi kesalahan. Coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (pageState === 'not_found') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <XCircle size={52} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Link Tidak Valid</h2>
          <p className="text-gray-500 text-sm">
            Link persetujuan ini tidak ditemukan atau sudah tidak berlaku.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === 'already_decided' && approval) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          {approval.status === 'APPROVED'
            ? <CheckCircle size={52} className="text-green-500 mx-auto mb-4" />
            : <XCircle size={52} className="text-red-500 mx-auto mb-4" />
          }
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Sudah {approval.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
          </h2>
          <p className="text-gray-500 text-sm mb-3">
            Pengajuan <strong>{approval.rfp?.number}</strong> telah diputuskan pada{' '}
            {approval.decidedAt ? fmtDate(approval.decidedAt) : '-'}.
          </p>
          {approval.notes && (
            <p className="text-sm text-gray-600 bg-gray-50 border rounded-lg p-3 text-left">
              <strong>Catatan:</strong> {approval.notes}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (pageState === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          {doneAction === 'APPROVED'
            ? <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
            : <XCircle size={56} className="text-red-500 mx-auto mb-4" />
          }
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {doneAction === 'APPROVED' ? 'Pengajuan Disetujui!' : 'Pengajuan Ditolak'}
          </h2>
          <p className="text-gray-600 text-sm mb-2">
            Keputusan Anda telah tersimpan. Tim finance akan segera mendapat notifikasi.
          </p>
          {doneAction === 'APPROVED' && (
            <p className="text-xs text-gray-400">Pemohon akan menerima notifikasi email bahwa pengajuan disetujui.</p>
          )}
        </div>
      </div>
    );
  }

  if (!approval) return null;
  const rfp = approval.rfp;
  const totalAmount = rfp.items.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto pt-8 pb-12">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-blue-900 text-white px-5 py-2 rounded-full text-sm font-semibold tracking-wide mb-3">
            PERSETUJUAN REQUEST FOR PAYMENT
          </div>
          <p className="text-gray-600 text-sm">
            {approval.bossName ? `Halo ${approval.bossName}, Anda` : 'Anda'} diminta untuk memberikan keputusan atas pengajuan berikut
          </p>
        </div>

        {/* RFP Card */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden mb-5">
          {/* Header bar */}
          <div className="bg-blue-900 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-300 uppercase tracking-wide">No. RFP</p>
                <p className="text-xl font-bold font-mono">{rfp.number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-300 uppercase tracking-wide">Total</p>
                <p className="text-xl font-bold">{fmt(totalAmount)}</p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="px-6 py-5 border-b">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ['Pengaju', rfp.name],
                ['Email', rfp.email || '-'],
                ['Tanggal', fmtDate(rfp.date)],
                ['Due Date', rfp.dueDate ? fmtDate(rfp.dueDate) : '-'],
                ['Proyek', rfp.project || '-'],
                ['Keperluan', rfp.detailsOfPayment || '-'],
                ['Kategori', CATEGORY_LABELS[rfp.rfpCategory] || rfp.rfpCategory],
                ['Penerima', rfp.beneficiary || '-'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">{k}</div>
                  <div className="font-medium text-gray-800">{v}</div>
                </div>
              ))}
            </div>
            {rfp.description && (
              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <div className="text-xs font-semibold text-blue-600 uppercase mb-1">Deskripsi / Latar Belakang</div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{rfp.description}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Rincian Pembayaran</p>
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Deskripsi</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {rfp.items.map((item, i) => (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border-b">{item.description}</td>
                    <td className="px-3 py-2 border-b text-right font-medium">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-900 text-white">
                  <td className="px-3 py-2.5 font-bold">TOTAL</td>
                  <td className="px-3 py-2.5 text-right font-bold">{fmt(totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Decision Section */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Keputusan Anda</h3>

          {/* Action selector */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => setAction('APPROVED')}
              className={`flex items-center justify-center gap-2 px-4 py-4 border-2 rounded-xl text-sm font-semibold transition-all ${
                action === 'APPROVED'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-500 hover:border-green-300 hover:bg-green-50'
              }`}
            >
              <ThumbsUp size={20} /> Setujui
            </button>
            <button
              type="button"
              onClick={() => setAction('REJECTED')}
              className={`flex items-center justify-center gap-2 px-4 py-4 border-2 rounded-xl text-sm font-semibold transition-all ${
                action === 'REJECTED'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-500 hover:border-red-300 hover:bg-red-50'
              }`}
            >
              <ThumbsDown size={20} /> Tolak
            </button>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">
              Catatan {action === 'REJECTED' && <span className="text-red-500">* (wajib untuk penolakan)</span>}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={action === 'REJECTED' ? 'Tuliskan alasan penolakan...' : 'Catatan opsional...'}
              rows={3}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* Submit */}
          {action && (
            <button
              type="button"
              onClick={() => handleDecide(action)}
              disabled={submitting}
              className={`w-full py-3.5 font-semibold rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors ${
                action === 'APPROVED'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Memproses...</>
                : action === 'APPROVED'
                  ? <><CheckCircle size={16} /> Konfirmasi Setujui</>
                  : <><XCircle size={16} /> Konfirmasi Tolak</>
              }
            </button>
          )}

          {!action && (
            <p className="text-center text-sm text-gray-400">Pilih Setujui atau Tolak di atas untuk melanjutkan</p>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Link persetujuan ini hanya dapat digunakan satu kali.
        </p>
      </div>
    </div>
  );
}
