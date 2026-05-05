import React, { useEffect, useState } from 'react';
import { supabase, getAppLockSettings, saveAppLockSettings, clearAppLockSettings } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { isBiometricAvailable, registerBiometric, clearBiometricCredential } from '../lib/biometric';
import { hashPin } from '../lib/crypto';
import { Moon, Sun } from 'lucide-react';

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { clearDocuments, setSettingsModalOpen, theme, setTheme, fontFamily, fontSize, setFontFamily, setFontSize } = useAppStore();
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'account'|'applock'|'ai'>('account');
  const [aiKeys, setAiKeys] = useState({ openai: '', gemini: '', claude: '', groq: '', xiaomi: '' });
  const [aiModel, setAiModel] = useState('openai');

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('tw_ai_keys') || '{}');
    setAiKeys(saved);
    setAiModel(localStorage.getItem('tw_ai_model') || 'openai');
  }, []);

  const saveAiSettings = () => {
    localStorage.setItem('tw_ai_keys', JSON.stringify(aiKeys));
    localStorage.setItem('tw_ai_model', aiModel);
    alert('AI設定を保存しました');
  };

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

  const handleDisableLock = () => {
    if (window.confirm('アプリロックを無効にしますか？')) {
      clearAppLockSettings();
      setAppLockEnabled(false);
      setBiometricEnabled(false);
    }
  };

  const handleToggleBiometric = async () => {
    if (biometricEnabled) {
      clearBiometricCredential();
      saveAppLockSettings({ ...getAppLockSettings(), biometric: false });
      setBiometricEnabled(false);
    } else {
      const success = await registerBiometric(email);
      if (success) {
        saveAppLockSettings({ ...getAppLockSettings(), biometric: true });
        setBiometricEnabled(true);
      } else {
        alert('生体認証の登録に失敗しました。');
      }
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
            style={{ padding: '15px', fontSize: 20, borderRadius: 12, border: 'none', background: k === '' ? 'transparent' : 'var(--hover-bg)', color: 'var(--text-color)', cursor: k ? 'pointer' : 'default', visibility: k === '' ? 'hidden' : 'visible', fontWeight: 600 }}>
            {k}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={() => setSettingsModalOpen(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 400 }}>設定</h2>
          <span style={{ fontSize: '11px', opacity: 0.5, fontWeight: 600 }}>v3.0.2</span>
        </div>
        
        <div style={{ display: 'flex', gap: 4, marginBottom: 32, background: 'var(--hover-bg)', padding: 4, borderRadius: 16 }}>
          {(['account','applock', 'ai'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ 
                flex: 1, 
                padding: '10px', 
                borderRadius: 12, 
                border: 'none', 
                background: activeTab === tab ? 'var(--bg-color)' : 'transparent', 
                color: activeTab === tab ? (tab === 'ai' ? 'var(--google-yellow)' : 'var(--google-blue)') : 'var(--placeholder-color)', 
                fontWeight: 600, 
                fontSize: 14,
                cursor: 'pointer',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}>
              {tab === 'account' ? '基本' : tab === 'applock' ? 'ロック' : 'AI'}
            </button>
          ))}
        </div>

        {activeTab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 4 }}>外観モード</div>
                <div style={{ fontSize: 15 }}>{theme === 'light' ? 'ライトモード' : 'ダークモード'}</div>
              </div>
              <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
                style={{ background: 'var(--hover-bg)', color: 'var(--text-color)', border: 'none', padding: '10px 20px', borderRadius: 24, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                {theme === 'light' ? <Moon size={16} className="icon-blue" /> : <Sun size={16} className="icon-yellow" />}
                切り替え
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 4 }}>フォント</div>
              </div>
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} style={{ padding: '8px 12px', borderRadius: 12, border: 'none', background: 'var(--hover-bg)', color: 'var(--text-color)', outline: 'none' }}>
                <option value="'Inter', system-ui, sans-serif">Inter (標準)</option>
                <option value="'Noto Sans JP', sans-serif">Noto Sans JP</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 4 }}>文字サイズ</div>
              </div>
              <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} style={{ padding: '8px 12px', borderRadius: 12, border: 'none', background: 'var(--hover-bg)', color: 'var(--text-color)', outline: 'none' }}>
                <option value="14px">小 (14px)</option>
                <option value="16px">中 (16px)</option>
                <option value="18px">大 (18px)</option>
                <option value="20px">特大 (20px)</option>
              </select>
            </div>

            <div style={{ height: 1, background: 'var(--menu-border)' }} />

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 4 }}>ログイン中</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{email}</div>
            </div>

            <div style={{ height: 1, background: 'var(--menu-border)' }} />

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 8 }}>同期ステータス</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--sidebar-bg)', padding: '12px 16px', borderRadius: 16 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: dbStatus === 'ok' ? 'var(--google-green)' : dbStatus === 'error' ? 'var(--google-red)' : 'var(--placeholder-color)' }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{dbStatus === 'ok' ? '正常に接続中' : dbStatus === 'error' ? '接続エラー' : '未確認'}</span>
                <button onClick={handleTestConnection} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 12, border: '1px solid var(--menu-border)', background: 'white', color: 'var(--text-color)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>テスト</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <button onClick={() => setSettingsModalOpen(false)} style={{ width: '100%', padding: '14px', background: 'var(--google-blue)', color: 'white', border: 'none', borderRadius: 24, fontWeight: 600, cursor: 'pointer' }}>完了</button>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleLogout} style={{ flex: 1, padding: '12px', background: 'transparent', color: 'var(--placeholder-color)', border: '1px solid var(--menu-border)', borderRadius: 24, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>ログアウト</button>
                <button onClick={handleEmergencyReset} style={{ flex: 1, padding: '12px', background: 'transparent', color: 'var(--google-red)', border: '1px solid var(--menu-border)', borderRadius: 24, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>全リセット</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'applock' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {appLockEnabled ? (
              <>
                <div style={{ background: 'var(--hover-bg)', padding: '16px', borderRadius: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: biometricAvailable ? 16 : 0 }}>
                    <div style={{ fontWeight: 600 }}>アプリロック</div>
                    <span style={{ color: 'var(--google-green)', fontSize: 14, fontWeight: 600 }}>有効</span>
                  </div>
                  {biometricAvailable && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--menu-border)' }}>
                      <div style={{ fontWeight: 600 }}>生体認証（指紋/顔）</div>
                      <button onClick={handleToggleBiometric} style={{ background: biometricEnabled ? 'var(--google-green)' : 'var(--hover-bg)', color: biometricEnabled ? 'white' : 'var(--text-color)', border: 'none', padding: '6px 16px', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}>
                        {biometricEnabled ? 'オン' : 'オフ'}
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={handleDisableLock} style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--google-red)', border: '1px solid var(--menu-border)', borderRadius: 24, fontWeight: 600, cursor: 'pointer' }}>ロックを無効化</button>
              </>
            ) : (
              <>
                {pinStep === 'idle' && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <p style={{ color: 'var(--placeholder-color)', marginBottom: 20 }}>アプリをパスコードで保護します</p>
                    <button onClick={() => setPinStep('enter')} style={{ background: 'var(--google-blue)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 24, fontWeight: 600, cursor: 'pointer' }}>設定を開始する</button>
                  </div>
                )}
                {pinStep === 'enter' && (
                  <div>
                    <h3 style={{ textAlign: 'center', marginBottom: 20 }}>新しいPINを入力</h3>
                    <PinInput value={newPin} target="new" />
                  </div>
                )}
                {pinStep === 'confirm' && (
                  <div>
                    <h3 style={{ textAlign: 'center', marginBottom: 20 }}>もう一度入力して確認</h3>
                    <PinInput value={confirmPin} target="confirm" />
                  </div>
                )}
                {pinError && <p style={{ color: 'var(--google-red)', textAlign: 'center', fontWeight: 600, marginTop: 16 }}>{pinError}</p>}
              </>
            )}
            <button onClick={() => { setSettingsModalOpen(false); setPinStep('idle'); setNewPin(''); setConfirmPin(''); }} style={{ width: '100%', padding: '14px', background: 'var(--hover-bg)', color: 'var(--text-color)', border: 'none', borderRadius: 24, fontWeight: 600, cursor: 'pointer', marginTop: 'auto' }}>閉じる</button>
          </div>
        )}

        {activeTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 8 }}>使用モデル</div>
              <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'var(--hover-bg)', color: 'var(--text-color)', outline: 'none' }}>
                <option value="openai">OpenAI (GPT-4o)</option>
                <option value="gemini">Gemini (1.5 Pro)</option>
                <option value="claude">Claude (3.5 Sonnet)</option>
                <option value="groq">Groq (Mixtral/Llama)</option>
                <option value="xiaomi">Xiaomi MiMo</option>
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 8 }}>OpenAI API Key</div>
              <input type="password" value={aiKeys.openai} onChange={(e) => setAiKeys({...aiKeys, openai: e.target.value})} placeholder="sk-..." style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--menu-border)', background: 'transparent', color: 'var(--text-color)', outline: 'none' }} />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 8 }}>Gemini API Key</div>
              <input type="password" value={aiKeys.gemini} onChange={(e) => setAiKeys({...aiKeys, gemini: e.target.value})} placeholder="AIza..." style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--menu-border)', background: 'transparent', color: 'var(--text-color)', outline: 'none' }} />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 8 }}>Claude API Key</div>
              <input type="password" value={aiKeys.claude} onChange={(e) => setAiKeys({...aiKeys, claude: e.target.value})} placeholder="sk-ant-..." style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--menu-border)', background: 'transparent', color: 'var(--text-color)', outline: 'none' }} />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 8 }}>Groq API Key</div>
              <input type="password" value={aiKeys.groq} onChange={(e) => setAiKeys({...aiKeys, groq: e.target.value})} placeholder="gsk_..." style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--menu-border)', background: 'transparent', color: 'var(--text-color)', outline: 'none' }} />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder-color)', marginBottom: 8 }}>Xiaomi MiMo API Key</div>
              <input type="password" value={aiKeys.xiaomi} onChange={(e) => setAiKeys({...aiKeys, xiaomi: e.target.value})} placeholder="..." style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--menu-border)', background: 'transparent', color: 'var(--text-color)', outline: 'none' }} />
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={saveAiSettings} style={{ width: '100%', padding: '14px', background: 'var(--google-yellow)', color: 'white', border: 'none', borderRadius: 24, fontWeight: 600, cursor: 'pointer' }}>保存して適用</button>
              <button onClick={() => setSettingsModalOpen(false)} style={{ width: '100%', padding: '14px', background: 'var(--hover-bg)', color: 'var(--text-color)', border: 'none', borderRadius: 24, fontWeight: 600, cursor: 'pointer' }}>閉じる</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

