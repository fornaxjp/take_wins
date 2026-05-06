import React, { useState, useEffect } from 'react';
import { useAppStore, getBackups, restoreBackup } from '../store/useAppStore';
import type { Backup } from '../store/useAppStore';
import { History, Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export const BackupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { userId } = useAppStore();
  const { t, language } = useTranslation();
  const bt = t.backup;
  const [backups, setBackups] = useState<Backup[]>([]);

  useEffect(() => {
    if (userId) {
      setBackups(getBackups(userId));
    }
  }, [userId]);

  const handleRestore = (timestamp: number) => {
    if (window.confirm(bt.confirm)) {
      if (userId) restoreBackup(userId, timestamp);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--menu-border)', background: 'var(--hover-bg)' }}>
          <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <History className="icon-blue" />
            {bt.title}
          </h2>
          <p style={{ margin: '8px 0 0 0', color: 'var(--placeholder-color)', fontSize: 14 }}>
            {bt.desc}
          </p>
        </div>

        <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
          {backups.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--placeholder-color)', padding: '40px 0' }}>
              <Clock size={32} style={{ opacity: 0.5, marginBottom: 16 }} />
              <p>{bt.noBackups}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {backups.map((b, i) => (
                <div key={b.timestamp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: 12, border: '1px solid var(--menu-border)', background: i === 0 ? 'var(--active-bg)' : 'transparent' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {new Date(b.timestamp).toLocaleString(language === 'ja' ? 'ja-JP' : language === 'zh' ? 'zh-TW' : language === 'ko' ? 'ko-KR' : 'en-US')}
                      {i === 0 && <span style={{ fontSize: 11, background: 'var(--google-blue)', color: 'white', padding: '2px 8px', borderRadius: 12 }}>{bt.latest}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--placeholder-color)' }}>
                      {bt.docCount}: {b.documents.length}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRestore(b.timestamp)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20, border: 'none', background: 'var(--google-blue)', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'filter 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    <RotateCcw size={16} /> {bt.restore}
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 8, marginTop: 24, padding: '12px', background: 'rgba(234, 67, 53, 0.1)', color: 'var(--google-red)', borderRadius: 8, fontSize: 13 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              {bt.warning}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--menu-border)', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 24, border: 'none', background: 'var(--hover-bg)', color: 'var(--text-color)', fontWeight: 600, cursor: 'pointer' }}>
            {bt.close}
          </button>
        </div>
      </div>
    </div>
  );
};
