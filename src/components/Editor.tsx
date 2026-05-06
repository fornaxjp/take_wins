import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Block } from './Block';
import { Tag, CircleDashed, Lock } from 'lucide-react';
import { LockScreen } from './LockScreen';
import { getAppLockSettings } from '../lib/supabase';

import { PageEditor } from './PageEditor';
import { translations } from '../i18n';

export const Editor: React.FC = () => {
  const { documents, activeDocumentId, sideDocumentId, createDocument, selectDocument, language } = useAppStore();
  const t = (translations[language] || translations.ja).editor;

  useEffect(() => {
    if (!activeDocumentId && documents.length > 0) {
      selectDocument(documents[0].id);
    }
  }, [activeDocumentId, documents, selectDocument]);

  if (!activeDocumentId && documents.length === 0) {
    return (
      <div className="editor-empty">
        <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.8 }}>📄</div>
        <h2>{t.empty}</h2>
        <p>{t.noDocDesc}</p>
        <button className="btn-primary" onClick={() => createDocument(null)}>
          {t.createNew}
        </button>
      </div>
    );
  }

  return (
    <div className={`editor-multi-container ${sideDocumentId ? 'split' : ''}`}>
      <div className="editor-main-panel">
        {activeDocumentId ? (
          <PageEditor documentId={activeDocumentId} />
        ) : (
          <div className="editor-empty">{t.loading}</div>
        )}
      </div>
      {sideDocumentId && (
        <div className="editor-side-panel">
          <PageEditor documentId={sideDocumentId} isSidePanel />
        </div>
      )}
    </div>
  );
};

export default Editor;
