import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Menu } from 'lucide-react';

function App() {
  const {
    selectDocument, activeDocumentId, documents,
    syncToCloud, setUserId, fetchFromCloud, clearDocuments, isReady
  } = useAppStore();

  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = not checked yet
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Step 1: Check auth once on mount
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

  // Step 2: URL sync only after data is ready
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
      if (activeDoc) {
        document.title = activeDoc.title ? `${activeDoc.title} - Take wins` : '無題のドキュメント - Take wins';
      }
    } else {
      window.history.replaceState(null, '', '/');
      document.title = 'Take wins';
    }
  }, [activeDocumentId, documents]);

  // Step 3: Background cloud sync (debounced)
  useEffect(() => {
    if (!session || !activeDocumentId) return;
    const timeoutId = setTimeout(() => {
      syncToCloud(activeDocumentId);
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [documents, activeDocumentId, session]);

  // === Render states ===

  // Auth not checked yet — show blank screen (never show content)
  if (session === undefined) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  // Not logged in — show login screen
  if (!session) {
    return <Auth />;
  }

  // Logged in but still fetching documents
  if (!isReady) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  // All good — show the app
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
