import React, { useEffect, useState } from 'react';
import { supabase, getAppLockSettings, saveAppLockSettings, clearAppLockSettings } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { isBiometricAvailable, registerBiometric, clearBiometricCredential } from '../lib/biometric';
import { hashPin } from '../lib/crypto';

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { clearDocuments, setSettingsModalOpen } = useAppStore();
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'account'|'applock'>('account');

  // App lock state
  const lockSettings = getAppLockSettings();
  const [appLockEnabled, setAppLockEnabled] = useState(lockSettings.enabled);
  const [biometricEnabled, setBiometricEnabled] = useState(lockSettings.biometric);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [pinStep, setPinStep] = useState<'idle'|'enter'|'confirm'>('idle');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [dbStatus, setDbStatus] = useState<'testing'|'ok'|'error'|null>(null);
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setEmail(user.email || ''); });
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  const handleLogout = async () => {
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
      console.error('[TakeWins] Connection test failed:', e);
      setDbStatus('error');
      setDbError(e.message || '接続に失敗しました');
    }
  };

  const handleEmergencyReset = () => {
    if (!window.confirm('【警告】すべてのローカルデータを削除し、強制ログアウトします。よろしいですか？')) return;
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  const handleToggleAppLock = async (on: boolean) => {
    if (on) {
      setPinStep('enter');
    } else {
      clearAppLockSettings();
      clearBiometricCredential();
      setAppLockEnabled(false);
      setBiometricEnabled(false);
    }
  };

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
            const s = { ...getAppLockSettings(), enabled: true, pin: hash };
            saveAppLockSettings(s);
            setAppLockEnabled(true);
            setPinStep('idle');
            setNewPin('');
            setConfirmPin('');
          });
        } else {
          setPinError('PINが一致しません。もう一度');
          setNewPin(''); setConfirmPin(''); setPinStep('enter');
        }
      }
    }
  };

  const handleToggleBiometric = async (on: boolean) => {
    if (on) {
      const ok = await registerBiometric();
      if (ok) { saveAppLockSettings({ ...getAppLockSettings(), biometric: true }); setBiometricEnabled(true); }
      else alert('生体認証の登録に失敗しました');
    } else {
      clearBiometricCredential();
      saveAppLockSettings({ ...getAppLockSettings(), biometric: false });
      setBiometricEnabled(false);
    }
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
            style={{ padding: '12px', fontSize: 18, borderRadius: 8, border: '1px solid var(--menu-border)', background: k === '' ? 'transparent' : 'var(--sidebar-bg)', color: 'var(--text-color)', cursor: k ? 'pointer' : 'default', visibility: k === '' ? 'hidden' : 'visible' }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={() => setSettingsModalOpen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h2 className="modal-title">設定</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['account','applock'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--menu-border)', background: activeTab === tab ? 'var(--text-color)' : 'transparent', color: activeTab === tab ? 'var(--bg-color)' : 'var(--text-color)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              {tab === 'account' ? 'アカウント' : 'ロック設定'}
            </button>
          ))}
        </div>

        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="settings-section">
              <div className="settings-label">ログイン中のアカウント</div>
              <div className="settings-value">{email}</div>
            </div>

            <div className="settings-section">
              <div className="settings-label">同期ステータス診断</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: dbStatus === 'ok' ? '#22c55e' : dbStatus === 'error' ? '#ef4444' : '#666' }} />
                <span style={{ fontSize: 14 }}>
                  {dbStatus === 'ok' ? '接続成功' : dbStatus === 'error' ? '接続エラー' : '未テスト'}
                </span>
                <button onClick={handleTestConnection} style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--menu-border)', background: 'transparent', color: 'var(--text-color)', cursor: 'pointer' }}>
                  テスト実行
                </button>
              </div>
              {dbError && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 8, wordBreak: 'break-all' }}>理由: {dbError}</p>}
            </div>

            <div style={{ marginTop: 8 }}>
              <button onClick={handleLogout} className="btn-danger" style={{ width: '100%', marginBottom: 12 }}>ログアウト</button>
              <button onClick={handleEmergencyReset} style={{ width: '100%', padding: '10px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 24 }}>
                全データをリセットして強制再起動
              </button>
              <button onClick={() => setSettingsModalOpen(false)} className="btn-secondary" style={{ width: '100%' }}>閉じる</button>
            </div>
          </div>
        )}

        {activeTab === 'applock' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="settings-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="settings-label">アプリロック</div>
                <div style={{ fontSize: 13, color: 'var(--placeholder-color)' }}>起動時にPINを要求</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={appLockEnabled} onChange={e => handleToggleAppLock(e.target.checked)} style={{ width: 22, height: 22 }} />
              </label>
            </div>

            {pinStep === 'enter' && (
              <div className="settings-section" style={{ textAlign: 'center' }}>
                <div className="settings-label" style={{ marginBottom: 12 }}>新しいPINを入力（4桁）</div>
                {pinError && <p style={{ color: 'var(--danger-color)', fontSize: 13, marginBottom: 8 }}>{pinError}</p>}
                <PinInput value={newPin} target="new" />
              </div>
            )}
            {pinStep === 'confirm' && (
              <div className="settings-section" style={{ textAlign: 'center' }}>
                <div className="settings-label" style={{ marginBottom: 12 }}>PINを再入力して確認</div>
                <PinInput value={confirmPin} target="confirm" />
              </div>
            )}

            {appLockEnabled && biometricAvailable && (
              <div className="settings-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="settings-label">生体認証（Face ID / Touch ID）</div>
                  <div style={{ fontSize: 13, color: 'var(--placeholder-color)' }}>ロック解除に使用</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={biometricEnabled} onChange={e => handleToggleBiometric(e.target.checked)} style={{ width: 22, height: 22 }} />
                </label>
              </div>
            )}

            <div className="settings-actions">
              <button onClick={() => setSettingsModalOpen(false)} className="btn-secondary" style={{ width: '100%' }}>閉じる</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
