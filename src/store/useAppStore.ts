import { create } from 'zustand';
import type { Block, BlockType, Document } from '../types';
import { supabase } from '../lib/supabase';

interface AppState {
  documents: Document[];
  activeDocumentId: string | null;
  focusedBlockId: string | null;
  sortType: 'custom' | 'date' | 'title' | 'tag';
  userId: string | null;
  isReady: boolean; // auth check complete

  setUserId: (id: string | null) => void;
  fetchFromCloud: () => Promise<void>;
  syncToCloud: (docId: string) => Promise<void>;
  syncAllDirty: () => Promise<void>;
  markDirty: (docId: string) => void;
  clearDocuments: () => void;

  _dirtyDocIds: Set<string>;

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

const generateId = () => Math.random().toString(36).substring(2, 9);
const createInitialBlock = (): Block => ({ id: generateId(), type: 'text', content: '' });

export const useAppStore = create<AppState>()((set, get) => ({
  // Start with completely empty state — never pre-populate from cache
  documents: [],
  activeDocumentId: null,
  focusedBlockId: null,
  sortType: 'custom',
  userId: null,
  isReady: false,
  _dirtyDocIds: new Set<string>(),

  setUserId: (id) => set({ userId: id }),

  clearDocuments: () => {
    set({ documents: [], activeDocumentId: null, focusedBlockId: null, userId: null, isReady: false, _dirtyDocIds: new Set() });
    try { localStorage.removeItem('notion-clone-storage'); } catch (_) {}
  },

  markDirty: (docId) => {
    get()._dirtyDocIds.add(docId);
  },

  syncAllDirty: async () => {
    const { userId, documents, _dirtyDocIds } = get();
    if (!userId || _dirtyDocIds.size === 0) return;
    const toSync = documents.filter(d => _dirtyDocIds.has(d.id));
    await Promise.all(toSync.map(doc =>
      supabase.from('documents').upsert({
        id: doc.id, user_id: userId, title: doc.title, blocks: doc.blocks,
        isFavorite: doc.isFavorite, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
        order: doc.order, parentId: doc.parentId, properties: doc.properties,
      })
    ));
    _dirtyDocIds.clear();
  },

  fetchFromCloud: async () => {
    const { userId } = get();
    if (!userId) { set({ isReady: true }); return; }

    const { data, error } = await supabase.from('documents').select('*');

    if (data && !error) {
      if (data.length > 0) {
        // Sort by order so sidebar shows in correct sequence
        const sorted = [...data].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        set({
          documents: sorted as Document[],
          activeDocumentId: sorted[0].id,
          isReady: true,
        });
      } else {
        // New account — create first document and push to cloud
        const newDoc: Document = {
          id: generateId(),
          title: '',
          blocks: [createInitialBlock()],
          isFavorite: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          order: 0,
          parentId: null,
        };
        set({ documents: [newDoc], activeDocumentId: newDoc.id, focusedBlockId: newDoc.blocks[0].id, isReady: true });
        setTimeout(() => get().syncToCloud(newDoc.id), 0);
      }
    } else {
      // Network error — still mark ready so loading spinner goes away
      set({ isReady: true });
    }
  },

  syncToCloud: async (docId) => {
    const { userId, documents } = get();
    if (!userId) return;
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    await supabase.from('documents').upsert({
      id: doc.id,
      user_id: userId,
      title: doc.title,
      blocks: doc.blocks,
      isFavorite: doc.isFavorite,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      order: doc.order,
      parentId: doc.parentId,
      properties: doc.properties,
    });
  },

  createDocument: (parentId = null) => {
    const newDoc: Document = {
      id: generateId(),
      title: '',
      blocks: [createInitialBlock()],
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: get().documents.length,
      parentId,
    };
    set((state) => ({
      documents: [...state.documents, newDoc],
      activeDocumentId: newDoc.id,
      focusedBlockId: newDoc.blocks[0].id,
    }));
    get().markDirty(newDoc.id);
  },

  selectDocument: (id) => set({ activeDocumentId: id }),

  deleteDocument: (id) => set((state) => {
    const getAllDescendants = (parentId: string, docs: Document[]): string[] => {
      const children = docs.filter(d => (d.parentId || null) === parentId).map(d => d.id);
      let all = [...children];
      children.forEach(childId => { all = [...all, ...getAllDescendants(childId, docs)]; });
      return all;
    };
    const toDelete = [id, ...getAllDescendants(id, state.documents)];
    if (state.userId) {
      supabase.from('documents').delete().in('id', toDelete).then();
    }
    const newDocs = state.documents.filter(d => !toDelete.includes(d.id));
    return {
      documents: newDocs,
      activeDocumentId: toDelete.includes(state.activeDocumentId as string)
        ? (newDocs[0]?.id || null)
        : state.activeDocumentId,
    };
  }),

  toggleFavorite: (id) => {
    set((state) => ({
      documents: state.documents.map(d => d.id === id ? { ...d, isFavorite: !d.isFavorite } : d),
    }));
    get().markDirty(id);
  },

  moveDocument: (id, newParentId) => set((state) => {
    const getAllDescendants = (parentId: string, docs: Document[]): string[] => {
      const children = docs.filter(d => (d.parentId || null) === parentId).map(d => d.id);
      let all = [...children];
      children.forEach(childId => { all = [...all, ...getAllDescendants(childId, docs)]; });
      return all;
    };
    if (newParentId && (id === newParentId || getAllDescendants(id, state.documents).includes(newParentId))) {
      return state;
    }
    return {
      documents: state.documents.map(d => d.id === id ? { ...d, parentId: newParentId, updatedAt: Date.now() } : d),
    };
  }),

  setSortType: (type) => set({ sortType: type }),

  updateDocumentTitle: (id, title) => {
    set((state) => ({
      documents: state.documents.map(d => d.id === id ? { ...d, title, updatedAt: Date.now() } : d),
    }));
    get().markDirty(id);
  },

  updateDocumentProperties: (id, properties) => set((state) => ({
    documents: state.documents.map(d =>
      d.id === id
        ? { ...d, properties: { ...(d.properties || { tags: [], status: null }), ...properties }, updatedAt: Date.now() }
        : d
    ),
  })),

  addBlock: (afterId, content = '', type = 'text') => {
    const newId = generateId();
    const newBlock: Block = { id: newId, type, content };
    set((state) => {
      if (!state.activeDocumentId) return state;
      const docIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
      if (docIndex === -1) return state;
      const doc = state.documents[docIndex];
      const blockIndex = doc.blocks.findIndex(b => b.id === afterId);
      if (blockIndex === -1) return state;
      const newBlocks = [...doc.blocks];
      newBlocks.splice(blockIndex + 1, 0, newBlock);
      const newDocs = [...state.documents];
      newDocs[docIndex] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
      return { documents: newDocs, focusedBlockId: newId };
    });
    const activeId = get().activeDocumentId;
    if (activeId) get().markDirty(activeId);
    return newId;
  },

  updateBlock: (id, content) => {
    set((state) => {
      if (!state.activeDocumentId) return state;
      const docIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
      if (docIndex === -1) return state;
      const doc = state.documents[docIndex];
      const newBlocks = doc.blocks.map(b => b.id === id ? { ...b, content } : b);
      const newDocs = [...state.documents];
      newDocs[docIndex] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
      return { documents: newDocs };
    });
    const activeId = get().activeDocumentId;
    if (activeId) get().markDirty(activeId);
  },

  updateBlockType: (id, type) => set((state) => {
    if (!state.activeDocumentId) return state;
    const docIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
    if (docIndex === -1) return state;
    const doc = state.documents[docIndex];
    const newBlocks = doc.blocks.map(b => b.id === id ? { ...b, type } : b);
    const newDocs = [...state.documents];
    newDocs[docIndex] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
    return { documents: newDocs };
  }),

  updateBlockData: (id, data) => set((state) => {
    if (!state.activeDocumentId) return state;
    const docIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
    if (docIndex === -1) return state;
    const doc = state.documents[docIndex];
    const newBlocks = doc.blocks.map(b => b.id === id ? { ...b, data: { ...b.data, ...data } } : b);
    const newDocs = [...state.documents];
    newDocs[docIndex] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
    return { documents: newDocs };
  }),

  removeBlock: (id) => set((state) => {
    if (!state.activeDocumentId) return state;
    const docIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
    if (docIndex === -1) return state;
    const doc = state.documents[docIndex];
    if (doc.blocks.length <= 1) return state;
    const blockIndex = doc.blocks.findIndex(b => b.id === id);
    if (blockIndex === -1) return state;
    const newBlocks = doc.blocks.filter(b => b.id !== id);
    const prevBlock = blockIndex > 0 ? doc.blocks[blockIndex - 1] : newBlocks[0];
    const newDocs = [...state.documents];
    newDocs[docIndex] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
    return { documents: newDocs, focusedBlockId: prevBlock ? prevBlock.id : null };
  }),

  moveBlock: (dragId, dropId) => set((state) => {
    if (!state.activeDocumentId || dragId === dropId) return state;
    const docIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
    if (docIndex === -1) return state;
    const doc = state.documents[docIndex];
    const dragIndex = doc.blocks.findIndex(b => b.id === dragId);
    const dropIndex = doc.blocks.findIndex(b => b.id === dropId);
    if (dragIndex === -1 || dropIndex === -1) return state;
    const newBlocks = [...doc.blocks];
    const [draggedBlock] = newBlocks.splice(dragIndex, 1);
    newBlocks.splice(dropIndex, 0, draggedBlock);
    const newDocs = [...state.documents];
    newDocs[docIndex] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
    return { documents: newDocs };
  }),

  setFocusedBlockId: (id) => set({ focusedBlockId: id }),
}));
