import { create } from 'zustand';
import { db } from '../lib/db';

// Sync status type
export type SyncStatus = 'idle' | 'syncing' | 'done' | 'error' | 'offline';


const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().substring(0, 8);
  }
  return Math.random().toString(36).substring(2, 10);
};
const createInitialBlock = (): Block => ({ id: generateId(), type: 'text', content: '' });

interface AppState {
  documents: Document[];
  activeDocumentId: string | null;
  sideDocumentId: string | null;
  focusedBlockId: string | null;
  sortType: 'custom' | 'date' | 'title' | 'tag';
  userId: string | null;
  isReady: boolean;
  isSettingsModalOpen: boolean;
  fontFamily: string;
  fontSize: string;
  _dirtyDocIds: Set<string>;
  unlockedDocIds: Set<string>;
  syncStatus: SyncStatus;

  setUserId: (id: string | null) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setFontFamily: (font: string) => void;
  setFontSize: (size: string) => void;
  initializeLocalData: () => Promise<void>;
  fetchFromCloud: () => Promise<void>;
  syncWithCloud: () => Promise<void>;
  markDirty: (docId: string) => void;
  clearDocuments: () => Promise<void>;
  createDocument: (parentId?: string | null) => void;
  createTemplateDocument: (type: any) => void;
  selectDocument: (id: string) => void;
  setSideDocument: (id: string | null) => void;
  deleteDocument: (id: string) => Promise<void>;
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
  unlockDocument: (id: string) => void;
  toggleDocumentLock: (id: string) => void;
  runCodeBlock: (id: string) => Promise<void>;
  fetchLiveData: (id: string) => Promise<void>;
  runAIAssistant: (id: string, prompt: string) => Promise<void>;
  toggleTimer: (id: string) => void;
  toggleBlocker: (id: string, reason?: string) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  documents: [],
  activeDocumentId: null,
  sideDocumentId: null,
  focusedBlockId: null,
  sortType: 'custom',
  userId: null,
  isReady: false,
  isSettingsModalOpen: false,
  syncStatus: 'idle',
  fontFamily: localStorage.getItem('tw_fontFamily') || "'Inter', system-ui, sans-serif",
  fontSize: localStorage.getItem('tw_fontSize') || "16px",
  _dirtyDocIds: new Set<string>(),
  unlockedDocIds: new Set<string>(),

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
  markDirty: (docId) => { 
    set(s => {
      const newDirty = new Set(s._dirtyDocIds);
      newDirty.add(docId);
      return { _dirtyDocIds: newDirty };
    });
  },
  clearDocuments: async () => {
    await db.documents.clear();
    await db.syncMetadata.clear();
        set({ documents: [], activeDocumentId: null, focusedBlockId: null, userId: null, isReady: true, _dirtyDocIds: new Set() });
  },

  initializeLocalData: async () => {
    const docs = await db.documents.toArray();
    set({ documents: docs, isReady: true, activeDocumentId: docs[0]?.id || null });
  },

  fetchFromCloud: async () => {
    const { userId } = get();
    if (!userId) return;
    
    set({ syncStatus: 'syncing' });
    try {
      const { data, error } = await supabase.from('documents').select('data, updated_at').eq('user_id', userId);
      if (error) throw error;
      
      if (data) {
        const cloudDocs: Document[] = data.map(row => typeof row.data === 'string' ? JSON.parse(row.data) : row.data);
        
        for (const cloudDoc of cloudDocs) {
          const localDoc = await db.documents.get(cloudDoc.id);
          if (!localDoc || cloudDoc.updatedAt > localDoc.updatedAt) {
            await db.documents.put(cloudDoc);
          }
        }
        
        const allLocal = await db.documents.toArray();
        set({ documents: allLocal, syncStatus: 'done' });
      }
    } catch (e) {
      console.error('Fetch error:', e);
      set({ syncStatus: 'error' });
    }
  },

  syncWithCloud: async () => {
    const { userId, _dirtyDocIds, documents, syncStatus } = get();
    if (!userId || !navigator.onLine) {
      if (!navigator.onLine) set({ syncStatus: 'offline' });
      return;
    }
    if (syncStatus === 'syncing') return;

    set({ syncStatus: 'syncing' });
    try {
      // 1. Push local dirty changes
      if (_dirtyDocIds.size > 0) {
        const dirtyDocs = documents.filter(d => _dirtyDocIds.has(d.id));
        const rows = dirtyDocs.map(doc => ({ 
          id: doc.id, 
          user_id: userId, 
          data: doc, 
          updated_at: doc.updatedAt 
        }));
        const { error } = await supabase.from('documents').upsert(rows);
        if (error) throw error;
        set({ _dirtyDocIds: new Set() });
      }

      // 2. Pull remote changes
      const { data, error } = await supabase.from('documents').select('data, updated_at').eq('user_id', userId);
      if (error) throw error;

      if (data) {
        const cloudDocs: Document[] = data.map(row => typeof row.data === 'string' ? JSON.parse(row.data) : row.data);
        let hasChanges = false;
        
        for (const cloudDoc of cloudDocs) {
          const localDoc = await db.documents.get(cloudDoc.id);
          if (!localDoc || cloudDoc.updatedAt > localDoc.updatedAt) {
            await db.documents.put(cloudDoc);
            hasChanges = true;
          } else if (localDoc && localDoc.updatedAt > cloudDoc.updatedAt) {
            // Local is newer but somehow not marked dirty, or sync failed previously
            await supabase.from('documents').upsert({ id: localDoc.id, user_id: userId, data: localDoc, updated_at: localDoc.updatedAt });
          }
        }

        if (hasChanges) {
          const allLocal = await db.documents.toArray();
          set({ documents: allLocal });
        }
      }
      set({ syncStatus: 'done' });
    } catch (e) {
      console.error('Sync error:', e);
      set({ syncStatus: 'error' });
    }
  },

  createDocument: (parentId = null) => {
    const newDoc: Document = { id: generateId(), title: '', blocks: [createInitialBlock()], isFavorite: false, createdAt: Date.now(), updatedAt: Date.now(), order: get().documents.length, parentId };
    set(s => ({ documents: [...s.documents, newDoc], activeDocumentId: newDoc.id }));
    get().markDirty(newDoc.id);
    db.documents.add(newDoc);
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
  setSideDocument: (id) => set({ sideDocumentId: id }),

  deleteDocument: async (id) => {
    const { userId, documents } = get();
    // Recursively find all children to delete
    const findChildrenIds = (parentId: string): string[] => {
      const children = documents.filter(d => d.parentId === parentId);
      return children.reduce((acc, child) => [...acc, child.id, ...findChildrenIds(child.id)], [] as string[]);
    };

    const idsToDelete = [id, ...findChildrenIds(id)];
    set(s => ({ 
      documents: s.documents.filter(d => !idsToDelete.includes(d.id)), 
      activeDocumentId: idsToDelete.includes(s.activeDocumentId || '') ? null : s.activeDocumentId 
    }));

    if (userId) {
      await supabase.from('documents').delete().in('id', idsToDelete).eq('user_id', userId);
    }
  },

  toggleFavorite: (id) => set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, isFavorite: !d.isFavorite } : d) })),

  moveDocument: (id, pid) => set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, parentId: pid } : d) })),

  setSortType: (t) => set({ sortType: t }),

  updateDocumentTitle: (id, title) => {
    set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, title, updatedAt: Date.now() } : d) }));
    get()._dirtyDocIds.add(id);
  },

  updateDocumentProperties: (id, props) => {
    set(s => ({ documents: s.documents.map(d => d.id === id ? { ...d, properties: { ...(d.properties || {}), ...props }, updatedAt: Date.now() } : d) }));
    get().markDirty(id);
  },

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
      if (from === -1 || to === -1) return s;
      const newBlocks = [...doc.blocks];
      const [moved] = newBlocks.splice(from, 1);
      newBlocks.splice(to, 0, moved);
      return { documents: s.documents.map(d => d.id === s.activeDocumentId ? { ...doc, blocks: newBlocks, updatedAt: Date.now() } : d) };
    });
    const aid = get().activeDocumentId;
    if (aid) get()._dirtyDocIds.add(aid);
  },

  setFocusedBlockId: (id) => set({ focusedBlockId: id }),

  unlockDocument: (id) => set(s => {
    const newSet = new Set(s.unlockedDocIds);
    newSet.add(id);
    return { unlockedDocIds: newSet };
  }),

  toggleDocumentLock: (id) => set(s => {
    const doc = s.documents.find(d => d.id === id);
    if (!doc) return s;
    const isLocked = !doc.properties?.isLocked;
    const newSet = new Set(s.unlockedDocIds);
    if (isLocked) {
      newSet.delete(id); // Re-lock it immediately
    } else {
      newSet.add(id); // Keep it accessible
    }
    const updatedDocs = s.documents.map(d => d.id === id ? { ...d, properties: { ...d.properties, isLocked } } : d);
    get().markDirty(id);
    return { documents: updatedDocs, unlockedDocIds: newSet };
  }),

  runCodeBlock: async (id) => {
    const { documents, activeDocumentId } = get();
    const doc = documents.find(d => d.id === activeDocumentId);
    if (!doc) return;
    const block = doc.blocks.find(b => b.id === id);
    if (!block || block.type !== 'code') return;

    const lang = block.language || 'python';
    const { runCode } = await import('../lib/codeRunner');
    const result = await runCode(lang, block.content);

    set(s => ({
      documents: s.documents.map(d => d.id === activeDocumentId ? {
        ...d,
        blocks: d.blocks.map(b => b.id === id ? { ...b, executionResult: result } : b),
        updatedAt: Date.now()
      } : d)
    }));
    get().markDirty(activeDocumentId!);
  },

  fetchLiveData: async (id) => {
    const { documents, activeDocumentId } = get();
    const doc = documents.find(d => d.id === activeDocumentId);
    if (!doc) return;
    const block = doc.blocks.find(b => b.id === id);
    if (!block || block.type !== 'live_data') return;

    const url = block.data?.url;
    if (!url) return;

    try {
      const res = await fetch(url);
      const data = await res.json();
      // Simple path selector if provided, e.g. "rate.usd"
      let value = data;
      if (block.data?.path) {
        const parts = block.data.path.split('.');
        for (const p of parts) value = value[p];
      }
      
      set(s => ({
        documents: s.documents.map(d => d.id === activeDocumentId ? {
          ...d,
          blocks: d.blocks.map(b => b.id === id ? { ...b, content: String(value), updatedAt: Date.now() } : b),
          updatedAt: Date.now()
        } : d)
      }));
      get().markDirty(activeDocumentId!);
    } catch (e) {
      console.error('Live Data Error:', e);
    }
  },

  runAIAssistant: async (id, prompt) => {
    const { documents, activeDocumentId } = get();
    const doc = documents.find(d => d.id === activeDocumentId);
    if (!doc) return;

    // Get keys from localStorage
    const keys = JSON.parse(localStorage.getItem('tw_ai_keys') || '{}');
    const model = localStorage.getItem('tw_ai_model') || 'openai';
    
    set(s => ({
      documents: s.documents.map(d => d.id === activeDocumentId ? {
        ...d,
        blocks: d.blocks.map(b => b.id === id ? { ...b, executionResult: { output: '思考中...', type: 'text' } } : b)
      } : d)
    }));

    try {
      const systemInstruction = `\n\n[System Instruction: You are a document generator. Output ONLY valid Markdown. DO NOT include any conversational text, greetings, or polite filler (e.g., "Here is your table", "Let me know if..."). If the user asks for a table without specifying data, leave ALL cells completely EMPTY (just space) instead of writing "Row 1", "Column 1", etc.]`;
      const fullPrompt = prompt + systemInstruction;

      let output = '';
      if (model === 'openai' && keys.openai) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keys.openai}` },
          body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: fullPrompt }] })
        });
        const data = await res.json();
        output = data.choices[0].message.content;
      } else if (model === 'gemini' && keys.gemini) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${keys.gemini}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
        });
        const data = await res.json();
        output = data.candidates[0].content.parts[0].text;
      } else if (model === 'claude' && keys.claude) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': keys.claude, 'anthropic-version': '2023-06-01', 'anthropic-dangerously-allow-browser': 'true' },
          body: JSON.stringify({ model: 'claude-3-5-sonnet-20240620', max_tokens: 1024, messages: [{ role: 'user', content: fullPrompt }] })
        });
        const data = await res.json();
        output = data.content[0].text;
      } else if (model === 'groq' && keys.groq) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keys.groq}` },
          body: JSON.stringify({ model: 'mixtral-8x7b-32768', messages: [{ role: 'user', content: fullPrompt }] })
        });
        const data = await res.json();
        output = data.choices[0].message.content;
      } else if (model === 'xiaomi' && keys.xiaomi) {
        const res = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keys.xiaomi}` },
          body: JSON.stringify({ model: 'mimo-v2.5', messages: [{ role: 'user', content: fullPrompt }] })
        });
        const data = await res.json();
        output = data.choices[0].message.content;
      } else {
        output = 'APIキーが設定されていないか、モデルが未対応です。設定画面でキーを入力してください。';
        // Fallback to text if error
        set(s => ({
          documents: s.documents.map(d => d.id === activeDocumentId ? {
            ...d,
            blocks: d.blocks.map(b => b.id === id ? { ...b, executionResult: { output, type: 'text' } } : b),
            updatedAt: Date.now()
          } : d)
        }));
        return;
      }

      // Parse markdown to blocks
      const lines = output.split('\n');
      const newBlocks: any[] = [];
      let currentTable: any = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
          if (line.includes('---')) continue;
          const cells = line.split('|').slice(1, -1).map(c => c.trim());
          if (!currentTable) {
            currentTable = { rows: 1, cols: cells.length, cells: [cells] };
          } else {
            currentTable.rows++;
            currentTable.cells.push(cells);
          }
        } else {
          if (currentTable) {
            newBlocks.push({ id: generateId(), type: 'table', content: '', data: currentTable });
            currentTable = null;
          }
          if (line) {
            if (line.startsWith('# ')) newBlocks.push({ id: generateId(), type: 'h1', content: line.slice(2) });
            else if (line.startsWith('## ')) newBlocks.push({ id: generateId(), type: 'h2', content: line.slice(3) });
            else if (line.startsWith('### ')) newBlocks.push({ id: generateId(), type: 'h3', content: line.slice(4) });
            else if (line.startsWith('- ')) newBlocks.push({ id: generateId(), type: 'bullet_list', content: line.slice(2) });
            else if (line.match(/^\d+\.\s/)) newBlocks.push({ id: generateId(), type: 'bullet_list', content: line.replace(/^\d+\.\s/, '') });
            else newBlocks.push({ id: generateId(), type: 'text', content: line });
          }
        }
      }
      if (currentTable) newBlocks.push({ id: generateId(), type: 'table', content: '', data: currentTable });
      if (newBlocks.length === 0) newBlocks.push({ id: generateId(), type: 'text', content: output });

      set(s => {
        const d = s.documents.find(doc => doc.id === activeDocumentId);
        if (!d) return s;
        const bIdx = d.blocks.findIndex(b => b.id === id);
        const upBlocks = [...d.blocks];
        upBlocks.splice(bIdx, 1, ...newBlocks);
        return { documents: s.documents.map(doc => doc.id === activeDocumentId ? { ...doc, blocks: upBlocks, updatedAt: Date.now() } : doc) };
      });
      get().markDirty(activeDocumentId!);
    } catch (e: any) {
      set(s => ({
        documents: s.documents.map(d => d.id === activeDocumentId ? {
          ...d,
          blocks: d.blocks.map(b => b.id === id ? { ...b, executionResult: { output: '', error: e.message, type: 'text' } } : b)
        } : d)
      }));
    }
  },

  toggleTimer: (id) => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;
    
    set(s => ({
      documents: s.documents.map(d => d.id === activeDocumentId ? {
        ...d,
        blocks: d.blocks.map(b => {
          if (b.id !== id) return b;
          const isRunning = !b.timer?.isRunning;
          const startTime = isRunning ? Date.now() : null;
          const elapsed = b.timer ? (isRunning ? b.timer.elapsed : b.timer.elapsed + (Date.now() - (b.timer.startTime || Date.now()))) : 0;
          return { ...b, timer: { isRunning, startTime, elapsed } };
        }),
        updatedAt: Date.now()
      } : d)
    }));
    get().markDirty(activeDocumentId);
  },

  toggleBlocker: (id, reason = '') => {
    const { activeDocumentId } = get();
    if (!activeDocumentId) return;

    set(s => ({
      documents: s.documents.map(d => d.id === activeDocumentId ? {
        ...d,
        blocks: d.blocks.map(b => {
          if (b.id !== id) return b;
          return { ...b, blocker: { isBlocked: !b.blocker?.isBlocked, reason } };
        }),
        updatedAt: Date.now()
      } : d)
    }));
    get().markDirty(activeDocumentId);
  },
}));

// Auto-save to Dexie on every change
useAppStore.subscribe((state, prevState) => {
  if (state.documents !== prevState.documents && state.isReady) {
    // Persistent Dexie save
    db.documents.clear().then(() => {
      db.documents.bulkAdd(state.documents);
    });
  }
});

// Backup System
export interface Backup {
  timestamp: number;
  documents: Document[];
}

export const getBackups = (userId: string): Backup[] => {
  try { return JSON.parse(localStorage.getItem(`tw_backup_${userId}`) || '[]'); }
  catch { return []; }
};

export const createBackup = (userId: string, documents: Document[]) => {
  const backups = getBackups(userId);
  // Prevent backup if the latest one is exactly the same
  if (backups.length > 0 && JSON.stringify(backups[0].documents) === JSON.stringify(documents)) return;
  
  const newBackup = { timestamp: Date.now(), documents };
  // Keep last 10 backups
  const updated = [newBackup, ...backups].slice(0, 10);
  localStorage.setItem(`tw_backup_${userId}`, JSON.stringify(updated));
};

export const restoreBackup = (userId: string, timestamp: number) => {
  const backups = getBackups(userId);
  const target = backups.find(b => b.timestamp === timestamp);
  if (target) {
    useAppStore.setState({ documents: target.documents });
    target.documents.forEach(d => useAppStore.getState().markDirty(d.id));
  }
};
