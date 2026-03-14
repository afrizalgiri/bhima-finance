'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, Users, Package, FileText, Receipt,
  CreditCard, DollarSign, BarChart3, Settings, LogOut, Menu, X, UserCog,
  History, Banknote
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '../lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Klien', icon: Users },
  { href: '/products', label: 'Produk & Layanan', icon: Package },
  { href: '/sph', label: 'SPH', icon: FileText },
  { href: '/invoices', label: 'Invoice', icon: Receipt },
  { href: '/payments', label: 'Pembayaran', icon: CreditCard },
  { href: '/expenses', label: 'Pengeluaran', icon: DollarSign },
  { href: '/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/settings', label: 'Pengaturan', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h1 className="text-lg font-bold text-blue-700">Bhima Finance</h1>
            <p className="text-xs text-gray-500">Finance Management</p>
          </div>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors',
                  active ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
                )}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
          {(user.role === 'ADMIN' || user.canViewHistory) && (
            <Link href="/history" onClick={() => setSidebarOpen(false)}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors',
                pathname === '/history' ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
              )}>
              <History size={18} />
              Riwayat Aktivitas
            </Link>
          )}
          <Link href="/payroll" onClick={() => setSidebarOpen(false)}
            className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors',
              pathname === '/payroll' ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
            )}>
            <Banknote size={18} />
            Slip Gaji
          </Link>
          {user.role === 'ADMIN' && (
            <>
              <div className="px-3 pt-3 pb-1 text-xs text-gray-400 uppercase tracking-wide">Admin</div>
              <Link href="/users" onClick={() => setSidebarOpen(false)}
                className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors',
                  pathname === '/users' ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
                )}>
                <UserCog size={18} />
                Manajemen User
              </Link>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <div className="px-3 py-2 text-xs text-gray-500 mb-1">
            <div className="font-medium text-gray-700">{user.name}</div>
            <div>{user.email}</div>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 w-full transition-colors">
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-3 lg:px-6">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="flex-1" />
          <span className="text-sm text-gray-600">Halo, <strong>{user.name}</strong></span>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
