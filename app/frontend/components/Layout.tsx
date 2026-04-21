'use client';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, Users, Package, FileText, Receipt,
  CreditCard, DollarSign, BarChart3, Settings, LogOut, Menu, X, UserCog,
  History, Banknote, PenLine, ClipboardList, Paperclip, ShoppingCart, Landmark
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '../lib/utils';

// All app routes with their feature key
const ALL_NAV = [
  { href: '/dashboard',        label: 'Dashboard',           icon: LayoutDashboard, key: 'dashboard' },
  { href: '/clients',          label: 'Klien',               icon: Users,            key: 'clients' },
  { href: '/products',         label: 'Produk & Layanan',    icon: Package,          key: 'products' },
  { href: '/sph',              label: 'SPH',                  icon: FileText,         key: 'sph' },
  { href: '/invoices',         label: 'Invoice',              icon: Receipt,          key: 'invoices' },
  { href: '/lampiran',         label: 'Lampiran',             icon: Paperclip,        key: 'lampiran' },
  { href: '/po',               label: 'Purchase Order',       icon: ShoppingCart,     key: 'po' },
  { href: '/norek',            label: 'Norek Karyawan',       icon: Landmark,         key: 'norek' },
  { href: '/payments',         label: 'Pembayaran',           icon: CreditCard,       key: 'payments' },
  { href: '/expenses',         label: 'Pengeluaran',          icon: DollarSign,       key: 'expenses' },
  { href: '/expense-requests', label: 'Request for Payment',  icon: ClipboardList,    key: 'expense-requests' },
  { href: '/reports',          label: 'Laporan',              icon: BarChart3,        key: 'reports' },
  { href: '/payroll',          label: 'Slip Gaji',            icon: Banknote,         key: 'payroll' },
  { href: '/history',          label: 'Riwayat Aktivitas',   icon: History,          key: 'history' },
  { href: '/settings',         label: 'Pengaturan',           icon: Settings,         key: 'settings' },
];

// Admin-only items (never shown to STAFF)
const ADMIN_ONLY_KEYS = new Set(['settings']);
// Admin section (shown below divider)
const ADMIN_SECTION = [
  { href: '/users',      label: 'Manajemen User',       icon: UserCog },
  { href: '/signatures', label: 'Tanda Tangan Digital', icon: PenLine },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const featureAccess: string[] = user?.featureAccess || [];
  const isAdmin = user?.role === 'ADMIN';

  // For STAFF: allowed paths based on featureAccess + always allowed
  const allowedPaths = isAdmin ? null : [
    '/expense-requests',
    ...ALL_NAV.filter(n => !ADMIN_ONLY_KEYS.has(n.key) && featureAccess.includes(n.key)).map(n => n.href),
  ];

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return; }
    if (!loading && user && !isAdmin) {
      // Check if current path is allowed
      const allowed = allowedPaths || [];
      const isAllowed = allowed.some(p => pathname === p || pathname.startsWith(p + '/'));
      if (!isAllowed) {
        router.replace('/expense-requests');
      }
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  // Build STAFF nav items
  const staffNavItems = [
    // RFP always first
    ALL_NAV.find(n => n.key === 'expense-requests')!,
    // Other permitted items (excluding RFP and admin-only)
    ...ALL_NAV.filter(n => n.key !== 'expense-requests' && !ADMIN_ONLY_KEYS.has(n.key) && featureAccess.includes(n.key)),
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

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
          {isAdmin ? (
            // ADMIN: full nav
            <>
              {ALL_NAV.map(item => {
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
              <div className="px-3 pt-3 pb-1 text-xs text-gray-400 uppercase tracking-wide">Admin</div>
              {ADMIN_SECTION.map(item => {
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
            </>
          ) : (
            // STAFF: only permitted items
            staffNavItems.map(item => {
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
            })
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
