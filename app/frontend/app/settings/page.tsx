'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { toast } from '../../components/ui/toaster';
import { Upload } from 'lucide-react';

export default function SettingsPage() {
  const [form, setForm] = useState({
    name: '', address: '', email: '', phone: '', website: '', taxNumber: '',
    bankName: '', bankAccount: '', bankHolder: '',
    docNameSph: '', docPrefixSph: '',
    docNameInvoice: '', docPrefixInvoice: '',
    docNameExpense: '', docPrefixExpense: '',
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get('/company').then(r => {
      if (r.data.data) {
        const d = r.data.data;
        setForm({
          name: d.name || '', address: d.address || '', email: d.email || '', phone: d.phone || '',
          website: d.website || '', taxNumber: d.taxNumber || '',
          bankName: d.bankName || '', bankAccount: d.bankAccount || '', bankHolder: d.bankHolder || '',
          docNameSph: d.docNameSph || '', docPrefixSph: d.docPrefixSph || '',
          docNameInvoice: d.docNameInvoice || '', docPrefixInvoice: d.docPrefixInvoice || '',
          docNameExpense: d.docNameExpense || '', docPrefixExpense: d.docPrefixExpense || '',
        });
        setLogoUrl(d.logoUrl || '');
      }
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put('/company', form);
      toast({ title: 'Pengaturan tersimpan' });
    } catch { toast({ title: 'Gagal menyimpan', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const r = await api.post('/company/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLogoUrl(r.data.logoUrl);
      toast({ title: 'Logo berhasil diupload' });
    } catch { toast({ title: 'Gagal upload logo', variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-bold text-gray-900">Pengaturan Perusahaan</h1><p className="text-gray-500 text-sm">Data perusahaan untuk dokumen SPH dan Invoice</p></div>

      <Card>
        <CardHeader><CardTitle className="text-base">Logo Perusahaan</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-4">
          {logoUrl ? (
            <img src={`${API_URL}${logoUrl}`} alt="Logo" className="h-16 object-contain border rounded-lg p-1" />
          ) : (
            <div className="h-16 w-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs">Logo</div>
          )}
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 h-9 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
              <Upload size={16} />{uploading ? 'Mengupload...' : 'Upload Logo'}
            </span>
            <input type="file" accept="image/*" onChange={uploadLogo} className="hidden" />
          </label>
        </CardContent>
      </Card>

      <form onSubmit={save}>
        <Card>
          <CardHeader><CardTitle className="text-base">Informasi Perusahaan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Nama Perusahaan *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="mt-1" /></div>
            <div><Label>Alamat *</Label><textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} required rows={3} className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="mt-1" /></div>
              <div><Label>Telepon *</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Website</Label><Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} className="mt-1" /></div>
              <div><Label>NPWP</Label><Input value={form.taxNumber} onChange={e => setForm({...form, taxNumber: e.target.value})} className="mt-1" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Informasi Bank</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Nama Bank</Label><Input value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>No. Rekening</Label><Input value={form.bankAccount} onChange={e => setForm({...form, bankAccount: e.target.value})} className="mt-1" /></div>
              <div><Label>Atas Nama</Label><Input value={form.bankHolder} onChange={e => setForm({...form, bankHolder: e.target.value})} className="mt-1" /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Nama & Kode Dokumen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-gray-500">Sesuaikan nama dan kode penomoran dokumen sesuai kebutuhan kantor Anda. Kode digunakan sebagai prefix nomor surat (contoh: <span className="font-mono bg-gray-100 px-1 rounded">SPH/2026/03/0001</span>).</p>
            <div className="grid grid-cols-1 gap-4">
              <div className="p-3 border border-gray-200 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Penawaran Harga (SPH)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nama Dokumen</Label>
                    <Input value={form.docNameSph} onChange={e => setForm({...form, docNameSph: e.target.value})} placeholder="Surat Penawaran Harga" className="mt-1" />
                  </div>
                  <div>
                    <Label>Kode Prefix</Label>
                    <Input value={form.docPrefixSph} onChange={e => setForm({...form, docPrefixSph: e.target.value})} placeholder="SPH" className="mt-1" />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Contoh nomor: <span className="font-mono">{form.docPrefixSph || 'SPH'}/2026/03/0001</span></p>
              </div>

              <div className="p-3 border border-gray-200 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Invoice / Tagihan</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nama Dokumen</Label>
                    <Input value={form.docNameInvoice} onChange={e => setForm({...form, docNameInvoice: e.target.value})} placeholder="Invoice" className="mt-1" />
                  </div>
                  <div>
                    <Label>Kode Prefix</Label>
                    <Input value={form.docPrefixInvoice} onChange={e => setForm({...form, docPrefixInvoice: e.target.value})} placeholder="INV" className="mt-1" />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Contoh nomor: <span className="font-mono">{form.docPrefixInvoice || 'INV'}/2026/03/0001</span></p>
              </div>

              <div className="p-3 border border-gray-200 rounded-lg space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Bukti Pengeluaran Kas</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nama Dokumen</Label>
                    <Input value={form.docNameExpense} onChange={e => setForm({...form, docNameExpense: e.target.value})} placeholder="Bukti Pengeluaran Kas" className="mt-1" />
                  </div>
                  <div>
                    <Label>Kode Prefix</Label>
                    <Input value={form.docPrefixExpense} onChange={e => setForm({...form, docPrefixExpense: e.target.value})} placeholder="BKK" className="mt-1" />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Contoh nomor: <span className="font-mono">{form.docPrefixExpense || 'BKK'}/2026/03/15</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4"><Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</Button></div>
      </form>
    </div>
  );
}
