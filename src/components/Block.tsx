import React, { useRef, useEffect, useState } from 'react';
import type { KeyboardEvent, ChangeEvent } from 'react';
import { GripVertical, Play, Terminal, RefreshCw, Send, Sparkles, Globe, Timer as TimerIcon, OctagonAlert } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { translations } from '../i18n';
import type { Block as BlockTypeInterface } from '../types';
import { SlashMenu } from './SlashMenu';
import { useNotification } from './NotificationProvider';

interface BlockProps {
  block: BlockTypeInterface;
}

export const Block: React.FC<BlockProps> = ({ block }) => {
  const { 
    updateBlock, updateBlockType, updateBlockData, addBlock, removeBlock, 
    focusedBlockId, setFocusedBlockId, moveBlock, runCodeBlock, fetchLiveData, 
    runAIAssistant, toggleTimer, toggleBlocker, language 
  } = useAppStore();
  const t = translations[language].ai;
  const { notify } = useNotification();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const [slashMenu, setSlashMenu] = useState<{ x: number, y: number } | null>(null);
  const [isDraggable, setIsDraggable] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    let interval: any;
    if (block.timer?.isRunning) {
      interval = setInterval(() => {
        const current = block.timer!.elapsed + (Date.now() - block.timer!.startTime!);
        setTime(current);
      }, 100);
    } else {
      setTime(block.timer?.elapsed || 0);
    }
    return () => clearInterval(interval);
  }, [block.timer]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h > 0 ? h + ':' : ''}${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

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
      const el = inputRef.current;
      el.style.height = '0px'; // Temporarily shrink to get scrollHeight
      el.style.height = el.scrollHeight + 'px';
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
    // 日本語入力（IME変換）中のEnterキーは無視する
    if (e.nativeEvent.isComposing) return;

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
    } else if (e.key === 'ArrowUp' && inputRef.current?.selectionStart === 0) {
      e.preventDefault();
      const doc = useAppStore.getState().documents.find(d => d.id === useAppStore.getState().activeDocumentId);
      if (doc) {
        const idx = doc.blocks.findIndex(b => b.id === block.id);
        if (idx > 0) setFocusedBlockId(doc.blocks[idx - 1].id);
      }
    } else if (e.key === 'ArrowDown' && inputRef.current?.selectionEnd === block.content.length) {
      e.preventDefault();
      const doc = useAppStore.getState().documents.find(d => d.id === useAppStore.getState().activeDocumentId);
      if (doc) {
        const idx = doc.blocks.findIndex(b => b.id === block.id);
        if (idx < doc.blocks.length - 1) setFocusedBlockId(doc.blocks[idx + 1].id);
      }
    } else if (e.key === 'Backspace' && block.content === '') {
      e.preventDefault();
      setSlashMenu(null);
      if (block.type !== 'text') {
        updateBlockType(block.id, 'text');
      } else {
        const doc = useAppStore.getState().documents.find(d => d.id === useAppStore.getState().activeDocumentId);
        if (doc && doc.blocks.length > 1) {
          const idx = doc.blocks.findIndex(b => b.id === block.id);
          const prevId = idx > 0 ? doc.blocks[idx - 1].id : null;
          removeBlock(block.id);
          if (prevId) setFocusedBlockId(prevId);
        }
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

  const handleRunCode = async () => {
    notify('コードを実行中...', 'info');
    await runCodeBlock(block.id);
    notify('コードの実行が完了しました', 'success');
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

      <div className="block-side-actions">
        {(block.type === 'todo_list' || block.type === 'text') && (
          <button 
            className={`block-timer-btn ${block.timer?.isRunning ? 'running' : ''}`} 
            onClick={() => toggleTimer(block.id)}
            title="タイムトラッキング"
          >
            <TimerIcon size={14} />
            {time > 0 && <span>{formatTime(time)}</span>}
          </button>
        )}
        <button 
          className={`block-blocker-btn ${block.blocker?.isBlocked ? 'blocked' : ''}`}
          onClick={() => {
            const reason = block.blocker?.isBlocked ? '' : window.prompt('ブロッカーの理由を入力してください:');
            if (reason !== null) toggleBlocker(block.id, reason);
          }}
          title="ブロッカー管理"
        >
          <OctagonAlert size={14} />
        </button>
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
        ) : block.type === 'code' ? (
          <div className="block-code-container">
            <div className="block-code-header">
              <select 
                value={block.language || 'python'} 
                onChange={(e) => updateBlockData(block.id, { language: e.target.value })}
                className="code-lang-select"
              >
                <option value="python">Python</option>
                <option value="sql">SQL</option>
                <option value="r">R</option>
              </select>
              <button onClick={handleRunCode} className="code-run-btn">
                <Play size={14} fill="currentColor" />
                Run
              </button>
            </div>
            <textarea
              ref={inputRef}
              value={block.content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocusedBlockId(block.id)}
              className="block-content code-textarea"
              placeholder={placeholder}
              spellCheck={false}
            />
            {block.executionResult && (
              <div className={`code-result ${block.executionResult.error ? 'error' : ''}`}>
                <div className="code-result-header">
                  <Terminal size={12} />
                  <span>Output</span>
                </div>
                <pre>{block.executionResult.error || block.executionResult.output || 'No output'}</pre>
              </div>
            )}
          </div>
        ) : block.type === 'live_data' ? (
          <div className="block-live-data">
            <div className="live-data-config">
              <Globe size={14} className="icon-blue" />
              <input 
                placeholder="API URL (e.g. JSON API)" 
                value={block.data?.url || ''} 
                onChange={(e) => updateBlockData(block.id, { url: e.target.value })}
              />
              <input 
                placeholder="JSON Path (e.g. rate.usd)" 
                value={block.data?.path || ''} 
                onChange={(e) => updateBlockData(block.id, { path: e.target.value })}
              />
              <button onClick={() => fetchLiveData(block.id)}><RefreshCw size={14} /></button>
            </div>
            <div className="live-data-value">
              {block.content || 'データ未取得'}
            </div>
          </div>
        ) : block.type === 'ai_assistant' ? (
          <div className="block-ai-modern">
            <div className="ai-modern-inner">
              <Sparkles size={16} className="ai-sparkle-icon" />
              <textarea
                ref={inputRef}
                value={block.content}
                onChange={handleChange}
                onKeyDown={(e) => {
                  handleKeyDown(e);
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                   if (block.content.trim()) runAIAssistant(block.id, block.content);
                  }
                }}
                placeholder={t.placeholder}
                className="ai-textarea-modern"
                rows={1}
                disabled={block.executionResult?.output === t.thinking}
              />
              <button 
                onClick={() => runAIAssistant(block.id, block.content)} 
                className="ai-send-btn-modern"
                disabled={!block.content.trim() || block.executionResult?.output === t.thinking}
              >
                <Send size={14} />
              </button>
            </div>
            {block.executionResult && block.executionResult.output === t.thinking && (
              <div className="ai-loading-state">
                <div className="ai-shimmer"></div>
                <span>{t.thinking}</span>
              </div>
            )}
            {block.executionResult && block.executionResult.output !== t.thinking && (
              <div className="ai-stuck-recovery">
                <p>{t.stuck}</p>
                <div className="ai-output-preview">{block.executionResult.output.substring(0, 100)}...</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={() => runAIAssistant(block.id, block.content)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, background: '#8b5cf6', color: 'white', border: 'none', cursor: 'pointer' }}>{t.regenerate}</button>
                  <button onClick={() => removeBlock(block.id)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, background: 'var(--google-red)', color: 'white', border: 'none', cursor: 'pointer' }}>{t.delete}</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <textarea
            ref={inputRef}
            value={block.content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocusedBlockId(block.id)}
            className={`block-content ${block.data?.checked ? 'todo-checked' : ''}`}
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
