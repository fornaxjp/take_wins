import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

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
      if (error) {
        setMessage(error.message);
      } else {
        setMessage('確認用のメールを送信しました。受信トレイをご確認いただき、メール内のリンクをクリックして本登録を完了させてください。完了後、再度ログインをお願いします。');
        // 自動ログインされる場合があります
      }
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-title">Take wins</h1>
        <p className="auth-subtitle">あらゆる端末で同期・共有できるデータベース</p>
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <input 
            type="email" 
            placeholder="メールアドレス" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input 
            type="password" 
            placeholder="パスワード" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? '処理中...' : (isLoginMode ? 'ログイン' : '新規登録')}
          </button>
        </form>
        
        <button 
          className="auth-toggle-btn"
          onClick={() => {
            setIsLoginMode(!isLoginMode);
            setMessage('');
          }}
        >
          {isLoginMode ? 'アカウントをお持ちでない方は新規登録' : '既にアカウントをお持ちの方はログイン'}
        </button>

        {message && <p className="auth-message">{message}</p>}
      </div>
    </div>
  );
};
