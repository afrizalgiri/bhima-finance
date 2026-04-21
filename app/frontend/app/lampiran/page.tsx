'use client';
import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toaster';
import { Plus, Download, Trash2, FileSpreadsheet, FileText, File, Upload, X, PlusCircle, Paperclip, ExternalLink } from 'lucide-react';

interface RfpAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize?: number;
  createdAt: string;
  request: { id: string; number: string; name: string; date: string; status: string; };
}

interface Lampiran {
  id: string;
  nama: string;
  deskripsi?: string;
  tipe: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  createdAt: string;
}

// ── Excel sheet state ──────────────────────────────────────
interface SheetData { name: string; columns: string[]; rows: string[][]; }
const emptySheet = (): SheetData => ({ name: 'Sheet1', columns: ['Kolom 1', 'Kolom 2'], rows: [['', '']] });

// ── Word section state ─────────────────────────────────────
interface WordSection { type: 'paragraph' | 'table'; content?: string; headers?: string[]; rows?: string[][]; }
const emptyWordSection = (): WordSection => ({ type: 'paragraph', content: '' });

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');
const formatSize = (b?: number) => !b ? '' : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const tipeLabel = (t: string) => ({ UPLOAD: 'Upload', EXCEL: 'Excel', WORD: 'Word' }[t] || t);
const tipeBadge = (t: string) => ({
  UPLOAD: 'bg-gray-100 text-gray-600',
  EXCEL: 'bg-green-100 text-green-700',
  WORD: 'bg-blue-100 text-blue-700',
}[t] || 'bg-gray-100 text-gray-600');

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  VERIFIED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export default function LampiranPage() {
  const [tab, setTab] = useState<'dokumen' | 'rfp'>('dokumen');
  const [list, setList] = useState<Lampiran[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // RFP attachments state
  const [rfpAtts, setRfpAtts] = useState<RfpAttachment[]>([]);
  const [rfpLoading, setRfpLoading] = useState(false);
  const [rfpSearch, setRfpSearch] = useState('');

  // Dialog state
  const [dialog, setDialog] = useState<'upload' | 'excel' | 'word' | null>(null);
  const [saving, setSaving] = useState(false);

  // Upload form
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNama, setUploadNama] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');

  // Excel form
  const [excelNama, setExcelNama] = useState('');
  const [excelDesc, setExcelDesc] = useState('');
  const [sheets, setSheets] = useState<SheetData[]>([emptySheet()]);

  // Word form
  const [wordNama, setWordNama] = useState('');
  const [wordDesc, setWordDesc] = useState('');
  const [wordTitle, setWordTitle] = useState('');
  const [wordSections, setWordSections] = useState<WordSection[]>([emptyWordSection()]);

  const fetchList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/lampiran', { params: { search } });
      setList(r.data.data);
    } finally { setLoading(false); }
  };

  const fetchRfpAtts = async () => {
    setRfpLoading(true);
    try {
      const r = await api.get('/expense-requests/attachments', { params: { search: rfpSearch } });
      setRfpAtts(r.data.data || []);
    } catch { setRfpAtts([]); }
    finally { setRfpLoading(false); }
  };

  useEffect(() => { fetchList(); }, [search]);
  useEffect(() => { if (tab === 'rfp') fetchRfpAtts(); }, [tab, rfpSearch]);

  const openUpload = () => { setUploadFile(null); setUploadNama(''); setUploadDesc(''); setDialog('upload'); };
  const openExcel = () => { setExcelNama(''); setExcelDesc(''); setSheets([emptySheet()]); setDialog('excel'); };
  const openWord = () => { setWordNama(''); setWordDesc(''); setWordTitle(''); setWordSections([emptyWordSection()]); setDialog('word'); };

  // ── Save Upload ─────────────────────────────────────────
  const saveUpload = async () => {
    if (!uploadFile) return toast({ title: 'Pilih file terlebih dahulu', variant: 'destructive' });
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('nama', uploadNama || uploadFile.name);
      if (uploadDesc) fd.append('deskripsi', uploadDesc);
      await api.post('/lampiran/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast({ title: 'Lampiran berhasil diupload' });
      setDialog(null); fetchList();
    } catch { toast({ title: 'Gagal upload', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  // ── Save Excel ──────────────────────────────────────────
  const saveExcel = async () => {
    if (!excelNama.trim()) return toast({ title: 'Nama lampiran wajib diisi', variant: 'destructive' });
    setSaving(true);
    try {
      await api.post('/lampiran/generate/excel', {
        nama: excelNama,
        deskripsi: excelDesc || null,
        templateData: { sheets },
      });
      toast({ title: 'Lampiran Excel berhasil dibuat' });
      setDialog(null); fetchList();
    } catch { toast({ title: 'Gagal membuat Excel', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  // ── Save Word ───────────────────────────────────────────
  const saveWord = async () => {
    if (!wordNama.trim()) return toast({ title: 'Nama lampiran wajib diisi', variant: 'destructive' });
    setSaving(true);
    try {
      await api.post('/lampiran/generate/word', {
        nama: wordNama,
        deskripsi: wordDesc || null,
        templateData: { title: wordTitle || wordNama, sections: wordSections },
      });
      toast({ title: 'Lampiran Word berhasil dibuat' });
      setDialog(null); fetchList();
    } catch { toast({ title: 'Gagal membuat Word', variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  // ── Delete ──────────────────────────────────────────────
  const remove = async (id: string, nama: string) => {
    if (!confirm(`Hapus lampiran "${nama}"?`)) return;
    try {
      await api.delete(`/lampiran/${id}`);
      toast({ title: 'Lampiran dihapus' });
      fetchList();
    } catch { toast({ title: 'Gagal menghapus', variant: 'destructive' }); }
  };

  // ── Excel helpers ───────────────────────────────────────
  const updateSheetCol = (si: number, ci: number, val: string) => {
    const s = sheets.map((sh, i) => i !== si ? sh : { ...sh, columns: sh.columns.map((c, j) => j === ci ? val : c) });
    setSheets(s);
  };
  const addSheetCol = (si: number) => {
    setSheets(sheets.map((sh, i) => i !== si ? sh : {
      ...sh,
      columns: [...sh.columns, `Kolom ${sh.columns.length + 1}`],
      rows: sh.rows.map(r => [...r, '']),
    }));
  };
  const removeSheetCol = (si: number, ci: number) => {
    setSheets(sheets.map((sh, i) => i !== si ? sh : {
      ...sh,
      columns: sh.columns.filter((_, j) => j !== ci),
      rows: sh.rows.map(r => r.filter((_, j) => j !== ci)),
    }));
  };
  const updateCell = (si: number, ri: number, ci: number, val: string) => {
    setSheets(sheets.map((sh, i) => i !== si ? sh : {
      ...sh,
      rows: sh.rows.map((r, j) => j !== ri ? r : r.map((c, k) => k === ci ? val : c)),
    }));
  };
  const addRow = (si: number) => setSheets(sheets.map((sh, i) => i !== si ? sh : { ...sh, rows: [...sh.rows, Array(sh.columns.length).fill('')] }));
  const removeRow = (si: number, ri: number) => setSheets(sheets.map((sh, i) => i !== si ? sh : { ...sh, rows: sh.rows.filter((_, j) => j !== ri) }));

  // ── Word helpers ────────────────────────────────────────
  const updateSection = (idx: number, patch: Partial<WordSection>) => setWordSections(wordSections.map((s, i) => i !== idx ? s : { ...s, ...patch }));
  const addSection = (type: 'paragraph' | 'table') => setWordSections([...wordSections, type === 'table' ? { type: 'table', headers: ['Kolom 1', 'Kolom 2'], rows: [['', '']] } : { type: 'paragraph', content: '' }]);
  const removeSection = (idx: number) => setWordSections(wordSections.filter((_, i) => i !== idx));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lampiran</h1>
          <p className="text-gray-500 text-sm">Dokumen lampiran & arsip file dari pengajuan RFP</p>
        </div>
        {tab === 'dokumen' && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openExcel} className="border-green-300 text-green-700 hover:bg-green-50"><FileSpreadsheet size={15} />Buat Excel</Button>
            <Button variant="outline" onClick={openWord} className="border-blue-300 text-blue-700 hover:bg-blue-50"><FileText size={15} />Buat Word</Button>
            <Button onClick={openUpload} className="bg-blue-600 hover:bg-blue-700"><Upload size={15} />Upload File</Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('dokumen')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'dokumen' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Dokumen Lampiran
        </button>
        <button
          onClick={() => setTab('rfp')}
          className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'rfp' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Paperclip size={14} /> Lampiran dari RFP
          {rfpAtts.length > 0 && (
            <span className="ml-1 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full">{rfpAtts.length}</span>
          )}
        </button>
      </div>

      {/* ── DOKUMEN LAMPIRAN TAB ── */}
      {tab === 'dokumen' && (
        <Card>
          <CardContent className="p-4">
            <Input placeholder="Cari lampiran..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs mb-4" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Nama</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Tipe</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">File</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Ukuran</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                    : list.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Belum ada lampiran</td></tr>
                    : list.map(l => (
                      <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2.5 px-3">
                          <div className="font-medium">{l.nama}</div>
                          {l.deskripsi && <div className="text-xs text-gray-400">{l.deskripsi}</div>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tipeBadge(l.tipe)}`}>{tipeLabel(l.tipe)}</span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs">{l.fileName || '-'}</td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs">{formatSize(l.fileSize) || '-'}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex gap-1">
                            <a href={`${API_BASE}/api/lampiran/${l.id}/download`} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" title="Download"><Download size={14} /></Button>
                            </a>
                            <Button variant="ghost" size="icon" onClick={() => remove(l.id, l.nama)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── LAMPIRAN RFP TAB ── */}
      {tab === 'rfp' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <Input
                placeholder="Cari nama file, nomor RFP, nama pemohon..."
                value={rfpSearch}
                onChange={e => setRfpSearch(e.target.value)}
                className="max-w-sm"
              />
              <button onClick={fetchRfpAtts} className="text-xs text-gray-500 hover:text-blue-600 shrink-0">Refresh</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Nama File</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Dari Pengajuan</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Pemohon</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Tgl Pengajuan</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Ukuran</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rfpLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">Memuat...</td></tr>
                  ) : rfpAtts.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">
                      {rfpSearch ? 'Tidak ada hasil pencarian' : 'Belum ada lampiran dari pengajuan RFP'}
                    </td></tr>
                  ) : rfpAtts.map(att => (
                    <tr key={att.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {att.mimeType.startsWith('image/') ? (
                            <img src={`${API_BASE}${att.fileUrl}`} alt={att.fileName}
                              className="w-8 h-8 object-cover rounded border shrink-0" />
                          ) : (
                            <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center shrink-0">
                              <span className="text-red-600 font-bold text-[10px]">PDF</span>
                            </div>
                          )}
                          <span className="font-medium text-gray-800 max-w-[180px] truncate">{att.fileName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs font-semibold text-blue-700">{att.request.number}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 text-xs">{att.request.name}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">{fmtDate(att.request.date)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[att.request.status] || 'bg-gray-100 text-gray-600'}`}>
                          {att.request.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">{formatSize(att.fileSize) || '-'}</td>
                      <td className="py-2.5 px-3">
                        <a href={`${API_BASE}${att.fileUrl}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          <ExternalLink size={13} /> Lihat
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Upload Dialog ────────────────────────────────── */}
      <Dialog open={dialog === 'upload'} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Lampiran</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>File *</Label>
              <div
                className="mt-1 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <File size={16} className="text-blue-500" />
                    <span className="font-medium">{uploadFile.name}</span>
                    <span className="text-gray-400">{formatSize(uploadFile.size)}</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">
                    <Upload size={20} className="mx-auto mb-1 text-gray-300" />
                    Klik untuk pilih file (.xlsx, .docx, .pdf, dll)
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setUploadFile(f); if (!uploadNama) setUploadNama(f.name.replace(/\.[^.]+$/, '')); }
              }} />
            </div>
            <div><Label>Nama Lampiran</Label><Input value={uploadNama} onChange={e => setUploadNama(e.target.value)} className="mt-1" placeholder="Nama tampilan lampiran" /></div>
            <div><Label>Deskripsi</Label><Input value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} className="mt-1" placeholder="Opsional" /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(null)} className="flex-1">Batal</Button>
              <Button onClick={saveUpload} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">{saving ? 'Mengupload...' : 'Upload'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Excel Builder Dialog ─────────────────────────── */}
      <Dialog open={dialog === 'excel'} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet size={16} className="text-green-600" />Buat Lampiran Excel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nama Lampiran *</Label><Input value={excelNama} onChange={e => setExcelNama(e.target.value)} className="mt-1" placeholder="contoh: Daftar Harga" /></div>
              <div><Label>Deskripsi</Label><Input value={excelDesc} onChange={e => setExcelDesc(e.target.value)} className="mt-1" placeholder="Opsional" /></div>
            </div>

            {sheets.map((sheet, si) => (
              <div key={si} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Input value={sheet.name} onChange={e => setSheets(sheets.map((s, i) => i === si ? { ...s, name: e.target.value } : s))}
                    className="max-w-[140px] text-sm" placeholder="Nama sheet" />
                  <span className="text-xs text-gray-400 flex-1">({sheet.columns.length} kolom, {sheet.rows.length} baris)</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => addSheetCol(si)}><Plus size={12} />Kolom</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse min-w-full">
                    <thead>
                      <tr>
                        {sheet.columns.map((col, ci) => (
                          <th key={ci} className="p-1">
                            <div className="flex items-center gap-1">
                              <Input value={col} onChange={e => updateSheetCol(si, ci, e.target.value)} className="text-xs h-7 font-bold bg-blue-50 border-blue-200" placeholder={`Kolom ${ci + 1}`} />
                              {sheet.columns.length > 1 && <button type="button" onClick={() => removeSheetCol(si, ci)} className="text-red-400 hover:text-red-600"><X size={10} /></button>}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="p-1">
                              <Input value={cell} onChange={e => updateCell(si, ri, ci, e.target.value)} className="text-xs h-7" placeholder="..." />
                            </td>
                          ))}
                          <td className="p-1"><button type="button" onClick={() => removeRow(si, ri)} className="text-red-400 hover:text-red-600"><X size={12} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => addRow(si)} className="text-xs"><Plus size={12} />Tambah Baris</Button>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(null)} className="flex-1">Batal</Button>
              <Button onClick={saveExcel} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700">{saving ? 'Membuat...' : 'Buat Excel'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Word Builder Dialog ──────────────────────────── */}
      <Dialog open={dialog === 'word'} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText size={16} className="text-blue-600" />Buat Lampiran Word</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nama Lampiran *</Label><Input value={wordNama} onChange={e => setWordNama(e.target.value)} className="mt-1" placeholder="contoh: Syarat & Ketentuan" /></div>
              <div><Label>Deskripsi</Label><Input value={wordDesc} onChange={e => setWordDesc(e.target.value)} className="mt-1" placeholder="Opsional" /></div>
            </div>
            <div><Label>Judul Dokumen</Label><Input value={wordTitle} onChange={e => setWordTitle(e.target.value)} className="mt-1" placeholder="Tampil sebagai heading 1" /></div>

            <div className="space-y-2">
              <Label>Konten</Label>
              {wordSections.map((sec, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => updateSection(idx, { type: 'paragraph' })}
                        className={`text-xs px-2 py-1 rounded border ${sec.type === 'paragraph' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>Paragraf</button>
                      <button type="button" onClick={() => updateSection(idx, { type: 'table', headers: sec.headers || ['Kolom 1', 'Kolom 2'], rows: sec.rows || [['', '']] })}
                        className={`text-xs px-2 py-1 rounded border ${sec.type === 'table' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300'}`}>Tabel</button>
                    </div>
                    {wordSections.length > 1 && <button type="button" onClick={() => removeSection(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>}
                  </div>
                  {sec.type === 'paragraph' ? (
                    <textarea
                      value={sec.content || ''} onChange={e => updateSection(idx, { content: e.target.value })} rows={3}
                      placeholder="Tulis paragraf di sini..."
                      className="w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  ) : (
                    <div className="space-y-1 overflow-x-auto">
                      <div className="flex gap-1 flex-wrap">
                        {(sec.headers || []).map((h, hi) => (
                          <Input key={hi} value={h}
                            onChange={e => updateSection(idx, { headers: sec.headers!.map((x, j) => j === hi ? e.target.value : x) })}
                            className="text-xs h-7 font-bold bg-blue-50 border-blue-200 w-32" placeholder={`Kolom ${hi + 1}`} />
                        ))}
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateSection(idx, { headers: [...(sec.headers || []), `Kolom ${(sec.headers || []).length + 1}`], rows: (sec.rows || []).map(r => [...r, '']) })}><Plus size={10} /></Button>
                      </div>
                      {(sec.rows || []).map((row, ri) => (
                        <div key={ri} className="flex gap-1 items-center">
                          {row.map((cell, ci) => (
                            <Input key={ci} value={cell}
                              onChange={e => updateSection(idx, { rows: sec.rows!.map((r, j) => j === ri ? r.map((c, k) => k === ci ? e.target.value : c) : r) })}
                              className="text-xs h-7 w-32" placeholder="..." />
                          ))}
                          <button type="button" onClick={() => updateSection(idx, { rows: sec.rows!.filter((_, j) => j !== ri) })} className="text-red-400"><X size={10} /></button>
                        </div>
                      ))}
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => updateSection(idx, { rows: [...(sec.rows || []), Array((sec.headers || []).length).fill('')] })}>
                        <Plus size={10} /> Baris
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addSection('paragraph')}><Plus size={12} />Paragraf</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addSection('table')}><Plus size={12} />Tabel</Button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(null)} className="flex-1">Batal</Button>
              <Button onClick={saveWord} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">{saving ? 'Membuat...' : 'Buat Word'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
