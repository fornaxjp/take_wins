import { create } from 'zustand';
import type { Block, BlockType, Document } from '../types';
import { supabase } from '../lib/supabase';

// ─── Per-user localStorage backup (keyed by userId for privacy) ───
const localKey = (uid: string) => `tw_u_${uid}`;
const saveLocal = (uid: string, docs: Document[]) => {
  try { localStorage.setItem(localKey(uid), JSON.stringify(docs)); } catch (_) {}
};
const loadLocal = (uid: string): Document[] => {
  try { const r = localStorage.getItem(localKey(uid)); return r ? JSON.parse(r) : []; }
  catch (_) { return []; }
};
const clearLocal = (uid: string) => {
  try { localStorage.removeItem(localKey(uid)); } catch (_) {}
};
// ─────────────────────────────────────────────────────────────────

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
  _dirtyDocIds: Set<string>;

  setUserId: (id: string | null) => void;
  setSettingsModalOpen: (open: boolean) => void;
  fetchFromCloud: () => Promise<void>;
  syncToCloud: (docId: string) => Promise<void>;
  syncAllDirty: () => Promise<void>;
  markDirty: (docId: string) => void;
  clearDocuments: () => void;

  createDocument: (parentId?: string | null) => void;
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

// After any mutation: save to localStorage immediately
const persist = (get: () => AppState) => {
  const { userId, documents } = get();
  if (userId) saveLocal(userId, documents);
};

export const useAppStore = create<AppState>()((set, get) => ({
  documents: [],
  activeDocumentId: null,
  focusedBlockId: null,
  sortType: 'custom',
  userId: null,
  isReady: false,
  isSettingsModalOpen: false,
  _dirtyDocIds: new Set<string>(),

  setUserId: (id) => set({ userId: id }),
  setSettingsModalOpen: (open) => set({ isSettingsModalOpen: open }),

  markDirty: (docId) => { get()._dirtyDocIds.add(docId); },

  clearDocuments: () => {
    const { userId } = get();
    if (userId) clearLocal(userId);
    try { localStorage.removeItem('notion-clone-storage'); } catch (_) {}
    set({ documents: [], activeDocumentId: null, focusedBlockId: null, userId: null, isReady: false, _dirtyDocIds: new Set() });
  },

  // ── Cloud operations ──────────────────────────────────────────
  // Schema: { id, user_id, data (jsonb = entire Document), updated_at }
  // Storing entire doc as JSON avoids all PostgreSQL column name issues.

  fetchFromCloud: async () => {
    const { userId } = get();
    if (!userId) { set({ isReady: true }); return; }

    // Show local data immediately (fast start)
    const localDocs = loadLocal(userId);
    if (localDocs.length > 0 && !get().isReady) {
      set({ documents: localDocs, activeDocumentId: localDocs[0].id, isReady: true });
    }

    const { data, error } = await supabase
      .from('documents')
      .select('data, updated_at')
      .eq('user_id', userId);

    if (error) {
      console.error('[TakeWins] fetchFromCloud error:', error.message);
      set({ isReady: true });
      return;
    }

      console.log(`[TakeWins] Cloud fetch success. Found ${data.length} docs.`);
      // Parse cloud docs from JSON
      const cloudDocs: Document[] = data.map((row: any) =>
        typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      );

      // Merge: prefer newer updatedAt per doc
      const cloudMap = new Map(cloudDocs.map(d => [d.id, d]));
      const localMap = new Map(localDocs.map(d => [d.id, d]));
      const allIds = new Set([...cloudMap.keys(), ...localMap.keys()]);
      const merged: Document[] = [];

      allIds.forEach(id => {
        const cloud = cloudMap.get(id);
        const local = localMap.get(id);
        if (cloud && local) {
          merged.push((cloud.updatedAt ?? 0) >= (local.updatedAt ?? 0) ? cloud : local);
        } else if (cloud) {
          merged.push(cloud);
        } else if (local) {
          merged.push(local);
          get()._dirtyDocIds.add(local.id); // push local-only doc to cloud
        }
      });

      const sorted = merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const currentActive = get().activeDocumentId;
      const stillExists = sorted.some(d => d.id === currentActive);

      set({
        documents: sorted,
        activeDocumentId: stillExists ? currentActive : (sorted[0]?.id ?? null),
        isReady: true,
      });
      saveLocal(userId, sorted);

      if (get()._dirtyDocIds.size > 0) {
        console.log(`[TakeWins] Pushing ${get()._dirtyDocIds.size} local-only docs to cloud...`);
        get().syncAllDirty();
      }
    } else {
      // No cloud data
      if (localDocs.length > 0) {
        // Push local docs up to cloud
        set({ documents: localDocs, activeDocumentId: localDocs[0].id, isReady: true });
        localDocs.forEach(d => get()._dirtyDocIds.add(d.id));
        get().syncAllDirty();
      } else {
        // Brand new account
        const newDoc: Document = {
          id: generateId(), title: '', blocks: [createInitialBlock()],
          isFavorite: false, createdAt: Date.now(), updatedAt: Date.now(), order: 0, parentId: null,
        };
        set({ documents: [newDoc], activeDocumentId: newDoc.id, focusedBlockId: newDoc.blocks[0].id, isReady: true });
        saveLocal(userId, [newDoc]);
        get()._dirtyDocIds.add(newDoc.id);
        get().syncAllDirty();
      }
    }
  },

  syncToCloud: async (docId) => {
    const { userId, documents } = get();
    if (!userId) return;
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    const { error } = await supabase.from('documents').upsert({
      id: doc.id,
      user_id: userId,
      data: doc,
      updated_at: doc.updatedAt,
    });

    if (error) {
      console.error('[TakeWins] syncToCloud error:', error.code, error.message);
    } else {
      console.log(`[TakeWins] Synced doc ${docId} to cloud.`);
    }
  },

  syncAllDirty: async () => {
    const { userId, documents, _dirtyDocIds } = get();
    if (!userId || _dirtyDocIds.size === 0) return;
    const toSync = documents.filter(d => _dirtyDocIds.has(d.id));
    const rows = toSync.map(doc => ({
      id: doc.id,
      user_id: userId,
      data: doc,
      updated_at: doc.updatedAt,
    }));

    if (rows.length === 0) return;

    console.log(`[TakeWins] Bulk syncing ${rows.length} docs...`);
    const { error } = await supabase.from('documents').upsert(rows);
    if (error) {
      console.error('[TakeWins] syncAllDirty error:', error.code, error.message);
    } else {
      console.log(`[TakeWins] Bulk sync successful.`);
      _dirtyDocIds.clear();
    }
  },

  // ── Document operations ───────────────────────────────────────
  createDocument: (parentId = null) => {
    const newDoc: Document = {
      id: generateId(), title: '', blocks: [createInitialBlock()],
      isFavorite: false, createdAt: Date.now(), updatedAt: Date.now(),
      order: get().documents.length, parentId,
    };
    set(s => ({ documents: [...s.documents, newDoc], activeDocumentId: newDoc.id, focusedBlockId: newDoc.blocks[0].id }));
    get()._dirtyDocIds.add(newDoc.id);
    persist(get);
  },

  selectDocument: (id) => set({ activeDocumentId: id }),

  deleteDocument: (id) => set(state => {
    const getDesc = (pid: string, docs: Document[]): string[] => {
      const ch = docs.filter(d => (d.parentId || null) === pid).map(d => d.id);
      return [...ch, ...ch.flatMap(c => getDesc(c, docs))];
    };
    const toDelete = [id, ...getDesc(id, state.documents)];
    if (state.userId) supabase.from('documents').delete().in('id', toDelete).then();
    const newDocs = state.documents.filter(d => !toDelete.includes(d.id));
    if (state.userId) saveLocal(state.userId, newDocs);
    return {
      documents: newDocs,
      activeDocumentId: toDelete.includes(state.activeDocumentId as string)
        ? (newDocs[0]?.id || null) : state.activeDocumentId,
    };
  }),

  toggleFavorite: (id) => {
    set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, isFavorite: !d.isFavorite, updatedAt: Date.now() } : d) }));
    get()._dirtyDocIds.add(id); persist(get);
  },

  moveDocument: (id, newParentId) => {
    set(state => {
      const getDesc = (pid: string, docs: Document[]): string[] => {
        const ch = docs.filter(d => (d.parentId || null) === pid).map(d => d.id);
        return [...ch, ...ch.flatMap(c => getDesc(c, docs))];
      };
      if (newParentId && (id === newParentId || getDesc(id, state.documents).includes(newParentId))) return state;
      return { documents: state.documents.map(d => d.id === id ? { ...d, parentId: newParentId, updatedAt: Date.now() } : d) };
    });
    get()._dirtyDocIds.add(id); persist(get);
  },

  setSortType: (type) => set({ sortType: type }),

  updateDocumentTitle: (id, title) => {
    set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, title, updatedAt: Date.now() } : d) }));
    get()._dirtyDocIds.add(id); persist(get);
  },

  updateDocumentProperties: (id, properties) => {
    set(s => ({
      documents: s.documents.map(d => d.id === id
        ? { ...d, properties: { ...(d.properties || { tags: [], status: null }), ...properties }, updatedAt: Date.now() } : d),
    }));
    get()._dirtyDocIds.add(id); persist(get);
  },

  // ── Block operations ──────────────────────────────────────────
  addBlock: (afterId, content = '', type = 'text') => {
    const newId = generateId();
    const nb: Block = { id: newId, type, content };
    set(state => {
      if (!state.activeDocumentId) return state;
      const di = state.documents.findIndex(d => d.id === state.activeDocumentId);
      if (di === -1) return state;
      const doc = state.documents[di];
      const bi = doc.blocks.findIndex(b => b.id === afterId);
      if (bi === -1) return state;
      const newBlocks = [...doc.blocks];
      newBlocks.splice(bi + 1, 0, nb);
      const newDocs = [...state.documents];
      newDocs[di] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
      return { documents: newDocs, focusedBlockId: newId };
    });
    const aid = get().activeDocumentId;
    if (aid) { get()._dirtyDocIds.add(aid); persist(get); }
    return newId;
  },

  updateBlock: (id, content) => {
    set(state => {
      if (!state.activeDocumentId) return state;
      const di = state.documents.findIndex(d => d.id === state.activeDocumentId);
      if (di === -1) return state;
      const doc = state.documents[di];
      const newDocs = [...state.documents];
      newDocs[di] = { ...doc, blocks: doc.blocks.map(b => b.id === id ? { ...b, content } : b), updatedAt: Date.now() };
      return { documents: newDocs };
    });
    const aid = get().activeDocumentId;
    if (aid) { get()._dirtyDocIds.add(aid); persist(get); }
  },

  updateBlockType: (id, type) => {
    set(state => {
      if (!state.activeDocumentId) return state;
      const di = state.documents.findIndex(d => d.id === state.activeDocumentId);
      if (di === -1) return state;
      const doc = state.documents[di];
      const newDocs = [...state.documents];
      newDocs[di] = { ...doc, blocks: doc.blocks.map(b => b.id === id ? { ...b, type } : b), updatedAt: Date.now() };
      return { documents: newDocs };
    });
    const aid = get().activeDocumentId;
    if (aid) { get()._dirtyDocIds.add(aid); persist(get); }
  },

  updateBlockData: (id, data) => {
    set(state => {
      if (!state.activeDocumentId) return state;
      const di = state.documents.findIndex(d => d.id === state.activeDocumentId);
      if (di === -1) return state;
      const doc = state.documents[di];
      const newDocs = [...state.documents];
      newDocs[di] = { ...doc, blocks: doc.blocks.map(b => b.id === id ? { ...b, data: { ...b.data, ...data } } : b), updatedAt: Date.now() };
      return { documents: newDocs };
    });
    const aid = get().activeDocumentId;
    if (aid) { get()._dirtyDocIds.add(aid); persist(get); }
  },

  removeBlock: (id) => {
    set(state => {
      if (!state.activeDocumentId) return state;
      const di = state.documents.findIndex(d => d.id === state.activeDocumentId);
      if (di === -1) return state;
      const doc = state.documents[di];
      if (doc.blocks.length <= 1) return state;
      const bi = doc.blocks.findIndex(b => b.id === id);
      if (bi === -1) return state;
      const newBlocks = doc.blocks.filter(b => b.id !== id);
      const newDocs = [...state.documents];
      newDocs[di] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
      return { documents: newDocs, focusedBlockId: bi > 0 ? doc.blocks[bi - 1].id : newBlocks[0]?.id ?? null };
    });
    const aid = get().activeDocumentId;
    if (aid) { get()._dirtyDocIds.add(aid); persist(get); }
  },

  moveBlock: (dragId, dropId) => {
    set(state => {
      if (!state.activeDocumentId || dragId === dropId) return state;
      const di = state.documents.findIndex(d => d.id === state.activeDocumentId);
      if (di === -1) return state;
      const doc = state.documents[di];
      const from = doc.blocks.findIndex(b => b.id === dragId);
      const to = doc.blocks.findIndex(b => b.id === dropId);
      if (from === -1 || to === -1) return state;
      const newBlocks = [...doc.blocks];
      const [moved] = newBlocks.splice(from, 1);
      newBlocks.splice(to, 0, moved);
      const newDocs = [...state.documents];
      newDocs[di] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
      return { documents: newDocs };
    });
    const aid = get().activeDocumentId;
    if (aid) { get()._dirtyDocIds.add(aid); persist(get); }
  },

  setFocusedBlockId: (id) => set({ focusedBlockId: id }),
}));
