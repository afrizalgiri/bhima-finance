'use client';
import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent } from '../../components/ui/card';
import { useRouter } from 'next/navigation';

const ENTITY_COLORS: Record<string, string> = {
  SPH: 'bg-blue-100 text-blue-700',
  Invoice: 'bg-teal-100 text-teal-700',
  Pembayaran: 'bg-green-100 text-green-700',
  Pengeluaran: 'bg-orange-100 text-orange-700',
  Klien: 'bg-purple-100 text-purple-700',
};

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'ADMIN' && !user.canViewHistory) {
      router.push('/dashboard');
      return;
    }
    fetchLogs();
  }, [user, entity, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const r = await api.get('/activity', { params: { entity: entity || undefined, page, limit } });
      setLogs(r.data.data);
      setTotal(r.data.total);
    } catch { } finally { setLoading(false); }
  };

  const entities = ['', 'SPH', 'Invoice', 'Pembayaran', 'Pengeluaran', 'Klien'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Aktivitas</h1>
        <p className="text-gray-500 text-sm">Semua aktivitas yang tercatat di sistem</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {entities.map(e => (
          <button key={e} onClick={() => { setEntity(e); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${entity === e ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {e || 'Semua'}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-10 text-gray-400">Memuat...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Belum ada aktivitas</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs mt-0.5">
                    {log.user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{log.user?.name || 'Unknown'}</span>
                      <span className="text-gray-500 text-sm">{log.action}</span>
                      {log.detail && <span className="text-gray-700 text-sm font-medium truncate">{log.detail}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENTITY_COLORS[log.entity] || 'bg-gray-100 text-gray-600'}`}>
                        {log.entity}
                      </span>
                      <span className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {total > limit && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">Sebelumnya</button>
          <span className="px-3 py-1.5 text-sm text-gray-600">{page} / {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)}
            className="px-3 py-1.5 border rounded text-sm disabled:opacity-40">Berikutnya</button>
        </div>
      )}
    </div>
  );
}
