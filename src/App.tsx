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
  const isSyncingRef = useRef(false);
  // Track which user's data is already loaded to avoid re-fetching on token refresh
  const loadedUserIdRef = useRef<string | null>(null);

  // Save immediately when user switches tabs or closes window
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') syncAllDirty(); };
    const onUnload = () => syncAllDirty();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onUnload); // more reliable than beforeunload
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onUnload);
    };
  }, [syncAllDirty]);

  // Auth init — only fetch from cloud ONCE per user login
  useEffect(() => {
    const init = async () => {
      const remembered = await loadRememberedSession();
      if (remembered) {
        setSession(remembered);
        setUserId(remembered.user.id);
        loadedUserIdRef.current = remembered.user.id;
        await fetchFromCloud();
        const ls = getAppLockSettings();
        if (ls.enabled) setIsAppLocked(true);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSession(session);
        setUserId(session.user.id);
        loadedUserIdRef.current = session.user.id;
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
        // Only fetch from cloud if this is a DIFFERENT user (real login)
        // Skip if it's just a token refresh for the same user already loaded
        if (session.user.id !== loadedUserIdRef.current) {
          loadedUserIdRef.current = session.user.id;
          setUserId(session.user.id);
          fetchFromCloud();
          const ls = getAppLockSettings();
          if (ls.enabled) setIsAppLocked(true);
        }
      } else {
        // Real logout
        loadedUserIdRef.current = null;
        clearRememberedSession();
        clearDocuments();
        setSession(null);
        setIsAppLocked(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Realtime sync from other devices — only apply if not currently syncing locally
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
          const updated = payload.new as Document;
          // Don't overwrite a document that is currently dirty (has unsaved local changes)
          if (store._dirtyDocIds.has(updated.id)) return;
          useAppStore.setState(s => ({ documents: s.documents.map(d => d.id === updated.id ? updated : d) }));
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

  // Auto-sync: save active document every 3 seconds if dirty, and immediately on doc switch
  useEffect(() => {
    if (!session || !activeDocumentId) return;
    const interval = setInterval(async () => {
      const store = useAppStore.getState();
      if (store._dirtyDocIds.has(activeDocumentId)) {
        isSyncingRef.current = true;
        await syncToCloud(activeDocumentId);
        store._dirtyDocIds.delete(activeDocumentId);
        setTimeout(() => { isSyncingRef.current = false; }, 300);
      }
    }, 3000);
    return () => {
      // Sync previous document immediately when switching away
      if (useAppStore.getState()._dirtyDocIds.has(activeDocumentId)) {
        isSyncingRef.current = true;
        syncToCloud(activeDocumentId).then(() => {
          useAppStore.getState()._dirtyDocIds.delete(activeDocumentId);
          setTimeout(() => { isSyncingRef.current = false; }, 300);
        });
      }
      clearInterval(interval);
    };
  }, [activeDocumentId, session]);

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
    return <LockScreen title="Take wins" pinHash={ls.pin} biometricEnabled={ls.biometric} onUnlock={() => setIsAppLocked(false)} />;
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
