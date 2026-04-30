import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FileText, Key, Building2, Smartphone, Users, Briefcase } from 'lucide-react';
import type { Block } from '../types';

export const TemplateModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<'password' | 'account' | 'meeting'>('password');
  
  // Options for Password / Account templates
  const [serviceType, setServiceType] = useState('Webサービス');
  const [fields, setFields] = useState({
    url: true,
    email: true,
    id: true,
    password: true,
    securityQ: false,
    phone: false
  });

  const handleGenerate = () => {
    const generateId = () => Math.random().toString(36).substring(2, 9);
    let title = '';
    let blocks: Block[] = [];

    if (selectedCategory === 'password') {
      title = `${serviceType}のパスワード`;
      const headerRow = [];
      const dataRow = [];
      if (fields.url) { headerRow.push('URL'); dataRow.push('https://'); }
      if (fields.email) { headerRow.push('Email'); dataRow.push(''); }
      if (fields.id) { headerRow.push('ID'); dataRow.push(''); }
      if (fields.password) { headerRow.push('Password'); dataRow.push(''); }
      if (fields.securityQ) { headerRow.push('秘密の質問'); dataRow.push(''); }
      if (fields.phone) { headerRow.push('電話番号'); dataRow.push(''); }

      blocks = [
        { id: generateId(), type: 'h2', content: `${serviceType}情報` },
        { id: generateId(), type: 'table', content: '', data: { rows: 2, cols: headerRow.length, cells: [headerRow, dataRow] } }
      ];
    } else if (selectedCategory === 'account') {
      title = `${serviceType}のアカウント管理`;
      blocks = [
        { id: generateId(), type: 'h2', content: `${serviceType} 基本情報` },
        { id: generateId(), type: 'bullet_list', content: 'アカウント名: ' },
        { id: generateId(), type: 'bullet_list', content: '登録名義: ' },
        { id: generateId(), type: 'bullet_list', content: '引き落とし口座: ' },
        { id: generateId(), type: 'divider', content: '' },
        { id: generateId(), type: 'h3', content: '備考' },
        { id: generateId(), type: 'text', content: '' }
      ];
    } else if (selectedCategory === 'meeting') {
      title = `【議事録】${serviceType}`;
      blocks = [
        { id: generateId(), type: 'h3', content: '日時: ' + new Date().toLocaleDateString() },
        { id: generateId(), type: 'h3', content: '場所/URL: https://' },
        { id: generateId(), type: 'h3', content: '参加者: ' },
        { id: generateId(), type: 'divider', content: '' },
        { id: generateId(), type: 'h2', content: 'アジェンダ' },
        { id: generateId(), type: 'todo_list', content: '' },
        { id: generateId(), type: 'h2', content: '決定事項' },
        { id: generateId(), type: 'bullet_list', content: '' }
      ];
    }

    useAppStore.setState(s => {
      const newDoc = { 
        id: generateId(), title, blocks, isFavorite: false, 
        createdAt: Date.now(), updatedAt: Date.now(), 
        order: s.documents.length, parentId: null,
        properties: { tags: [serviceType], status: null }
      };
      s._dirtyDocIds.add(newDoc.id);
      return { documents: [...s.documents, newDoc], activeDocumentId: newDoc.id };
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--menu-border)', background: 'var(--hover-bg)' }}>
          <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText className="icon-blue" />
            テンプレートから作成
          </h2>
          <p style={{ margin: '8px 0 0 0', color: 'var(--placeholder-color)', fontSize: 14 }}>
            用途に合わせて項目をカスタマイズして、最適なフォーマットでドキュメントを開始します。
          </p>
        </div>

        <div style={{ display: 'flex', minHeight: 300 }}>
          {/* Sidebar */}
          <div style={{ width: 180, borderRight: '1px solid var(--menu-border)', padding: '16px 8px' }}>
            <div 
              onClick={() => setSelectedCategory('password')}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedCategory === 'password' ? 'var(--active-bg)' : 'transparent', color: selectedCategory === 'password' ? 'var(--active-text)' : 'var(--text-color)', fontWeight: selectedCategory === 'password' ? 600 : 400 }}
            >
              <Key size={16} /> パスワード
            </div>
            <div 
              onClick={() => setSelectedCategory('account')}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedCategory === 'account' ? 'var(--active-bg)' : 'transparent', color: selectedCategory === 'account' ? 'var(--active-text)' : 'var(--text-color)', fontWeight: selectedCategory === 'account' ? 600 : 400 }}
            >
              <Building2 size={16} /> アカウント
            </div>
            <div 
              onClick={() => setSelectedCategory('meeting')}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedCategory === 'meeting' ? 'var(--active-bg)' : 'transparent', color: selectedCategory === 'meeting' ? 'var(--active-text)' : 'var(--text-color)', fontWeight: selectedCategory === 'meeting' ? 600 : 400 }}
            >
              <Users size={16} /> 議事録
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 8 }}>
                {selectedCategory === 'meeting' ? 'ミーティングの種類' : 'サービスの種類'}
              </label>
              <select 
                value={serviceType} 
                onChange={(e) => setServiceType(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--menu-border)', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: 15 }}
              >
                {selectedCategory === 'meeting' ? (
                  <>
                    <option value="社内MTG">社内MTG</option>
                    <option value="クライアントMTG">クライアントMTG</option>
                    <option value="1on1">1on1 面談</option>
                  </>
                ) : (
                  <>
                    <option value="Webサービス">Webサービス</option>
                    <option value="スマホアプリ">スマホアプリ</option>
                    <option value="銀行口座">銀行口座</option>
                    <option value="クレジットカード">クレジットカード</option>
                    <option value="SNS">SNS (X, Insta等)</option>
                    <option value="社内システム">社内システム</option>
                  </>
                )}
              </select>
            </div>

            {selectedCategory === 'password' && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 12 }}>
                  テーブルに含める項目（チェックでオンオフ）
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {Object.entries({ url: 'URL (https://...)', email: 'メールアドレス', id: 'ログインID', password: 'パスワード', securityQ: '秘密の質問', phone: '登録電話番号' }).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={fields[key as keyof typeof fields]}
                        onChange={(e) => setFields({ ...fields, [key]: e.target.checked })}
                        style={{ width: 16, height: 16, accentColor: 'var(--google-blue)' }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {selectedCategory !== 'password' && (
              <div style={{ padding: 16, background: 'var(--hover-bg)', borderRadius: 8, fontSize: 13, color: 'var(--placeholder-color)' }}>
                このテンプレートは「{serviceType}」用に最適化された見出しとリストで構成されます。作成後に自由に編集・追記が可能です。
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--menu-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 20, border: 'none', background: 'transparent', color: 'var(--placeholder-color)', fontWeight: 600, cursor: 'pointer' }}>
            キャンセル
          </button>
          <button onClick={handleGenerate} className="btn-primary" style={{ padding: '10px 24px' }}>
            作成する
          </button>
        </div>
      </div>
    </div>
  );
};
