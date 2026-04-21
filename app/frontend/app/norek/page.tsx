'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from '../../components/ui/toaster';
import { Plus, Pencil, Trash2, Building2, X, CheckCircle, XCircle } from 'lucide-react';

const BANKS = [
  'Bank Central Asia (BCA)',
  'Bank Mandiri',
  'Bank Negara Indonesia (BNI)',
  'Bank Rakyat Indonesia (BRI)',
  'Bank Syariah Indonesia (BSI)',
  'Bank CIMB Niaga',
  'Bank Danamon',
  'Bank Permata',
  'Bank OCBC NISP',
  'Bank Maybank Indonesia',
  'Bank Panin',
  'Bank Mega',
  'Bank BTN',
  'Bank BPD (Daerah)',
  'Bank Jago',
  'Bank Neo Commerce (BNC)',
  'GoPay',
  'OVO',
  'DANA',
  'ShopeePay',
  'LinkAja',
  'Lainnya',
];

type BankAccount = {
  id: string;
  employeeName: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  notes?: string;
  isActive: boolean;
};

const EMPTY_FORM = {
  employeeName: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  notes: '',
};

export default function NorekPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const r = await api.get('/employee-banks');
      setAccounts(r.data.data || []);
    } catch {
      toast({ title: 'Gagal memuat data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (acc: BankAccount) => {
    setEditing(acc);
    setForm({
      employeeName: acc.employeeName,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      accountHolder: acc.accountHolder,
      notes: acc.notes || '',
    });
    setShowModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/employee-banks/${editing.id}`, form);
        toast({ title: 'Data rekening diperbarui' });
      } else {
        await api.post('/employee-banks', form);
        toast({ title: 'Rekening karyawan ditambahkan' });
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal menyimpan', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (acc: BankAccount) => {
    try {
      await api.put(`/employee-banks/${acc.id}`, { isActive: !acc.isActive });
      toast({ title: acc.isActive ? 'Rekening dinonaktifkan' : 'Rekening diaktifkan' });
      load();
    } catch {
      toast({ title: 'Gagal mengubah status', variant: 'destructive' });
    }
  };

  const remove = async (acc: BankAccount) => {
    if (!confirm(`Hapus rekening ${acc.employeeName} — ${acc.bankName}?`)) return;
    try {
      await api.delete(`/employee-banks/${acc.id}`);
      toast({ title: 'Rekening dihapus' });
      load();
    } catch {
      toast({ title: 'Gagal menghapus', variant: 'destructive' });
    }
  };

  const filtered = accounts.filter(a =>
    a.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    a.bankName.toLowerCase().includes(search.toLowerCase()) ||
    a.accountNumber.includes(search) ||
    a.accountHolder.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nomor Rekening Karyawan</h1>
          <p className="text-gray-500 text-sm">Daftar rekening bank karyawan untuk transfer pembayaran RFP</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
          <Plus size={16} /> Tambah Rekening
        </Button>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder="Cari nama, bank, nomor rekening..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Building2 size={40} className="mb-3 opacity-40" />
            <p className="text-sm">{search ? 'Tidak ada hasil pencarian' : 'Belum ada rekening terdaftar'}</p>
            {!search && (
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus size={14} className="mr-1" /> Tambah Rekening Pertama
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(acc => (
            <Card key={acc.id} className={acc.isActive ? '' : 'opacity-60'}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{acc.employeeName}</span>
                        {!acc.isActive && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Nonaktif</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{acc.bankName}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="font-mono text-sm font-medium text-gray-800">{acc.accountNumber}</span>
                        <span className="text-xs text-gray-400">a/n {acc.accountHolder}</span>
                      </div>
                      {acc.notes && <p className="text-xs text-gray-400 mt-1">{acc.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(acc)}
                      title={acc.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      className="p-2 rounded hover:bg-gray-100 transition-colors"
                    >
                      {acc.isActive
                        ? <CheckCircle size={16} className="text-green-600" />
                        : <XCircle size={16} className="text-gray-400" />
                      }
                    </button>
                    <button
                      onClick={() => openEdit(acc)}
                      className="p-2 rounded hover:bg-gray-100 transition-colors"
                    >
                      <Pencil size={16} className="text-blue-600" />
                    </button>
                    <button
                      onClick={() => remove(acc)}
                      className="p-2 rounded hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Rekening' : 'Tambah Rekening Karyawan'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              <div>
                <Label>Nama Karyawan *</Label>
                <Input
                  value={form.employeeName}
                  onChange={e => setForm({ ...form, employeeName: e.target.value })}
                  required className="mt-1" placeholder="Nama lengkap karyawan"
                />
              </div>
              <div>
                <Label>Nama Bank *</Label>
                <select
                  value={form.bankName}
                  onChange={e => setForm({ ...form, bankName: e.target.value })}
                  required
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-background"
                >
                  <option value="">-- Pilih Bank --</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <Label>Nomor Rekening *</Label>
                <Input
                  value={form.accountNumber}
                  onChange={e => setForm({ ...form, accountNumber: e.target.value })}
                  required className="mt-1 font-mono" placeholder="1234567890"
                />
              </div>
              <div>
                <Label>Atas Nama *</Label>
                <Input
                  value={form.accountHolder}
                  onChange={e => setForm({ ...form, accountHolder: e.target.value })}
                  required className="mt-1" placeholder="Nama sesuai rekening"
                />
              </div>
              <div>
                <Label>Catatan</Label>
                <Input
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="mt-1" placeholder="Opsional"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1">
                  Batal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
