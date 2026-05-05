import React, { useEffect, useRef, useState } from 'react';
import { Type, Heading1, Heading2, Heading3, List, CheckSquare, Quote, Minus, Code, Table as TableIcon, Globe, Sparkles } from 'lucide-react';
import type { BlockType } from '../types';

interface SlashMenuProps {
  x: number;
  y: number;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

const menuItems: { type: BlockType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { type: 'text', label: 'テキスト', desc: '通常の文章', icon: <Type size={16} />, color: '#5f6368' },
  { type: 'h1', label: '見出し 1', desc: '大きな見出し', icon: <Heading1 size={16} />, color: '#1a73e8' },
  { type: 'h2', label: '見出し 2', desc: '中くらいの見出し', icon: <Heading2 size={16} />, color: '#1a73e8' },
  { type: 'h3', label: '見出し 3', desc: '小さな見出し', icon: <Heading3 size={16} />, color: '#1a73e8' },
  { type: 'bullet_list', label: 'リスト', desc: '箇条書き', icon: <List size={16} />, color: '#34a853' },
  { type: 'todo_list', label: 'ToDo', desc: 'チェックリスト', icon: <CheckSquare size={16} />, color: '#34a853' },
  { type: 'quote', label: '引用', desc: '引用ブロック', icon: <Quote size={16} />, color: '#fbbc04' },
  { type: 'code', label: 'コード', desc: '実行可能コードブロック', icon: <Code size={16} />, color: '#ea4335' },
  { type: 'table', label: 'テーブル', desc: '表を挿入', icon: <TableIcon size={16} />, color: '#5f6368' },
  { type: 'divider', label: '区切り線', desc: 'セクション区切り', icon: <Minus size={16} />, color: '#9aa0a6' },
  { type: 'live_data', label: 'ライブデータ', desc: '株価・APIデータ', icon: <Globe size={16} />, color: '#1a73e8' },
  { type: 'ai_assistant', label: 'AI アシスタント', desc: 'AIに質問・執筆依頼', icon: <Sparkles size={16} />, color: '#8b5cf6' },
];

export const SlashMenu: React.FC<SlashMenuProps> = ({ x, y, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % menuItems.length); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + menuItems.length) % menuItems.length); }
      if (e.key === 'Enter') { e.preventDefault(); onSelect(menuItems[activeIdx].type); }
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [activeIdx, onSelect, onClose]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Smart positioning: keep menu on screen
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 320),
    top: y + 8,
    zIndex: 9999,
  };

  return (
    <div ref={menuRef} style={menuStyle} className="slash-menu-modern">
      <div className="slash-menu-label">ブロックを挿入</div>
      {menuItems.map((item, idx) => (
        <button
          key={item.type}
          className={`slash-menu-row ${idx === activeIdx ? 'active' : ''}`}
          onMouseEnter={() => setActiveIdx(idx)}
          onClick={() => onSelect(item.type)}
        >
          <span className="slash-menu-icon-wrap" style={{ background: item.color + '18', color: item.color }}>
            {item.icon}
          </span>
          <span className="slash-menu-text">
            <span className="slash-menu-name">{item.label}</span>
            <span className="slash-menu-desc">{item.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
};
