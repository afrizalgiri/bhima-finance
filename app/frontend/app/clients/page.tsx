'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toaster';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  address: string;
  email?: string;
  phone?: string;
  pic?: string;
}

const empty: Omit<Client, 'id'> = { name: '', address: '', email: '', phone: '', pic: '' };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const r = await api.get('/clients', { params: { search, limit: 100 } });
      setClients(r.data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchClients(); }, [search]);

  const openAdd = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (c: Client) => { setEditing(c); setForm({ name: c.name, address: c.address, email: c.email || '', phone: c.phone || '', pic: c.pic || '' }); setDialogOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/clients/${editing.id}`, form);
        toast({ title: 'Client berhasil diperbarui' });
      } else {
        await api.post('/clients', form);
        toast({ title: 'Client berhasil ditambahkan' });
      }
      setDialogOpen(false);
      fetchClients();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Gagal menyimpan', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Hapus client "${name}"?`)) return;
    try {
      await api.delete(`/clients/${id}`);
      toast({ title: 'Client dihapus' });
      fetchClients();
    } catch {
      toast({ title: 'Gagal menghapus', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klien</h1>
          <p className="text-gray-500 text-sm">Kelola data klien perusahaan</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700"><Plus size={16} />Tambah Klien</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Search size={16} className="text-gray-400" />
            <Input placeholder="Cari klien..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Nama Perusahaan</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Alamat</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Telepon</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">PIC</th>
                  <th className="py-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                ) : clients.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Belum ada klien</td></tr>
                ) : clients.map(c => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium">{c.name}</td>
                    <td className="py-2.5 px-3 text-gray-600 max-w-[200px] truncate">{c.address}</td>
                    <td className="py-2.5 px-3 text-gray-600">{c.email || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-600">{c.phone || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-600">{c.pic || '-'}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit size={15} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(c.id, c.name)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Klien' : 'Tambah Klien'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Nama Perusahaan *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="mt-1" /></div>
            <div><Label>Alamat *</Label><textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} required rows={2} className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="mt-1" /></div>
            <div><Label>Telepon</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="mt-1" /></div>
            <div><Label>PIC (Person in Charge)</Label><Input value={form.pic} onChange={e => setForm({...form, pic: e.target.value})} className="mt-1" /></div>
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
