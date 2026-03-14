'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toaster';
import { UserPlus, Pencil, Trash2, KeyRound, ShieldCheck, User, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserData {
  id: string; name: string; email: string; role: string; isActive: boolean; canViewHistory: boolean; canViewSalary: boolean; createdAt: string;
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

  const savePermissions = async (u: UserData) => {
    try {
      await api.put(`/users/${u.id}/permissions`, { canViewHistory: u.canViewHistory, canViewSalary: u.canViewSalary });
      toast({ title: `Izin ${u.name} diperbarui` });
      setPermUser(null); fetchUsers();
    } catch (err: any) {
      toast({ title: 'Gagal memperbarui izin', variant: 'destructive' });
    }
  };

  const deleteUser = async (u: UserData) => {
    if (!confirm(`Hapus user "${u.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast({ title: 'User dihapus' });
      fetchUsers();
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
          <p className="text-gray-500 text-sm">Kelola akses tim finance</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
          <UserPlus size={16} /> Tambah User
        </Button>
      </div>

      <div className="grid gap-3">
        {users.map(u => (
          <Card key={u.id} className={!u.isActive ? 'opacity-60' : ''}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  {u.role === 'ADMIN' ? <ShieldCheck size={18} className="text-blue-600" /> : <User size={18} className="text-gray-500" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{u.name}</span>
                    {u.id === me?.id && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Anda</span>}
                  </div>
                  <div className="text-sm text-gray-500">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>{u.role}</Badge>
                <Badge variant={u.isActive ? 'default' : 'destructive'} className={u.isActive ? 'bg-green-100 text-green-700' : ''}>{u.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
                {u.canViewHistory && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Lihat History</span>}
                {u.canViewSalary && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Lihat Gaji</span>}
                <Button variant="ghost" size="sm" onClick={() => setEditUser({ ...u })} title="Edit"><Pencil size={15} /></Button>
                {u.id !== me?.id && <Button variant="ghost" size="sm" onClick={() => setPermUser({ ...u })} title="Kelola Izin"><Shield size={15} /></Button>}
                <Button variant="ghost" size="sm" onClick={() => { setResetUser(u); setNewPassword(''); }} title="Reset Password"><KeyRound size={15} /></Button>
                {u.id !== me?.id && (
                  <Button variant="ghost" size="sm" onClick={() => deleteUser(u)} className="text-red-500 hover:text-red-700" title="Hapus"><Trash2 size={15} /></Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal Tambah User */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah User Baru</DialogTitle></DialogHeader>
          <form onSubmit={addUser} className="space-y-4 mt-2">
            <div><Label>Nama Lengkap</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="mt-1" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="mt-1" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required minLength={6} placeholder="Min. 6 karakter" className="mt-1" /></div>
            <div>
              <Label>Role</Label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
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

      {/* Modal Edit User */}
      <Dialog open={!!editUser} onOpenChange={v => !v && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          {editUser && (
            <form onSubmit={saveEdit} className="space-y-4 mt-2">
              <div><Label>Nama Lengkap</Label><Input value={editUser.name} onChange={e => setEditUser({...editUser, name: e.target.value})} required className="mt-1" /></div>
              <div><Label>Email</Label><Input type="email" value={editUser.email} onChange={e => setEditUser({...editUser, email: e.target.value})} required className="mt-1" /></div>
              <div>
                <Label>Role</Label>
                <select value={editUser.role} onChange={e => setEditUser({...editUser, role: e.target.value})} className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="STAFF">STAFF</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={editUser.isActive} onChange={e => setEditUser({...editUser, isActive: e.target.checked})} className="rounded" />
                <Label htmlFor="isActive">Akun Aktif</Label>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Batal</Button>
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? 'Menyimpan...' : 'Simpan'}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Kelola Izin */}
      <Dialog open={!!permUser} onOpenChange={v => !v && setPermUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kelola Izin — {permUser?.name}</DialogTitle></DialogHeader>
          {permUser && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-gray-500">Atur izin akses khusus untuk user ini.</p>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-sm">Lihat Riwayat Aktivitas</div>
                    <div className="text-xs text-gray-500">Dapat mengakses halaman History semua aktivitas</div>
                  </div>
                  <input type="checkbox" checked={permUser.canViewHistory}
                    onChange={e => setPermUser({...permUser, canViewHistory: e.target.checked})}
                    className="w-4 h-4 rounded accent-blue-600" />
                </label>
                <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-sm">Lihat Angka Gaji</div>
                    <div className="text-xs text-gray-500">Dapat melihat jumlah gaji di halaman Slip Gaji</div>
                  </div>
                  <input type="checkbox" checked={permUser.canViewSalary}
                    onChange={e => setPermUser({...permUser, canViewSalary: e.target.checked})}
                    className="w-4 h-4 rounded accent-blue-600" />
                </label>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setPermUser(null)}>Batal</Button>
                <Button onClick={() => savePermissions(permUser)} className="bg-blue-600 hover:bg-blue-700">Simpan Izin</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Reset Password */}
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
