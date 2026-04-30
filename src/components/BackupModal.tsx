import React, { useState, useEffect } from 'react';
import { useAppStore, getBackups, restoreBackup } from '../store/useAppStore';
import type { Backup } from '../store/useAppStore';
import { History, Clock, RotateCcw, AlertTriangle } from 'lucide-react';

export const BackupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { userId } = useAppStore();
  const [backups, setBackups] = useState<Backup[]>([]);

  useEffect(() => {
    if (userId) {
      setBackups(getBackups(userId));
    }
  }, [userId]);

  const handleRestore = (timestamp: number) => {
    if (window.confirm('この時点のデータに復元しますか？（現在の未保存の変更は失われる可能性があります）')) {
      if (userId) restoreBackup(userId, timestamp);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, padding: 0 }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--menu-border)', background: 'var(--hover-bg)' }}>
          <h2 style={{ margin: 0, fontSize: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <History className="icon-blue" />
            履歴と復元
          </h2>
          <p style={{ margin: '8px 0 0 0', color: 'var(--placeholder-color)', fontSize: 14 }}>
            システムは自動で5分ごとに最新の変更をバックアップしています。過去のデータに戻したい場合はここから復元できます。
          </p>
        </div>

        <div style={{ padding: '24px', maxHeight: '400px', overflowY: 'auto' }}>
          {backups.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--placeholder-color)', padding: '40px 0' }}>
              <Clock size={32} style={{ opacity: 0.5, marginBottom: 16 }} />
              <p>バックアップ履歴がありません</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {backups.map((b, i) => (
                <div key={b.timestamp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: 12, border: '1px solid var(--menu-border)', background: i === 0 ? 'var(--active-bg)' : 'transparent' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {new Date(b.timestamp).toLocaleString('ja-JP')}
                      {i === 0 && <span style={{ fontSize: 11, background: 'var(--google-blue)', color: 'white', padding: '2px 8px', borderRadius: 12 }}>最新バックアップ</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--placeholder-color)' }}>
                      ドキュメント数: {b.documents.length}件
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRestore(b.timestamp)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 20, border: 'none', background: 'var(--google-blue)', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'filter 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
                  >
                    <RotateCcw size={16} /> 復元
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 8, marginTop: 24, padding: '12px', background: 'rgba(234, 67, 53, 0.1)', color: 'var(--google-red)', borderRadius: 8, fontSize: 13 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>注意:</strong> 復元を行うと、選択した時点以降の変更は上書きされます。必要であれば復元前に現在の状態を確認してください。
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--menu-border)', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 24, border: 'none', background: 'var(--hover-bg)', color: 'var(--text-color)', fontWeight: 600, cursor: 'pointer' }}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
