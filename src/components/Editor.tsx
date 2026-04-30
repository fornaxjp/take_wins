import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Block } from './Block';
import { Tag, CircleDashed } from 'lucide-react';

export const Editor: React.FC = () => {
  const { documents, activeDocumentId, addBlock, updateDocumentTitle, selectDocument, updateDocumentProperties, updateBlockData, createDocument } = useAppStore();
  const [isGeneratingAI, setIsGeneratingAI] = React.useState(false);

  const doc = documents.find(d => d.id === activeDocumentId);

  useEffect(() => {
    if (!activeDocumentId && documents.length > 0) {
      selectDocument(documents[0].id);
    }
  }, [activeDocumentId, documents, selectDocument]);

  if (!doc) {
    return (
      <div className="editor-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--placeholder-color)' }}>
        <div style={{ fontSize: 64, marginBottom: 24, opacity: 0.8 }}>📄</div>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-color)', marginBottom: 8 }}>ドキュメントがありません</h2>
        <p style={{ fontSize: 16, marginBottom: 32 }}>左のメニューから新しいドキュメントを作成するか、テンプレートを選択してください。</p>
        <button className="btn-primary" onClick={() => createDocument(null)}>
          ＋ 新しいドキュメントを作成
        </button>
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

  const generateAISummary = () => {
    setIsGeneratingAI(true);
    setTimeout(() => {
      const summaryText = "【AI サマリー】\nこのドキュメントは " + doc.blocks.length + " 個のブロックで構成されています。重要なポイントとして、タグ「" + (props.tags.join(', ') || 'なし') + "」が設定されています。全体の進捗状況は「" + (props.status || '未設定') + "」です。";
      addBlock(doc.blocks[doc.blocks.length - 1]?.id || '', summaryText, 'quote');
      setIsGeneratingAI(false);
    }, 1500);
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

        <div style={{ fontSize: 13, color: 'var(--placeholder-color)', marginBottom: 24, marginTop: -16, fontWeight: 500 }}>
          最終更新: {new Date(doc.updatedAt).toLocaleString('ja-JP')}
        </div>

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
              {props.tags.map((tag: string) => (
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
          {doc.blocks.length === 0 ? (
            <div className="empty-block-placeholder" onClick={() => addBlock(doc.id, '', 'text')} style={{ color: 'var(--placeholder-color)', cursor: 'text', padding: '12px 0' }}>
               ここをクリックして入力を開始するか、'/' でコマンドを開く
            </div>
          ) : (
            doc.blocks.map((block) => (
              <Block key={block.id} block={block} />
            ))
          )}
        </div>

        <div style={{ marginTop: 60, paddingBottom: 60, borderTop: '1px dashed var(--menu-border)', paddingTop: 24, textAlign: 'center' }}>
          <button 
            onClick={generateAISummary}
            disabled={isGeneratingAI || doc.blocks.length < 2}
            style={{
              background: 'linear-gradient(135deg, #1a73e8, #ea4335)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '24px',
              fontWeight: 600,
              fontSize: 14,
              cursor: (isGeneratingAI || doc.blocks.length < 2) ? 'not-allowed' : 'pointer',
              opacity: (isGeneratingAI || doc.blocks.length < 2) ? 0.6 : 1,
              boxShadow: '0 4px 12px rgba(26,115,232,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'transform 0.2s'
            }}
          >
            {isGeneratingAI ? '✨ サマリーを生成中...' : '✨ AIでノートをまとめる'}
          </button>
          {doc.blocks.length < 2 && <div style={{ fontSize: 12, color: 'var(--placeholder-color)', marginTop: 8 }}>※内容が少ないためAIを使用できません</div>}
        </div>
      </div>
    </div>
  );
};

export default Editor;
