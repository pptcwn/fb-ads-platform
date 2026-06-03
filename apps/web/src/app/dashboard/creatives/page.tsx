'use client';

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import {
  accountsApi,
  creativesApi,
  facebookApi,
  type CreativeItem,
  type FbPageItem,
} from '@/lib/api-client';
import Shell from '@/components/Shell';
import PageLayout from '@/components/layout/PageLayout';
import Modal from '@/components/Modal';
import { Sparkles, Download, Image, Video, FileText, Copy, Camera, Megaphone, Pencil, Palette, RefreshCw } from 'lucide-react';

type Creative = CreativeItem;
type FbPage = FbPageItem;

interface PagePost {
  postId: string;
  message: string;
  permalinkUrl: string;
  createdTime: string;
  imageUrl: string | null;
  attachments: any[];
}

const CTA_OPTIONS = [
  'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'BOOK_NOW',
  'GET_OFFER', 'CONTACT_US', 'SUBSCRIBE', 'WATCH_MORE',
];

const STATUS_BADGE: Record<string, string> = {
  READY: 'badge-success',
  USED: 'badge-warning',
};

const TYPE_ICONS: Record<string, ReactNode> = {
  IMAGE: <Image className="w-4 h-4" />,
  VIDEO: <Video className="w-4 h-4" />,
  TEXT: <FileText className="w-4 h-4" />,
};

function imageSrc(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith('http') || url.startsWith('/') ? url : `/${url}`;
}

export default function CreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Tab
  const [tab, setTab] = useState<'creatives' | 'import'>('creatives');

  // Master-detail
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create/Edit
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'IMAGE', primaryText: '', headline: '',
    description: '', callToAction: '', linkUrl: '', pageId: '', imageUrl: '',
  });
  const [saving, setSaving] = useState(false);

  // Upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  // ─── Page Import ───
  const [pages, setPages] = useState<FbPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('');
  const [pagePosts, setPagePosts] = useState<PagePost[]>([]);
  const [importing, setImporting] = useState<string | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Post to Page
  const [postingToPage, setPostingToPage] = useState<string | null>(null);

  const [adAccounts, setAdAccounts] = useState<{ id: string; name: string; accountId: string }[]>([]);
  const [fbPublishModal, setFbPublishModal] = useState<string | null>(null);
  const [fbPublishAccountId, setFbPublishAccountId] = useState('');
  const [fbPublishing, setFbPublishing] = useState(false);

  const selectedCreative = selectedId ? creatives.find((c) => c.id === selectedId) : null;
  const showDetailMobile = selectedId != null;

  // ─── Helpers ───

  const fetchAll = useCallback(async () => {
    try {
      const { data } = await creativesApi.list();
      setCreatives(data);
    } catch { setMsg('❌ Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadPages = useCallback(async () => {
    try {
      const { data } = await creativesApi.pages();
      setPages(data);
    } catch {
      setPages([]);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // ─── Page Import ───

  const syncAndLoadPages = useCallback(async () => {
    setLoadingPages(true);
    try {
      await facebookApi.syncPages();
      const { data } = await creativesApi.pages();
      setPages(data);
      if (data.length > 0 && !selectedPage) setSelectedPage(data[0].pageId);
    } catch (err: any) {
      setMsg('❌ Failed to load pages: ' + (err?.response?.data?.message || err.message));
    } finally { setLoadingPages(false); }
  }, [selectedPage]);

  useEffect(() => {
    if (tab === 'import') syncAndLoadPages();
  }, [tab, syncAndLoadPages]);

  const loadPagePosts = useCallback(async (pageId: string) => {
    if (!pageId) return;
    setLoadingPosts(true);
    try {
      const { data } = await creativesApi.pagePosts(pageId);
      setPagePosts(data as PagePost[]);
    } catch (err: any) {
      setMsg('❌ Failed to load posts: ' + (err?.response?.data?.message || err.message));
    } finally { setLoadingPosts(false); }
  }, []);

  useEffect(() => {
    if (selectedPage) loadPagePosts(selectedPage);
  }, [selectedPage, loadPagePosts]);

  const importPost = async (pageId: string, post: PagePost) => {
    setImporting(post.postId);
    setMsg('');
    try {
      const { data } = await creativesApi.importPost(pageId, post.postId, {
        message: post.message,
        imageUrl: post.imageUrl ?? undefined,
        permalinkUrl: post.permalinkUrl,
      });
      setMsg(`✅ Imported as "${data.name}"`);
      fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setImporting(null); }
  };

  const postToPage = async (creativeId: string, pageId: string) => {
    setPostingToPage(creativeId);
    setMsg('');
    try {
      const { data } = await creativesApi.postToPage(creativeId, pageId);
      setMsg(`✅ ${data.message}`);
      fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setPostingToPage(null); }
  };

  // ─── CRUD helpers ───

  const resetForm = () => {
    setEditId(null);
    setForm({ name: '', type: 'IMAGE', primaryText: '', headline: '', description: '', callToAction: '', linkUrl: '', pageId: '', imageUrl: '' });
    setShowForm(false);
  };

  const openEdit = (c: Creative) => {
    setEditId(c.id);
    setForm({
      name: c.name, type: c.type, primaryText: c.primaryText || '',
      headline: c.headline || '', description: c.description || '',
      callToAction: c.callToAction || 'LEARN_MORE', linkUrl: c.linkUrl || '',
      pageId: c.pageId || '', imageUrl: c.imageUrl || '',
    });
    setShowForm(true);
  };

  const saveCreative = async () => {
    if (!form.name.trim()) { setMsg('❌ Name required'); return; }
    setSaving(true); setMsg('');
    try {
      if (editId) {
        await creativesApi.update(editId, form);
        setMsg('✅ Creative updated!');
      } else {
        await creativesApi.create(form);
        setMsg('✅ Creative created!');
      }
      resetForm();
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setSaving(false); }
  };

  const deleteCreative = async (id: string, name: string) => {
    if (!confirm(`Delete creative "${name}"?`)) return;
    try {
      await creativesApi.remove(id);
      setMsg('✅ Deleted');
      if (id === selectedId) setSelectedId(null);
      await fetchAll();
    } catch { setMsg('❌ Delete failed'); }
  };

  const uploadImage = async (id: string) => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setMsg('❌ Select a file first'); return; }
    setUploading(id); setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await creativesApi.upload(id, fd);
      setMsg('✅ Image uploaded!');
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setUploading(null); if (fileRef.current) fileRef.current.value = ''; }
  };

  const openFbPublish = async (creativeId: string) => {
    try {
      const { data: accounts } = await accountsApi.list();
      if (!accounts?.length) {
        setMsg('❌ No ad accounts found — connect Facebook and sync accounts first');
        return;
      }
      setAdAccounts(accounts);
      setFbPublishAccountId(accounts[0].id);
      setFbPublishModal(creativeId);
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    }
  };

  const confirmFbPublish = async () => {
    if (!fbPublishModal || !fbPublishAccountId) return;
    setFbPublishing(true);
    setMsg('');
    try {
      const { data } = await creativesApi.fbCreate(fbPublishModal, fbPublishAccountId);
      setMsg(`✅ FB creative created! ID: ${data.fbCreativeId}`);
      setFbPublishModal(null);
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally {
      setFbPublishing(false);
    }
  };

  const cloneCreative = async (id: string, name: string) => {
    try {
      const newName = `Copy of ${name}`;
      const { data } = await creativesApi.clone(id, newName);
      setMsg(`✅ ${(data as { message?: string }).message || 'Cloned'}`);
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    }
  };

  const [showPostModal, setShowPostModal] = useState<string | null>(null);

  if (loading) return (
    <Shell>
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-ink-300 animate-pulse">กำลังโหลด...</p>
      </div>
    </Shell>
  );

  const tabSwitcher = (
    <div className="flex gap-1 bg-surface-50 rounded-lg border border-surface-200/50 p-1">
      <button onClick={() => setTab('creatives')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          tab === 'creatives' ? 'bg-accent text-white' : 'text-ink-300 hover:text-ink'
        }`}>
        <Sparkles className="w-4 h-4 inline mr-1" /> ครีเอทีฟของฉัน
      </button>
      <button onClick={() => setTab('import')}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          tab === 'import' ? 'bg-accent text-white' : 'text-ink-300 hover:text-ink'
        }`}>
        <Download className="w-4 h-4 inline mr-1" /> นำเข้าจากเพจ
      </button>
    </div>
  );

  return (
    <Shell>
      <div className="p-6">
        <PageLayout
          title="ครีเอทีฟ"
          subtitle={tab === 'creatives' ? `${creatives.length} รายการ` : 'นำเข้าโพสต์จาก Facebook Page'}
          actions={
            tab === 'creatives' ? (
              <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary btn-sm">
                + สร้างใหม่
              </button>
            ) : (
              <button onClick={syncAndLoadPages} disabled={loadingPages} className="btn-secondary btn-sm inline-flex items-center gap-1">
                <RefreshCw className="w-4 h-4" /> ซิงค์เพจ
              </button>
            )
          }
        >
          <div className="mb-4">{tabSwitcher}</div>

          {msg && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.includes('✅') ? 'msg-success' : 'msg-error'}`}>
              {msg}
            </div>
          )}

          {/* Import tab — full width */}
          {tab === 'import' && (
            <div>
              {loadingPages ? (
                <div className="text-center py-12 text-ink-300">กำลังโหลดเพจ...</div>
              ) : pages.length === 0 ? (
                <div className="card px-6 py-12 text-center">
                  <p className="text-ink-300 mb-3">ไม่พบ Facebook Page</p>
                  <p className="text-sm text-ink-300">ตรวจสอบสิทธิ์เพจในแอป Facebook และเชื่อมต่อบัญชีใหม่</p>
                  <a href="/dashboard"
                    className="inline-block mt-4 text-sm text-accent hover:text-accent underline">
                    เชื่อมต่อ Facebook อีกครั้ง →
                  </a>
                </div>
              ) : (
                <div>
                  <div className="card p-4 mb-4">
                    <label className="block text-sm font-medium text-ink mb-2">เลือกเพจ</label>
                    <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)}
                      className="w-full max-w-md px-3 py-2 text-sm text-ink bg-surface-50">
                      {pages.map(p => (
                        <option key={p.pageId} value={p.pageId}>{p.name} {p.category ? `(${p.category})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {loadingPosts ? (
                    <div className="text-center py-12 text-ink-300">กำลังโหลดโพสต์...</div>
                  ) : pagePosts.length === 0 ? (
                    <div className="card px-6 py-12 text-center text-ink-300">
                      ไม่พบโพสต์ในเพจนี้
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pagePosts.map((post) => (
                        <div key={post.postId} className="card overflow-hidden hover:shadow-md transition-shadow">
                          {post.imageUrl && (
                            <div className="h-40 bg-surface-100 overflow-hidden">
                              <img src={post.imageUrl} alt="" className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                          )}
                          <div className="p-4">
                            <p className="text-sm text-ink line-clamp-3 mb-2">
                              {post.message || <span className="text-ink-300 italic">(ไม่มีข้อความ)</span>}
                            </p>
                            <p className="text-[11px] text-ink-300 mb-3">
                              {new Date(post.createdTime).toLocaleDateString('th-TH', {
                                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                              {' · '}
                              <a href={post.permalinkUrl} target="_blank" rel="noopener noreferrer"
                                className="text-accent hover:underline">ดูบน FB</a>
                            </p>
                            <button onClick={() => importPost(selectedPage, post)}
                              disabled={importing === post.postId}
                              className="w-full text-sm bg-accent text-white px-3 py-2 rounded-lg hover:bg-accent/90 disabled:opacity-50">
                              {importing === post.postId ? 'กำลังนำเข้า...' : <><Download className="w-4 h-4 inline" /> นำเข้าเป็นครีเอทีฟ</>}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Creatives tab — master-detail */}
          {tab === 'creatives' && (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 min-h-[480px]">
              {/* Left: compact list */}
              <div
                className={`card p-3 overflow-y-auto max-h-[70vh] lg:max-h-none ${
                  showDetailMobile ? 'hidden lg:block' : 'block'
                }`}
              >
                {creatives.length === 0 ? (
                  <div className="text-center py-8 text-ink-300">
                    <p className="text-sm">ยังไม่มีครีเอทีฟ</p>
                    <p className="text-xs mt-1">สร้างใหม่หรือนำเข้าจากเพจ</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {creatives.map((c) => {
                      const src = imageSrc(c.imageUrl);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={`w-full text-left p-2 rounded-lg transition-colors flex gap-2 ${
                            selectedId === c.id ? 'bg-accent-muted border border-accent-border' : 'hover:bg-surface-100 border border-transparent'
                          }`}
                        >
                          <div className="w-12 h-12 shrink-0 rounded bg-surface-100 overflow-hidden flex items-center justify-center">
                            {src ? (
                              <img src={src} alt="" className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <span className="text-ink-400">{TYPE_ICONS[c.type]}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink truncate">{c.name}</p>
                            <p className="text-[10px] text-ink-300">{c.type} · ใช้ {c.usedCount}x</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[c.status] || 'badge-ink'}`}>{c.status}</span>
                              {c.fbCreativeId ? (
                                <span className="text-[10px] text-success">Meta ✓</span>
                              ) : (
                                <span className="text-[10px] text-ink-400">ยังไม่ publish</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: detail */}
              <div
                className={`card p-5 overflow-y-auto ${
                  showDetailMobile ? 'block' : 'hidden lg:block'
                }`}
              >
                {selectedCreative ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="lg:hidden text-sm text-accent mb-4 inline-flex items-center gap-1"
                    >
                      ← กลับ
                    </button>

                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                      <div className="w-full sm:w-48 h-40 bg-surface-100 rounded-lg overflow-hidden flex items-center justify-center shrink-0 relative">
                        {imageSrc(selectedCreative.imageUrl) ? (
                          <img
                            src={imageSrc(selectedCreative.imageUrl)!}
                            alt={selectedCreative.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-ink-400 text-4xl">{TYPE_ICONS[selectedCreative.type]}</span>
                        )}
                        <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          STATUS_BADGE[selectedCreative.status] || 'badge-ink'
                        }`}>{selectedCreative.status}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-ink">{selectedCreative.name}</h2>
                        <p className="text-xs text-ink-300 mt-1">{selectedCreative.type} · ใช้ในแคมเปญ {selectedCreative.usedCount} ครั้ง</p>
                        {selectedCreative.fbCreativeId ? (
                          <p className="text-xs text-success mt-2 font-medium">✓ อยู่บน Meta · {selectedCreative.fbCreativeId}</p>
                        ) : (
                          <p className="text-xs text-ink-400 mt-2">ยังไม่อยู่บน Meta — กด FB Publish</p>
                        )}
                      </div>
                    </div>

                    {selectedCreative.primaryText && (
                      <div className="mb-3">
                        <p className="text-xs text-ink-300 mb-1">Primary Text</p>
                        <p className="text-sm text-ink whitespace-pre-wrap">{selectedCreative.primaryText}</p>
                      </div>
                    )}
                    {selectedCreative.headline && (
                      <div className="mb-3">
                        <p className="text-xs text-ink-300 mb-1">Headline</p>
                        <p className="text-sm font-medium text-ink">{selectedCreative.headline}</p>
                      </div>
                    )}
                    {selectedCreative.description && (
                      <div className="mb-3">
                        <p className="text-xs text-ink-300 mb-1">Description</p>
                        <p className="text-sm text-ink-200">{selectedCreative.description}</p>
                      </div>
                    )}
                    {selectedCreative.linkUrl && (
                      <div className="mb-3">
                        <p className="text-xs text-ink-300 mb-1">Link</p>
                        <a href={selectedCreative.linkUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline break-all">
                          {selectedCreative.linkUrl}
                        </a>
                      </div>
                    )}

                    {selectedCreative.campaigns.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-ink-300 mb-1">แคมเปญที่ใช้</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedCreative.campaigns.map((cc, i) => (
                            <span key={i} className="text-[10px] bg-surface-50 text-ink-200 px-2 py-0.5 rounded">
                              {cc.campaign.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-surface-300">
                      <button onClick={() => openEdit(selectedCreative)} className="btn-secondary btn-sm">
                        <Pencil className="w-4 h-4 inline" /> แก้ไข
                      </button>
                      <button onClick={() => openFbPublish(selectedCreative.id)} className="btn-primary btn-sm">
                        FB Publish
                      </button>
                      <button onClick={() => cloneCreative(selectedCreative.id, selectedCreative.name)} className="btn-secondary btn-sm">
                        <Copy className="w-4 h-4 inline" /> Clone
                      </button>
                      {selectedCreative.type !== 'TEXT' && (
                        <>
                          <input type="file" ref={fileRef} accept="image/*" className="hidden"
                            onChange={() => uploadImage(selectedCreative.id)} />
                          <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading === selectedCreative.id}
                            className="btn-secondary btn-sm"
                          >
                            <Camera className="w-4 h-4 inline" />
                            {uploading === selectedCreative.id ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}
                          </button>
                        </>
                      )}
                      {pages.length > 0 && (
                        <button onClick={() => setShowPostModal(selectedCreative.id)} className="btn-secondary btn-sm">
                          <Megaphone className="w-4 h-4 inline" /> โพสต์ไปเพจ
                        </button>
                      )}
                      <button
                        onClick={() => deleteCreative(selectedCreative.id, selectedCreative.name)}
                        className="btn-danger btn-sm"
                      >
                        ลบ
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[320px] text-center text-ink-300">
                    <Sparkles className="w-10 h-10 mb-3 text-ink-200" />
                    <p>เลือกครีเอทีฟจากรายการด้านซ้าย</p>
                    <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary btn-sm mt-4">
                      + สร้างใหม่
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </PageLayout>

        {/* Create/Edit Form Modal */}
        <Modal open={showForm} onClose={resetForm} title={editId ? <><Pencil className="w-4 h-4" /> Edit Creative</> : <><Palette className="w-4 h-4" /> New Creative</>} maxWidth="max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-ink-200 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Creative name"
                className="w-full bg-surface-50 px-3 py-2 text-sm text-ink placeholder-ink-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-200 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}
                className="w-full bg-surface-50 px-3 py-2 text-sm text-ink">
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
                <option value="TEXT">Text Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-200 mb-1">Call to Action</label>
              <select value={form.callToAction} onChange={e => setForm({...form, callToAction: e.target.value})}
                className="w-full bg-surface-50 px-3 py-2 text-sm text-ink">
                {CTA_OPTIONS.map(cta => <option key={cta} value={cta}>{cta.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-ink-200 mb-1">Primary Text</label>
              <textarea value={form.primaryText} onChange={e => setForm({...form, primaryText: e.target.value})}
                placeholder="Main ad copy..."
                className="w-full bg-surface-50 px-3 py-2 text-sm text-ink placeholder-ink-400" rows={2} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-200 mb-1">Headline</label>
              <input value={form.headline} onChange={e => setForm({...form, headline: e.target.value})}
                placeholder="Headline"
                className="w-full bg-surface-50 px-3 py-2 text-sm text-ink placeholder-ink-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-200 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Description"
                className="w-full bg-surface-50 px-3 py-2 text-sm text-ink placeholder-ink-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-200 mb-1">Link URL</label>
              <input value={form.linkUrl} onChange={e => setForm({...form, linkUrl: e.target.value})}
                placeholder="https://..."
                className="w-full bg-surface-50 px-3 py-2 text-sm text-ink placeholder-ink-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-200 mb-1">Page ID</label>
              <input value={form.pageId} onChange={e => setForm({...form, pageId: e.target.value})}
                placeholder="Facebook Page ID"
                className="w-full bg-surface-50 px-3 py-2 text-sm text-ink placeholder-ink-400" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-ink-200 mb-1">Image URL (public URL)</label>
              <input value={form.imageUrl} onChange={e => setForm({...form, imageUrl: e.target.value})}
                placeholder="https://example.com/image.jpg"
                className="w-full bg-surface-50 px-3 py-2 text-sm text-ink placeholder-ink-400" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 -mx-5 px-5 border-t border-surface-300">
            <button onClick={resetForm} className="btn-secondary btn-sm">Cancel</button>
            <button onClick={saveCreative} disabled={saving}
              className="btn-primary btn-sm">
              {saving ? 'Saving...' : editId ? 'Update' : 'Create'}
            </button>
          </div>
        </Modal>

        {/* FB Publish — ad account */}
        <Modal
          open={!!fbPublishModal}
          onClose={() => setFbPublishModal(null)}
          title="Publish to Meta"
          icon={<Sparkles className="w-4 h-4" />}
        >
          <p className="text-sm text-ink-300 mb-3">Choose the ad account to create this creative under.</p>
          <label className="block text-xs font-medium text-ink-200 mb-1">Ad Account</label>
          <select
            value={fbPublishAccountId}
            onChange={(e) => setFbPublishAccountId(e.target.value)}
            className="w-full bg-surface-50 px-3 py-2 text-sm text-ink mb-4"
          >
            {adAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.accountId})
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2 pt-4 -mx-5 px-5 border-t border-surface-300">
            <button onClick={() => setFbPublishModal(null)} className="btn-secondary btn-sm">Cancel</button>
            <button onClick={confirmFbPublish} disabled={fbPublishing} className="btn-primary btn-sm">
              {fbPublishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </Modal>

        {/* Post to Page Modal */}
        <Modal open={!!showPostModal} onClose={() => setShowPostModal(null)} title="Post Creative to Page" icon={<Megaphone className="w-4 h-4" />}>
          {pages.length === 0 ? (
            <div>
              <p className="text-sm text-ink-300 mb-4">No pages found. Sync your pages first.</p>
              <button onClick={() => { syncAndLoadPages(); setShowPostModal(null); }}
                className="btn-primary btn-sm">
                <RefreshCw className="w-4 h-4" /> Sync Pages
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Choose a page to post to:</label>
              {pages.map(p => (
                <button key={p.pageId}
                  disabled={postingToPage === showPostModal}
                  onClick={() => {
                    postToPage(showPostModal!, p.pageId);
                    setShowPostModal(null);
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg border border-surface-200/50 hover:bg-surface-100 mb-2 text-sm disabled:opacity-50 transition-colors">
                  <span className="font-medium text-ink">{p.name}</span>
                  {p.category && <span className="text-ink-300 ml-2">{p.category}</span>}
                  {p.tasks.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {p.tasks.slice(0, 4).map(t => (
                        <span key={t} className="text-[10px] bg-surface-50 text-ink-300 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-4 pt-4 -mx-5 px-5 border-t border-surface-300">
            <button onClick={() => setShowPostModal(null)}
              className="btn-secondary btn-sm">Cancel</button>
          </div>
        </Modal>
      </div>
    </Shell>
  );
}