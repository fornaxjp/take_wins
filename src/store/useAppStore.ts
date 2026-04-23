import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Block, BlockType, Document } from '../types';
import { supabase } from '../lib/supabase';

interface AppState {
  documents: Document[];
  activeDocumentId: string | null;
  focusedBlockId: string | null;
  sortType: 'custom' | 'date' | 'title' | 'tag';
  userId: string | null;

  setUserId: (id: string | null) => void;
  fetchFromCloud: () => Promise<void>;
  syncToCloud: (docId: string) => Promise<void>;

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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      documents: [{
        id: generateId(),
        title: '無題のドキュメント',
        blocks: [createInitialBlock()],
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        order: 0,
        parentId: null
      }],
      activeDocumentId: null,
      focusedBlockId: null,
      sortType: 'custom',
      userId: null,

      setUserId: (id) => set({ userId: id }),

      fetchFromCloud: async () => {
        const { userId } = get();
        if (!userId) return;
        const { data, error } = await supabase.from('documents').select('*');
        if (data && !error && data.length > 0) {
          set({ documents: data as Document[] });
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
          properties: doc.properties
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
          parentId
        };
        set((state) => ({
          documents: [...state.documents, newDoc],
          activeDocumentId: newDoc.id,
          focusedBlockId: newDoc.blocks[0].id
        }));
      },

      selectDocument: (id) => set({ activeDocumentId: id }),

      deleteDocument: (id) => set((state) => {
        const getAllDescendants = (parentId: string, docs: Document[]): string[] => {
          const children = docs.filter(d => (d.parentId || null) === parentId).map(d => d.id);
          let all = [...children];
          children.forEach(childId => {
            all = [...all, ...getAllDescendants(childId, docs)];
          });
          return all;
        };
        const toDelete = [id, ...getAllDescendants(id, state.documents)];
        
        if (state.userId) {
          supabase.from('documents').delete().in('id', toDelete).then();
        }

        const newDocs = state.documents.filter(d => !toDelete.includes(d.id));
        return {
          documents: newDocs,
          activeDocumentId: toDelete.includes(state.activeDocumentId as string) ? (newDocs[0]?.id || null) : state.activeDocumentId
        };
      }),

      toggleFavorite: (id) => set((state) => ({
        documents: state.documents.map(d => d.id === id ? { ...d, isFavorite: !d.isFavorite } : d)
      })),

      moveDocument: (id, newParentId) => set((state) => {
        const getAllDescendants = (parentId: string, docs: Document[]): string[] => {
          const children = docs.filter(d => (d.parentId || null) === parentId).map(d => d.id);
          let all = [...children];
          children.forEach(childId => {
            all = [...all, ...getAllDescendants(childId, docs)];
          });
          return all;
        };
        if (newParentId && (id === newParentId || getAllDescendants(id, state.documents).includes(newParentId))) {
          return state; 
        }
        return {
          documents: state.documents.map(d => d.id === id ? { ...d, parentId: newParentId, updatedAt: Date.now() } : d)
        };
      }),

      setSortType: (type) => set({ sortType: type }),

      updateDocumentTitle: (id, title) => set((state) => ({
        documents: state.documents.map(d => d.id === id ? { ...d, title, updatedAt: Date.now() } : d)
      })),

      updateDocumentProperties: (id, properties) => set((state) => ({
        documents: state.documents.map(d => d.id === id ? { ...d, properties: { ...(d.properties || {tags:[], status: null}), ...properties }, updatedAt: Date.now() } : d)
      })),

      addBlock: (afterId, content = '', type = 'text') => {
        const state = get();
        if (!state.activeDocumentId) return '';
        const newId = generateId();
        const newBlock: Block = { id: newId, type, content };
        
        set((state) => {
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
        return newId;
      },

      updateBlock: (id, content) => set((state) => {
        if (!state.activeDocumentId) return state;
        const docIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
        if (docIndex === -1) return state;
        const doc = state.documents[docIndex];
        
        const newBlocks = doc.blocks.map(b => b.id === id ? { ...b, content } : b);
        const newDocs = [...state.documents];
        newDocs[docIndex] = { ...doc, blocks: newBlocks, updatedAt: Date.now() };
        
        return { documents: newDocs };
      }),

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
    }),
    {
      name: 'notion-clone-storage',
    }
  )
);
