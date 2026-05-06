import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FileText, Key, Building2, Smartphone, Users, Briefcase } from 'lucide-react';
import type { Block } from '../types';
import { useTranslation } from '../hooks/useTranslation';

export const TemplateModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const tt = t.templates;
  const [selectedCategory, setSelectedCategory] = useState<'password' | 'account' | 'meeting'>('password');
  
  // Options for Password / Account templates
  const [serviceType, setServiceType] = useState('web');
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
    const typeLabel = tt.types[serviceType as keyof typeof tt.types];
    let title = '';
    let blocks: Block[] = [];

    if (selectedCategory === 'password') {
      title = `${typeLabel}${t.sidebar.untitled}`; // Or a more specific suffix
      const headerRow = [];
      const dataRow = [];
      if (fields.url) { headerRow.push(tt.fields.url); dataRow.push('https://'); }
      if (fields.email) { headerRow.push(tt.fields.email); dataRow.push(''); }
      if (fields.id) { headerRow.push(tt.fields.id); dataRow.push(''); }
      if (fields.password) { headerRow.push(tt.fields.password); dataRow.push(''); }
      if (fields.securityQ) { headerRow.push(tt.fields.securityQ); dataRow.push(''); }
      if (fields.phone) { headerRow.push(tt.fields.phone); dataRow.push(''); }

      blocks = [
        { id: generateId(), type: 'h2', content: `${typeLabel}` },
        { id: generateId(), type: 'table', content: '', data: { rows: 2, cols: headerRow.length, cells: [headerRow, dataRow] } }
      ];
    } else if (selectedCategory === 'account') {
      title = `${typeLabel}${t.sidebar.untitled}`;
      blocks = [
        { id: generateId(), type: 'h2', content: `${typeLabel}` },
        { id: generateId(), type: 'bullet_list', content: `${tt.fields.id}: ` },
        { id: generateId(), type: 'bullet_list', content: `${tt.fields.email}: ` },
        { id: generateId(), type: 'divider', content: '' },
        { id: generateId(), type: 'h3', content: 'Memo' },
        { id: generateId(), type: 'text', content: '' }
      ];
    } else if (selectedCategory === 'meeting') {
      title = `【${tt.categories.meeting}】${typeLabel}`;
      blocks = [
        { id: generateId(), type: 'h3', content: 'Date: ' + new Date().toLocaleDateString() },
        { id: generateId(), type: 'h3', content: 'Venue/URL: https://' },
        { id: generateId(), type: 'h3', content: 'Participants: ' },
        { id: generateId(), type: 'divider', content: '' },
        { id: generateId(), type: 'h2', content: 'Agenda' },
        { id: generateId(), type: 'todo_list', content: '' },
        { id: generateId(), type: 'h2', content: 'Decisions' },
        { id: generateId(), type: 'bullet_list', content: '' }
      ];
    }

    useAppStore.setState(s => {
      const newDoc = { 
        id: generateId(), title, blocks, isFavorite: false, 
        createdAt: Date.now(), updatedAt: Date.now(), 
        order: s.documents.length, parentId: null,
        properties: { tags: [typeLabel], status: null }
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
            {tt.title}
          </h2>
          <p style={{ margin: '8px 0 0 0', color: 'var(--placeholder-color)', fontSize: 14 }}>
            {tt.desc}
          </p>
        </div>

        <div style={{ display: 'flex', minHeight: 300 }}>
          {/* Sidebar */}
          <div style={{ width: 180, borderRight: '1px solid var(--menu-border)', padding: '16px 8px' }}>
            <div 
              onClick={() => { setSelectedCategory('password'); setServiceType('web'); }}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedCategory === 'password' ? 'var(--active-bg)' : 'transparent', color: selectedCategory === 'password' ? 'var(--active-text)' : 'var(--text-color)', fontWeight: selectedCategory === 'password' ? 600 : 400 }}
            >
              <Key size={16} /> {tt.categories.password}
            </div>
            <div 
              onClick={() => { setSelectedCategory('account'); setServiceType('web'); }}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedCategory === 'account' ? 'var(--active-bg)' : 'transparent', color: selectedCategory === 'account' ? 'var(--active-text)' : 'var(--text-color)', fontWeight: selectedCategory === 'account' ? 600 : 400 }}
            >
              <Building2 size={16} /> {tt.categories.account}
            </div>
            <div 
              onClick={() => { setSelectedCategory('meeting'); setServiceType('meetingInternal'); }}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedCategory === 'meeting' ? 'var(--active-bg)' : 'transparent', color: selectedCategory === 'meeting' ? 'var(--active-text)' : 'var(--text-color)', fontWeight: selectedCategory === 'meeting' ? 600 : 400 }}
            >
              <Users size={16} /> {tt.categories.meeting}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 8 }}>
                {selectedCategory === 'meeting' ? tt.meetingType : tt.serviceType}
              </label>
              <select 
                value={serviceType} 
                onChange={(e) => setServiceType(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid var(--menu-border)', background: 'var(--bg-color)', color: 'var(--text-color)', fontSize: 15 }}
              >
                {selectedCategory === 'meeting' ? (
                  <>
                    <option value="meetingInternal">{tt.types.meetingInternal}</option>
                    <option value="meetingClient">{tt.types.meetingClient}</option>
                    <option value="meeting1on1">{tt.types.meeting1on1}</option>
                  </>
                ) : (
                  <>
                    <option value="web">{tt.types.web}</option>
                    <option value="app">{tt.types.app}</option>
                    <option value="bank">{tt.types.bank}</option>
                    <option value="card">{tt.types.card}</option>
                    <option value="sns">{tt.types.sns}</option>
                    <option value="internal">{tt.types.internal}</option>
                  </>
                )}
              </select>
            </div>

            {selectedCategory === 'password' && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 12 }}>
                  {tt.fieldsLabel}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {Object.keys(fields).map((key) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={fields[key as keyof typeof fields]}
                        onChange={(e) => setFields({ ...fields, [key]: e.target.checked })}
                        style={{ width: 16, height: 16, accentColor: 'var(--google-blue)' }}
                      />
                      {tt.fields[key as keyof typeof tt.fields]}
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            {selectedCategory !== 'password' && (
              <div style={{ padding: 16, background: 'var(--hover-bg)', borderRadius: 8, fontSize: 13, color: 'var(--placeholder-color)' }}>
                {tt.info.replace('{type}', tt.types[serviceType as keyof typeof tt.types])}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--menu-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 20, border: 'none', background: 'transparent', color: 'var(--placeholder-color)', fontWeight: 600, cursor: 'pointer' }}>
            {tt.cancel}
          </button>
          <button onClick={handleGenerate} className="btn-primary" style={{ padding: '10px 24px' }}>
            {tt.create}
          </button>
        </div>
      </div>
    </div>
  );
};
