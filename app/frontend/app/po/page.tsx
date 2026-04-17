'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from '../../components/ui/toaster';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Plus, Download, Eye, Trash2, X, Pencil, Search, RefreshCw } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');

const PO_STATUS = [
  { value: 'DRAFT',     label: 'Draft',       cls: 'bg-gray-100 text-gray-700' },
  { value: 'SENT',      label: 'Terkirim',    cls: 'bg-blue-100 text-blue-700' },
  { value: 'APPROVED',  label: 'Disetujui',   cls: 'bg-green-100 text-green-700' },
  { value: 'REJECTED',  label: 'Ditolak',     cls: 'bg-red-100 text-red-700' },
  { value: 'COMPLETED', label: 'Selesai',     cls: 'bg-purple-100 text-purple-700' },
];

const UNITS = ['pcs', 'unit', 'set', 'bulan', 'bln', 'hari', 'jam', 'kg', 'liter', 'meter', 'paket', 'ls'];

type Item = { name: string; description: string; quantity: number; unit: string; price: number | '' };
const emptyItem = (): Item => ({ name: '', description: '', quantity: 1, unit: 'pcs', price: '' });

type FormState = {
  number: string; date: string; dueDate: string;
  supplier: string; supplierAddress: string; supplierPhone: string; supplierEmail: string; attention: string;
  project: string; description: string;
  taxRate: string; notes: string; paymentTerms: string; headerColor: string; status: string;
};

const initForm = (): FormState => ({
  number: '', date: new Date().toISOString().split('T')[0], dueDate: '',
  supplier: '', supplierAddress: '', supplierPhone: '', supplierEmail: '', attention: '',
  project: '', description: '',
  taxRate: '0', notes: '', paymentTerms: '', headerColor: '#1a3557', status: 'DRAFT',
});

export default function PoPage() {
  const [pos, setPos] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [signatures, setSignatures] = useState<any[]>([]);

  const [showForm, setShowForm]     = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showPdf, setShowPdf]       = useState(false);
  const [selected, setSelected]     = useState<any>(null);
  const [editMode, setEditMode]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(initForm());
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [saving, setSaving]         = useState(false);
  const [pdfSigIds, setPdfSigIds]   = useState(['', '']);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const [pr, sr] = await Promise.all([api.get('/po', { params }), api.get('/signatures')]);
      setPos(pr.data.data || []);
      setTotal(pr.data.total || 0);
      setSignatures(sr.data.data || []);
    } catch { toast({ title: 'Gagal memuat data', variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Calc ──────────────────────────────────────────────────────────────────────
  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price) || 0), 0);
  const taxAmount = subtotal * (Number(form.taxRate) / 100);
  const grandTotal = subtotal + taxAmount;

  // ── Items helpers ─────────────────────────────────────────────────────────────
  const setItem = (idx: number, field: keyof Item, val: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };
  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => { if (items.length > 1) setItems(prev => prev.filter((_, i) => i !== idx)); };

  // ── Open create ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditMode(false); setEditingId(null);
    setForm(initForm()); setItems([emptyItem()]);
    setShowForm(true);
  };

  // ── Open edit ────────────────────────────────────────────────────────────────
  const openEdit = (po: any) => {
    setEditMode(true); setEditingId(po.id);
    setForm({
      number: po.number || '',
      date: po.date ? po.date.split('T')[0] : '',
      dueDate: po.dueDate ? po.dueDate.split('T')[0] : '',
      supplier: po.supplier || '',
      supplierAddress: po.supplierAddress || '',
      supplierPhone: po.supplierPhone || '',
      supplierEmail: po.supplierEmail || '',
      attention: po.attention || '',
      project: po.project || '',
      description: po.description || '',
      taxRate: String(po.taxRate ?? 0),
      notes: po.notes || '',
      paymentTerms: po.paymentTerms || '',
      headerColor: po.headerColor || '#1a3557',
      status: po.status || 'DRAFT',
    });
    setItems(po.items?.length ? po.items.map((i: any) => ({
      name: i.name, description: i.description || '',
      quantity: i.quantity, unit: i.unit, price: i.price,
    })) : [emptyItem()]);
    setShowForm(true);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier) { toast({ title: 'Nama supplier wajib diisi', variant: 'destructive' }); return; }
    const validItems = items.filter(i => i.name.trim());
    if (!validItems.length) { toast({ title: 'Minimal 1 item', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const body = { ...form, taxRate: Number(form.taxRate), items: validItems };
      if (editMode && editingId) {
        await api.put(`/po/${editingId}`, body);
        toast({ title: 'PO berhasil diupdate' });
      } else {
        await api.post('/po', body);
        toast({ title: 'PO berhasil dibuat' });
      }
      setShowForm(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal menyimpan', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Hapus PO ini?')) return;
    try {
      await api.delete(`/po/${id}`);
      toast({ title: 'PO dihapus' });
      setShowDetail(false);
      fetchAll();
    } catch { toast({ title: 'Gagal menghapus', variant: 'destructive' }); }
  };

  // ── View detail ──────────────────────────────────────────────────────────────
  const openDetail = async (id: string) => {
    const r = await api.get(`/po/${id}`);
    setSelected(r.data.data);
    setShowDetail(true);
  };

  // ── Quick download (no sig) ───────────────────────────────────────────────────
  const quickDownload = async (po: any) => {
    setDownloading(po.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/po/${po.id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ signatureIds: [] }),
      });
      if (!res.ok) throw new Error('Gagal generate PDF');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `PO-${po.number.replace(/\//g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast({ title: 'Gagal download PDF', variant: 'destructive' }); }
    finally { setDownloading(null); }
  };

  // ── PDF with sigs ─────────────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!selected) return;
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/po/${selected.id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ signatureIds: pdfSigIds }),
      });
      if (!res.ok) throw new Error('Gagal generate PDF');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `PO-${selected.number.replace(/\//g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      setShowPdf(false);
    } catch { toast({ title: 'Gagal generate PDF', variant: 'destructive' }); }
    finally { setPdfLoading(false); }
  };

  const statusInfo = (s: string) => PO_STATUS.find(p => p.value === s) || { label: s, cls: 'bg-gray-100 text-gray-600' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Order</h1>
          <p className="text-gray-500 text-sm">Kelola Purchase Order ke supplier</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus size={16} /> Buat PO
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nomor, supplier, proyek..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Semua Status</option>
          {PO_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button onClick={fetchAll} className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
        ) : pos.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Belum ada Purchase Order</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nomor PO</th>
                  <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                  <th className="px-4 py-3 text-left font-medium">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium">Proyek</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po, i) => {
                  const st = statusInfo(po.status);
                  return (
                    <tr key={po.id} className={`border-t border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                      <td className="px-4 py-3 font-medium text-blue-700">{po.number}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(po.date)}</td>
                      <td className="px-4 py-3 font-medium">{po.supplier}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{po.project || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(po.total)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openDetail(po.id)} title="Detail" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Eye size={15} /></button>
                          <button onClick={() => openEdit(po)} title="Edit" className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded"><Pencil size={15} /></button>
                          <button onClick={() => quickDownload(po)} disabled={downloading === po.id} title="Download PDF" className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-40">
                            <Download size={15} />
                          </button>
                          <button onClick={() => handleDelete(po.id)} title="Hapus" className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && <div className="px-4 py-2 border-t text-xs text-gray-400">{total} PO ditemukan</div>}
      </div>

      {/* ── CREATE / EDIT MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl my-4">
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="font-bold text-gray-900 text-lg">{editMode ? 'Edit PO' : 'Buat Purchase Order'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-5">
              {/* Row 1: Number, Date, Due Date, Status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label>Nomor PO</Label>
                  <Input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                    placeholder="Auto-generate jika kosong" className="mt-1 font-mono" />
                </div>
                <div>
                  <Label>Tanggal *</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required className="mt-1" />
                </div>
                <div>
                  <Label>Tgl. Pengiriman</Label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Status</Label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {PO_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Supplier info */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Informasi Supplier</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Nama Supplier *</Label>
                    <Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} required placeholder="PT. Supplier Utama" className="mt-1" />
                  </div>
                  <div>
                    <Label>U.p. / Attn</Label>
                    <Input value={form.attention} onChange={e => setForm(f => ({ ...f, attention: e.target.value }))} placeholder="Nama PIC supplier" className="mt-1" />
                  </div>
                  <div>
                    <Label>Alamat</Label>
                    <Input value={form.supplierAddress} onChange={e => setForm(f => ({ ...f, supplierAddress: e.target.value }))} placeholder="Jl. Contoh No. 1" className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Telepon</Label>
                      <Input value={form.supplierPhone} onChange={e => setForm(f => ({ ...f, supplierPhone: e.target.value }))} placeholder="021-xxxx" className="mt-1" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" value={form.supplierEmail} onChange={e => setForm(f => ({ ...f, supplierEmail: e.target.value }))} placeholder="supplier@mail.com" className="mt-1" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Project / Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Proyek / Referensi</Label>
                  <Input value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} placeholder="Nama proyek / referensi" className="mt-1" />
                </div>
                <div>
                  <Label>Deskripsi Singkat</Label>
                  <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Keterangan singkat PO" className="mt-1" />
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Item / Barang / Jasa</Label>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                    <Plus size={13} /> Tambah Item
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-12 gap-0 bg-blue-900 text-white text-xs font-medium px-2 py-2">
                    <div className="col-span-4 px-1">Nama Item</div>
                    <div className="col-span-3 px-1">Deskripsi</div>
                    <div className="col-span-1 px-1 text-center">Qty</div>
                    <div className="col-span-1 px-1 text-center">Sat</div>
                    <div className="col-span-2 px-1 text-right">Harga</div>
                    <div className="col-span-1 px-1" />
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className={`grid grid-cols-12 gap-0 px-2 py-1.5 border-t border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                      <div className="col-span-4 px-1">
                        <input value={item.name} onChange={e => setItem(idx, 'name', e.target.value)}
                          placeholder="Nama item *" className="w-full text-sm border-0 bg-transparent outline-none focus:bg-white focus:border focus:border-blue-400 focus:rounded px-1 py-0.5" />
                      </div>
                      <div className="col-span-3 px-1">
                        <input value={item.description} onChange={e => setItem(idx, 'description', e.target.value)}
                          placeholder="Keterangan" className="w-full text-sm border-0 bg-transparent outline-none focus:bg-white focus:border focus:border-blue-400 focus:rounded px-1 py-0.5" />
                      </div>
                      <div className="col-span-1 px-1">
                        <input type="number" min="0" value={item.quantity} onChange={e => setItem(idx, 'quantity', Number(e.target.value))}
                          className="w-full text-sm text-center border-0 bg-transparent outline-none focus:bg-white focus:border focus:border-blue-400 focus:rounded px-1 py-0.5" />
                      </div>
                      <div className="col-span-1 px-1">
                        <select value={item.unit} onChange={e => setItem(idx, 'unit', e.target.value)}
                          className="w-full text-xs border-0 bg-transparent outline-none focus:bg-white focus:border focus:border-blue-400 focus:rounded py-0.5">
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2 px-1">
                        <input type="number" min="0" value={item.price} onChange={e => setItem(idx, 'price', e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0" className="w-full text-sm text-right border-0 bg-transparent outline-none focus:bg-white focus:border focus:border-blue-400 focus:rounded px-1 py-0.5" />
                      </div>
                      <div className="col-span-1 px-1 flex items-center justify-center">
                        <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><X size={13} /></button>
                      </div>
                    </div>
                  ))}
                  {/* Subtotals */}
                  <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600">
                      <div className="flex items-center gap-2">
                        <span>PPN</span>
                        <input type="number" min="0" max="100" value={form.taxRate}
                          onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))}
                          className="w-14 text-xs text-center border border-gray-300 rounded px-1 py-0.5" />
                        <span className="text-xs">%</span>
                      </div>
                      <span className="font-medium">{formatCurrency(taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-blue-900 font-bold border-t border-gray-300 pt-1">
                      <span>TOTAL</span><span>{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes / Payment Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Catatan</Label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} placeholder="Catatan tambahan..." className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <Label>Syarat Pembayaran</Label>
                  <textarea value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                    rows={3} placeholder="Contoh: Net 30, DP 50% ..." className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Header color */}
              <div className="flex items-center gap-3">
                <Label>Warna Header PDF</Label>
                <input type="color" value={form.headerColor} onChange={e => setForm(f => ({ ...f, headerColor: e.target.value }))}
                  className="h-8 w-16 rounded border border-gray-300 cursor-pointer" />
                <span className="text-xs text-gray-400 font-mono">{form.headerColor}</span>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Batal</button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 px-6">
                  {saving ? 'Menyimpan...' : editMode ? 'Update PO' : 'Buat PO'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {showDetail && selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl my-4">
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
              <div>
                <h2 className="font-bold text-gray-900">{selected.number}</h2>
                <p className="text-xs text-gray-500">{formatDate(selected.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo(selected.status).cls}`}>
                  {statusInfo(selected.status).label}
                </span>
                <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {/* Supplier info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-semibold text-gray-700">Supplier: {selected.supplier}</p>
                {selected.supplierAddress && <p className="text-gray-500">{selected.supplierAddress}</p>}
                {selected.supplierPhone && <p className="text-gray-500">Tel: {selected.supplierPhone}</p>}
                {selected.supplierEmail && <p className="text-gray-500">Email: {selected.supplierEmail}</p>}
                {selected.attention && <p className="text-gray-500">U.p.: {selected.attention}</p>}
                {selected.project && <p className="text-blue-600">Proyek: {selected.project}</p>}
                {selected.dueDate && <p className="text-gray-500">Tgl. Kirim: {formatDate(selected.dueDate)}</p>}
              </div>
              {/* Items */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</p>
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-center font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Harga</th>
                      <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items?.map((item: any, i: number) => (
                      <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.name}</p>
                          {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                        </td>
                        <td className="px-3 py-2 text-center">{item.quantity} {item.unit}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.price)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-900 text-white">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 font-bold text-right">
                        {Number(selected.taxRate) > 0 ? `Subtotal: ${formatCurrency(selected.subtotal)} | PPN ${selected.taxRate}%: ${formatCurrency(selected.taxAmount)} | TOTAL:` : 'TOTAL'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold">{formatCurrency(selected.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {/* Notes */}
              {(selected.notes || selected.paymentTerms) && (
                <div className="text-sm space-y-2 border-t pt-3">
                  {selected.notes && <div><span className="font-semibold text-gray-600">Catatan:</span> <span className="text-gray-700">{selected.notes}</span></div>}
                  {selected.paymentTerms && <div><span className="font-semibold text-gray-600">Syarat Bayar:</span> <span className="text-gray-700">{selected.paymentTerms}</span></div>}
                </div>
              )}
              {/* Actions */}
              <div className="flex gap-2 justify-end border-t pt-3">
                <button onClick={() => openEdit(selected)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => { setShowDetail(false); setPdfSigIds(['', '']); setShowPdf(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                  <Download size={14} /> Download PDF
                </button>
                <button onClick={() => handleDelete(selected.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                  <Trash2 size={14} /> Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF DIALOG ── */}
      {showPdf && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Download PDF — {selected.number}</h2>
              <button onClick={() => setShowPdf(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">Pilih tanda tangan (opsional):</p>
              {['Dibuat Oleh', 'Disetujui Oleh'].map((label, idx) => (
                <div key={idx}>
                  <label className="text-xs font-semibold text-gray-600 uppercase mb-1 block">{label}</label>
                  <select value={pdfSigIds[idx]} onChange={e => setPdfSigIds(ids => ids.map((v, i) => i === idx ? e.target.value : v))}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-white">
                    <option value="">— Tanpa Tanda Tangan —</option>
                    {signatures.map(s => <option key={s.id} value={s.id}>{s.name}{s.title ? ` (${s.title})` : ''}</option>)}
                  </select>
                  {pdfSigIds[idx] && (() => {
                    const sig = signatures.find(s => s.id === pdfSigIds[idx]);
                    return sig ? <img src={`${API_BASE}/${sig.imageUrl}`} alt="ttd" className="mt-1 h-10 object-contain" /> : null;
                  })()}
                </div>
              ))}
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setShowPdf(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Batal</button>
                <button onClick={handleDownloadPdf} disabled={pdfLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
