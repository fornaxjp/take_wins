import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';
import { Globe } from 'lucide-react';

export const Auth: React.FC = () => {
  const { setLanguage } = useAppStore();
  const { t, language } = useTranslation();
  const at = t.auth;
  
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
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) setMessage(error.message);
      else setMessage(at.checkEmail);
    }
    setLoading(false);
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
        <h1 className="auth-subtitle">{isLoginMode ? at.login : at.signUp}</h1>
        <p className="auth-desc">{at.desc}</p>
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <input type="email" placeholder={at.email} value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder={at.password} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? at.processing : (isLoginMode ? at.next : at.register)}
          </button>
        </form>

        <button className="auth-toggle-btn" onClick={() => { setIsLoginMode(!isLoginMode); setMessage(''); }}>
          {isLoginMode ? at.noAccount : at.hasAccount}
        </button>
        {message && <p className="auth-message">{message}</p>}

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--menu-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Globe size={16} style={{ color: 'var(--placeholder-color)' }} />
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value as any)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--placeholder-color)', 
              fontSize: 13, 
              fontWeight: 600, 
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
            <option value="zh">繁體中文</option>
            <option value="ko">한국어</option>
          </select>
        </div>
      </div>
    </div>
  );
};
