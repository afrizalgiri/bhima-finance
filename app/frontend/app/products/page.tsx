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
import { formatCurrency } from '../../lib/utils';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

interface Product { id: string; name: string; description?: string; price: number; unit: string; }
const empty = { name: '', description: '', price: '', unit: 'pcs' };
const units = ['pcs', 'unit', 'set', 'bulan', 'hari', 'jam', 'kg', 'liter', 'meter', 'paket'];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const r = await api.get('/products', { params: { search } });
      setProducts(r.data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [search]);

  const openAdd = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ name: p.name, description: p.description || '', price: String(p.price), unit: p.unit }); setDialogOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form, price: parseFloat(form.price) };
      if (editing) { await api.put(`/products/${editing.id}`, data); toast({ title: 'Produk diperbarui' }); }
      else { await api.post('/products', data); toast({ title: 'Produk ditambahkan' }); }
      setDialogOpen(false); fetchProducts();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Gagal menyimpan', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Hapus produk "${name}"?`)) return;
    try { await api.delete(`/products/${id}`); toast({ title: 'Produk dihapus' }); fetchProducts(); }
    catch { toast({ title: 'Gagal menghapus', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Produk & Layanan</h1><p className="text-gray-500 text-sm">Kelola daftar produk dan layanan</p></div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700"><Plus size={16} />Tambah Produk</Button>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4"><Search size={16} className="text-gray-400" /><Input placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200"><th className="text-left py-2 px-3 font-semibold text-gray-600">Nama</th><th className="text-left py-2 px-3 font-semibold text-gray-600">Deskripsi</th><th className="text-right py-2 px-3 font-semibold text-gray-600">Harga</th><th className="text-center py-2 px-3 font-semibold text-gray-600">Satuan</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                : products.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Belum ada produk</td></tr>
                : products.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium">{p.name}</td>
                    <td className="py-2.5 px-3 text-gray-600">{p.description || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(p.price)}</td>
                    <td className="py-2.5 px-3 text-center text-gray-600">{p.unit}</td>
                    <td className="py-2.5 px-3"><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit size={15} /></Button><Button variant="ghost" size="icon" onClick={() => remove(p.id, p.name)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Produk' : 'Tambah Produk'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Nama Produk / Layanan *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="mt-1" /></div>
            <div><Label>Deskripsi</Label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Harga (IDR) *</Label><Input type="number" min="0" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required className="mt-1" /></div>
              <div><Label>Satuan *</Label>
                <Select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="mt-1">
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Batal</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
