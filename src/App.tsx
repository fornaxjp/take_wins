import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store/useAppStore';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { Auth } from './components/Auth';
import { LockScreen } from './components/LockScreen';
import { supabase, loadRememberedSession, clearRememberedSession, getAppLockSettings } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Menu } from 'lucide-react';
import type { Document } from './types';

function App() {
  const { selectDocument, activeDocumentId, documents, syncToCloud, syncAllDirty, setUserId, fetchFromCloud, clearDocuments, isReady } = useAppStore();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const localSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);

  // Save immediately when user switches tabs or closes window
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        syncAllDirty();
      }
    };
    const handleBeforeUnload = () => { syncAllDirty(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [syncAllDirty]);

  // Auth init
  useEffect(() => {
    const init = async () => {
      // Try remembered session first
      const remembered = await loadRememberedSession();
      if (remembered) {
        setSession(remembered);
        setUserId(remembered.user.id);
        await fetchFromCloud();
        // Check app lock
        const ls = getAppLockSettings();
        if (ls.enabled) setIsAppLocked(true);
        return;
      }
      // Fall back to current Supabase session (in-memory only)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
        setUserId(session.user.id);
        await fetchFromCloud();
        const ls = getAppLockSettings();
        if (ls.enabled) setIsAppLocked(true);
      } else {
        setSession(null);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        setUserId(session.user.id);
        fetchFromCloud();
      } else {
        clearRememberedSession();
        clearDocuments();
        setSession(null);
        setIsAppLocked(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Realtime sync
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const channel = supabase.channel(`docs-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${userId}` }, (payload) => {
        if (isSyncingRef.current) return;
        const store = useAppStore.getState();
        if (payload.eventType === 'INSERT') {
          const n = payload.new as Document;
          if (!store.documents.some(d => d.id === n.id))
            useAppStore.setState(s => ({ documents: [...s.documents, n] }));
        } else if (payload.eventType === 'UPDATE') {
          useAppStore.setState(s => ({ documents: s.documents.map(d => d.id === (payload.new as Document).id ? payload.new as Document : d) }));
        } else if (payload.eventType === 'DELETE') {
          useAppStore.setState(s => ({ documents: s.documents.filter(d => d.id !== (payload.old as any).id) }));
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // URL sync
  useEffect(() => {
    if (!isReady || documents.length === 0) return;
    const pathId = window.location.pathname.slice(1);
    if (pathId && documents.some(d => d.id === pathId)) selectDocument(pathId);
  }, [isReady]);

  useEffect(() => {
    if (activeDocumentId) {
      window.history.replaceState(null, '', `/${activeDocumentId}`);
      const doc = documents.find(d => d.id === activeDocumentId);
      document.title = doc?.title ? `${doc.title} - Take wins` : '無題のドキュメント - Take wins';
    } else {
      window.history.replaceState(null, '', '/');
      document.title = 'Take wins';
    }
  }, [activeDocumentId, documents]);

  // Debounced cloud sync
  useEffect(() => {
    if (!session || !activeDocumentId) return;
    if (localSyncTimer.current) clearTimeout(localSyncTimer.current);
    localSyncTimer.current = setTimeout(async () => {
      isSyncingRef.current = true;
      await syncToCloud(activeDocumentId);
      setTimeout(() => { isSyncingRef.current = false; }, 300);
    }, 1500);
    return () => { if (localSyncTimer.current) clearTimeout(localSyncTimer.current); };
  }, [documents, activeDocumentId, session]);

  const Spinner = () => (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
      <div className="loading-spinner" />
    </div>
  );

  if (session === undefined) return <Spinner />;
  if (!session) return <Auth />;
  if (!isReady) return <Spinner />;

  if (isAppLocked) {
    const ls = getAppLockSettings();
    return <LockScreen title="Take wins にアクセスするにはロック解除が必要です" pinHash={ls.pin} biometricEnabled={ls.biometric} onUnlock={() => setIsAppLocked(false)} />;
  }

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
