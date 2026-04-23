import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from './store/useAppStore';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { Auth } from './components/Auth';
import { LockScreen } from './components/LockScreen';
import { SettingsModal } from './components/SettingsModal';
import { supabase, getAppLockSettings } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Menu, RefreshCw } from 'lucide-react';
import type { Document } from './types';

function App() {
  const {
    selectDocument, activeDocumentId, documents,
    syncAllDirty, setUserId, fetchFromCloud,
    clearDocuments, isReady, isSettingsModalOpen, setSettingsModalOpen
  } = useAppStore();

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle'|'syncing'|'done'|'error'>('idle');
  const loadedUidRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);

  // Manual sync
  const handleSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncStatus('syncing');
    try {
      await syncAllDirty();
      await fetchFromCloud();
      setSyncStatus('done');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } finally {
      isSyncingRef.current = false;
    }
  }, [syncAllDirty, fetchFromCloud]);

  // Save on hide, refresh on show
  useEffect(() => {
    const onChange = async () => {
      if (document.visibilityState === 'hidden') {
        await syncAllDirty();
      } else if (document.visibilityState === 'visible' && loadedUidRef.current) {
        // Coming back to tab — flush then pull latest
        await syncAllDirty();
        await fetchFromCloud();
      }
    };
    document.addEventListener('visibilitychange', onChange);
    window.addEventListener('pagehide', () => syncAllDirty());
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [syncAllDirty, fetchFromCloud]);

  // Auth — Supabase handles session persistence automatically
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && session.user.id !== loadedUidRef.current) {
        loadedUidRef.current = session.user.id;
        setUserId(session.user.id);
        fetchFromCloud().then(() => {
          if (getAppLockSettings().enabled) setIsAppLocked(true);
        });
      } else if (!session) {
        setSession(null);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        if (session.user.id !== loadedUidRef.current) {
          loadedUidRef.current = session.user.id;
          setUserId(session.user.id);
          fetchFromCloud().then(() => {
            if (getAppLockSettings().enabled) setIsAppLocked(true);
          });
        }
      } else {
        loadedUidRef.current = null;
        clearDocuments();
        setIsAppLocked(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Realtime updates from other devices
  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;
    const channel = supabase
      .channel(`user-docs-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${uid}` },
        (payload) => {
          if (isSyncingRef.current) return;
          const store = useAppStore.getState();
          if (payload.eventType === 'INSERT') {
            const n = payload.new as Document;
            if (!store.documents.some(d => d.id === n.id))
              useAppStore.setState(s => ({ documents: [...s.documents, n] }));
          } else if (payload.eventType === 'UPDATE') {
            const u = payload.new as Document;
            if (store._dirtyDocIds.has(u.id)) return; // don't overwrite dirty local data
            useAppStore.setState(s => ({ documents: s.documents.map(d => d.id === u.id ? u : d) }));
          } else if (payload.eventType === 'DELETE') {
            useAppStore.setState(s => ({ documents: s.documents.filter(d => d.id !== (payload.old as any).id) }));
          }
        }
      ).subscribe();
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

  // Periodic cloud sync every 5 seconds
  useEffect(() => {
    if (!session || !activeDocumentId) return;
    const interval = setInterval(async () => {
      const store = useAppStore.getState();
      if (store._dirtyDocIds.size > 0 && !isSyncingRef.current) {
        isSyncingRef.current = true;
        await store.syncAllDirty();
        setTimeout(() => { isSyncingRef.current = false; }, 500);
      }
    }, 5000);
    return () => {
      // Sync immediately on document switch
      const store = useAppStore.getState();
      if (store._dirtyDocIds.has(activeDocumentId)) {
        store.syncToCloud(activeDocumentId).then(() => store._dirtyDocIds.delete(activeDocumentId));
      }
      clearInterval(interval);
    };
  }, [activeDocumentId, session]);

  const Spinner = () => (
    <div style={{ display: 'flex', height: '100dvh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
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

  const activeTitle = documents.find(d => d.id === activeDocumentId)?.title;
  const syncIcon = syncStatus === 'syncing' ? '⏳' : syncStatus === 'done' ? '✓' : syncStatus === 'error' ? '✗' : '';

  return (
    <div className="app-container">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="app-main">
        <div className="mobile-header">
          <button onClick={() => setIsSidebarOpen(true)} className="mobile-menu-btn" aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="mobile-header-title">{activeTitle || 'Take wins'}</span>
          <button onClick={handleSync} className="mobile-menu-btn" aria-label="Sync now"
            style={{ position: 'relative', fontSize: 11, color: syncStatus === 'error' ? 'var(--danger-color)' : syncStatus === 'done' ? '#22c55e' : 'var(--text-color)' }}>
            {syncStatus === 'syncing'
              ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
              : syncStatus !== 'idle'
              ? <span style={{ fontWeight: 700 }}>{syncIcon}</span>
              : <RefreshCw size={18} />}
          </button>
        </div>
        <Editor />
      </main>
      {isSettingsModalOpen && <SettingsModal onClose={() => setSettingsModalOpen(false)} />}
    </div>
  );
}

export default App;
