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
import { formatCurrency, formatDate, SPH_STATUS } from '../../lib/utils';
import { Plus, Download, Eye, Trash2, X, Sparkles, Loader2, Pencil, RotateCcw, ChevronUp, ChevronDown, Layers, ToggleRight } from 'lucide-react';
import LampiranSection from '../../components/LampiranSection';

interface Section {
  key: string;
  title: string;
  showPerColumn: boolean;
  totalOverride: string;
  sortOrder: number;
}

interface Item {
  name: string; description: string; quantity: number; unit: string; price: number | '';
  productId?: string; sectionKey: string; nomor: string; sortOrder: number; perValue: number | '';
}

const mkKey = () => `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const defaultSection = (sortOrder = 0): Section => ({ key: mkKey(), title: '', showPerColumn: false, totalOverride: '', sortOrder });
const emptyItem = (sectionKey: string, sortOrder = 0): Item => ({
  name: '', description: '', quantity: 1, unit: 'pcs', price: '', sectionKey, nomor: '', sortOrder, perValue: '',
});
const units = ['pcs', 'unit', 'set', 'bulan', 'bln', 'hari', 'jam', 'kg', 'liter', 'meter', 'paket'];
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');

export default function SphPage() {
  const [sphs, setSphs] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({
    clientId: '', date: new Date().toISOString().split('T')[0], validUntil: '',
    taxRate: '0', notes: '', openingText: '', closingText: '', headerColor: '#1a3557',
    signerTitle: '', signatureId: '', status: 'DRAFT', number: '',
  });

  const initSec = defaultSection();
  const [sections, setSections] = useState<Section[]>([initSec]);
  const [items, setItems] = useState<Item[]>([emptyItem(initSec.key)]);
  const [customTotal, setCustomTotal] = useState('');
  const [pendingLampiranIds, setPendingLampiranIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sr, cr, pr, sigr] = await Promise.all([api.get('/sph'), api.get('/clients'), api.get('/products'), api.get('/signatures')]);
      setSphs(sr.data.data); setClients(cr.data.data); setProducts(pr.data.data); setSignatures(sigr.data.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchAll(); }, []);

  /* ═══ SECTION ═══ */
  const addSection = () => {
    const s = defaultSection(sections.length);
    setSections(prev => [...prev, s]);
    setItems(prev => [...prev, emptyItem(s.key)]);
  };
  const removeSection = (key: string) => {
    if (sections.length <= 1) return;
    if (!confirm('Hapus section ini beserta semua itemnya?')) return;
    setSections(prev => prev.filter(s => s.key !== key));
    setItems(prev => prev.filter(i => i.sectionKey !== key));
  };
  const updateSection = (idx: number, field: keyof Section, value: any) => {
    setSections(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };
  const moveSection = (idx: number, dir: -1 | 1) => {
    const t = idx + dir;
    if (t < 0 || t >= sections.length) return;
    setSections(prev => {
      const u = [...prev]; [u[idx], u[t]] = [u[t], u[idx]];
      u.forEach((s, i) => s.sortOrder = i); return u;
    });
  };

  /* ═══ ITEMS ═══ */
  const addItemToSection = (sectionKey: string) => {
    const secItems = items.filter(i => i.sectionKey === sectionKey);
    setItems(prev => [...prev, emptyItem(sectionKey, secItems.length)]);
  };
  const removeItemFrom = (sectionKey: string, localIdx: number) => {
    const secItems = items.filter(i => i.sectionKey === sectionKey);
    if (secItems.length <= 1) return;
    const target = secItems[localIdx];
    setItems(prev => {
      const idx = prev.indexOf(target);
      if (idx === -1) return prev;
      const n = [...prev]; n.splice(idx, 1); return n;
    });
  };
  const updateItemIn = (sectionKey: string, localIdx: number, field: keyof Item, value: any) => {
    const secItems = items.filter(i => i.sectionKey === sectionKey);
    const target = secItems[localIdx];
    if (!target) return;
    setItems(prev => {
      const idx = prev.indexOf(target);
      if (idx === -1) return prev;
      const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n;
    });
  };
  const selectProduct = (sectionKey: string, localIdx: number, productId: string) => {
    const p = products.find((x: any) => x.id === productId);
    if (!p) return;
    const secItems = items.filter(i => i.sectionKey === sectionKey);
    const target = secItems[localIdx];
    if (!target) return;
    setItems(prev => {
      const idx = prev.indexOf(target);
      if (idx === -1) return prev;
      const n = [...prev];
      n[idx] = { ...n[idx], productId, name: p.name, description: p.description || '', price: Number(p.price), unit: p.unit };
      return n;
    });
  };

  /* ═══ CALC ═══ */
  const calcItemTotal = (item: Item) => {
    if (item.price === '') return 0;
    const per = item.perValue === '' ? 1 : Number(item.perValue);
    return item.quantity * per * Number(item.price);
  };
  const calcSectionSubtotal = (key: string) => items.filter(i => i.sectionKey === key).reduce((s, i) => s + calcItemTotal(i), 0);
  const getEffSectionTotal = (sec: Section) => sec.totalOverride !== '' ? Number(sec.totalOverride) : calcSectionSubtotal(sec.key);
  const subtotal = sections.reduce((s, sec) => s + getEffSectionTotal(sec), 0);
  const taxAmount = subtotal * (parseFloat(form.taxRate || '0') / 100);
  const autoTotal = subtotal + taxAmount;
  const effectiveTotal = customTotal !== '' ? Number(customTotal) : autoTotal;

  /* ═══ AI ═══ */
  const generateAiText = async () => {
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) { toast({ title: 'Isi minimal satu item terlebih dahulu', variant: 'destructive' }); return; }
    setGeneratingAi(true);
    try {
      const client = clients.find((c: any) => c.id === form.clientId);
      const r = await api.post('/ai/generate-text', {
        items: validItems.map(i => ({ name: i.name, description: i.description, unit: i.unit })),
        docType: 'sph', clientName: client?.name || '',
      });
      setForm(f => ({ ...f, openingText: r.data.data.openingText, closingText: r.data.data.closingText }));
      toast({ title: 'Teks berhasil digenerate oleh AI' });
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Gagal generate teks AI', variant: 'destructive' });
    } finally { setGeneratingAi(false); }
  };

  /* ═══ OPEN EDIT ═══ */
  const openEdit = async (sph: any) => {
    const r = await api.get(`/sph/${sph.id}`);
    const s = r.data.data;
    setEditMode(true); setEditingId(s.id); setEditingNumber(s.number);
    setForm({
      clientId: s.clientId, date: new Date(s.date).toISOString().split('T')[0],
      validUntil: s.validUntil ? new Date(s.validUntil).toISOString().split('T')[0] : '',
      taxRate: String(s.taxRate || 0), notes: s.notes || '', openingText: s.openingText || '',
      closingText: s.closingText || '', headerColor: s.headerColor || '#1a3557',
      signerTitle: s.signerTitle || '', signatureId: s.signatureId || '',
      status: s.status || 'DRAFT', number: s.number || '',
    });
    let loadedSections: Section[];
    if (s.sectionsConfig && Array.isArray(s.sectionsConfig) && s.sectionsConfig.length > 0) {
      loadedSections = s.sectionsConfig.map((sec: any) => ({
        key: sec.key, title: sec.title || '', showPerColumn: sec.showPerColumn || false,
        totalOverride: sec.totalOverride != null ? String(sec.totalOverride) : '', sortOrder: sec.sortOrder || 0,
      }));
    } else {
      loadedSections = [{ key: 'main', title: '', showPerColumn: false, totalOverride: '', sortOrder: 0 }];
    }
    setSections(loadedSections);
    const loadedItems: Item[] = s.items.map((item: any, idx: number) => ({
      name: item.name, description: item.description || '', quantity: Number(item.quantity),
      unit: item.unit || 'pcs', price: item.price == null ? '' : Number(item.price),
      productId: item.productId || undefined, sectionKey: item.sectionKey || loadedSections[0].key,
      nomor: item.nomor || '', sortOrder: item.sortOrder != null ? item.sortOrder : idx,
      perValue: item.perValue == null ? '' : Number(item.perValue),
    }));
    setItems(loadedItems);
    const calcSub = loadedSections.reduce((sum, sec) => {
      const st = sec.totalOverride !== '' ? Number(sec.totalOverride)
        : loadedItems.filter(i => i.sectionKey === sec.key).reduce((a, item) => {
            const p = item.price === '' ? 0 : Number(item.price);
            const pv = item.perValue === '' ? 1 : Number(item.perValue);
            return a + item.quantity * pv * p;
          }, 0);
      return sum + st;
    }, 0);
    const calcT = calcSub * (1 + (Number(s.taxRate) || 0) / 100);
    setCustomTotal(Math.abs(Number(s.total) - calcT) > 0.5 ? String(s.total) : '');
    setDialogOpen(true);
  };

  /* ═══ SAVE ═══ */
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const sectionsData = sections.map(sec => ({
        key: sec.key, title: sec.title, showPerColumn: sec.showPerColumn,
        totalOverride: sec.totalOverride !== '' ? Number(sec.totalOverride) : null, sortOrder: sec.sortOrder,
      }));
      let globalSort = 0;
      const allItems = sections.flatMap(sec =>
        items.filter(i => i.sectionKey === sec.key).map(item => ({
          ...item, price: item.price === '' ? null : Number(item.price),
          perValue: item.perValue === '' ? null : Number(item.perValue), sortOrder: globalSort++,
        }))
      );
      const payload: any = {
        ...form, taxRate: parseFloat(form.taxRate || '0'), items: allItems, total: effectiveTotal,
        openingText: form.openingText || null, closingText: form.closingText || null,
        headerColor: form.headerColor || null, signerTitle: form.signerTitle || null,
        signatureId: form.signatureId || null, sectionsConfig: sectionsData,
      };
      if (editMode && editingId) {
        await api.put(`/sph/${editingId}`, payload);
        toast({ title: 'SPH berhasil diupdate' });
      } else {
        const created = await api.post('/sph', payload);
        const newId = created.data.data.id;
        if (pendingLampiranIds.length > 0)
          await api.post('/lampiran/dokumen/attach', { dokumenType: 'sph', dokumenId: newId, lampiranIds: pendingLampiranIds });
        toast({ title: 'SPH berhasil dibuat' });
      }
      setDialogOpen(false); fetchAll();
    } catch (err: any) {
      toast({ title: 'Gagal', description: err.response?.data?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Hapus SPH ini?')) return;
    try { await api.delete(`/sph/${id}`); toast({ title: 'SPH dihapus' }); fetchAll(); }
    catch { toast({ title: 'Gagal menghapus', variant: 'destructive' }); }
  };
  const downloadPdf = async (id: string, number: string) => {
    setDownloadingId(id);
    try {
      const r = await api.get(`/sph/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `SPH-${number.replace(/\//g, '-')}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: 'Gagal generate PDF', variant: 'destructive' }); }
    finally { setDownloadingId(null); }
  };
  const viewSph = async (id: string) => { const r = await api.get(`/sph/${id}`); setSelected(r.data.data); setViewDialog(true); };
  const openCreate = () => {
    setEditMode(false); setEditingId(null); setEditingNumber(''); setCustomTotal(''); setPendingLampiranIds([]);
    const s = defaultSection();
    setSections([s]); setItems([emptyItem(s.key)]);
    setForm({ clientId: '', date: new Date().toISOString().split('T')[0], validUntil: '', taxRate: '0', notes: '', openingText: '', closingText: '', headerColor: '#1a3557', signerTitle: '', signatureId: '', status: 'DRAFT', number: '' });
    setDialogOpen(true);
  };

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">SPH</h1><p className="text-gray-500 text-sm">Surat Penawaran Harga</p></div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700"><Plus size={16} />Buat SPH</Button>
      </div>

      {/* ── LIST TABLE ── */}
      <Card><CardContent className="p-4"><div className="overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="border-b border-gray-200">
          <th className="text-left py-2 px-3 font-semibold text-gray-600">Nomor</th>
          <th className="text-left py-2 px-3 font-semibold text-gray-600">Klien</th>
          <th className="text-left py-2 px-3 font-semibold text-gray-600">Tanggal</th>
          <th className="text-right py-2 px-3 font-semibold text-gray-600">Total</th>
          <th className="text-left py-2 px-3 font-semibold text-gray-600">Status</th>
          <th></th>
        </tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Memuat...</td></tr>
          : sphs.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Belum ada SPH</td></tr>
          : sphs.map(s => {
            const status = SPH_STATUS.find(x => x.value === s.status);
            return (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2.5 px-3 font-medium text-blue-600">{s.number}</td>
                <td className="py-2.5 px-3">{s.client?.name}</td>
                <td className="py-2.5 px-3 text-gray-600">{formatDate(s.date)}</td>
                <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(s.total)}</td>
                <td className="py-2.5 px-3"><span className={`px-2 py-0.5 rounded-full text-xs ${status?.color}`}>{status?.label}</span></td>
                <td className="py-2.5 px-3"><div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => viewSph(s.id)}><Eye size={15} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Edit"><Pencil size={15} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => downloadPdf(s.id, s.number)} disabled={downloadingId === s.id}><Download size={15} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(s.id)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></Button>
                </div></td>
              </tr>
            );
          })}
        </tbody></table>
      </div></CardContent></Card>

      {/* ══════════ CREATE / EDIT DIALOG ══════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{editMode ? `Edit SPH — ${editingNumber}` : 'Buat SPH Baru'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className={editMode ? 'col-span-1' : 'col-span-2'}>
                <Label>Klien *</Label>
                <Select value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})} required className="mt-1">
                  <option value="">-- Pilih Klien --</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              {editMode && (
                <div><Label>Status</Label>
                  <Select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="mt-1">
                    <option value="DRAFT">Draft</option><option value="SENT">Terkirim</option>
                    <option value="ACCEPTED">Diterima</option><option value="REJECTED">Ditolak</option>
                  </Select>
                </div>
              )}

              <div><Label>Tanggal *</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required className="mt-1" /></div>
              <div><Label>Berlaku Hingga</Label><Input type="date" value={form.validUntil} onChange={e => setForm({...form, validUntil: e.target.value})} className="mt-1" /></div>
            </div>

            {/* ══ SECTIONS & ITEMS ══ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Layers size={15} className="text-blue-600" />
                  <Label className="text-blue-800 font-semibold">Section & Item</Label>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSection} className="border-blue-300 text-blue-700 hover:bg-blue-50">
                  <Plus size={14} /> Tambah Section
                </Button>
              </div>

              <div className="space-y-3">
                {sections.map((sec, sIdx) => {
                  const secItems = items.filter(i => i.sectionKey === sec.key);
                  const secCalcTotal = calcSectionSubtotal(sec.key);
                  const secEffTotal = getEffSectionTotal(sec);

                  return (
                    <div key={sec.key} className="border border-blue-200 rounded-lg p-3 bg-gradient-to-b from-blue-50/50 to-white">
                      {/* Section Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <Input value={sec.title} onChange={e => updateSection(sIdx, 'title', e.target.value)}
                          placeholder={`Judul Section (contoh: ${sIdx + 1}. One Time Charge)`}
                          className="flex-1 font-semibold text-sm border-blue-200" />
                        <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer select-none bg-white border border-gray-200 rounded-md px-2 py-1.5">
                          <input type="checkbox" checked={sec.showPerColumn} onChange={e => updateSection(sIdx, 'showPerColumn', e.target.checked)} className="rounded" />
                          Kolom &quot;Per&quot;
                        </label>
                        {sections.length > 1 && (<>
                          <Button type="button" variant="ghost" size="icon" onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0} className="h-7 w-7"><ChevronUp size={13} /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => moveSection(sIdx, 1)} disabled={sIdx === sections.length - 1} className="h-7 w-7"><ChevronDown size={13} /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeSection(sec.key)} className="h-7 w-7 text-red-500 hover:text-red-700"><Trash2 size={13} /></Button>
                        </>)}
                      </div>

                      {/* Items list */}
                      <div className="space-y-2">
                        {secItems.map((item, iIdx) => (
                          <div key={iIdx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
                            <div className="flex gap-2">
                              <div style={{ width: '65px' }}>
                                <Label className="text-xs">No.</Label>
                                <Input value={item.nomor} onChange={e => updateItemIn(sec.key, iIdx, 'nomor', e.target.value)}
                                  placeholder={`${sIdx + 1}.${iIdx + 1}`} className="mt-1 text-sm text-center" />
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">Produk (opsional)</Label>
                                <Select value={item.productId || ''} onChange={e => selectProduct(sec.key, iIdx, e.target.value)} className="mt-1 text-xs">
                                  <option value="">-- Pilih atau ketik manual --</option>
                                  {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </Select>
                              </div>
                              {secItems.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeItemFrom(sec.key, iIdx)} className="mt-5 text-red-500"><X size={15} /></Button>
                              )}
                            </div>
                            <div><Label className="text-xs">Nama *</Label><Input value={item.name} onChange={e => updateItemIn(sec.key, iIdx, 'name', e.target.value)} required className="mt-1 text-sm" /></div>
                            <div><Label className="text-xs">Deskripsi</Label><Input value={item.description} onChange={e => updateItemIn(sec.key, iIdx, 'description', e.target.value)} className="mt-1 text-sm" /></div>
                            <div className={`grid gap-2 ${sec.showPerColumn ? 'grid-cols-5' : 'grid-cols-4'}`}>
                              <div>
                                <Label className="text-xs">Qty *</Label>
                                <Input type="number" min="0.01" step="0.01" value={item.quantity}
                                  onChange={e => updateItemIn(sec.key, iIdx, 'quantity', parseFloat(e.target.value) || 0)} required className="mt-1 text-sm" />
                              </div>
                              {sec.showPerColumn && (
                                <div>
                                  <Label className="text-xs">Per <span className="text-gray-400 font-normal">— opsional</span></Label>
                                  <Input type="number" min="0" step="any" value={item.perValue}
                                    onChange={e => updateItemIn(sec.key, iIdx, 'perValue', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    placeholder="12" className="mt-1 text-sm" />
                                </div>
                              )}
                              <div>
                                <Label className="text-xs">Satuan</Label>
                                <Select value={item.unit} onChange={e => updateItemIn(sec.key, iIdx, 'unit', e.target.value)} className="mt-1 text-xs">
                                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                                </Select>
                              </div>
                              <div className="col-span-2">
                                <Label className="text-xs">Harga Satuan (Rp) <span className="text-gray-400 font-normal">— opsional</span></Label>
                                <Input type="number" min="0" step="any" value={item.price}
                                  onChange={e => updateItemIn(sec.key, iIdx, 'price', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                  placeholder="Kosongkan jika tidak ada harga" className="mt-1 text-sm" />
                              </div>
                            </div>
                            {item.price !== '' && (
                              <div className="text-right text-xs text-gray-500">
                                Jumlah: <strong>{formatCurrency(calcItemTotal(item))}</strong>
                                {sec.showPerColumn && item.perValue !== '' && <span className="text-gray-400 ml-1">({item.quantity} × {Number(item.perValue)} × {formatCurrency(Number(item.price))})</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => addItemToSection(sec.key)}>
                          <Plus size={14} /> Tambah Item
                        </Button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-medium">Total {sec.title || `Section ${sIdx + 1}`}:</span>
                          <Input type="number" min="0" step="any"
                            value={sec.totalOverride !== '' ? sec.totalOverride : secCalcTotal || ''}
                            onChange={e => updateSection(sIdx, 'totalOverride', e.target.value)}
                            className={`w-44 text-right text-sm font-bold ${sec.totalOverride !== '' ? 'text-blue-700 border-blue-400' : 'text-gray-700'}`} />
                          {sec.totalOverride !== '' && (
                            <button type="button" onClick={() => updateSection(sIdx, 'totalOverride', '')}
                              className="text-xs text-gray-400 hover:text-blue-600"><RotateCcw size={11} /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Text & Color */}
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-purple-800 font-semibold">Teks Pembuka & Penutup</Label>
                <Button type="button" variant="outline" size="sm" onClick={generateAiText} disabled={generatingAi}
                  className="border-purple-400 text-purple-700 hover:bg-purple-100">
                  {generatingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {generatingAi ? 'Generating...' : 'Generate AI'}
                </Button>
              </div>
              <div><Label className="text-xs">Paragraf Pembuka</Label>
                <textarea value={form.openingText} onChange={e => setForm({...form, openingText: e.target.value})} rows={2}
                  placeholder="Otomatis digenerate oleh AI, atau ketik manual..."
                  className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div><Label className="text-xs">Paragraf Penutup</Label>
                <textarea value={form.closingText} onChange={e => setForm({...form, closingText: e.target.value})} rows={2}
                  placeholder="Otomatis digenerate oleh AI, atau ketik manual..."
                  className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-purple-800">Warna Header Tabel:</Label>
                <input type="color" value={form.headerColor} onChange={e => setForm({...form, headerColor: e.target.value})}
                  className="h-8 w-12 rounded cursor-pointer border border-gray-300" />
                <span className="text-xs text-gray-500">{form.headerColor}</span>
                <button type="button" onClick={() => setForm({...form, headerColor: '#1a3557'})} className="text-xs text-purple-600 hover:underline">Reset</button>
              </div>
              <div><Label className="text-xs">Jabatan Penanda Tangan</Label>
                <Input value={form.signerTitle} onChange={e => setForm({...form, signerTitle: e.target.value})}
                  placeholder="contoh: Finance Department / Direktur / Manager" className="mt-1 text-sm" />
              </div>
              <div><Label className="text-xs">Tanda Tangan Digital</Label>
                <select value={form.signatureId} onChange={e => setForm({...form, signatureId: e.target.value})}
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">-- Tanpa TTD --</option>
                  {signatures.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.title ? ` (${s.title})` : ''}</option>)}
                </select>
                {form.signatureId && (() => {
                  const sig = signatures.find((s: any) => s.id === form.signatureId);
                  return sig ? (
                    <div className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                      <img src={`${API_BASE}${sig.imageUrl}`} alt={sig.name} className="h-10 object-contain" />
                      <span className="text-xs text-gray-600">{sig.name}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* PPN + Total */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>PPN (%)</Label>
                <Input type="number" min="0" max="100" value={form.taxRate} onChange={e => setForm({...form, taxRate: e.target.value})} className="mt-1" />
                {subtotal > 0 && (<div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                  <div>Subtotal: {formatCurrency(subtotal)}</div>
                  {parseFloat(form.taxRate) > 0 && <div>PPN: {formatCurrency(taxAmount)}</div>}
                </div>)}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>GRAND TOTAL (Rp) *</Label>
                  {customTotal !== '' && (
                    <button type="button" onClick={() => setCustomTotal('')}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                      <RotateCcw size={11} /> Reset ke otomatis
                    </button>
                  )}
                </div>
                <Input type="number" min="0" step="any"
                  value={customTotal !== '' ? customTotal : autoTotal || ''}
                  onChange={e => setCustomTotal(e.target.value)} placeholder="0"
                  className={`mt-1 font-bold text-base ${customTotal !== '' ? 'text-blue-700 border-blue-400' : 'text-gray-700'}`} />
                {customTotal !== '' ? (
                  <div className="mt-1 text-xs text-blue-600 font-medium">{formatCurrency(Number(customTotal))}
                    {autoTotal > 0 && <span className="text-gray-400 font-normal ml-1">(otomatis: {formatCurrency(autoTotal)})</span>}
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-gray-400">
                    {autoTotal > 0 ? `= ${formatCurrency(autoTotal)} (dari section)` : 'Ketik nominal untuk override manual'}
                  </div>
                )}
              </div>
            </div>

            <div><Label>Catatan</Label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
              className="mt-1 w-full rounded-md border border-input px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>

            <LampiranSection dokumenType="sph" dokumenId={editMode ? editingId : null}
              pendingIds={pendingLampiranIds} onChange={editMode ? undefined : setPendingLampiranIds} />

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Batal</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {saving ? (editMode ? 'Menyimpan...' : 'Membuat...') : (editMode ? 'Simpan Perubahan' : 'Buat SPH')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════════ VIEW DIALOG ══════════ */}
      {selected && (
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>SPH {selected.number}</span>
                <Button size="sm" onClick={() => downloadPdf(selected.id, selected.number)} className="bg-blue-600 hover:bg-blue-700"><Download size={14} />Download PDF</Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">Klien:</span> <strong>{selected.client?.name}</strong></div>
                <div><span className="text-gray-500">Tanggal:</span> {formatDate(selected.date)}</div>
              </div>
              {selected.openingText && (
                <div className="p-2 bg-gray-50 rounded text-xs text-gray-600 italic">
                  <span className="font-semibold not-italic text-gray-700">Pembuka: </span>{selected.openingText}
                </div>
              )}

              {/* Render by sections */}
              {(() => {
                const config: any[] = selected.sectionsConfig && Array.isArray(selected.sectionsConfig) && selected.sectionsConfig.length > 0
                  ? selected.sectionsConfig : [{ key: 'main', title: '', showPerColumn: false, totalOverride: null }];
                return config.map((sec: any, sIdx: number) => {
                  const secItems = (selected.items || []).filter((item: any) => (item.sectionKey || 'main') === sec.key);
                  const showPer = sec.showPerColumn;
                  const secTotal = sec.totalOverride != null ? sec.totalOverride
                    : secItems.reduce((s: number, item: any) => s + (Number(item.total) || 0), 0);
                  return (
                    <div key={sec.key || sIdx}>
                      {sec.title && <h3 className="font-semibold text-sm mt-3 mb-1 text-gray-800">{sec.title}</h3>}
                      <table className="w-full border-collapse">
                        <thead>
                          <tr style={{ backgroundColor: selected.headerColor || '#1a3557' }}>
                            <th className="text-center p-2 text-xs text-white w-10">No.</th>
                            <th className="text-left p-2 text-xs text-white">Uraian / Deskripsi</th>
                            <th className="text-center p-2 text-xs text-white w-12">Qty</th>
                            {showPer && <th className="text-center p-2 text-xs text-white w-12">Per</th>}
                            <th className="text-center p-2 text-xs text-white w-12">Sat.</th>
                            <th className="text-right p-2 text-xs text-white">Harga Satuan</th>
                            <th className="text-right p-2 text-xs text-white">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody>
                          {secItems.map((item: any, i: number) => (
                            <tr key={i} className="border-b">
                              <td className="p-2 text-center text-xs">{item.nomor || (i + 1)}</td>
                              <td className="p-2">
                                <div className="font-medium text-xs">{item.name}</div>
                                {item.description && <div className="text-xs text-gray-400">{item.description}</div>}
                              </td>
                              <td className="p-2 text-center text-xs">{Number(item.quantity)}</td>
                              {showPer && <td className="p-2 text-center text-xs">{item.perValue != null ? Number(item.perValue) : ''}</td>}
                              <td className="p-2 text-center text-xs">{item.unit}</td>
                              <td className="p-2 text-right text-xs">{item.price == null ? <span className="text-gray-300">—</span> : formatCurrency(item.price)}</td>
                              <td className="p-2 text-right text-xs font-medium">{item.total == null ? <span className="text-gray-300">—</span> : formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                          {/* Section total row */}
                          {(config.length > 1 || sec.title) && (
                            <tr style={{ backgroundColor: selected.headerColor || '#1a3557' }}>
                              <td colSpan={showPer ? 6 : 5} className="p-2 text-xs text-white font-semibold text-right">
                                Total {sec.title || `Section ${sIdx + 1}`}
                              </td>
                              <td className="p-2 text-right text-xs text-white font-bold">{formatCurrency(secTotal)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                });
              })()}

              <div className="text-right space-y-1">
                {Number(selected.subtotal) > 0 && <div className="text-gray-500">Subtotal: {formatCurrency(selected.subtotal)}</div>}
                {Number(selected.taxRate) > 0 && Number(selected.taxAmount) > 0 && <div className="text-gray-500">PPN {Number(selected.taxRate)}%: {formatCurrency(selected.taxAmount)}</div>}
                <div className="text-lg font-bold text-blue-700">Grand Total: {formatCurrency(selected.total)}</div>
              </div>
              {selected.closingText && (
                <div className="p-2 bg-gray-50 rounded text-xs text-gray-600 italic">
                  <span className="font-semibold not-italic text-gray-700">Penutup: </span>{selected.closingText}
                </div>
              )}
              {selected.signature && (
                <div className="flex justify-end pt-2"><div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Hormat kami,</div>
                  <img src={`${API_BASE}${selected.signature.imageUrl}`} alt={selected.signature.name} className="h-14 object-contain mx-auto" />
                  <div className="border-t border-gray-400 mt-1 pt-1 text-xs font-semibold">{selected.signature.name}</div>
                  {selected.signature.title && <div className="text-xs text-gray-500">{selected.signature.title}</div>}
                </div></div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
