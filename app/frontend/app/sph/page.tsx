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
import { formatCurrency, formatDate, SPH_STATUS } from '../../lib/utils';
import { Plus, Download, Eye, Trash2, X, Sparkles, Loader2 } from 'lucide-react';

interface Item { name: string; description: string; quantity: number; unit: string; price: number; productId?: string; }
const emptyItem: Item = { name: '', description: '', quantity: 1, unit: 'pcs', price: 0 };
const units = ['pcs', 'unit', 'set', 'bulan', 'hari', 'jam', 'kg', 'liter', 'meter', 'paket'];

export default function SphPage() {
  const [sphs, setSphs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({
    clientId: '', date: new Date().toISOString().split('T')[0], validUntil: '',
    taxRate: '0', notes: '', openingText: '', closingText: '', headerColor: '#1a3557',
  });
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sr, cr, pr] = await Promise.all([api.get('/sph'), api.get('/clients'), api.get('/products')]);
      setSphs(sr.data.data); setClients(cr.data.data); setProducts(pr.data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof Item, value: any) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: value };
    setItems(updated);
  };
  const selectProduct = (i: number, productId: string) => {
    const p = products.find((p: any) => p.id === productId);
    if (p) {
      const updated = [...items];
      updated[i] = { ...updated[i], productId, name: p.name, description: p.description || '', price: Number(p.price), unit: p.unit };
      setItems(updated);
    }
  };

  const subtotal = items.reduce((s, item) => s + item.quantity * item.price, 0);
  const taxAmount = subtotal * (parseFloat(form.taxRate) / 100);
  const total = subtotal + taxAmount;

  const generateAiText = async () => {
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) {
      toast({ title: 'Isi minimal satu item terlebih dahulu', variant: 'destructive' });
      return;
    }
    setGeneratingAi(true);
    try {
      const client = clients.find((c: any) => c.id === form.clientId);
      const r = await api.post('/ai/generate-text', {
        items: validItems.map(i => ({ name: i.name, description: i.description, unit: i.unit })),
        docType: 'sph',
        clientName: client?.name || '',
      });
      setForm(f => ({ ...f, openingText: r.data.data.openingText, closingText: r.data.data.closingText }));
      toast({ title: 'Teks berhasil digenerate oleh AI' });
    } catch {
      toast({ title: 'Gagal generate teks AI', variant: 'destructive' });
    } finally { setGeneratingAi(false); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/sph', {
        ...form, taxRate: parseFloat(form.taxRate), items,
        openingText: form.openingText || null,
        closingText: form.closingText || null,
        headerColor: form.headerColor || null,
      });
      toast({ title: 'SPH berhasil dibuat' });
      setDialogOpen(false); fetchAll();
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Hapus SPH ini?')) return;
    try { await api.delete(`/sph/${id}`); toast({ title: 'SPH dihapus' }); fetchAll(); }
    catch { toast({ title: 'Gagal menghapus', variant: 'destructive' }); }
  };

  const downloadPdf = async (id: string, number: string) => {
    setDownloadingId(id);
    try {
      const r = await api.get(`/sph/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `SPH-${number.replace(/\//g, '-')}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: 'Gagal generate PDF', variant: 'destructive' }); }
    finally { setDownloadingId(null); }
  };

  const viewSph = async (id: string) => {
    const r = await api.get(`/sph/${id}`);
    setSelected(r.data.data); setViewDialog(true);
  };

  const openCreate = () => {
    setItems([{ ...emptyItem }]);
    setForm({ clientId: '', date: new Date().toISOString().split('T')[0], validUntil: '', taxRate: '0', notes: '', openingText: '', closingText: '', headerColor: '#1a3557' });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">SPH</h1><p className="text-gray-500 text-sm">Surat Penawaran Harga</p></div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700"><Plus size={16} />Buat SPH</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Nomor</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Klien</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Tanggal</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Total</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                : sphs.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Belum ada SPH</td></tr>
                : sphs.map(s => {
                  const status = SPH_STATUS.find(x => x.value === s.status);
                  return (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-blue-600">{s.number}</td>
                      <td className="py-2.5 px-3">{s.client?.name}</td>
                      <td className="py-2.5 px-3 text-gray-600">{formatDate(s.date)}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(s.total)}</td>
                      <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs ${status?.color}`}>{status?.label}</span></td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => viewSph(s.id)}><Eye size={15} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => downloadPdf(s.id, s.number)} disabled={downloadingId === s.id}><Download size={15} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(s.id)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></Button>
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

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Buat SPH Baru</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Klien *</Label>
                <Select value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})} required className="mt-1">
                  <option value="">-- Pilih Klien --</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div><Label>Tanggal *</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required className="mt-1" /></div>
              <div><Label>Berlaku Hingga</Label><Input type="date" value={form.validUntil} onChange={e => setForm({...form, validUntil: e.target.value})} className="mt-1" /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Item / Produk</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus size={14} />Tambah Item</Button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Produk (opsional)</Label>
                        <Select value={item.productId || ''} onChange={e => selectProduct(i, e.target.value)} className="mt-1 text-xs">
                          <option value="">-- Pilih atau ketik manual --</option>
                          {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </Select>
                      </div>
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} className="mt-5 text-red-500"><X size={15} /></Button>
                      )}
                    </div>
                    <div><Label className="text-xs">Nama *</Label><Input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} required className="mt-1 text-sm" /></div>
                    <div><Label className="text-xs">Deskripsi</Label><Input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className="mt-1 text-sm" /></div>
                    <div className="grid grid-cols-4 gap-2">
                      <div><Label className="text-xs">Qty *</Label><Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value))} required className="mt-1 text-sm" /></div>
                      <div><Label className="text-xs">Satuan</Label><Select value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} className="mt-1 text-xs">{units.map(u => <option key={u} value={u}>{u}</option>)}</Select></div>
                      <div className="col-span-2"><Label className="text-xs">Harga (IDR) *</Label><Input type="number" min="0" value={item.price} onChange={e => updateItem(i, 'price', parseFloat(e.target.value))} required className="mt-1 text-sm" /></div>
                    </div>
                    <div className="text-right text-xs text-gray-500">Total: <strong>{formatCurrency(item.quantity * item.price)}</strong></div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Text & Color */}
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-purple-800 font-semibold">Teks Pembuka & Penutup</Label>
                <Button type="button" variant="outline" size="sm"
                  onClick={generateAiText} disabled={generatingAi}
                  className="border-purple-400 text-purple-700 hover:bg-purple-100">
                  {generatingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {generatingAi ? 'Generating...' : 'Generate AI'}
                </Button>
              </div>
              <div>
                <Label className="text-xs">Paragraf Pembuka</Label>
                <textarea value={form.openingText} onChange={e => setForm({...form, openingText: e.target.value})} rows={2}
                  placeholder="Otomatis digenerate oleh AI, atau ketik manual..."
                  className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div>
                <Label className="text-xs">Paragraf Penutup</Label>
                <textarea value={form.closingText} onChange={e => setForm({...form, closingText: e.target.value})} rows={2}
                  placeholder="Otomatis digenerate oleh AI, atau ketik manual..."
                  className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-purple-800">Warna Header Tabel:</Label>
                <input type="color" value={form.headerColor} onChange={e => setForm({...form, headerColor: e.target.value})}
                  className="h-8 w-12 rounded cursor-pointer border border-gray-300" />
                <span className="text-xs text-gray-500">{form.headerColor}</span>
                <button type="button" onClick={() => setForm({...form, headerColor: '#1a3557'})}
                  className="text-xs text-purple-600 hover:underline">Reset</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>PPN (%)</Label><Input type="number" min="0" max="100" value={form.taxRate} onChange={e => setForm({...form, taxRate: e.target.value})} className="mt-1" /></div>
              <div className="flex flex-col justify-end text-right">
                <div className="text-xs text-gray-500">Subtotal: {formatCurrency(subtotal)}</div>
                {parseFloat(form.taxRate) > 0 && <div className="text-xs text-gray-500">PPN: {formatCurrency(taxAmount)}</div>}
                <div className="text-base font-bold text-blue-700">Total: {formatCurrency(total)}</div>
              </div>
            </div>
            <div><Label>Catatan</Label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Batal</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">{saving ? 'Membuat...' : 'Buat SPH'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      {selected && (
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>SPH {selected.number}</span>
                <Button size="sm" onClick={() => downloadPdf(selected.id, selected.number)} className="bg-blue-600 hover:bg-blue-700"><Download size={14} />Download PDF</Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">Klien:</span> <strong>{selected.client?.name}</strong></div>
                <div><span className="text-gray-500">Tanggal:</span> {formatDate(selected.date)}</div>
              </div>
              {selected.openingText && (
                <div className="p-2 bg-gray-50 rounded text-xs text-gray-600 italic">
                  <span className="font-semibold not-italic text-gray-700">Pembuka: </span>{selected.openingText}
                </div>
              )}
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: selected.headerColor || '#1a3557' }}>
                    <th className="text-left p-2 text-xs text-white">Nama</th>
                    <th className="text-center p-2 text-xs text-white">Qty</th>
                    <th className="text-right p-2 text-xs text-white">Harga</th>
                    <th className="text-right p-2 text-xs text-white">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{item.name}</td>
                      <td className="p-2 text-center">{Number(item.quantity)} {item.unit}</td>
                      <td className="p-2 text-right">{formatCurrency(item.price)}</td>
                      <td className="p-2 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right space-y-1">
                <div className="text-gray-500">Subtotal: {formatCurrency(selected.subtotal)}</div>
                {Number(selected.taxRate) > 0 && <div className="text-gray-500">PPN {Number(selected.taxRate)}%: {formatCurrency(selected.taxAmount)}</div>}
                <div className="text-lg font-bold text-blue-700">Total: {formatCurrency(selected.total)}</div>
              </div>
              {selected.closingText && (
                <div className="p-2 bg-gray-50 rounded text-xs text-gray-600 italic">
                  <span className="font-semibold not-italic text-gray-700">Penutup: </span>{selected.closingText}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
