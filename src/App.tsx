import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore, createBackup } from './store/useAppStore';
import Editor from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { Auth } from './components/Auth';
import { LockScreen } from './components/LockScreen';
import { SettingsModal } from './components/SettingsModal';
import { supabase, getAppLockSettings } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Menu, RefreshCw } from 'lucide-react';

function App() {
  const {
    selectDocument, activeDocumentId, documents,
    syncAllDirty, setUserId, fetchFromCloud,
    clearDocuments, isReady, isSettingsModalOpen, setSettingsModalOpen,
    theme, fontFamily, fontSize
  } = useAppStore();

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle'|'syncing'|'done'|'error'>('idle');
  const loadedUidRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);

  // Apply theme and fonts to HTML element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.setProperty('--app-font-family', fontFamily);
    document.documentElement.style.setProperty('--app-font-size', fontSize);
  }, [theme, fontFamily, fontSize]);

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && session.user.id !== loadedUidRef.current) {
        loadedUidRef.current = session.user.id;
        setUserId(session.user.id);
        fetchFromCloud().then(() => { if (getAppLockSettings().enabled) setIsAppLocked(true); });
      } else if (!session) { setSession(null); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        if (session.user.id !== loadedUidRef.current) {
          loadedUidRef.current = session.user.id;
          setUserId(session.user.id);
          fetchFromCloud().then(() => { if (getAppLockSettings().enabled) setIsAppLocked(true); });
        }
      } else {
        loadedUidRef.current = null;
        clearDocuments();
        setIsAppLocked(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [setUserId, fetchFromCloud, clearDocuments]);

  useEffect(() => {
    if (!session || !activeDocumentId) return;
    
    // 5秒ごとのSupabase同期
    const syncInterval = setInterval(async () => {
      const store = useAppStore.getState();
      if (store._dirtyDocIds.size > 0 && !isSyncingRef.current) {
        isSyncingRef.current = true;
        try { await store.syncAllDirty(); } catch (e) { console.error(e); }
        finally { setTimeout(() => { isSyncingRef.current = false; }, 500); }
      }
    }, 5000);

    // 5分ごとのローカルバックアップ
    const backupInterval = setInterval(() => {
      const store = useAppStore.getState();
      if (store.userId && store.documents.length > 0) {
        createBackup(store.userId, store.documents);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearInterval(syncInterval);
      clearInterval(backupInterval);
    };
  }, [activeDocumentId, session]);

  if (session === undefined) return <div className="loading-spinner" />;
  if (!session) return <Auth />;
  if (!isReady) return <div className="loading-spinner" />;

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
          <button onClick={() => setIsSidebarOpen(true)} className="mobile-menu-btn"><Menu size={22} /></button>
          <div className="mobile-header-center">
            <span className="mobile-header-title">{activeTitle || 'Take wins'}</span>
            <span style={{ fontSize: '9px', opacity: 0.4, display: 'block' }}>v2.0.4</span>
          </div>
          <button onClick={handleSync} className="mobile-menu-btn" style={{ position: 'relative' }}>
            {syncStatus === 'syncing' ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <span style={{ fontSize: 16 }}>{syncIcon || <RefreshCw size={18} />}</span>}
          </button>
        </div>
        <Editor />
      </main>
      {isSettingsModalOpen && <SettingsModal onClose={() => setSettingsModalOpen(false)} />}
    </div>
  );
}

export default App;
