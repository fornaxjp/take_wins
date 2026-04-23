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

        {/* Properties Section */}
        <div className="editor-properties">
          <div className="property-row">
            <div className="property-label">
              <CircleDashed size={16} /> ステータス
            </div>
            <div className="property-value">
              <select 
                value={props.status || ''} 
                onChange={(e) => updateDocumentProperties(doc.id, { status: e.target.value || null })}
              >
                <option value="">未設定</option>
                <option value="Not Started">未着手</option>
                <option value="In Progress">進行中</option>
                <option value="Done">完了</option>
              </select>
            </div>
          </div>
          <div className="property-row">
            <div className="property-label">
              <Tag size={16} /> タグ
            </div>
            <div className="property-value tags-container">
              {props.tags.map(tag => (
                <span key={tag} className="property-tag">
                  {tag}
                  <button onClick={() => removeTag(tag)}>×</button>
                </span>
              ))}
              <input type="text" placeholder="タグを追加 (Enter)" onKeyDown={handleAddTag} className="tag-input" />
            </div>
          </div>
        </div>

        <div className="editor-blocks">
          {doc.blocks.map((block) => (
            <Block key={block.id} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
};
