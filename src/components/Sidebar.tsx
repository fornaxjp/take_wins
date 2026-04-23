import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FileText, Plus, Star, Trash2, ChevronRight, ChevronDown, Search } from 'lucide-react';
import type { Document } from '../types';
import { SettingsModal } from './SettingsModal';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { 
    documents, activeDocumentId, createDocument, selectDocument, 
    deleteDocument, toggleFavorite, setSortType, sortType, moveDocument 
  } = useAppStore();
  
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  let displayDocs = [...documents];
  
  // Sort
  if (sortType === 'date') {
    displayDocs.sort((a, b) => b.updatedAt - a.updatedAt);
  } else if (sortType === 'title') {
    displayDocs.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // Default / Custom / Tag sort logic requires order preservation
    displayDocs.sort((a, b) => a.order - b.order);
  }

  // Filter by search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    displayDocs = displayDocs.filter(d => {
      const titleMatch = (d.title || '無題のドキュメント').toLowerCase().includes(q);
      const tagMatch = d.properties?.tags?.some(t => t.toLowerCase().includes(q));
      return titleMatch || tagMatch;
    });
  }

  const favorites = displayDocs.filter(d => d.isFavorite);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, targetParentId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId && draggedId !== targetParentId) {
      if (sortType !== 'custom' || searchQuery) {
        alert("カスタム階層（検索なし）の時のみ移動可能です。");
        return;
      }
      moveDocument(draggedId, targetParentId);
    }
    setDraggedId(null);
  };

  const renderItem = (doc: Document, depth: number, isDraggable: boolean, hasChildren: boolean) => {
    const isExpanded = expanded[doc.id] || false;
    // When grouped by tag, we need unique keys since a doc can appear multiple times
    // But since renderItem is called inside a key-ed parent container in tag mode, doc.id is fine.
    // However, if we move it to root, we must ensure the parent handles keys.
    return (
      <div key={doc.id}>
        <div
          className={`sidebar-item ${activeDocumentId === doc.id ? 'active' : ''}`}
          style={{ paddingLeft: `${16 + depth * 12}px` }}
          draggable={isDraggable}
          onDragStart={(e) => handleDragStart(e, doc.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, doc.id)}
          onClick={() => {
            selectDocument(doc.id);
            if (window.innerWidth <= 768 && onClose) onClose();
          }}
        >
          <div 
            className="sidebar-expand-icon"
            onClick={(e) => hasChildren ? toggleExpand(doc.id, e) : undefined}
            style={{ opacity: hasChildren ? 1 : 0, cursor: hasChildren ? 'pointer' : 'default' }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <FileText size={16} className="sidebar-icon" />
          <span className="sidebar-item-title">{doc.title || '無題のドキュメント'}</span>
          <div className="sidebar-item-actions">
            <button onClick={(e) => { e.stopPropagation(); createDocument(doc.id); setExpanded(p => ({...p, [doc.id]: true})); }} title="子ページを追加">
              <Plus size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(doc.id); }} className={doc.isFavorite ? 'star-active' : ''} title="お気に入り">
              <Star size={14} />
            </button>
            <button className="action-trash" onClick={(e) => { e.stopPropagation(); deleteDocument(doc.id); }} title="削除">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        {(!searchQuery && sortType === 'custom') && isExpanded && renderDocTree(doc.id, depth + 1)}
      </div>
    );
  };

  const renderDocTree = (parentId: string | null, depth: number = 0) => {
    let children = displayDocs.filter(d => (d.parentId || null) === parentId);
    
    // If not custom sort OR if searching, force a flat list for private section
    if (sortType !== 'custom' || searchQuery) {
      if (parentId !== null) return null; // only render root
      children = displayDocs.filter(d => !d.isFavorite); // exclude favorites from private flat list
    }

    return children.map((doc) => {
      const hasChildren = (!searchQuery && sortType === 'custom') && documents.some(d => (d.parentId || null) === doc.id);
      const isDraggable = sortType === 'custom' && !searchQuery;
      return renderItem(doc, depth, isDraggable, hasChildren);
    });
  };

  const renderTagGroups = () => {
    const allTags = new Set<string>();
    displayDocs.forEach(d => {
      if (d.properties?.tags) {
        d.properties.tags.forEach(t => allTags.add(t));
      }
    });

    const tagsArray = Array.from(allTags).sort();
    
    return (
      <div className="tag-groups">
        {tagsArray.map(tag => {
          const docsWithTag = displayDocs.filter(d => !d.isFavorite && d.properties?.tags?.includes(tag));
          if (docsWithTag.length === 0) return null;
          
          return (
            <div key={tag} className="tag-group-section">
              <div className="sidebar-section-title" style={{ marginTop: 12, marginBottom: 4 }}>🏷️ {tag}</div>
              {docsWithTag.map(doc => renderItem(doc, 0, false, false))}
            </div>
          );
        })}
        
        {(() => {
          const untagged = displayDocs.filter(d => !d.isFavorite && (!d.properties?.tags || d.properties.tags.length === 0));
          if (untagged.length === 0) return null;
          return (
            <div key="untagged" className="tag-group-section">
              <div className="sidebar-section-title" style={{ marginTop: 12, marginBottom: 4 }}>🏷️ タグ未設定</div>
              {untagged.map(doc => renderItem(doc, 0, false, false))}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <>
    <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div 
          className="sidebar-user" 
          onClick={() => setShowSettings(true)} 
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="アカウント設定を開く"
        >
          ⚙️ 設定
        </div>
        <button onClick={() => createDocument(null)} className="sidebar-new-btn" title="新規ドキュメント">
          <Plus size={16} />
        </button>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <div className="sidebar-search">
        <Search size={14} className="sidebar-search-icon" />
        <input 
          type="text" 
          placeholder="タイトルやタグで検索..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="sidebar-sort">
        <select value={sortType} onChange={(e) => setSortType(e.target.value as any)}>
          <option value="custom">グループ階層（手動）</option>
          <option value="date">更新日順（一覧）</option>
          <option value="title">名前順（一覧）</option>
          <option value="tag">タグ別（グループ）</option>
        </select>
      </div>

      <div className="sidebar-section">
        {favorites.length > 0 && (
          <>
            <div className="sidebar-section-title">お気に入り</div>
            <div className="sidebar-list">
              {favorites.map((doc) => (
                 <div
                 key={`fav-${doc.id}`}
                 className={`sidebar-item ${activeDocumentId === doc.id ? 'active' : ''}`}
                 onClick={() => selectDocument(doc.id)}
                 style={{ paddingLeft: 16 }}
               >
                 <FileText size={16} className="sidebar-icon" />
                 <span className="sidebar-item-title">{doc.title || '無題のドキュメント'}</span>
               </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div 
        className="sidebar-section"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, null)}
        style={{ minHeight: '100px', flex: 1 }}
      >
        <div className="sidebar-section-title">プライベート</div>
        <div className="sidebar-list">
          {sortType === 'tag' ? renderTagGroups() : renderDocTree(null, 0)}
        </div>
      </div>
    </div>
    </>
  );
};
