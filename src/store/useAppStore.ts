import { create } from 'zustand';
import type { Block, BlockType, Document } from '../types';
import { supabase } from '../lib/supabase';

// localStorage Helpers
const localKey = (uid: string) => `tw_u_${uid}`;
const saveLocal = (uid: string, docs: Document[]) => {
  try { localStorage.setItem(localKey(uid), JSON.stringify(docs)); } catch (_) {}
};
const loadLocal = (uid: string): Document[] => {
  try { const r = localStorage.getItem(localKey(uid)); return r ? JSON.parse(r) : []; }
  catch (_) { return []; }
};

const generateId = () => Math.random().toString(36).substring(2, 9);
const createInitialBlock = (): Block => ({ id: generateId(), type: 'text', content: '' });

interface AppState {
  documents: Document[];
  activeDocumentId: string | null;
  focusedBlockId: string | null;
  sortType: 'custom' | 'date' | 'title' | 'tag';
  userId: string | null;
  isReady: boolean;
  isSettingsModalOpen: boolean;
  theme: 'light' | 'dark';
  fontFamily: string;
  fontSize: string;
  _dirtyDocIds: Set<string>;

  setUserId: (id: string | null) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setFontFamily: (font: string) => void;
  setFontSize: (size: string) => void;
  fetchFromCloud: () => Promise<void>;
  syncToCloud: (docId: string) => Promise<void>;
  syncAllDirty: () => Promise<void>;
  markDirty: (docId: string) => void;
  clearDocuments: () => void;
  createDocument: (parentId?: string | null) => void;
  createTemplateDocument: (type: 'password' | 'account' | 'meeting') => void;
  selectDocument: (id: string) => void;
  deleteDocument: (id: string) => void;
  toggleFavorite: (id: string) => void;
  moveDocument: (id: string, newParentId: string | null) => void;
  setSortType: (type: 'custom' | 'date' | 'title' | 'tag') => void;
  updateDocumentTitle: (id: string, title: string) => void;
  updateDocumentProperties: (id: string, properties: any) => void;
  addBlock: (afterId: string, content?: string, type?: BlockType) => string;
  updateBlock: (id: string, content: string) => void;
  updateBlockType: (id: string, type: BlockType) => void;
  updateBlockData: (id: string, data: any) => void;
  removeBlock: (id: string) => void;
  moveBlock: (dragId: string, dropId: string) => void;
  setFocusedBlockId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  documents: [],
  activeDocumentId: null,
  focusedBlockId: null,
  sortType: 'custom',
  userId: null,
  isReady: false,
  isSettingsModalOpen: false,
  theme: (localStorage.getItem('tw_theme') as 'light' | 'dark') || 'light',
  fontFamily: localStorage.getItem('tw_fontFamily') || "'Inter', system-ui, sans-serif",
  fontSize: localStorage.getItem('tw_fontSize') || "16px",
  _dirtyDocIds: new Set<string>(),

  setUserId: (id) => set({ userId: id }),
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),
  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem('tw_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  },
  setFontFamily: (fontFamily) => {
    set({ fontFamily });
    localStorage.setItem('tw_fontFamily', fontFamily);
    document.documentElement.style.setProperty('--app-font-family', fontFamily);
  },
  setFontSize: (fontSize) => {
    set({ fontSize });
    localStorage.setItem('tw_fontSize', fontSize);
    document.documentElement.style.setProperty('--app-font-size', fontSize);
  },
  markDirty: (docId) => { get()._dirtyDocIds.add(docId); },
  clearDocuments: () => {
    const { userId } = get();
    if (userId) { try { localStorage.removeItem(localKey(userId)); } catch(_) {} }
    set({ documents: [], activeDocumentId: null, focusedBlockId: null, userId: null, isReady: false, _dirtyDocIds: new Set() });
  },

  fetchFromCloud: async () => {
    const { userId } = get();
    if (!userId) { set({ isReady: true }); return; }
    const localDocs = loadLocal(userId);
    if (localDocs.length > 0 && !get().isReady) {
      set({ documents: localDocs, activeDocumentId: localDocs[0].id, isReady: true });
    }
    const { data, error } = await supabase.from('documents').select('data, updated_at').eq('user_id', userId);
    if (error) { set({ isReady: true }); return; }
    if (data && data.length > 0) {
      const cloudDocs: Document[] = data.map((row: any) => typeof row.data === 'string' ? JSON.parse(row.data) : row.data);
      set({ documents: cloudDocs, activeDocumentId: cloudDocs[0]?.id || null, isReady: true });
      saveLocal(userId, cloudDocs);
    } else {
      set({ isReady: true });
    }
  },

  syncToCloud: async (docId) => {
    const { userId, documents } = get();
    if (!userId) return;
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    await supabase.from('documents').upsert({ id: doc.id, user_id: userId, data: doc, updated_at: doc.updatedAt });
  },

  syncAllDirty: async () => {
    const { userId, documents, _dirtyDocIds } = get();
    if (!userId || _dirtyDocIds.size === 0) return;
    const toSync = documents.filter(d => _dirtyDocIds.has(d.id));
    const rows = toSync.map(doc => ({ id: doc.id, user_id: userId, data: doc, updated_at: doc.updatedAt }));
    await supabase.from('documents').upsert(rows);
    _dirtyDocIds.clear();
  },

  createDocument: (parentId = null) => {
    const newDoc: Document = { id: generateId(), title: '', blocks: [createInitialBlock()], isFavorite: false, createdAt: Date.now(), updatedAt: Date.now(), order: get().documents.length, parentId };
    set(s => ({ documents: [...s.documents, newDoc], activeDocumentId: newDoc.id }));
    get()._dirtyDocIds.add(newDoc.id);
  },

  createTemplateDocument: (type) => {
    let title = '';
    let blocks: Block[] = [];
    if (type === 'password') {
      title = 'パスワード管理';
      blocks = [
        { id: generateId(), type: 'h2', content: 'サービス名' },
        { id: generateId(), type: 'table', content: '', data: { rows: 2, cols: 3, cells: [['URL', 'ID / Email', 'Password'], ['https://...', '', '']] } }
      ];
    } else if (type === 'account') {
      title = 'アカウント管理';
      blocks = [
        { id: generateId(), type: 'h2', content: '銀行・サービス' },
        { id: generateId(), type: 'bullet_list', content: '口座番号:' },
        { id: generateId(), type: 'bullet_list', content: '名義:' }
      ];
    } else if (type === 'meeting') {
      title = 'ミーティング議事録';
      blocks = [
        { id: generateId(), type: 'h3', content: '日時: ' + new Date().toLocaleDateString() },
        { id: generateId(), type: 'h3', content: '参加者: ' },
        { id: generateId(), type: 'divider', content: '' },
        { id: generateId(), type: 'h2', content: 'アジェンダ' },
        { id: generateId(), type: 'todo_list', content: '' },
        { id: generateId(), type: 'h2', content: '決定事項' },
        { id: generateId(), type: 'bullet_list', content: '' }
      ];
    }
    const newDoc: Document = { id: generateId(), title, blocks, isFavorite: false, createdAt: Date.now(), updatedAt: Date.now(), order: get().documents.length, parentId: null };
    set(s => ({ documents: [...s.documents, newDoc], activeDocumentId: newDoc.id }));
    get()._dirtyDocIds.add(newDoc.id);
  },

  selectDocument: (id) => set({ activeDocumentId: id }),

  deleteDocument: (id) => set(s => ({ documents: s.documents.filter(d => d.id !== id) })),

  toggleFavorite: (id) => set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, isFavorite: !d.isFavorite } : d) })),

  moveDocument: (id, pid) => set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, parentId: pid } : d) })),

  setSortType: (t) => set({ sortType: t }),

  updateDocumentTitle: (id, title) => {
    set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, title, updatedAt: Date.now() } : d) }));
    get()._dirtyDocIds.add(id);
  },

  updateDocumentProperties: (id, props) => set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, properties: { ...d.properties, ...props } } : d) })),

  addBlock: (afterId, content = '', type = 'text') => {
    const id = generateId();
    set(s => {
      const doc = s.documents.find(d => d.id === s.activeDocumentId);
      if (!doc) return s;
      const idx = doc.blocks.findIndex(b => b.id === afterId);
      const newBlocks = [...doc.blocks];
      newBlocks.splice(idx + 1, 0, { id, type, content });
      return { documents: s.documents.map(d => d.id === s.activeDocumentId ? { ...doc, blocks: newBlocks, updatedAt: Date.now() } : d), focusedBlockId: id };
    });
    if (get().activeDocumentId) get()._dirtyDocIds.add(get().activeDocumentId!);
    return id;
  },

  updateBlock: (id, content) => {
    set(s => ({ documents: s.documents.map(d => d.id === s.activeDocumentId ? { ...d, blocks: d.blocks.map(b => b.id === id ? { ...b, content } : b), updatedAt: Date.now() } : d) }));
    const aid = get().activeDocumentId;
    if (aid) get()._dirtyDocIds.add(aid);
  },

  updateBlockType: (id, type) => {
    set(s => ({ documents: s.documents.map(d => d.id === s.activeDocumentId ? { ...d, blocks: d.blocks.map(b => b.id === id ? { ...b, type } : b), updatedAt: Date.now() } : d) }));
    const aid = get().activeDocumentId;
    if (aid) get()._dirtyDocIds.add(aid);
  },

  updateBlockData: (id, data) => {
    set(s => ({ documents: s.documents.map(d => d.id === s.activeDocumentId ? { ...d, blocks: d.blocks.map(b => b.id === id ? { ...b, data: { ...b.data, ...data } } : b) } : d) }));
    const aid = get().activeDocumentId;
    if (aid) get()._dirtyDocIds.add(aid);
  },

  removeBlock: (id) => {
    set(s => ({ documents: s.documents.map(d => d.id === s.activeDocumentId ? { ...d, blocks: d.blocks.filter(b => b.id !== id), updatedAt: Date.now() } : d) }));
    const aid = get().activeDocumentId;
    if (aid) get()._dirtyDocIds.add(aid);
  },

  moveBlock: (dragId, dropId) => {
    set(s => {
      const doc = s.documents.find(d => d.id === s.activeDocumentId);
      if (!doc) return s;
      const from = doc.blocks.findIndex(b => b.id === dragId);
      const to = doc.blocks.findIndex(b => b.id === dropId);
      const newBlocks = [...doc.blocks];
      const [moved] = newBlocks.splice(from, 1);
      newBlocks.splice(to, 0, moved);
      return { documents: s.documents.map(d => d.id === s.activeDocumentId ? { ...doc, blocks: newBlocks, updatedAt: Date.now() } : d) };
    });
    const aid = get().activeDocumentId;
    if (aid) get()._dirtyDocIds.add(aid);
  },

  setFocusedBlockId: (id) => set({ focusedBlockId: id }),
}));
