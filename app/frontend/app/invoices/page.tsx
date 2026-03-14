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
import { formatCurrency, formatDate, formatDateInput, INVOICE_STATUS, PAYMENT_METHODS } from '../../lib/utils';
import { Plus, Download, Eye, Trash2, X, CreditCard } from 'lucide-react';

interface Item { name: string; description: string; quantity: number; unit: string; price: number; productId?: string; }
const emptyItem: Item = { name: '', description: '', quantity: 1, unit: 'pcs', price: 0 };
const units = ['pcs', 'unit', 'set', 'bulan', 'hari', 'jam', 'kg', 'liter', 'meter', 'paket'];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({
    clientId: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    taxRate: '0',
    notes: '',
    headerColor: '#0f766e',
  });
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    method: 'TRANSFER',
    reference: '',
    notes: '',
  });
  const [paymentSaving, setPaymentSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ir, cr, pr] = await Promise.all([
        api.get('/invoices', { params: { limit: 100 } }),
        api.get('/clients'),
        api.get('/products'),
      ]);
      setInvoices(ir.data.data);
      setClients(cr.data.data);
      setProducts(pr.data.data);
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/invoices', {
        ...form, taxRate: parseFloat(form.taxRate), items,
        headerColor: form.headerColor || null,
      });
      toast({ title: 'Invoice berhasil dibuat' });
      setDialogOpen(false); fetchAll();
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Hapus invoice ini?')) return;
    try { await api.delete(`/invoices/${id}`); toast({ title: 'Invoice dihapus' }); fetchAll(); }
    catch { toast({ title: 'Gagal menghapus', variant: 'destructive' }); }
  };

  const downloadPdf = async (id: string, number: string) => {
    setDownloadingId(id);
    try {
      const r = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `INV-${number.replace(/\//g, '-')}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: 'Gagal generate PDF', variant: 'destructive' }); }
    finally { setDownloadingId(null); }
  };

  const viewInvoice = async (id: string) => {
    const r = await api.get(`/invoices/${id}`);
    setSelected(r.data.data); setViewDialog(true);
  };

  const openPayment = (inv: any) => {
    setSelected(inv);
    const remaining = Number(inv.total) - Number(inv.paidAmount || 0);
    setPaymentForm({
      amount: String(remaining > 0 ? remaining : ''),
      date: new Date().toISOString().split('T')[0],
      method: 'TRANSFER',
      reference: '',
      notes: '',
    });
    setPaymentDialog(true);
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault(); setPaymentSaving(true);
    try {
      await api.post('/payments', {
        invoiceId: selected.id,
        amount: parseFloat(paymentForm.amount),
        date: paymentForm.date,
        method: paymentForm.method,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
      });
      toast({ title: 'Pembayaran berhasil dicatat' });
      setPaymentDialog(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setPaymentSaving(false); }
  };

  const openCreate = () => {
    setItems([{ ...emptyItem }]);
    setForm({ clientId: '', date: new Date().toISOString().split('T')[0], dueDate: '', taxRate: '0', notes: '', headerColor: '#0f766e' });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Invoice</h1><p className="text-gray-500 text-sm">Kelola invoice dan tagihan klien</p></div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700"><Plus size={16} />Buat Invoice</Button>
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
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Jatuh Tempo</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Total</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Sisa</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                : invoices.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-gray-400">Belum ada invoice</td></tr>
                : invoices.map(inv => {
                  const status = INVOICE_STATUS.find(s => s.value === inv.status);
                  const remaining = Number(inv.total) - Number(inv.paidAmount || 0);
                  const isUnpaid = inv.status !== 'PAID' && inv.status !== 'CANCELLED';
                  return (
                    <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-blue-600">{inv.number}</td>
                      <td className="py-2.5 px-3">{inv.client?.name}</td>
                      <td className="py-2.5 px-3 text-gray-600">{formatDate(inv.date)}</td>
                      <td className="py-2.5 px-3 text-gray-600">{inv.dueDate ? formatDate(inv.dueDate) : '-'}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(inv.total)}</td>
                      <td className="py-2.5 px-3 text-right">
                        {remaining > 0 ? <span className="text-red-600 font-medium">{formatCurrency(remaining)}</span> : <span className="text-green-600">Lunas</span>}
                      </td>
                      <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs ${status?.color}`}>{status?.label}</span></td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => viewInvoice(inv.id)} title="Lihat detail"><Eye size={15} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => downloadPdf(inv.id, inv.number)} disabled={downloadingId === inv.id} title="Download PDF"><Download size={15} /></Button>
                          {isUnpaid && (
                            <Button variant="ghost" size="icon" onClick={() => openPayment(inv)} className="text-green-600 hover:text-green-800" title="Catat pembayaran"><CreditCard size={15} /></Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => remove(inv.id)} className="text-red-500 hover:text-red-700" title="Hapus"><Trash2 size={15} /></Button>
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

      {/* Create Invoice Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Buat Invoice Baru</DialogTitle></DialogHeader>
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
              <div><Label>Jatuh Tempo</Label><Input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="mt-1" /></div>
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

            {/* Color Picker */}
            <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
              <Label className="text-xs font-semibold text-gray-700">Warna Header Tabel:</Label>
              <input type="color" value={form.headerColor} onChange={e => setForm({...form, headerColor: e.target.value})}
                className="h-8 w-12 rounded cursor-pointer border border-gray-300" />
              <span className="text-xs text-gray-500">{form.headerColor}</span>
              <button type="button" onClick={() => setForm({...form, headerColor: '#0f766e'})}
                className="text-xs text-blue-600 hover:underline">Reset</button>
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
              <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">{saving ? 'Membuat...' : 'Buat Invoice'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      {selected && viewDialog && (
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Invoice {selected.number}</span>
                <Button size="sm" onClick={() => downloadPdf(selected.id, selected.number)} className="bg-blue-600 hover:bg-blue-700"><Download size={14} />Download PDF</Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">Klien:</span> <strong>{selected.client?.name}</strong></div>
                <div><span className="text-gray-500">Tanggal:</span> {formatDate(selected.date)}</div>
                {selected.dueDate && <div><span className="text-gray-500">Jatuh Tempo:</span> {formatDate(selected.dueDate)}</div>}
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  {(() => { const st = INVOICE_STATUS.find(s => s.value === selected.status); return <span className={`px-2 py-0.5 rounded-full text-xs ${st?.color}`}>{st?.label}</span>; })()}
                </div>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-2 text-xs">Nama</th>
                    <th className="text-center p-2 text-xs">Qty</th>
                    <th className="text-right p-2 text-xs">Harga</th>
                    <th className="text-right p-2 text-xs">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">
                        <div>{item.name}</div>
                        {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                      </td>
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
                {Number(selected.paidAmount) > 0 && (
                  <>
                    <div className="text-green-600">Dibayar: {formatCurrency(selected.paidAmount)}</div>
                    <div className={`font-semibold ${Number(selected.total) - Number(selected.paidAmount) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Sisa: {formatCurrency(Number(selected.total) - Number(selected.paidAmount))}
                    </div>
                  </>
                )}
              </div>
              {selected.payments && selected.payments.length > 0 && (
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Riwayat Pembayaran</p>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b"><th className="text-left py-1">Tanggal</th><th className="text-left py-1">Metode</th><th className="text-right py-1">Jumlah</th><th className="text-left py-1">Ref</th></tr></thead>
                    <tbody>
                      {selected.payments.map((p: any) => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="py-1 text-gray-600">{formatDate(p.date)}</td>
                          <td className="py-1">{PAYMENT_METHODS.find(m => m.value === p.method)?.label}</td>
                          <td className="py-1 text-right text-green-600 font-medium">{formatCurrency(p.amount)}</td>
                          <td className="py-1 text-gray-500">{p.reference || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Payment Dialog */}
      {selected && paymentDialog && (
        <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Catat Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="font-medium text-blue-800">{selected.number} - {selected.client?.name}</p>
              <p className="text-blue-600">Total: {formatCurrency(selected.total)} | Dibayar: {formatCurrency(selected.paidAmount || 0)}</p>
              <p className="font-semibold text-red-600">Sisa: {formatCurrency(Number(selected.total) - Number(selected.paidAmount || 0))}</p>
            </div>
            <form onSubmit={savePayment} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Jumlah (IDR) *</Label><Input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required className="mt-1" /></div>
                <div><Label>Tanggal *</Label><Input type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} required className="mt-1" /></div>
              </div>
              <div><Label>Metode Pembayaran</Label><Select value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})} className="mt-1">{PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</Select></div>
              <div><Label>Nomor Referensi</Label><Input value={paymentForm.reference} onChange={e => setPaymentForm({...paymentForm, reference: e.target.value})} placeholder="Nomor transfer / cek" className="mt-1" /></div>
              <div><Label>Catatan</Label><Input value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} className="mt-1" /></div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setPaymentDialog(false)} className="flex-1">Batal</Button>
                <Button type="submit" disabled={paymentSaving} className="flex-1 bg-green-600 hover:bg-green-700">{paymentSaving ? 'Menyimpan...' : 'Simpan Pembayaran'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
