import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from './store/useAppStore';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { Auth } from './components/Auth';
import { LockScreen } from './components/LockScreen';
import { supabase, loadRememberedSession, clearRememberedSession, getAppLockSettings } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Menu, RefreshCw } from 'lucide-react';
import type { Document } from './types';

function App() {
  const {
    selectDocument, activeDocumentId, documents,
    syncToCloud, syncAllDirty, setUserId,
    fetchFromCloud, clearDocuments, isReady
  } = useAppStore();

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const isSyncingToCloud = useRef(false);

  // ── Manual refresh ────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    await syncAllDirty();        // flush local changes to cloud first
    await fetchFromCloud();      // then pull latest from cloud
    setIsSyncing(false);
  }, [isSyncing, syncAllDirty, fetchFromCloud]);

  // ── Save on tab hide / page hide ─────────────────────────────
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') syncAllDirty();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [syncAllDirty]);

  // ── Fetch fresh data when tab becomes visible again ───────────
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === 'visible' && loadedUserIdRef.current) {
        // Push any dirty local changes, then pull cloud
        await syncAllDirty();
        await fetchFromCloud();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [syncAllDirty, fetchFromCloud]);

  // ── Auth: load once per user, never re-fetch on token refresh ─
  useEffect(() => {
    const init = async () => {
      // Try remembered session
      const remembered = await loadRememberedSession();
      const sessionToUse = remembered || (await supabase.auth.getSession()).data.session;

      if (sessionToUse) {
        setSession(sessionToUse);
        setUserId(sessionToUse.user.id);
        loadedUserIdRef.current = sessionToUse.user.id;
        await fetchFromCloud();
        if (getAppLockSettings().enabled) setIsAppLocked(true);
      } else {
        setSession(null);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        // Only re-fetch if this is genuinely a new user login (not a token refresh)
        if (session.user.id !== loadedUserIdRef.current) {
          loadedUserIdRef.current = session.user.id;
          setUserId(session.user.id);
          fetchFromCloud();
          if (getAppLockSettings().enabled) setIsAppLocked(true);
        }
      } else {
        loadedUserIdRef.current = null;
        clearRememberedSession();
        clearDocuments();
        setSession(null);
        setIsAppLocked(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Supabase Realtime: push changes from other devices ────────
  useEffect(() => {
    if (!session?.user?.id) return;
    const uid = session.user.id;

    const channel = supabase
      .channel(`docs-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${uid}` },
        (payload) => {
          // Ignore echoes of our own saves
          if (isSyncingToCloud.current) return;

          const store = useAppStore.getState();
          if (payload.eventType === 'INSERT') {
            const n = payload.new as Document;
            if (!store.documents.some(d => d.id === n.id))
              useAppStore.setState(s => ({ documents: [...s.documents, n] }));
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Document;
            // Don't overwrite locally-dirty docs
            if (store._dirtyDocIds.has(updated.id)) return;
            useAppStore.setState(s => ({
              documents: s.documents.map(d => d.id === updated.id ? updated : d)
            }));
          } else if (payload.eventType === 'DELETE') {
            useAppStore.setState(s => ({
              documents: s.documents.filter(d => d.id !== (payload.old as any).id)
            }));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // ── URL sync ──────────────────────────────────────────────────
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

  // ── Cloud sync: every 5s + immediately on doc switch ──────────
  useEffect(() => {
    if (!session || !activeDocumentId) return;

    const interval = setInterval(async () => {
      const store = useAppStore.getState();
      if (store._dirtyDocIds.size > 0) {
        isSyncingToCloud.current = true;
        await store.syncAllDirty();
        setTimeout(() => { isSyncingToCloud.current = false; }, 500);
      }
    }, 5000);

    return () => {
      // Sync immediately when leaving a document
      const store = useAppStore.getState();
      if (store._dirtyDocIds.has(activeDocumentId)) {
        isSyncingToCloud.current = true;
        store.syncToCloud(activeDocumentId).then(() => {
          store._dirtyDocIds.delete(activeDocumentId);
          setTimeout(() => { isSyncingToCloud.current = false; }, 500);
        });
      }
      clearInterval(interval);
    };
  }, [activeDocumentId, session]);

  // ── Render states ─────────────────────────────────────────────
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
    return (
      <LockScreen
        title="Take wins"
        pinHash={ls.pin}
        biometricEnabled={ls.biometric}
        onUnlock={() => setIsAppLocked(false)}
      />
    );
  }

  const activeTitle = documents.find(d => d.id === activeDocumentId)?.title;

  return (
    <div className="app-container">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="app-main">
        <div className="mobile-header">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="mobile-menu-btn"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <span className="mobile-header-title">
            {activeTitle || 'Take wins'}
          </span>
          <button
            onClick={handleRefresh}
            className="mobile-menu-btn"
            aria-label="Sync"
            style={{ opacity: isSyncing ? 0.5 : 1 }}
          >
            <RefreshCw size={18} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
        <Editor />
      </main>
    </div>
  );
}

export default App;
