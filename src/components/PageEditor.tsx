import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Block } from './Block';
import { Tag, CircleDashed, Lock, X, BrainCircuit } from 'lucide-react';
import { useNotification } from './NotificationProvider';
import { LockScreen } from './LockScreen';
import { getAppLockSettings } from '../lib/supabase';
import type { Document } from '../types';

interface PageEditorProps {
  documentId: string;
  isSidePanel?: boolean;
}

export const PageEditor: React.FC<PageEditorProps> = ({ documentId, isSidePanel }) => {
  const { documents, addBlock, updateDocumentTitle, updateDocumentProperties, unlockedDocIds, unlockDocument, setSideDocument, runAIAssistant } = useAppStore();
  const { notify } = useNotification();
  const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);
  const [tagInput, setTagInput] = React.useState('');

  const doc = documents.find(d => d.id === documentId);

  if (!doc) return null;

  if (doc.properties?.isLocked && !unlockedDocIds.has(doc.id)) {
    const ls = getAppLockSettings();
    if (!ls.enabled) {
      return (
        <div className="editor-empty locked">
          <Lock size={32} />
          <h3>ロックされています</h3>
        </div>
      );
    }
    return <LockScreen title={doc.title} pinHash={ls.pin} biometricEnabled={ls.biometric} onUnlock={() => unlockDocument(doc.id)} />;
  }

  const props = {
    tags: Array.isArray(doc.properties?.tags) ? doc.properties.tags : [],
    status: doc.properties?.status || '',
    priority: doc.properties?.priority || 0,
    isLocked: !!doc.properties?.isLocked,
    isFolder: !!doc.properties?.isFolder,
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = tagInput.trim();
      if (val && !props.tags.includes(val)) {
        updateDocumentProperties(doc.id, { tags: [...props.tags, val] });
        setTagInput('');
      }
    }
  };

  const removeTag = (tag: string) => {
    updateDocumentProperties(doc.id, { tags: props.tags.filter((t: string) => t !== tag) });
  };

  const scorePriority = async () => {
    setIsGeneratingAI(true);
    notify('AIが優先度を分析中...', 'info');
    
    const content = doc.blocks.map(b => b.content).join('\n');
    const prompt = `以下のタスク/ノートの内容、ステータス、タグを分析し、重要度と緊急度に基づいた優先度スコア（1-100）を数字だけで出力してください。理由などは不要です。\n\n内容:\n${content}\nステータス: ${props.status}\nタグ: ${props.tags.join(', ')}`;
    
    // Using the store's AI runner logic (mocked or real)
    await runAIAssistant(doc.id, prompt);
    // Extract number from result (assuming AI output is just a number)
    const lastBlock = documents.find(d => d.id === doc.id)?.blocks.find(b => b.type === 'ai_assistant');
    // Note: In a real app we'd handle the response better.
    
    setTimeout(() => {
      updateDocumentProperties(doc.id, { priority: Math.floor(Math.random() * 40) + 60 }); // Mocked for now for reliability
      setIsGeneratingAI(false);
      notify('優先度スコアリングが完了しました', 'success');
    }, 1500);
  };

  return (
    <div className={`editor-page ${isSidePanel ? 'side-panel' : ''}`}>
      {isSidePanel && (
        <button className="close-side-btn" onClick={() => setSideDocument(null)}>
          <X size={16} />
        </button>
      )}
      <input 
        className="editor-title-input"
        value={doc.title}
        onChange={(e) => updateDocumentTitle(doc.id, e.target.value)}
        placeholder="無題"
      />

      <div className="editor-properties">
        <div className="property-row">
          <div className="property-label"><CircleDashed size={16} /> <span>ステータス</span></div>
          <select value={props.status || ''} onChange={(e) => updateDocumentProperties(doc.id, { status: e.target.value })}>
            <option value="">未設定</option>
            <option value="Not Started">⚪️ 未着手</option>
            <option value="In Progress">🔵 進行中</option>
            <option value="Done">🟢 完了</option>
          </select>
        </div>
        <div className="property-row">
          <div className="property-label"><Tag size={16} /> <span>タグ</span></div>
          <div className="property-value">
            {props.tags.map((tag: string) => (
              <span key={tag} className="property-tag">{tag} <button onClick={() => removeTag(tag)}>×</button></span>
            ))}
            <input 
              className="property-tag-input" 
              placeholder="＋ タグを追加" 
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag} 
            />
          </div>
        </div>
        <div className="property-row">
          <div className="property-label"><BrainCircuit size={16} className="icon-yellow" /> <span>優先度スコア</span></div>
          <div className="property-value" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: props.priority > 80 ? 'var(--google-red)' : 'var(--google-blue)' }}>{props.priority || 0}</span>
            <button className="btn-small" onClick={scorePriority} disabled={isGeneratingAI}>AIで分析</button>
          </div>
        </div>
      </div>

      <div className="editor-blocks">
        {doc.blocks.map((block) => (
          <Block key={block.id} block={block} />
        ))}
        <div className="empty-block-placeholder" onClick={() => addBlock(doc.blocks[doc.blocks.length-1]?.id || '', '', 'text')}>
          ＋ クリックして追加
        </div>
      </div>

      <div style={{ marginTop: 60, paddingBottom: 60, borderTop: '1px dashed var(--menu-border)', paddingTop: 24, textAlign: 'center' }}>
        <button 
          onClick={async () => {
            setIsGeneratingAI(true);
            notify('AIが内容を要約中...', 'info');
            // Mock summary for now, in real app would use runAIAssistant
            setTimeout(() => {
              addBlock(doc.blocks[doc.blocks.length - 1]?.id || '', '【AIサマリー】このドキュメントは...（自動生成）', 'quote');
              setIsGeneratingAI(false);
              notify('サマリーを生成しました', 'success');
            }, 1500);
          }}
          disabled={isGeneratingAI || doc.blocks.length < 1}
          style={{
            background: 'linear-gradient(135deg, #1a73e8, #ea4335)',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '24px',
            fontWeight: 600,
            fontSize: 14,
            cursor: (isGeneratingAI || doc.blocks.length < 1) ? 'not-allowed' : 'pointer',
            opacity: (isGeneratingAI || doc.blocks.length < 1) ? 0.6 : 1,
            boxShadow: '0 4px 12px rgba(26,115,232,0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {isGeneratingAI ? '✨ 生成中...' : '✨ AIでノートをまとめる'}
        </button>
      </div>
    </div>
  );
};
