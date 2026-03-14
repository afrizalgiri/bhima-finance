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
import { formatCurrency, formatDate, PAYMENT_METHODS } from '../../lib/utils';
import { Plus, Trash2 } from 'lucide-react';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ invoiceId: '', amount: '', date: new Date().toISOString().split('T')[0], method: 'TRANSFER', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pr, ir] = await Promise.all([
        api.get('/payments'),
        api.get('/invoices', { params: { limit: 200 } }),
      ]);
      setPayments(pr.data.data);
      setInvoices(ir.data.data.filter((i: any) => i.status !== 'PAID'));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/payments', { ...form, amount: parseFloat(form.amount) });
      toast({ title: 'Pembayaran dicatat' });
      setDialogOpen(false);
      setForm({ invoiceId: '', amount: '', date: new Date().toISOString().split('T')[0], method: 'TRANSFER', reference: '', notes: '' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Hapus pembayaran ini?')) return;
    try { await api.delete(`/payments/${id}`); toast({ title: 'Pembayaran dihapus' }); fetchData(); }
    catch { toast({ title: 'Gagal', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Pembayaran</h1><p className="text-gray-500 text-sm">Catat pembayaran invoice</p></div>
        <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700"><Plus size={16} />Catat Pembayaran</Button>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200"><th className="text-left py-2 px-3 font-semibold text-gray-600">Tanggal</th><th className="text-left py-2 px-3 font-semibold text-gray-600">Invoice</th><th className="text-left py-2 px-3 font-semibold text-gray-600">Klien</th><th className="text-right py-2 px-3 font-semibold text-gray-600">Jumlah</th><th className="text-left py-2 px-3 font-semibold text-gray-600">Metode</th><th className="text-left py-2 px-3 font-semibold text-gray-600">Referensi</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                : payments.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada pembayaran</td></tr>
                : payments.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3">{formatDate(p.date)}</td>
                    <td className="py-2.5 px-3 font-medium text-blue-600">{p.invoice?.number}</td>
                    <td className="py-2.5 px-3 text-gray-600">{p.invoice?.client?.name}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-green-600">{formatCurrency(p.amount)}</td>
                    <td className="py-2.5 px-3 text-gray-600">{PAYMENT_METHODS.find(m => m.value === p.method)?.label}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{p.reference || '-'}</td>
                    <td className="py-2.5 px-3"><Button variant="ghost" size="icon" onClick={() => remove(p.id)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Catat Pembayaran</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Invoice *</Label>
              <Select value={form.invoiceId} onChange={e => setForm({...form, invoiceId: e.target.value})} required className="mt-1">
                <option value="">-- Pilih Invoice --</option>
                {invoices.map((i: any) => <option key={i.id} value={i.id}>{i.number} - {i.client?.name} ({formatCurrency(Number(i.total) - Number(i.paidAmount))} sisa)</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Jumlah (IDR) *</Label><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required className="mt-1" /></div>
              <div><Label>Tanggal *</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required className="mt-1" /></div>
            </div>
            <div><Label>Metode Pembayaran</Label><Select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="mt-1">{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></div>
            <div><Label>Nomor Referensi</Label><Input value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} placeholder="Nomor transfer / cek" className="mt-1" /></div>
            <div><Label>Catatan</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="mt-1" /></div>
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
