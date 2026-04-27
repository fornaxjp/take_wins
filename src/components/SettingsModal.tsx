import React, { useEffect, useState } from 'react';
import { supabase, getAppLockSettings, saveAppLockSettings, clearAppLockSettings } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { isBiometricAvailable, registerBiometric, clearBiometricCredential } from '../lib/biometric';
import { hashPin } from '../lib/crypto';
import { Moon, Sun } from 'lucide-react';

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { clearDocuments, setSettingsModalOpen, theme, setTheme } = useAppStore();
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'account'|'applock'>('account');

  const [dbStatus, setDbStatus] = useState<'testing'|'ok'|'error'|null>(null);
  const [dbError, setDbError] = useState('');

  // App lock state
  const lockSettings = getAppLockSettings();
  const [appLockEnabled, setAppLockEnabled] = useState(lockSettings.enabled);
  const [biometricEnabled, setBiometricEnabled] = useState(lockSettings.biometric);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pinStep, setPinStep] = useState<'idle'|'enter'|'confirm'>('idle');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setEmail(user.email || ''); });
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  const handleLogout = async () => {
    if (!window.confirm('ログアウトしますか？')) return;
    await supabase.auth.signOut();
    clearDocuments();
    setSettingsModalOpen(false);
    window.location.reload();
  };

  const handleTestConnection = async () => {
    setDbStatus('testing');
    setDbError('');
    try {
      const { error } = await supabase.from('documents').select('id').limit(1);
      if (error) throw error;
      setDbStatus('ok');
    } catch (e: any) {
      setDbStatus('error');
      setDbError(e.message || '接続エラー');
    }
  };

  const handleEmergencyReset = () => {
    if (!window.confirm('全データを削除して初期化します。よろしいですか？')) return;
    localStorage.clear();
    window.location.href = '/';
  };

  const PinInput = ({ value, target }: { value: string; target: 'new'|'confirm' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, margin: '8px 0' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--text-color)', background: value.length > i ? 'var(--text-color)' : 'transparent' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: 280 }}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          <button key={i} disabled={k === ''} onClick={() => { if (k === '⌫') { if (target === 'new') setNewPin(p => p.slice(0,-1)); else setConfirmPin(p => p.slice(0,-1)); } else if (k) handlePinDigit(k, target); }}
            style={{ padding: '15px', fontSize: 20, borderRadius: 12, border: '1px solid var(--menu-border)', background: k === '' ? 'transparent' : 'var(--sidebar-bg)', color: 'var(--text-color)', cursor: k ? 'pointer' : 'default', visibility: k === '' ? 'hidden' : 'visible' }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );

  const handlePinDigit = (d: string, target: 'new'|'confirm') => {
    if (target === 'new') {
      const next = newPin + d;
      if (next.length <= 4) setNewPin(next);
      if (next.length === 4 && pinStep === 'enter') { setPinStep('confirm'); setPinError(''); }
    } else {
      const next = confirmPin + d;
      if (next.length <= 4) setConfirmPin(next);
      if (next.length === 4) {
        if (next === newPin) {
          hashPin(next).then(hash => {
            saveAppLockSettings({ ...getAppLockSettings(), enabled: true, pin: hash });
            setAppLockEnabled(true); setPinStep('idle'); setNewPin(''); setConfirmPin('');
          });
        } else {
          setPinError('PINが一致しません');
          setNewPin(''); setConfirmPin(''); setPinStep('enter');
        }
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setSettingsModalOpen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>設定</h2>
          <span style={{ fontSize: '10px', opacity: 0.5 }}>v2.0.3</span>
        </div>
        
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['account','applock'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--menu-border)', background: activeTab === tab ? 'var(--text-color)' : 'transparent', color: activeTab === tab ? 'var(--bg-color)' : 'var(--text-color)', fontWeight: 700, cursor: 'pointer' }}>
              {tab === 'account' ? 'アカウント' : 'ロック'}
            </button>
          ))}
        </div>

        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="settings-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="settings-label">外観モード</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{theme === 'light' ? 'ライトモード' : 'ダークモード'}</div>
              </div>
              <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
                style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700 }}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                切り替え
              </button>
            </div>

            <div className="settings-section">
              <div className="settings-label">ログイン中</div>
              <div className="settings-value">{email}</div>
            </div>

            <div className="settings-section">
              <div className="settings-label">同期ステータス</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: dbStatus === 'ok' ? '#22c55e' : dbStatus === 'error' ? '#ef4444' : '#666' }} />
                <span>{dbStatus === 'ok' ? '正常' : dbStatus === 'error' ? 'エラー' : '未確認'}</span>
                <button onClick={handleTestConnection} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--menu-border)', background: 'transparent', color: 'var(--text-color)' }}>テスト</button>
              </div>
              {dbError && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: 8 }}>{dbError}</p>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button onClick={handleLogout} className="btn-danger" style={{ width: '100%', height: '50px' }}>ログアウト</button>
              <button onClick={handleEmergencyReset} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 10, fontWeight: 600 }}>全リセット初期化</button>
              <button onClick={() => setSettingsModalOpen(false)} className="btn-secondary" style={{ width: '100%', height: '50px' }}>閉じる</button>
            </div>
          </div>
        )}

        {activeTab === 'applock' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* ... ロック設定の中身 ... */}
            <div className="settings-actions">
              <button onClick={() => setSettingsModalOpen(false)} className="btn-secondary">閉じる</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
