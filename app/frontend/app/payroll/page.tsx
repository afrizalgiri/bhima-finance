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
import { Plus, Edit, Trash2, Download, Mail, FileText, User, Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const fmt = (n: number | null) =>
  n === null ? '****' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const emptyForm = {
  employeeName: '', position: '', department: '',
  month: new Date().getMonth() + 1, year: new Date().getFullYear(),
  baseSalary: '', allowances: '0', deductions: '0', notes: '',
};

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

  // Email dialog state
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailTarget, setEmailTarget] = useState<any>(null);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Download loading per id
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!user) return;
    if (!isAdmin && !user.canViewSalary && !user.featureAccess?.includes('payroll')) { router.push('/expense-requests'); return; }
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
    setForm({
      employeeName: p.employeeName,
      position: p.position || '',
      department: p.department || '',
      month: p.month, year: p.year,
      baseSalary: String(p.baseSalary),
      allowances: String(p.allowances),
      deductions: String(p.deductions),
      notes: p.notes || '',
    });
    setDialogOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const data = {
        ...form,
        baseSalary: parseFloat(form.baseSalary) || 0,
        allowances: parseFloat(form.allowances) || 0,
        deductions: parseFloat(form.deductions) || 0,
      };
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

  const downloadPdf = async (p: any) => {
    setDownloadingId(p.id);
    try {
      const res = await api.get(`/payroll/${p.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      const month = String(p.month).padStart(2, '0');
      a.href = url; a.download = `SlipGaji_${p.employeeName.replace(/\s+/g, '_')}_${p.year}_${month}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Gagal mengunduh PDF', variant: 'destructive' });
    } finally { setDownloadingId(null); }
  };

  const openEmailDialog = (p: any) => {
    setEmailTarget(p);
    setEmailInput('');
    setEmailDialog(true);
  };

  const sendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTarget) return;
    setSendingEmail(true);
    try {
      await api.post(`/payroll/${emailTarget.id}/send-email`, { email: emailInput });
      toast({ title: `Slip gaji dikirim ke ${emailInput}` });
      setEmailDialog(false);
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal mengirim email', variant: 'destructive' });
    } finally { setSendingEmail(false); }
  };

  const netPreview = (parseFloat(form.baseSalary) || 0) + (parseFloat(form.allowances) || 0) - (parseFloat(form.deductions) || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Slip Gaji</h1>
          <p className="text-gray-500 text-sm">Kelola & distribusikan slip gaji karyawan</p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus size={15} /> Buat Slip Gaji
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={0}>Semua Bulan</option>
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        {payrolls.length > 0 && (
          <span className="text-sm text-gray-400">{payrolls.length} slip gaji</span>
        )}
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1B3A5C] text-white">
                  <th className="text-left py-3 px-4 font-semibold">Karyawan</th>
                  <th className="text-left py-3 px-4 font-semibold hidden md:table-cell">Jabatan / Dept</th>
                  <th className="text-left py-3 px-4 font-semibold">Periode</th>
                  <th className="text-right py-3 px-4 font-semibold hidden lg:table-cell">Gaji Pokok</th>
                  <th className="text-right py-3 px-4 font-semibold hidden lg:table-cell">Tunjangan</th>
                  <th className="text-right py-3 px-4 font-semibold hidden lg:table-cell">Potongan</th>
                  <th className="text-right py-3 px-4 font-semibold">Gaji Bersih</th>
                  <th className="py-3 px-4 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    <span>Memuat data...</span>
                  </td></tr>
                ) : payrolls.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    <span>Belum ada data slip gaji</span>
                  </td></tr>
                ) : payrolls.map((p, idx) => (
                  <tr key={p.id} className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    {/* Karyawan */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <User size={14} className="text-blue-600" />
                        </div>
                        <span className="font-semibold text-gray-800">{p.employeeName}</span>
                      </div>
                    </td>
                    {/* Jabatan/Dept */}
                    <td className="py-3 px-4 hidden md:table-cell">
                      {p.position || p.department ? (
                        <div className="text-xs text-gray-500 leading-tight">
                          {p.position && <div className="font-medium text-gray-700">{p.position}</div>}
                          {p.department && <div className="flex items-center gap-1"><Building2 size={10} />{p.department}</div>}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Periode */}
                    <td className="py-3 px-4 text-gray-600">{MONTHS[p.month - 1]} {p.year}</td>
                    {/* Gaji Pokok */}
                    <td className="py-3 px-4 text-right hidden lg:table-cell text-gray-600">
                      Rp {fmtShort(p.baseSalary)}
                    </td>
                    {/* Tunjangan */}
                    <td className="py-3 px-4 text-right hidden lg:table-cell text-green-600">
                      {p.allowances > 0 ? `+ Rp ${fmtShort(p.allowances)}` : '—'}
                    </td>
                    {/* Potongan */}
                    <td className="py-3 px-4 text-right hidden lg:table-cell text-red-500">
                      {p.deductions > 0 ? `- Rp ${fmtShort(p.deductions)}` : '—'}
                    </td>
                    {/* Gaji Bersih */}
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-[#1B3A5C] bg-blue-50 px-2 py-0.5 rounded text-sm">
                        {fmt(p.netSalary)}
                      </span>
                    </td>
                    {/* Aksi */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => downloadPdf(p)}
                          disabled={downloadingId === p.id}
                          title="Download PDF"
                          className="p-1.5 rounded text-gray-500 hover:bg-green-100 hover:text-green-700 disabled:opacity-50 transition-colors"
                        >
                          {downloadingId === p.id ? (
                            <span className="text-xs">...</span>
                          ) : (
                            <Download size={14} />
                          )}
                        </button>
                        <button
                          onClick={() => openEmailDialog(p)}
                          title="Kirim via Email"
                          className="p-1.5 rounded text-gray-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                        >
                          <Mail size={14} />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => openEdit(p)}
                              title="Edit"
                              className="p-1.5 rounded text-gray-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => remove(p.id, `${p.employeeName} ${MONTHS[p.month - 1]}`)}
                              title="Hapus"
                              className="p-1.5 rounded text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      {isAdmin && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Slip Gaji' : 'Buat Slip Gaji'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div>
                <Label>Nama Karyawan *</Label>
                <Input value={form.employeeName} onChange={e => setForm({...form, employeeName: e.target.value})}
                  required placeholder="Contoh: Budi Santoso" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Jabatan</Label>
                  <Input value={form.position} onChange={e => setForm({...form, position: e.target.value})}
                    placeholder="Contoh: Staff IT" className="mt-1" />
                </div>
                <div>
                  <Label>Departemen</Label>
                  <Input value={form.department} onChange={e => setForm({...form, department: e.target.value})}
                    placeholder="Contoh: Finance" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bulan *</Label>
                  <select value={form.month} onChange={e => setForm({...form, month: parseInt(e.target.value)})}
                    className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Tahun *</Label>
                  <Input type="number" value={form.year} onChange={e => setForm({...form, year: parseInt(e.target.value)})}
                    required className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Gaji Pokok (Rp) *</Label>
                <Input type="number" min="0" value={form.baseSalary}
                  onChange={e => setForm({...form, baseSalary: e.target.value})} required placeholder="0" className="mt-1" />
              </div>
              <div>
                <Label>Tunjangan (Rp)</Label>
                <Input type="number" min="0" value={form.allowances}
                  onChange={e => setForm({...form, allowances: e.target.value})} className="mt-1" />
              </div>
              <div>
                <Label>Potongan (Rp)</Label>
                <Input type="number" min="0" value={form.deductions}
                  onChange={e => setForm({...form, deductions: e.target.value})} className="mt-1" />
              </div>

              {/* Net preview */}
              <div className="bg-[#1B3A5C] rounded-lg p-4 flex items-center justify-between">
                <span className="text-blue-200 text-sm font-medium">Gaji Bersih</span>
                <span className="text-white font-bold text-lg">{fmt(netPreview)}</span>
              </div>

              <div>
                <Label>Catatan</Label>
                <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="mt-1" />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Batal</Button>
                <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Send Email Dialog */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail size={18} className="text-blue-600" />
              Kirim Slip Gaji
            </DialogTitle>
          </DialogHeader>
          {emailTarget && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">
              <p className="font-semibold text-gray-800">{emailTarget.employeeName}</p>
              <p className="text-gray-500">{MONTHS[emailTarget.month - 1]} {emailTarget.year} &mdash; {fmt(emailTarget.netSalary)}</p>
            </div>
          )}
          <form onSubmit={sendEmail} className="space-y-3">
            <div>
              <Label>Alamat Email Tujuan *</Label>
              <Input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                required
                placeholder="karyawan@example.com"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">Slip gaji akan dikirim sebagai lampiran PDF</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEmailDialog(false)} className="flex-1">Batal</Button>
              <Button type="submit" disabled={sendingEmail} className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2">
                <Mail size={14} />
                {sendingEmail ? 'Mengirim...' : 'Kirim Email'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
