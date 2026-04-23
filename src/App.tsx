import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store/useAppStore';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Menu } from 'lucide-react';
import type { Document } from './types';

function App() {
  const {
    selectDocument, activeDocumentId, documents,
    syncToCloud, setUserId, fetchFromCloud, clearDocuments, isReady
  } = useAppStore();

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Track whether the current sync was triggered locally (to avoid loop)
  const localSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);

  // Step 1: Auth + Realtime setup
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setUserId(session.user.id);
        fetchFromCloud();
      } else {
        setSession(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setUserId(session.user.id);
        fetchFromCloud();
      } else {
        clearDocuments();
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Step 2: Subscribe to real-time changes from Supabase
  // This fires when ANOTHER device edits a document for the same account
  useEffect(() => {
    if (!session?.user?.id) return;

    const userId = session.user.id;

    const channel = supabase
      .channel(`user-docs-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',             // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${userId}`, // Only this user's data
        },
        (payload) => {
          // If WE just triggered this sync, ignore it (avoid echo)
          if (isSyncingRef.current) return;

          const store = useAppStore.getState();
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === 'INSERT') {
            const exists = store.documents.some(d => d.id === (newRecord as Document).id);
            if (!exists) {
              useAppStore.setState(state => ({
                documents: [...state.documents, newRecord as Document],
              }));
            }
          } else if (eventType === 'UPDATE') {
            useAppStore.setState(state => ({
              documents: state.documents.map(d =>
                d.id === (newRecord as Document).id ? (newRecord as Document) : d
              ),
            }));
          } else if (eventType === 'DELETE') {
            useAppStore.setState(state => ({
              documents: state.documents.filter(d => d.id !== (oldRecord as any).id),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // Step 3: URL sync after data ready
  useEffect(() => {
    if (!isReady || documents.length === 0) return;
    const pathId = window.location.pathname.slice(1);
    if (pathId && documents.some(d => d.id === pathId)) {
      selectDocument(pathId);
    }
  }, [isReady]);

  useEffect(() => {
    if (activeDocumentId) {
      window.history.replaceState(null, '', `/${activeDocumentId}`);
      const activeDoc = documents.find(d => d.id === activeDocumentId);
      document.title = activeDoc?.title
        ? `${activeDoc.title} - Take wins`
        : '無題のドキュメント - Take wins';
    } else {
      window.history.replaceState(null, '', '/');
      document.title = 'Take wins';
    }
  }, [activeDocumentId, documents]);

  // Step 4: Debounced cloud sync when local edits happen
  useEffect(() => {
    if (!session || !activeDocumentId) return;

    if (localSyncTimer.current) clearTimeout(localSyncTimer.current);

    localSyncTimer.current = setTimeout(async () => {
      isSyncingRef.current = true;     // mark as local sync so realtime listener ignores echo
      await syncToCloud(activeDocumentId);
      // Give Supabase ~300ms to broadcast before we allow realtime updates again
      setTimeout(() => { isSyncingRef.current = false; }, 300);
    }, 1500);

    return () => {
      if (localSyncTimer.current) clearTimeout(localSyncTimer.current);
    };
  }, [documents, activeDocumentId, session]);

  // === Render states ===
  const Spinner = () => (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
      <div className="loading-spinner" />
    </div>
  );

  if (session === undefined) return <Spinner />;
  if (!session) return <Auth />;
  if (!isReady) return <Spinner />;

  return (
    <div className="app-container">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="app-main">
        <div className="mobile-header">
          <button onClick={() => setIsSidebarOpen(true)} className="mobile-menu-btn" title="メニューを開く">
            <Menu size={20} />
          </button>
        </div>
        <Editor />
      </main>
    </div>
  );
}

export default App;
