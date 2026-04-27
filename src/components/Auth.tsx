import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    if (isLoginMode) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage(error.message);
      else setMessage('確認メールを送りました。メール内のリンクをクリックして本登録を完了してください。');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    useAppStore.getState().clearDocuments();
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-logo">
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--google-blue)' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--google-red)' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--google-yellow)' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--google-green)' }} />
        </div>
        <h1 className="auth-subtitle">{isLoginMode ? 'ログイン' : 'アカウント作成'}</h1>
        <p className="auth-desc">Take wins で作業を続けましょう</p>
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <input type="email" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? '処理中...' : (isLoginMode ? '次へ' : '登録する')}
          </button>
        </form>

        <button className="auth-toggle-btn" onClick={() => { setIsLoginMode(!isLoginMode); setMessage(''); }}>
          {isLoginMode ? 'アカウントを作成する' : '既にアカウントをお持ちの方'}
        </button>
        {message && <p className="auth-message">{message}</p>}
      </div>
    </div>
  );
};
