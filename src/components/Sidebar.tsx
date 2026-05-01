import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getAppLockSettings } from '../lib/supabase';
import { FileText, Plus, Star, Trash2, ChevronRight, ChevronDown, Search, Settings, LayoutTemplate, History, Lock, Unlock, Columns } from 'lucide-react';
import type { Document } from '../types';
import { TemplateModal } from './TemplateModal';
import { BackupModal } from './BackupModal';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { 
    documents, activeDocumentId, createDocument, selectDocument, 
    deleteDocument, toggleFavorite, setSortType, sortType, moveDocument,
    setSettingsModalOpen, toggleDocumentLock, setSideDocument, sideDocumentId
  } = useAppStore();
  
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  let displayDocs = [...documents];
  if (sortType === 'date') displayDocs.sort((a, b) => b.updatedAt - a.updatedAt);
  else if (sortType === 'title') displayDocs.sort((a, b) => a.title.localeCompare(b.title));
  else displayDocs.sort((a, b) => a.order - b.order);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    displayDocs = displayDocs.filter(d => (d.title || '').toLowerCase().includes(q));
  }

  const favorites = displayDocs.filter(d => d.isFavorite);

  const getIconColorClass = (id: string) => {
    const colors = ['icon-blue', 'icon-red', 'icon-yellow', 'icon-green'];
    const charCodeSum = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId && draggedId !== targetId) {
      moveDocument(draggedId, targetId);
    }
    setDraggedId(null);
  };

  const createFolder = () => {
    const id = Math.random().toString(36).substring(2, 9);
    useAppStore.setState(s => {
      const newDoc: Document = { 
        id, title: '新しいフォルダ', blocks: [], isFavorite: false, 
        createdAt: Date.now(), updatedAt: Date.now(), order: s.documents.length, parentId: null,
        properties: { tags: [], status: null, isFolder: true }
      };
      s._dirtyDocIds.add(id);
      return { documents: [...s.documents, newDoc] };
    });
  };

  const renderItem = (doc: Document, depth: number) => {
    const isExpanded = expanded[doc.id] || false;
    const hasChildren = documents.some(d => d.parentId === doc.id);
    const isFolder = doc.properties?.isFolder;
    
    return (
      <div key={doc.id}
        draggable
        onDragStart={(e) => handleDragStart(e, doc.id)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, doc.id)}
      >
        <div className={`sidebar-item ${activeDocumentId === doc.id ? 'active' : ''}`} style={{ paddingLeft: `${16 + depth * 12}px` }}
          onClick={(e) => { 
            e.stopPropagation();
            if (isFolder) { toggleExpand(doc.id, e); }
            else { selectDocument(doc.id); if (window.innerWidth <= 768 && onClose) onClose(); }
          }}>
          <div className="sidebar-expand-icon" onClick={(e) => { e.stopPropagation(); toggleExpand(doc.id, e); }}>
            {(hasChildren || isFolder) ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
          </div>
          {isFolder ? (
            <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--placeholder-color)' }}>📁</div>
          ) : (
            <FileText size={18} className={`sidebar-icon ${getIconColorClass(doc.id)}`} />
          )}
          <span className="sidebar-item-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title || (isFolder ? '新しいフォルダ' : '無題のドキュメント')}</span>
          <div className="sidebar-item-actions">
            {!isFolder && <button onClick={(e) => { 
              e.stopPropagation(); 
              if (!doc.properties?.isLocked && !getAppLockSettings().enabled) {
                alert('ファイルにロックをかけるには、先に「設定」からアプリロック（PIN）を有効にしてください。');
                return;
              }
              toggleDocumentLock(doc.id); 
            }}>{doc.properties?.isLocked ? <Lock size={14} className="icon-red" /> : <Unlock size={14} />}</button>}
            {!isFolder && <button 
              className={sideDocumentId === doc.id ? 'active' : ''}
              onClick={(e) => { e.stopPropagation(); setSideDocument(sideDocumentId === doc.id ? null : doc.id); }}
              title="サイドパネルで開く"
            >
              <Columns size={14} className={sideDocumentId === doc.id ? 'icon-blue' : ''} />
            </button>}
            {!isFolder && <button onClick={(e) => { e.stopPropagation(); toggleFavorite(doc.id); }}><Star size={14} fill={doc.isFavorite ? "currentColor" : "none"} className={doc.isFavorite ? 'icon-yellow' : ''} /></button>}
            {isFolder && <button onClick={(e) => { e.stopPropagation(); createDocument(doc.id); setExpanded(p => ({...p, [doc.id]: true})); }}><Plus size={14} /></button>}
            <button onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}><Trash2 size={14} /></button>
          </div>
        </div>
        {isExpanded && renderDocTree(doc.id, depth + 1)}
      </div>
    );
  };

  const renderDocTree = (parentId: string | null, depth: number = 0) => {
    const children = displayDocs.filter(d => d.parentId === parentId);
    if (children.length === 0 && parentId !== null) {
      return <div style={{ padding: '4px 12px 4px ' + (36 + depth * 12) + 'px', fontSize: 11, opacity: 0.4, fontStyle: 'italic' }}>フォルダは空です</div>;
    }
    return children.map(doc => renderItem(doc, depth));
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div style={{ display: 'flex', gap: 2 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--google-blue)' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--google-red)' }} />
            </div>
            <span>Take wins</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '0 12px' }}>
          <button onClick={() => createDocument(null)} className="sidebar-new-btn-google" style={{ flex: 1, margin: '8px 0 8px', padding: '10px' }}>
            <Plus size={20} className="icon-blue" />
            <span>作成</span>
          </button>
          <button onClick={createFolder} className="sidebar-new-btn-google" style={{ flex: 1, margin: '8px 0 8px', padding: '10px' }}>
            <span style={{ fontSize: 16 }}>📁</span>
            <span>フォルダ</span>
          </button>
        </div>

        <div style={{ padding: '0 12px 16px' }}>
          <button 
            onClick={() => setIsTemplateModalOpen(true)} 
            style={{ width: '100%', padding: '10px', borderRadius: 20, border: '1px solid var(--menu-border)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 600, transition: 'background 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <LayoutTemplate size={16} className="icon-yellow" />
            テンプレートから作成
          </button>
        </div>

        <div className="sidebar-search-container">
          <label htmlFor="sidebar-search" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Search size={18} className="sidebar-search-icon" />
          </label>
          <input id="sidebar-search" type="text" placeholder="マイドキュメントを検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, null)}>
          <div className="sidebar-section-title">お気に入り</div>
          {favorites.length > 0 ? favorites.map(doc => renderItem(doc, 0)) : <div style={{ padding: '8px 24px', fontSize: 12, opacity: 0.5 }}>お気に入りはまだありません</div>}
          
          <div className="sidebar-section-title">マイドライブ</div>
          {renderDocTree(null, 0)}
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--menu-border)', padding: '12px' }}>
          <div className="sidebar-item" onClick={() => setIsBackupModalOpen(true)}>
            <History size={18} className="sidebar-icon" />
            <span className="sidebar-item-title">履歴と復元</span>
          </div>
          <div className="sidebar-item" onClick={() => { setSettingsModalOpen(true); if (onClose) onClose(); }}>
            <Settings size={18} className="sidebar-icon" />
            <span className="sidebar-item-title">設定とアカウント管理</span>
          </div>
        </div>
      </div>
      {isTemplateModalOpen && <TemplateModal onClose={() => setIsTemplateModalOpen(false)} />}
      {isBackupModalOpen && <BackupModal onClose={() => setIsBackupModalOpen(false)} />}
    </>
  );
};
