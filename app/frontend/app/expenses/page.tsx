'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toaster';
import { formatCurrency, formatDate, formatDateInput, EXPENSE_CATEGORIES } from '../../lib/utils';
import { Plus, Edit, Trash2, FileDown, CheckSquare, Square } from 'lucide-react';

interface Expense {
  id: string; name: string; date: string; category: string;
  amount: number; department?: string; requestBy?: string; notes?: string;
}

const empty = {
  name: '', date: new Date().toISOString().split('T')[0],
  category: 'TRANSPORT', amount: '', department: '', requestBy: '', notes: ''
};

const DEPARTMENTS = ['Finance', 'Marketing', 'Operasional', 'HRD', 'IT', 'Direksi', 'Umum', 'Lainnya'];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pdfForm, setPdfForm] = useState({ department: '', requestBy: '', period: '' });
  const [generating, setGenerating] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const r = await api.get('/expenses', { params: { limit: 200 } });
      setExpenses(r.data.data);
      setTotal(r.data.data.reduce((s: number, e: Expense) => s + Number(e.amount), 0));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchExpenses(); }, []);

  const openAdd = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      name: e.name, date: formatDateInput(e.date), category: e.category,
      amount: String(e.amount), department: e.department || '', requestBy: e.requestBy || '', notes: e.notes || ''
    });
    setDialogOpen(true);
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault(); setSaving(true);
    try {
      const data = { ...form, amount: parseFloat(form.amount) };
      if (editing) { await api.put(`/expenses/${editing.id}`, data); toast({ title: 'Pengeluaran diperbarui' }); }
      else { await api.post('/expenses', data); toast({ title: 'Pengeluaran ditambahkan' }); }
      setDialogOpen(false); fetchExpenses();
    } catch { toast({ title: 'Gagal menyimpan', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Hapus pengeluaran ini?')) return;
    try { await api.delete(`/expenses/${id}`); toast({ title: 'Dihapus' }); fetchExpenses(); }
    catch { toast({ title: 'Gagal menghapus', variant: 'destructive' }); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === expenses.length ? [] : expenses.map(e => e.id));
  };

  const downloadPdf = async () => {
    setGenerating(true);
    try {
      const ids = selectedIds.length > 0 ? selectedIds : expenses.map(e => e.id);
      const r = await api.post('/expenses/pdf', { ids, ...pdfForm }, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const now = new Date();
      a.href = url;
      a.download = `BKK-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'PDF berhasil didownload' });
      setPdfDialogOpen(false);
    } catch { toast({ title: 'Gagal generate PDF', variant: 'destructive' }); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pengeluaran Operasional</h1>
          <p className="text-gray-500 text-sm">Catat dan kelola pengeluaran harian</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setPdfForm({ department: '', requestBy: '', period: '' }); setPdfDialogOpen(true); }}
            className="border-green-600 text-green-700 hover:bg-green-50">
            <FileDown size={16} />
            {selectedIds.length > 0 ? `Download PDF (${selectedIds.length})` : 'Download PDF'}
          </Button>
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700"><Plus size={16} />Tambah</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-gray-500">Total Pengeluaran</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(total)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Jumlah Transaksi</p>
              <p className="text-xl font-bold text-gray-800">{expenses.length}</p>
            </div>
            {selectedIds.length > 0 && (
              <div>
                <p className="text-xs text-gray-500">Dipilih</p>
                <p className="text-xl font-bold text-blue-600">{selectedIds.length} item</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 px-3 w-8">
                    <button onClick={toggleSelectAll}>
                      {selectedIds.length === expenses.length && expenses.length > 0
                        ? <CheckSquare size={16} className="text-blue-600" />
                        : <Square size={16} className="text-gray-400" />}
                    </button>
                  </th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Tanggal</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Nama Pengeluaran</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Kategori</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Departemen</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Diminta Oleh</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Nominal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Belum ada pengeluaran</td></tr>
                ) : expenses.map(e => {
                  const cat = EXPENSE_CATEGORIES.find(c => c.value === e.category);
                  const selected = selectedIds.includes(e.id);
                  return (
                    <tr key={e.id} className={`border-b border-gray-100 hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}>
                      <td className="py-2.5 px-3">
                        <button onClick={() => toggleSelect(e.id)}>
                          {selected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-400" />}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="py-2.5 px-3 font-medium">{e.name}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{cat?.label || e.category}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 text-xs">{e.department || '-'}</td>
                      <td className="py-2.5 px-3 text-gray-600 text-xs">{e.requestBy || '-'}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-red-600">{formatCurrency(e.amount)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Edit size={15} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(e.id)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Form Tambah/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tanggal *</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required className="mt-1" /></div>
              <div><Label>Kategori *</Label>
                <Select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="mt-1">
                  {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </div>
            </div>
            <div><Label>Nama Pengeluaran *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="mt-1" /></div>
            <div><Label>Nominal (IDR) *</Label><Input type="number" min="0" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Departemen</Label>
                <Select value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="mt-1">
                  <option value="">-- Pilih Departemen --</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </Select>
              </div>
              <div><Label>Diminta Oleh (PIC)</Label><Input value={form.requestBy} onChange={e => setForm({...form, requestBy: e.target.value})} placeholder="Nama PIC" className="mt-1" /></div>
            </div>
            <div><Label>Catatan</Label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
                className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Batal</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Download PDF Bukti Kas Keluar */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Download Bukti Pengeluaran Kas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              {selectedIds.length > 0
                ? `${selectedIds.length} item pengeluaran dipilih akan dimasukkan ke PDF.`
                : `Semua ${expenses.length} pengeluaran akan dimasukkan ke PDF.`}
            </div>
            <div>
              <Label>Departemen / Divisi</Label>
              <Select value={pdfForm.department} onChange={e => setPdfForm({...pdfForm, department: e.target.value})} className="mt-1">
                <option value="">-- Pilih Departemen --</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <Label>Diminta Oleh (PIC)</Label>
              <Input value={pdfForm.requestBy} onChange={e => setPdfForm({...pdfForm, requestBy: e.target.value})} placeholder="Nama yang meminta" className="mt-1" />
            </div>
            <div>
              <Label>Periode</Label>
              <Input value={pdfForm.period} onChange={e => setPdfForm({...pdfForm, period: e.target.value})} placeholder="Contoh: Maret 2026" className="mt-1" />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
              PDF akan berisi tanda tangan 3 pihak:<br/>
              <strong>Menyetujui</strong> · <strong>Mengetahui</strong> · <strong>Penerima/PIC</strong>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPdfDialogOpen(false)} className="flex-1">Batal</Button>
              <Button onClick={downloadPdf} disabled={generating} className="flex-1 bg-green-600 hover:bg-green-700">
                <FileDown size={16} />
                {generating ? 'Generating...' : 'Download PDF'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
