import { create } from 'zustand';
import type { Block, BlockType } from '../types';

interface EditorState {
  blocks: Block[];
  focusedBlockId: string | null;
  addBlock: (afterId: string, content?: string, type?: BlockType) => string;
  updateBlock: (id: string, content: string) => void;
  updateBlockType: (id: string, type: BlockType) => void;
  removeBlock: (id: string) => void;
  setFocusedBlockId: (id: string | null) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useEditorStore = create<EditorState>((set) => ({
  blocks: [
    { id: generateId(), type: 'h1', content: '無題のドキュメント' },
    { id: generateId(), type: 'text', content: '' },
  ],
  focusedBlockId: null,
  addBlock: (afterId, content = '', type = 'text') => {
    const newId = generateId();
    set((state) => {
      const index = state.blocks.findIndex((b) => b.id === afterId);
      if (index === -1) return state;
      const newBlock: Block = { id: newId, type, content };
      const newBlocks = [...state.blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      return { blocks: newBlocks, focusedBlockId: newId };
    });
    return newId;
  },
  updateBlock: (id, content) => {
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, content } : b)),
    }));
  },
  updateBlockType: (id, type) => {
    set((state) => ({
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, type } : b)),
    }));
  },
  removeBlock: (id) => {
    set((state) => {
      if (state.blocks.length <= 1) return state;
      const index = state.blocks.findIndex((b) => b.id === id);
      if (index === -1) return state;
      const newBlocks = state.blocks.filter((b) => b.id !== id);
      const prevBlock = index > 0 ? state.blocks[index - 1] : state.blocks[1];
      return { 
        blocks: newBlocks, 
        focusedBlockId: prevBlock ? prevBlock.id : null 
      };
    });
  },
  setFocusedBlockId: (id) => set({ focusedBlockId: id }),
}));
