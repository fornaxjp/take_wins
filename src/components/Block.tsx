import React, { useRef, useEffect, useState } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Block as BlockTypeInterface } from '../types';
import { SlashMenu } from './SlashMenu';

interface BlockProps {
  block: BlockTypeInterface;
}

export const Block: React.FC<BlockProps> = ({ block }) => {
  const { updateBlock, updateBlockType, updateBlockData, addBlock, removeBlock, focusedBlockId, setFocusedBlockId, moveBlock } = useAppStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const [slashMenu, setSlashMenu] = useState<{ x: number, y: number } | null>(null);
  const [isDraggable, setIsDraggable] = useState(false);

  useEffect(() => {
    if (focusedBlockId === block.id) {
      if (block.type === 'divider' && dividerRef.current) {
        dividerRef.current.focus();
      } else if (block.type !== 'table' && inputRef.current) {
        inputRef.current.focus();
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }
  }, [focusedBlockId, block.id, block.type]);

  const adjustHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [block.content, block.type]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    updateBlock(block.id, val);

    if (val === '# ') { updateBlockType(block.id, 'h1'); updateBlock(block.id, ''); setSlashMenu(null); return; }
    if (val === '## ') { updateBlockType(block.id, 'h2'); updateBlock(block.id, ''); setSlashMenu(null); return; }
    if (val === '### ') { updateBlockType(block.id, 'h3'); updateBlock(block.id, ''); setSlashMenu(null); return; }
    if (val === '- ') { updateBlockType(block.id, 'bullet_list'); updateBlock(block.id, ''); setSlashMenu(null); return; }
    if (val === '[] ') { updateBlockType(block.id, 'todo_list'); updateBlock(block.id, ''); setSlashMenu(null); return; }
    if (val === '> ') { updateBlockType(block.id, 'quote'); updateBlock(block.id, ''); setSlashMenu(null); return; }
    if (val === '---') { 
      updateBlockType(block.id, 'divider'); 
      updateBlock(block.id, ''); 
      setSlashMenu(null); 
      addBlock(block.id, '', 'text'); // 自動で次の行を追加
      return; 
    }
    if (val === '```') { updateBlockType(block.id, 'code'); updateBlock(block.id, ''); setSlashMenu(null); return; }

    if (val === '/') {
      const rect = e.target.getBoundingClientRect();
      setSlashMenu({ x: rect.left, y: rect.bottom + 4 });
    } else {
      setSlashMenu(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (block.type === 'code') return;
      e.preventDefault();
      setSlashMenu(null);

      if ((block.type === 'bullet_list' || block.type === 'todo_list' || block.type === 'quote') && block.content === '') {
        updateBlockType(block.id, 'text');
        return;
      }

      const nextType = (block.type === 'bullet_list' || block.type === 'todo_list') ? block.type : 'text';
      addBlock(block.id, '', nextType);
    } else if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      setSlashMenu(null);
      if (block.type !== 'text') {
        updateBlockType(block.id, 'text');
      } else {
        removeBlock(block.id);
      }
    }
  };

  const handleSelectSlashMenuItem = (type: BlockTypeInterface['type']) => {
    updateBlockType(block.id, type);
    updateBlock(block.id, '');
    setSlashMenu(null);
    if (type === 'table') {
      updateBlockData(block.id, { rows: 2, cols: 2, cells: [['', ''], ['', '']] });
    } else if (type === 'divider') {
      addBlock(block.id, '', 'text'); // 自動で次の行を追加
      return;
    }
    // フォーカスを当て直す
    if (type !== 'table') {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', block.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragId = e.dataTransfer.getData('text/plain');
    if (dragId && dragId !== block.id) {
      moveBlock(dragId, block.id);
    }
    setIsDraggable(false);
  };

  const updateTableCell = (rIndex: number, cIndex: number, val: string) => {
    const data = block.data || { cells: [] };
    const newCells = data.cells.map((row: string[], r: number) => 
      r === rIndex ? row.map((cell: string, c: number) => c === cIndex ? val : cell) : row
    );
    updateBlockData(block.id, { cells: newCells });
  };

  const addTableRow = () => {
    const data = block.data || { cols: 2, cells: [] };
    const newRow = Array(data.cols).fill('');
    updateBlockData(block.id, { rows: (data.rows || 2) + 1, cells: [...data.cells, newRow] });
  };

  const addTableCol = () => {
    const data = block.data || { rows: 2, cells: [] };
    const newCells = data.cells.map((row: string[]) => [...row, '']);
    updateBlockData(block.id, { cols: (data.cols || 2) + 1, cells: newCells });
  };

  let placeholder = "コマンドは '/' を入力";
  if (block.type === 'h1') placeholder = "見出し 1";
  if (block.type === 'h2') placeholder = "見出し 2";
  if (block.type === 'h3') placeholder = "見出し 3";
  if (block.type === 'bullet_list') placeholder = "リスト";
  if (block.type === 'todo_list') placeholder = "ToDo";
  if (block.type === 'quote') placeholder = "引用...";
  if (block.type === 'code') placeholder = "コードを入力...";

  return (
    <div 
      className={`block-wrapper block-${block.type}`}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div 
        className="block-drag-handle"
        onMouseEnter={() => setIsDraggable(true)}
        onMouseLeave={() => setIsDraggable(false)}
      >
        <GripVertical size={16} />
      </div>
      
      <div className="block-content-area">
        {block.type === 'bullet_list' && <span className="bullet-dot">•</span>}
        {block.type === 'todo_list' && (
          <input 
            type="checkbox" 
            className="todo-checkbox"
            checked={block.data?.checked || false}
            onChange={(e) => updateBlockData(block.id, { checked: e.target.checked })}
          />
        )}
        
        {block.type === 'divider' ? (
          <div 
            className="block-divider" 
            tabIndex={0} 
            ref={dividerRef}
            onClick={() => setFocusedBlockId(block.id)}
            onKeyDown={(e) => { 
              if(e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                removeBlock(block.id);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                addBlock(block.id, '', 'text');
              }
            }}
          >
            <hr />
          </div>
        ) : block.type === 'table' ? (
          <div className="block-table-wrapper">
            <table className="block-table">
              <tbody>
                {(block.data?.cells || [['', ''], ['', '']]).map((row: string[], rIndex: number) => (
                  <tr key={rIndex}>
                    {row.map((cell: string, cIndex: number) => (
                      <td key={cIndex}>
                        <input 
                          value={cell} 
                          onChange={(e) => updateTableCell(rIndex, cIndex, e.target.value)}
                          placeholder="空のセル"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="block-table-actions">
              <button onClick={addTableRow}>行を追加</button>
              <button onClick={addTableCol}>列を追加</button>
              <button onClick={() => removeBlock(block.id)} className="danger">テーブル削除</button>
            </div>
          </div>
        ) : (
          <textarea
            ref={inputRef}
            value={block.content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocusedBlockId(block.id)}
            className={`block-input ${block.data?.checked ? 'todo-checked' : ''}`}
            placeholder={placeholder}
            rows={1}
            spellCheck={false}
          />
        )}
      </div>

      {slashMenu && (
        <SlashMenu
          x={slashMenu.x}
          y={slashMenu.y}
          onSelect={handleSelectSlashMenuItem}
          onClose={() => setSlashMenu(null)}
        />
      )}
    </div>
  );
};
