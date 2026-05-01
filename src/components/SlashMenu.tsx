import React, { useEffect, useRef } from 'react';
import { Type, Heading1, Heading2, Heading3, List, CheckSquare, Quote, Minus, Code, Table as TableIcon, Globe, Sparkles } from 'lucide-react';
import type { BlockType } from '../types';

interface SlashMenuProps {
  x: number;
  y: number;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({ x, y, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const menuItems: { type: BlockType; label: string; icon: React.ReactNode }[] = [
    { type: 'text', label: 'テキスト', icon: <Type size={14} /> },
    { type: 'h1', label: '見出し 1', icon: <Heading1 size={14} /> },
    { type: 'h2', label: '見出し 2', icon: <Heading2 size={14} /> },
    { type: 'h3', label: '見出し 3', icon: <Heading3 size={14} /> },
    { type: 'bullet_list', label: '箇条書きリスト', icon: <List size={14} /> },
    { type: 'todo_list', label: 'ToDo リスト', icon: <CheckSquare size={14} /> },
    { type: 'quote', label: '引用', icon: <Quote size={14} /> },
    { type: 'divider', label: '区切り線', icon: <Minus size={14} /> },
    { type: 'code', label: '実行可能コード', icon: <Code size={14} /> },
    { type: 'table', label: 'テーブル', icon: <TableIcon size={14} /> },
    { type: 'live_data', label: 'ライブデータ (株価等)', icon: <Globe size={14} /> },
    { type: 'ai_assistant', label: 'AI アシスタント', icon: <Sparkles size={14} /> },
  ];

  return (
    <div 
      className="slash-menu"
      ref={menuRef}
      style={{ left: x, top: y }}
    >
      <div className="slash-menu-header">基本ブロック</div>
      {menuItems.map(item => (
        <button 
          key={item.type}
          className="slash-menu-item"
          onClick={() => onSelect(item.type)}
        >
          <div className="slash-menu-icon">{item.icon}</div>
          {item.label}
        </button>
      ))}
    </div>
  );
};
