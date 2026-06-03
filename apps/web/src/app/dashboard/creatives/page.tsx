'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import Shell from '@/components/Shell';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import { Sparkles, Download, Image, Video, FileText, Copy, Camera, Megaphone, Pencil, Palette, RefreshCw } from 'lucide-react';

interface Creative {
  id: string;
  name: string;
  type: string;
  status: string;
  primaryText: string | null;
  headline: string | null;
  description: string | null;
  callToAction: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  fbCreativeId: string | null;
  usedCount: number;
  pageId: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  campaigns: { campaign: { id: string; name: string } }[];
}

interface FbPage {
  id: string;
  pageId: string;
  name: string;
  category: string | null;
  tasks: string[];
}

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

export default function CreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Tab
  const [tab, setTab] = useState<'creatives' | 'import'>('creatives');

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

  // Detail view
  const [detail, setDetail] = useState<Creative | null>(null);

  // ─── Page Import ───
  const [pages, setPages] = useState<FbPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('');
  const [pagePosts, setPagePosts] = useState<PagePost[]>([]);
  const [importing, setImporting] = useState<string | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Post to Page
  const [postingToPage, setPostingToPage] = useState<string | null>(null);

  // ─── Helpers ───

  const tokenAxios = useCallback(() => {
    axios.defaults.withCredentials = true;
    return true;
  }, []);

  const fetchAll = useCallback(async () => {
    if (!tokenAxios()) return;
    try {
      const { data } = await axios.get('/api/creatives');
      setCreatives(data);
    } catch { setMsg('❌ Failed to load'); }
    finally { setLoading(false); }
  }, [tokenAxios]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Page Import ───

  const syncAndLoadPages = useCallback(async () => {
    if (!tokenAxios()) return;
    setLoadingPages(true);
    try {
      await axios.post('/api/facebook/sync-pages');
      const { data } = await axios.get('/api/creatives/pages');
      setPages(data);
      if (data.length > 0 && !selectedPage) setSelectedPage(data[0].pageId);
    } catch (err: any) {
      setMsg('❌ Failed to load pages: ' + (err?.response?.data?.message || err.message));
    } finally { setLoadingPages(false); }
  }, [tokenAxios, selectedPage]);

  useEffect(() => {
    if (tab === 'import') syncAndLoadPages();
  }, [tab, syncAndLoadPages]);

  const loadPagePosts = useCallback(async (pageId: string) => {
    if (!tokenAxios() || !pageId) return;
    setLoadingPosts(true);
    try {
      const { data } = await axios.get(`/api/creatives/pages/${pageId}/posts`);
      setPagePosts(data);
    } catch (err: any) {
      setMsg('❌ Failed to load posts: ' + (err?.response?.data?.message || err.message));
    } finally { setLoadingPosts(false); }
  }, [tokenAxios]);

  useEffect(() => {
    if (selectedPage) loadPagePosts(selectedPage);
  }, [selectedPage, loadPagePosts]);

  const importPost = async (pageId: string, post: PagePost) => {
    if (!tokenAxios()) return;
    setImporting(post.postId);
    setMsg('');
    try {
      const { data } = await axios.post(`/api/creatives/import/${pageId}/${post.postId}`, {
        message: post.message,
        imageUrl: post.imageUrl,
        permalinkUrl: post.permalinkUrl,
      });
      setMsg(`✅ Imported as "${data.name}"`);
      fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setImporting(null); }
  };

  const postToPage = async (creativeId: string, pageId: string) => {
    if (!tokenAxios()) return;
    setPostingToPage(creativeId);
    setMsg('');
    try {
      const { data } = await axios.post(`/api/creatives/${creativeId}/fb-post/${pageId}`);
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
        await axios.patch(`/api/creatives/${editId}`, form);
        setMsg('✅ Creative updated!');
      } else {
        await axios.post('/api/creatives', form);
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
      await axios.delete(`/api/creatives/${id}`);
      setMsg('✅ Deleted');
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
      await axios.post(`/api/creatives/${id}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMsg('✅ Image uploaded!');
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    } finally { setUploading(null); if (fileRef.current) fileRef.current.value = ''; }
  };

  const createFbCreative = async (id: string) => {
    try {
      const { data: accounts } = await axios.get('/api/adaccounts');
      if (accounts.length === 0) { setMsg('❌ No ad accounts found'); return; }
      const accountId = accounts[0].id;
      const { data } = await axios.post(`/api/creatives/${id}/fb-create/${accountId}`);
      setMsg(`✅ FB creative created! ID: ${data.fbCreativeId}`);
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    }
  };

  // ─── Clone ───
  const cloneCreative = async (id: string, name: string) => {
    try {
      const newName = `Copy of ${name}`;
      const { data } = await axios.post(`/api/creatives/${id}/clone`, { name: newName });
      setMsg(`✅ ${data.message}`);
      await fetchAll();
    } catch (err: any) {
      setMsg(`❌ ${err?.response?.data?.message || err.message}`);
    }
  };

  // ─── Post to Page Modal ───
  const [showPostModal, setShowPostModal] = useState<string | null>(null);

  if (loading) return (
    <Shell>
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-ink-300 animate-pulse">Loading...</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="p-6">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-surface-50 rounded-lg border border-surface-200/50 p-1">
            <button onClick={() => setTab('creatives')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === 'creatives' ? 'bg-accent text-white' : 'text-ink-300 hover:text-ink'
              }`}>
                            <Sparkles className="w-4 h-4" /> My Creatives
            </button>
            <button onClick={() => setTab('import')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === 'import' ? 'bg-accent text-white' : 'text-ink-300 hover:text-ink'
              }`}>
                            <Download className="w-4 h-4" /> Import from Page
            </button>
          </div>
          {tab === 'creatives' && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="btn-primary btn-sm">
              + New Creative
            </button>
          )}
        </div>

        {msg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.includes('✅') ? 'msg-success' : 'msg-error'}`}>
            {msg}
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB: Import from Page
            ════════════════════════════════════════════ */}
        {tab === 'import' && (
          <div>
            {loadingPages ? (
              <div className="text-center py-12 text-ink-300">Loading pages...</div>
            ) : pages.length === 0 ? (
              <div className="card px-6 py-12 text-center">
                <p className="text-ink-300 mb-3">No Facebook pages found.</p>
                <p className="text-sm text-ink-300">Make sure your Facebook App has page permissions and you manage at least one page.</p>
                <a href="/dashboard"
                  className="inline-block mt-4 text-sm text-accent hover:text-accent underline">
                  Re-connect Facebook account →
                </a>
              </div>
            ) : (
              <div>
                {/* Page Selector */}
                <div className="card p-4 mb-4">
                  <label className="block text-sm font-medium text-ink mb-2">Select Page</label>
                  <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)}
                    className="w-full max-w-md px-3 py-2 text-sm text-ink bg-surface-50">
                    {pages.map(p => (
                      <option key={p.pageId} value={p.pageId}>{p.name} {p.category ? `(${p.category})` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Posts List */}
                {loadingPosts ? (
                  <div className="text-center py-12 text-ink-300">Loading posts...</div>
                ) : pagePosts.length === 0 ? (
                  <div className="card px-6 py-12 text-center text-ink-300">
                    No posts found on this page.
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
                            {post.message || <span className="text-ink-300 italic">(no text)</span>}
                          </p>
                          <p className="text-[11px] text-ink-300 mb-3">
                            {new Date(post.createdTime).toLocaleDateString('th-TH', {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                            {' · '}
                            <a href={post.permalinkUrl} target="_blank" rel="noopener noreferrer"
                              className="text-accent hover:underline">View on FB</a>
                          </p>
                          <button onClick={() => importPost(selectedPage, post)}
                            disabled={importing === post.postId}
                            className="w-full text-sm bg-accent text-white px-3 py-2 rounded-lg hover:bg-accent/90 disabled:opacity-50">
                            {importing === post.postId ? 'Importing...' : <><Download className="w-4 h-4" /> Import as Creative</>}
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

        {/* ════════════════════════════════════════════
            TAB: My Creatives
            ════════════════════════════════════════════ */}
        {tab === 'creatives' && (
          <>
            {creatives.length === 0 ? (
              <div className="card px-6 py-12 text-center text-ink-300">
                No creatives yet. Click &quot;+ New Creative&quot; to get started, or switch to &quot;Import from Page&quot; tab.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {creatives.map((c) => (
                  <div key={c.id} className="card overflow-hidden hover:shadow-md transition-shadow">
                    {/* Image preview */}
                    <div className="h-40 bg-surface-100 relative overflow-hidden flex items-center justify-center">
                      {c.imageUrl ? (
                        <img src={c.imageUrl.startsWith('http') ? c.imageUrl : c.imageUrl}
                          alt={c.name} className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className={`text-4xl ${c.type === 'TEXT' ? '' : 'text-ink-400'}`}>
                          {c.type === 'IMAGE' ? <Image className="w-4 h-4" /> : c.type === 'VIDEO' ? <Video className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                      )}
                      <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        STATUS_BADGE[c.status] || 'badge-ink'
                      }`}>{c.status}</span>
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <p className="font-medium text-sm text-ink truncate">{c.name}</p>
                      <p className="text-xs text-ink-300 mt-1">{c.type} · Used {c.usedCount}x</p>
                      {c.fbCreativeId ? (
                        <p className="text-[10px] text-success mt-1 font-medium">✓ On Meta · {c.fbCreativeId}</p>
                      ) : (
                        <p className="text-[10px] text-ink-400 mt-1">ยังไม่อยู่บน Meta — กด FB Publish</p>
                      )}
                      {c.primaryText && <p className="text-xs text-ink-200 mt-1 line-clamp-2">{c.primaryText}</p>}
                      {c.headline && <p className="text-xs font-medium text-ink mt-1">{c.headline}</p>}

                      {/* Campaign tags */}
                      {c.campaigns.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.campaigns.slice(0, 3).map((cc, i) => (
                            <span key={i} className="text-[10px] bg-surface-50 text-ink-200 px-1.5 py-0.5 rounded">
                              {cc.campaign.name}
                            </span>
                          ))}
                          {c.campaigns.length > 3 && <span className="text-[10px] text-ink-400">+{c.campaigns.length - 3}</span>}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 mt-3 pt-3 flex-wrap border-t border-surface-300">
                        <button onClick={() => openEdit(c)}
                          className="text-xs text-accent hover:text-accent/80 px-2 py-1 font-medium">Edit</button>
                        <button onClick={() => deleteCreative(c.id, c.name)}
                          className="text-xs text-danger hover:text-danger/80 px-2 py-1 font-medium">Del</button>
                        <button onClick={() => cloneCreative(c.id, c.name)}
                          className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 font-medium"><Copy className="w-4 h-4" /> Clone</button>
                        {c.type !== 'TEXT' && (
                          <>
                            <input type="file" ref={fileRef} accept="image/*" className="hidden"
                              onChange={() => uploadImage(c.id)} />
                            <button onClick={() => fileRef.current?.click()} disabled={uploading === c.id}
                              className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1">
                              {uploading === c.id ? '...' : <Camera className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                        <button onClick={() => createFbCreative(c.id)}
                          className="text-xs text-success hover:text-success/80 px-2 py-1 font-medium">
                          FB Publish
                        </button>
                        {pages.length > 0 && (
                          <button onClick={() => setShowPostModal(c.id)}
                            className="text-xs text-orange-600 hover:text-orange-800 px-2 py-1 font-medium"><Megaphone className="w-4 h-4" /> Post to Page
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

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
