'use client';
import { useEffect, useState, useRef } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toaster';
import { Plus, Trash2, PenLine, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');

interface Signature { id: string; name: string; title: string | null; imageUrl: string; createdAt: string; }

export default function SignaturesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', title: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) { router.push('/dashboard'); return; }
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const r = await api.get('/signatures');
      setSignatures(r.data.data);
    } catch { } finally { setLoading(false); }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const openAdd = () => {
    setForm({ name: '', title: '' });
    setFile(null);
    setPreview(null);
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast({ title: 'Pilih file gambar TTD terlebih dahulu', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('title', form.title);
      fd.append('image', file);
      await api.post('/signatures', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast({ title: 'TTD berhasil ditambahkan' });
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal menyimpan', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Hapus TTD "${name}"?`)) return;
    try {
      await api.delete(`/signatures/${id}`);
      toast({ title: 'TTD dihapus' });
      fetchAll();
    } catch { toast({ title: 'Gagal menghapus', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tanda Tangan Digital</h1>
          <p className="text-gray-500 text-sm">Kelola TTD yang dapat digunakan di dokumen SPH & Invoice</p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700">
            <Plus size={16} />Tambah TTD
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat...</div>
      ) : signatures.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PenLine size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Belum ada TTD</p>
            <p className="text-gray-400 text-sm mt-1">Tambahkan TTD dari orang yang berwenang menandatangani dokumen</p>
            {isAdmin && (
              <Button onClick={openAdd} className="mt-4 bg-blue-600 hover:bg-blue-700">
                <Plus size={16} />Tambah TTD Pertama
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {signatures.map(sig => (
            <Card key={sig.id} className="relative group overflow-hidden">
              <CardContent className="p-4">
                <div className="h-24 flex items-center justify-center bg-gray-50 rounded-lg mb-3 border border-gray-100">
                  <img
                    src={`${API_BASE}${sig.imageUrl}`}
                    alt={sig.name}
                    className="max-h-20 max-w-full object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="font-semibold text-gray-800 text-sm truncate">{sig.name}</div>
                {sig.title && <div className="text-xs text-gray-500 truncate mt-0.5">{sig.title}</div>}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(sig.id, sig.name)}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah Tanda Tangan Digital</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>Nama Penanda Tangan *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                required placeholder="Contoh: Budi Santoso" className="mt-1" />
            </div>
            <div>
              <Label>Jabatan</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Contoh: Direktur Utama / Finance Manager" className="mt-1" />
            </div>
            <div>
              <Label>File Gambar TTD *</Label>
              <div
                className="mt-1 border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {preview ? (
                  <img src={preview} alt="preview" className="max-h-24 mx-auto object-contain" />
                ) : (
                  <div className="text-gray-400">
                    <Upload size={28} className="mx-auto mb-1" />
                    <p className="text-sm">Klik untuk upload gambar TTD</p>
                    <p className="text-xs mt-0.5">PNG, JPG, WEBP (maks 2MB)</p>
                    <p className="text-xs text-blue-500 mt-1">Disarankan: background transparan (PNG)</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
              {file && (
                <p className="text-xs text-gray-500 mt-1">{file.name}</p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Batal</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {saving ? 'Menyimpan...' : 'Simpan TTD'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
