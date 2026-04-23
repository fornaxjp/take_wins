import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email || '');
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    useAppStore.getState().setUserId(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">アカウント設定</h2>
        
        <div className="settings-section">
          <div className="settings-label">ログイン中のメールアドレス</div>
          <div className="settings-value">{email}</div>
        </div>

        <div className="settings-actions">
          <button onClick={handleLogout} className="btn-danger">ログアウト</button>
          <button onClick={onClose} className="btn-secondary">閉じる</button>
        </div>
      </div>
    </div>
  );
};
