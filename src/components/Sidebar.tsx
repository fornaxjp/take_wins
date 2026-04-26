import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FileText, Plus, Star, Trash2, ChevronRight, ChevronDown, Search } from 'lucide-react';
import type { Document } from '../types';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { 
    documents, activeDocumentId, createDocument, selectDocument, 
    deleteDocument, toggleFavorite, setSortType, sortType, moveDocument,
    setSettingsModalOpen
  } = useAppStore();
  
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

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

  const renderItem = (doc: Document, depth: number) => {
    const isExpanded = expanded[doc.id] || false;
    const hasChildren = documents.some(d => d.parentId === doc.id);
    return (
      <div key={doc.id}>
        <div className={`sidebar-item ${activeDocumentId === doc.id ? 'active' : ''}`} style={{ paddingLeft: `${16 + depth * 12}px` }}
          onClick={() => { selectDocument(doc.id); if (window.innerWidth <= 768 && onClose) onClose(); }}>
          <div className="sidebar-expand-icon" onClick={(e) => { e.stopPropagation(); toggleExpand(doc.id, e); }}>
            {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
          </div>
          <FileText size={16} className="sidebar-icon" />
          <span className="sidebar-item-title">{doc.title || '無題'}</span>
          <div className="sidebar-item-actions">
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(doc.id); }}><Star size={14} className={doc.isFavorite ? 'star-active' : ''} /></button>
            <button onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }}><Trash2 size={14} /></button>
          </div>
        </div>
        {isExpanded && renderDocTree(doc.id, depth + 1)}
      </div>
    );
  };

  const renderDocTree = (parentId: string | null, depth: number = 0) => {
    return displayDocs.filter(d => d.parentId === parentId).map(doc => renderItem(doc, depth));
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-user" onClick={() => { setSettingsModalOpen(true); if (onClose) onClose(); }} style={{ cursor: 'pointer' }}>
            ⚙️ 設定
          </div>
          <button onClick={() => createDocument(null)} className="sidebar-new-btn"><Plus size={16} /></button>
        </div>
        <div className="sidebar-search">
          <Search size={14} className="sidebar-search-icon" />
          <input type="text" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="sidebar-section">
          <div className="sidebar-section-title">お気に入り</div>
          {favorites.map(doc => renderItem(doc, 0))}
          <div className="sidebar-section-title" style={{ marginTop: 16 }}>プライベート</div>
          {renderDocTree(null, 0)}
        </div>
      </div>
    </>
  );
};
