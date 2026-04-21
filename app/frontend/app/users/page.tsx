'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toaster';
import { UserPlus, Pencil, Trash2, KeyRound, ShieldCheck, User, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

// All togglable features for STAFF users
const FEATURE_GROUPS = [
  {
    group: 'Transaksi',
    features: [
      { key: 'expense-requests', label: 'Request for Payment', desc: 'Mengajukan & melihat permintaan pembayaran', always: true },
      { key: 'invoices',         label: 'Invoice',              desc: 'Melihat & mengelola invoice klien' },
      { key: 'payments',         label: 'Pembayaran',           desc: 'Melihat pembayaran yang diterima' },
      { key: 'expenses',         label: 'Pengeluaran',          desc: 'Melihat & mencatat pengeluaran' },
      { key: 'po',               label: 'Purchase Order',       desc: 'Melihat & mengelola PO' },
    ],
  },
  {
    group: 'Data Master',
    features: [
      { key: 'clients',  label: 'Klien',           desc: 'Melihat & mengelola data klien' },
      { key: 'products', label: 'Produk & Layanan', desc: 'Melihat & mengelola produk/layanan' },
      { key: 'norek',    label: 'Norek Karyawan',   desc: 'Melihat rekening bank karyawan' },
      { key: 'sph',      label: 'SPH',              desc: 'Membuat Surat Penawaran Harga' },
    ],
  },
  {
    group: 'Dokumen & Laporan',
    features: [
      { key: 'lampiran', label: 'Lampiran',          desc: 'Melihat arsip lampiran dokumen' },
      { key: 'reports',  label: 'Laporan',            desc: 'Melihat & mengunduh laporan keuangan' },
      { key: 'payroll',  label: 'Slip Gaji',          desc: 'Melihat & mengunduh slip gaji' },
      { key: 'history',  label: 'Riwayat Aktivitas', desc: 'Melihat log aktivitas sistem' },
    ],
  },
  {
    group: 'Sistem',
    features: [
      { key: 'settings', label: 'Pengaturan',  desc: 'Mengakses pengaturan perusahaan' },
      { key: 'dashboard', label: 'Dashboard',  desc: 'Melihat ringkasan dashboard' },
    ],
  },
];

interface UserData {
  id: string; name: string; email: string; role: string; isActive: boolean;
  canViewHistory: boolean; canViewSalary: boolean; featureAccess: string[]; createdAt: string;
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [resetUser, setResetUser] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' });
  const [saving, setSaving] = useState(false);
  const [permUser, setPermUser] = useState<UserData | null>(null);
  const [permAccess, setPermAccess] = useState<string[]>([]);

  useEffect(() => {
    if (me && me.role !== 'ADMIN') { router.push('/dashboard'); return; }
    fetchUsers();
  }, [me]);

  const fetchUsers = async () => {
    try {
      const r = await api.get('/users');
      setUsers(r.data.data);
    } catch { toast({ title: 'Gagal memuat data user', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/users', form);
      toast({ title: 'User berhasil ditambahkan' });
      setShowAdd(false); setForm({ name: '', email: '', password: '', role: 'STAFF' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal menambah user', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editUser) return; setSaving(true);
    try {
      await api.put(`/users/${editUser.id}`, { name: editUser.name, email: editUser.email, role: editUser.role, isActive: editUser.isActive });
      toast({ title: 'User berhasil diupdate' });
      setEditUser(null); fetchUsers();
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal update user', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const doResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); if (!resetUser) return; setSaving(true);
    try {
      await api.put(`/users/${resetUser.id}/reset-password`, { newPassword });
      toast({ title: `Password ${resetUser.name} berhasil direset` });
      setResetUser(null); setNewPassword('');
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal reset password', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const openPermissions = (u: UserData) => {
    setPermUser(u);
    // expense-requests is always on — don't put it in toggles
    setPermAccess(u.featureAccess || []);
  };

  const toggleFeature = (key: string) => {
    setPermAccess(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const savePermissions = async () => {
    if (!permUser) return; setSaving(true);
    try {
      await api.put(`/users/${permUser.id}/permissions`, { featureAccess: permAccess });
      toast({ title: `Izin akses ${permUser.name} diperbarui` });
      setPermUser(null); fetchUsers();
    } catch {
      toast({ title: 'Gagal memperbarui izin', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const deleteUser = async (u: UserData) => {
    if (!confirm(`Hapus user "${u.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast({ title: 'User dihapus' }); fetchUsers();
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal hapus user', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen User</h1>
          <p className="text-gray-500 text-sm">Kelola akun & izin akses fitur tim</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
          <UserPlus size={16} /> Tambah User
        </Button>
      </div>

      <div className="grid gap-3">
        {users.map(u => {
          const accessCount = (u.featureAccess || []).filter(k => k !== 'expense-requests').length;
          return (
            <Card key={u.id} className={`border-0 shadow-sm ${!u.isActive ? 'opacity-60' : ''}`}>
              <CardContent className="flex items-center justify-between p-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    {u.role === 'ADMIN' ? <ShieldCheck size={18} className="text-blue-600" /> : <User size={18} className="text-gray-500" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{u.name}</span>
                      {u.id === me?.id && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Anda</span>}
                    </div>
                    <div className="text-sm text-gray-500">{u.email}</div>
                    {u.role === 'STAFF' && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {accessCount > 0 ? `${accessCount + 1} fitur diizinkan` : 'RFP saja'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}
                    className={u.role === 'ADMIN' ? 'bg-blue-600' : ''}>{u.role}</Badge>
                  <Badge variant={u.isActive ? 'default' : 'destructive'}
                    className={u.isActive ? 'bg-green-100 text-green-700 border-0' : ''}>
                    {u.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => setEditUser({ ...u })} title="Edit Info">
                    <Pencil size={15} />
                  </Button>
                  {u.id !== me?.id && u.role !== 'ADMIN' && (
                    <Button variant="ghost" size="sm" onClick={() => openPermissions(u)} title="Atur Izin Fitur"
                      className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50">
                      <Shield size={15} />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setResetUser(u); setNewPassword(''); }} title="Reset Password">
                    <KeyRound size={15} />
                  </Button>
                  {u.id !== me?.id && (
                    <Button variant="ghost" size="sm" onClick={() => deleteUser(u)}
                      className="text-red-500 hover:text-red-700" title="Hapus">
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Tambah User ─────────────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah User Baru</DialogTitle></DialogHeader>
          <form onSubmit={addUser} className="space-y-4 mt-2">
            <div><Label>Nama Lengkap</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="mt-1" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="mt-1" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} placeholder="Min. 6 karakter" className="mt-1" /></div>
            <div>
              <Label>Role</Label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="STAFF">STAFF</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Menyimpan...' : 'Tambah'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User ──────────────────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={v => !v && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          {editUser && (
            <form onSubmit={saveEdit} className="space-y-4 mt-2">
              <div><Label>Nama Lengkap</Label><Input value={editUser.name} onChange={e => setEditUser({...editUser, name: e.target.value})} required className="mt-1" /></div>
              <div><Label>Email</Label><Input type="email" value={editUser.email} onChange={e => setEditUser({...editUser, email: e.target.value})} required className="mt-1" /></div>
              <div>
                <Label>Role</Label>
                <select value={editUser.role} onChange={e => setEditUser({...editUser, role: e.target.value})}
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="STAFF">STAFF</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editUser.isActive} onChange={e => setEditUser({...editUser, isActive: e.target.checked})} className="rounded" />
                <span className="text-sm">Akun Aktif</span>
              </label>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Batal</Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Kelola Izin Akses ─────────────────────────────────────────────── */}
      <Dialog open={!!permUser} onOpenChange={v => { if (!v) setPermUser(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield size={18} className="text-indigo-600" />
              Izin Akses Fitur — {permUser?.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 -mt-1">
            Pilih fitur yang boleh digunakan oleh user ini. Fitur yang tidak dipilih tidak akan muncul di menu.
          </p>

          <div className="space-y-5 mt-2">
            {FEATURE_GROUPS.map(group => (
              <div key={group.group}>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.group}</div>
                <div className="space-y-1">
                  {group.features.map(feat => {
                    const isAlways = (feat as any).always;
                    const checked = isAlways || permAccess.includes(feat.key);
                    return (
                      <label key={feat.key}
                        className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${isAlways ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer hover:bg-indigo-50/50'} ${checked && !isAlways ? 'border-indigo-300 bg-indigo-50/40' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${isAlways ? 'text-gray-500' : 'text-gray-800'}`}>
                            {feat.label}
                            {isAlways && <span className="ml-2 text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">selalu aktif</span>}
                          </div>
                          <div className="text-xs text-gray-400">{feat.desc}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isAlways}
                          onChange={() => !isAlways && toggleFeature(feat.key)}
                          className="ml-3 w-4 h-4 rounded accent-indigo-600 shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setPermUser(null)}>Batal</Button>
            <Button onClick={savePermissions} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? 'Menyimpan...' : 'Simpan Izin'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password ────────────────────────────────────────────────── */}
      <Dialog open={!!resetUser} onOpenChange={v => !v && setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password — {resetUser?.name}</DialogTitle></DialogHeader>
          <form onSubmit={doResetPassword} className="space-y-4 mt-2">
            <div><Label>Password Baru</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="Min. 6 karakter" className="mt-1" /></div>
            <p className="text-xs text-gray-500">User harus login ulang setelah password direset.</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setResetUser(null)}>Batal</Button>
              <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? 'Menyimpan...' : 'Reset Password'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
