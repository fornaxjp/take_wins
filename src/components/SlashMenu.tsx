import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Type, Heading1, Heading2, Heading3, List, CheckSquare, Quote, Minus, Code, Table as TableIcon, Globe, Sparkles } from 'lucide-react';
import type { BlockType } from '../types';
import { translations } from '../i18n';
import { useAppStore } from '../store/useAppStore';

interface SlashMenuProps {
  x: number;
  y: number;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({ x, y, onSelect, onClose }) => {
  const { language } = useAppStore();
  const t = translations[language].slashMenu;

  const menuItems: { type: BlockType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    { type: 'text', label: t.text, desc: t.textDesc, icon: <Type size={16} />, color: '#5f6368' },
    { type: 'h1', label: t.h1, desc: t.h1Desc, icon: <Heading1 size={16} />, color: '#1a73e8' },
    { type: 'h2', label: t.h2, desc: t.h2Desc, icon: <Heading2 size={16} />, color: '#1a73e8' },
    { type: 'h3', label: t.h3, desc: t.h3Desc, icon: <Heading3 size={16} />, color: '#1a73e8' },
    { type: 'bullet_list', label: t.list, desc: t.listDesc, icon: <List size={16} />, color: '#34a853' },
    { type: 'todo_list', label: t.todo, desc: t.todoDesc, icon: <CheckSquare size={16} />, color: '#34a853' },
    { type: 'quote', label: t.quote, desc: t.quoteDesc, icon: <Quote size={16} />, color: '#fbbc04' },
    { type: 'code', label: t.code, desc: t.codeDesc, icon: <Code size={16} />, color: '#ea4335' },
    { type: 'table', label: t.table, desc: t.tableDesc, icon: <TableIcon size={16} />, color: '#5f6368' },
    { type: 'divider', label: t.divider, desc: t.dividerDesc, icon: <Minus size={16} />, color: '#9aa0a6' },
    { type: 'live_data', label: t.liveData, desc: t.liveDataDesc, icon: <Globe size={16} />, color: '#1a73e8' },
    { type: 'ai_assistant', label: t.aiAssistant, desc: t.aiAssistantDesc, icon: <Sparkles size={16} />, color: '#8b5cf6' },
  ];

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

  const [adjustedTop, setAdjustedTop] = useState(y + 8);

  useEffect(() => {
    if (menuRef.current) {
      const height = menuRef.current.offsetHeight;
      if (y + 8 + height > window.innerHeight) {
        setAdjustedTop(Math.max(8, y - height - 32)); // Adjust upwards if overflowing
      } else {
        setAdjustedTop(y + 8);
      }
    }
  }, [y]);

  // Smart positioning: keep menu on screen
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 320),
    top: adjustedTop,
    zIndex: 9999,
  };

  return createPortal(
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
    </div>,
    document.body
  );
};
