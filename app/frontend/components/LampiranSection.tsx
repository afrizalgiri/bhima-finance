'use client';
import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from './ui/toaster';
import { Paperclip, Plus, Trash2, ArrowUp, ArrowDown, FileSpreadsheet, FileText, File, Search, X } from 'lucide-react';

interface LampiranMeta {
  id: string;
  nama: string;
  deskripsi?: string;
  tipe: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

interface DokumenLampiran {
  id: string;
  urutan: number;
  lampiranId: string;
  lampiran: LampiranMeta;
}

interface Props {
  dokumenType: string;
  dokumenId: string | null; // null = dokumen belum disimpan, pending attach
  // Mode pending: lampiran dipilih di frontend dulu, dikirim bareng save dokumen
  onChange?: (selectedIds: string[]) => void;
  pendingIds?: string[]; // dipakai kalau dokumenId null
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');

const tipeIcon = (tipe: string) => {
  if (tipe === 'EXCEL') return <FileSpreadsheet size={14} className="text-green-600" />;
  if (tipe === 'WORD') return <FileText size={14} className="text-blue-600" />;
  return <File size={14} className="text-gray-500" />;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function LampiranSection({ dokumenType, dokumenId, onChange, pendingIds = [] }: Props) {
  const [attached, setAttached] = useState<DokumenLampiran[]>([]);
  const [pendingSelected, setPendingSelected] = useState<LampiranMeta[]>([]);
  const [masterList, setMasterList] = useState<LampiranMeta[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const isPending = !dokumenId;

  // Load attached lampiran (when dokumenId is known)
  useEffect(() => {
    if (!dokumenId) return;
    setLoading(true);
    api.get(`/lampiran/dokumen/${dokumenType}/${dokumenId}`)
      .then(r => setAttached(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dokumenId, dokumenType]);

  // Load master list when picker opens
  useEffect(() => {
    if (!pickerOpen) return;
    api.get('/lampiran', { params: { search } })
      .then(r => setMasterList(r.data.data))
      .catch(() => {});
  }, [pickerOpen, search]);

  // Notify parent of pending selection changes
  useEffect(() => {
    if (isPending && onChange) onChange(pendingSelected.map(l => l.id));
  }, [pendingSelected]);

  const alreadyPicked = new Set(
    isPending
      ? pendingSelected.map(l => l.id)
      : attached.map(d => d.lampiranId)
  );

  const handlePick = async (item: LampiranMeta) => {
    if (alreadyPicked.has(item.id)) return;

    if (isPending) {
      setPendingSelected(prev => [...prev, item]);
    } else {
      try {
        const r = await api.post('/lampiran/dokumen/attach', {
          dokumenType,
          dokumenId,
          lampiranIds: [item.id],
        });
        setAttached(r.data.data);
        toast({ title: `Lampiran "${item.nama}" ditambahkan` });
      } catch {
        toast({ title: 'Gagal menambahkan lampiran', variant: 'destructive' });
      }
    }
    setPickerOpen(false);
    setSearch('');
  };

  const handleDetach = async (junctionId: string, nama: string) => {
    if (isPending) {
      setPendingSelected(prev => prev.filter(l => l.id !== junctionId));
      return;
    }
    const entry = attached.find(a => a.id === junctionId);
    if (!entry) return;
    try {
      await api.delete(`/lampiran/dokumen/${dokumenType}/${dokumenId}/${entry.lampiranId}`);
      setAttached(prev => prev.filter(a => a.id !== junctionId));
      toast({ title: `Lampiran "${nama}" dihapus dari dokumen` });
    } catch {
      toast({ title: 'Gagal hapus lampiran', variant: 'destructive' });
    }
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const newList = [...attached];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= newList.length) return;
    [newList[idx], newList[targetIdx]] = [newList[targetIdx], newList[idx]];
    setAttached(newList);
    if (!isPending) {
      await api.put('/lampiran/dokumen/reorder', {
        dokumenType,
        dokumenId,
        orderedIds: newList.map(a => a.id),
      }).catch(() => {});
    }
  };

  const displayList = isPending
    ? pendingSelected.map((l, i) => ({ id: l.id, urutan: i, lampiranId: l.id, lampiran: l }))
    : attached;

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip size={15} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Lampiran</span>
          {displayList.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">{displayList.length}</span>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus size={13} /> Tambah Lampiran
        </Button>
      </div>

      {loading && <div className="text-xs text-gray-400 py-1">Memuat lampiran...</div>}

      {displayList.length === 0 && !loading && (
        <div className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded">
          Belum ada lampiran. Klik "+ Tambah Lampiran" untuk memilih.
        </div>
      )}

      <div className="space-y-1.5">
        {displayList.map((dl, idx) => (
          <div key={dl.id} className="flex items-center gap-2 bg-gray-50 rounded-md px-2.5 py-1.5 border border-gray-100">
            <span className="text-xs text-gray-400 w-5 text-center font-mono">{idx + 1}</span>
            {tipeIcon(dl.lampiran.tipe)}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate">{dl.lampiran.nama}</div>
              {dl.lampiran.fileName && (
                <div className="text-xs text-gray-400 truncate">{dl.lampiran.fileName} {formatSize(dl.lampiran.fileSize) && `· ${formatSize(dl.lampiran.fileSize)}`}</div>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {!isPending && (
                <a
                  href={`${API_BASE}/api/lampiran/${dl.lampiranId}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-blue-600 text-xs"
                  title="Download"
                >↓</a>
              )}
              <button type="button" onClick={() => handleMove(idx, -1)} disabled={idx === 0}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30">
                <ArrowUp size={11} />
              </button>
              <button type="button" onClick={() => handleMove(idx, 1)} disabled={idx === displayList.length - 1}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30">
                <ArrowDown size={11} />
              </button>
              <button type="button" onClick={() => handleDetach(dl.id, dl.lampiran.nama)}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Picker Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Pilih Lampiran</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 border rounded-md px-2">
              <Search size={14} className="text-gray-400" />
              <input
                className="flex-1 py-1.5 text-sm outline-none bg-transparent"
                placeholder="Cari lampiran..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {masterList.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-6">
                  Belum ada lampiran. Buat di menu <strong>Lampiran</strong>.
                </div>
              )}
              {masterList.map(item => {
                const picked = alreadyPicked.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={picked}
                    onClick={() => handlePick(item)}
                    className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors border ${
                      picked ? 'bg-green-50 border-green-200 opacity-60 cursor-default' : 'hover:bg-blue-50 hover:border-blue-200 border-gray-100'
                    }`}
                  >
                    {tipeIcon(item.tipe)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.nama}</div>
                      {item.deskripsi && <div className="text-xs text-gray-400 truncate">{item.deskripsi}</div>}
                      {item.fileName && <div className="text-xs text-gray-400 truncate">{item.fileName} {formatSize(item.fileSize) && `· ${formatSize(item.fileSize)}`}</div>}
                    </div>
                    {picked && <span className="text-xs text-green-600 shrink-0">✓ Sudah dipilih</span>}
                  </button>
                );
              })}
            </div>
            <div className="text-xs text-gray-400 text-center">
              Belum ada lampiran yang dibutuhkan?{' '}
              <a href="/lampiran" target="_blank" className="text-blue-600 hover:underline">Kelola Master Lampiran →</a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
