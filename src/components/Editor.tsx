import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Block } from './Block';
import { Tag, CircleDashed } from 'lucide-react';

export const Editor: React.FC = () => {
  const { documents, activeDocumentId, addBlock, updateDocumentTitle, selectDocument, updateDocumentProperties } = useAppStore();

  const doc = documents.find(d => d.id === activeDocumentId);

  useEffect(() => {
    if (!activeDocumentId && documents.length > 0) {
      selectDocument(documents[0].id);
    }
  }, [activeDocumentId, documents, selectDocument]);

  if (!doc) {
    return (
      <div className="editor-empty">
        ドキュメントがありません。左のメニューから作成してください。
      </div>
    );
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('editor-container') || target.classList.contains('editor-page')) {
      const lastBlock = doc.blocks[doc.blocks.length - 1];
      if (lastBlock && lastBlock.content !== '') {
         addBlock(lastBlock.id);
      }
    }
  };

  const props = doc.properties || { tags: [], status: null };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = e.currentTarget.value.trim();
      if (val && !props.tags.includes(val)) {
        updateDocumentProperties(doc.id, { tags: [...props.tags, val] });
        e.currentTarget.value = '';
      }
    }
  };

  const removeTag = (tag: string) => {
    updateDocumentProperties(doc.id, { tags: props.tags.filter(t => t !== tag) });
  };

  return (
    <div className="editor-container" onClick={handleContainerClick}>
      <div className="editor-page">
        <input 
          className="editor-title-input"
          value={doc.title}
          onChange={(e) => updateDocumentTitle(doc.id, e.target.value)}
          placeholder="無題のドキュメント"
        />

        <div className="editor-properties">
          <div className="property-row">
            <div className="property-label">
              <CircleDashed size={18} className="icon-blue" />
              <span>ステータス</span>
            </div>
            <div className="property-value">
              <select 
                style={{ 
                  background: 'var(--hover-bg)', 
                  border: 'none', 
                  padding: '6px 12px', 
                  borderRadius: '12px', 
                  fontSize: '13px',
                  color: 'var(--text-color)',
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer'
                }}
                value={props.status || ''} 
                onChange={(e) => updateDocumentProperties(doc.id, { status: e.target.value || null })}
              >
                <option value="">未設定</option>
                <option value="Not Started">⚪️ 未着手</option>
                <option value="In Progress">🔵 進行中</option>
                <option value="Done">🟢 完了</option>
              </select>
            </div>
          </div>
          <div className="property-row">
            <div className="property-label">
              <Tag size={18} className="icon-green" />
              <span>タグ</span>
            </div>
            <div className="property-value" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {props.tags.map(tag => (
                <span key={tag} className="property-tag">
                  {tag}
                  <button onClick={() => removeTag(tag)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center' }}>×</button>
                </span>
              ))}
              <input 
                type="text" 
                placeholder="＋ タグを追加" 
                onKeyDown={handleAddTag} 
                style={{ 
                  background: 'transparent', 
                  border: 'none',
                  borderBottom: '1px solid transparent',
                  padding: '4px 0', 
                  fontSize: '13px',
                  color: 'var(--text-color)',
                  outline: 'none',
                  width: '120px',
                  transition: 'border-color 0.2s'
                }} 
                onFocus={(e) => e.target.style.borderBottomColor = 'var(--google-blue)'}
                onBlur={(e) => e.target.style.borderBottomColor = 'transparent'}
              />
            </div>
          </div>
        </div>

        <div className="editor-blocks" style={{ marginTop: 20 }}>
          {doc.blocks.map((block) => (
            <Block key={block.id} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Editor;
