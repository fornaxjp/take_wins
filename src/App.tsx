import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';

function App() {
  const { selectDocument, activeDocumentId, documents, fetchFromCloud, syncToCloud, setUserId } = useAppStore();
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Authentication and initial fetch
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setUserId(session.user.id);
        fetchFromCloud();
      }
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setUserId(session.user.id);
        fetchFromCloud();
      } else {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchFromCloud, setUserId]);

  // Handle URL Syncing
  useEffect(() => {
    const pathId = window.location.pathname.slice(1);
    if (pathId && documents.some(d => d.id === pathId)) {
      selectDocument(pathId);
    }
  }, [selectDocument, documents.length]);

  useEffect(() => {
    if (activeDocumentId) {
      window.history.replaceState(null, '', `/${activeDocumentId}`);
      const activeDoc = documents.find(d => d.id === activeDocumentId);
      if (activeDoc) {
        document.title = activeDoc.title ? `${activeDoc.title} - Take wins` : '無題のドキュメント - Take wins';
      }
    } else {
      window.history.replaceState(null, '', `/`);
      document.title = 'Take wins';
    }
  }, [activeDocumentId, documents]);

  // Background Syncing
  useEffect(() => {
    if (!session || !activeDocumentId) return;
    
    // Debounce syncing to cloud to avoid spamming the DB on every keystroke
    const timeoutId = setTimeout(() => {
      syncToCloud(activeDocumentId);
    }, 1500); // 1.5秒間操作がなければクラウドに保存

    return () => clearTimeout(timeoutId);
  }, [documents, activeDocumentId, session, syncToCloud]);

  if (isInitializing) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>読み込み中...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="app-main">
        <Editor />
      </main>
    </div>
  );
}

export default App;
