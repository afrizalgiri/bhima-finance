'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toaster';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const fmt = (n: number | null) => n === null ? '****' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const emptyForm = { employeeName: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), baseSalary: '', allowances: '0', deductions: '0', notes: '' };

export default function PayrollPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(0);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!user) return;
    if (!isAdmin && !user.canViewSalary) { router.push('/dashboard'); return; }
    fetchAll();
  }, [user, filterYear, filterMonth]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params: any = { year: filterYear };
      if (filterMonth > 0) params.month = filterMonth;
      const r = await api.get('/payroll', { params });
      setPayrolls(r.data.data);
    } catch { } finally { setLoading(false); }
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ employeeName: p.employeeName, month: p.month, year: p.year, baseSalary: String(p.baseSalary), allowances: String(p.allowances), deductions: String(p.deductions), notes: p.notes || '' });
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const data = { ...form, baseSalary: parseFloat(form.baseSalary) || 0, allowances: parseFloat(form.allowances) || 0, deductions: parseFloat(form.deductions) || 0 };
      if (editing) {
        await api.put(`/payroll/${editing.id}`, data);
        toast({ title: 'Slip gaji diperbarui' });
      } else {
        await api.post('/payroll', data);
        toast({ title: 'Slip gaji dibuat' });
      }
      setDialogOpen(false); fetchAll();
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal menyimpan', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Hapus slip gaji ${name}?`)) return;
    try {
      await api.delete(`/payroll/${id}`);
      toast({ title: 'Slip gaji dihapus' }); fetchAll();
    } catch { toast({ title: 'Gagal menghapus', variant: 'destructive' }); }
  };

  const netPreview = (parseFloat(form.baseSalary) || 0) + (parseFloat(form.allowances) || 0) - (parseFloat(form.deductions) || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Slip Gaji</h1>
          <p className="text-gray-500 text-sm">Kelola slip gaji karyawan</p>
        </div>
        {isAdmin && <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700"><Plus size={16} />Buat Slip Gaji</Button>}
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
          className="rounded-md border border-input px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}
          className="rounded-md border border-input px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <option value={0}>Semua Bulan</option>
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-600">Karyawan</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-600">Periode</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-gray-600">Gaji Pokok</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-gray-600">Tunjangan</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-gray-600">Potongan</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-gray-600">Gaji Bersih</th>
                  {isAdmin && <th className="py-2.5 px-4"></th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                ) : payrolls.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-gray-400">Belum ada data slip gaji</td></tr>
                ) : payrolls.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-medium">{p.employeeName}</td>
                    <td className="py-2.5 px-4 text-gray-600">{MONTHS[p.month - 1]} {p.year}</td>
                    <td className="py-2.5 px-4 text-right">{fmt(p.baseSalary)}</td>
                    <td className="py-2.5 px-4 text-right text-green-600">{fmt(p.allowances)}</td>
                    <td className="py-2.5 px-4 text-right text-red-500">{p.deductions > 0 ? '-' + fmt(p.deductions) : fmt(0)}</td>
                    <td className="py-2.5 px-4 text-right font-bold text-blue-700">{fmt(p.netSalary)}</td>
                    {isAdmin && (
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit size={14} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => remove(p.id, p.employeeName + ' ' + MONTHS[p.month-1])} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? 'Edit Slip Gaji' : 'Buat Slip Gaji'}</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div>
                <Label>Nama Karyawan *</Label>
                <Input value={form.employeeName} onChange={e => setForm({...form, employeeName: e.target.value})} required placeholder="Contoh: Budi Santoso" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bulan *</Label>
                  <select value={form.month} onChange={e => setForm({...form, month: parseInt(e.target.value)})}
                    className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Tahun *</Label>
                  <Input type="number" value={form.year} onChange={e => setForm({...form, year: parseInt(e.target.value)})} required className="mt-1" />
                </div>
              </div>
              <div><Label>Gaji Pokok (Rp) *</Label><Input type="number" min="0" value={form.baseSalary} onChange={e => setForm({...form, baseSalary: e.target.value})} required placeholder="0" className="mt-1" /></div>
              <div><Label>Tunjangan (Rp)</Label><Input type="number" min="0" value={form.allowances} onChange={e => setForm({...form, allowances: e.target.value})} className="mt-1" /></div>
              <div><Label>Potongan (Rp)</Label><Input type="number" min="0" value={form.deductions} onChange={e => setForm({...form, deductions: e.target.value})} className="mt-1" /></div>
              <div className="bg-blue-50 rounded-md p-3 text-sm">
                <span className="text-gray-600">Gaji Bersih: </span>
                <strong className="text-blue-700">{fmt(netPreview)}</strong>
              </div>
              <div><Label>Catatan</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="mt-1" /></div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Batal</Button>
                <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
