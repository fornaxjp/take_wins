import React, { useState, useEffect } from 'react';
import { hashPin } from '../lib/crypto';
import { verifyBiometric, isBiometricAvailable } from '../lib/biometric';

interface LockScreenProps {
  title?: string;
  pinHash: string;
  biometricEnabled: boolean;
  onUnlock: () => void;
  autoTryBiometric?: boolean;
}

export const LockScreen: React.FC<LockScreenProps> = ({ title, pinHash, biometricEnabled, onUnlock, autoTryBiometric = true }) => {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [hasBiometric, setHasBiometric] = useState(false);

  useEffect(() => {
    if (biometricEnabled) isBiometricAvailable().then(setHasBiometric);
  }, [biometricEnabled]);

  useEffect(() => {
    if (biometricEnabled && hasBiometric && autoTryBiometric) {
      setTimeout(() => handleBiometric(), 400);
    }
  }, [hasBiometric]);

  const handleDigit = async (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length === 4) {
      const h = await hashPin(next);
      if (h === pinHash) { onUnlock(); }
      else {
        setShake(true);
        setError('PINコードが違います');
        setTimeout(() => { setPin(''); setShake(false); setError(''); }, 700);
      }
    }
  };

  const handleBiometric = async () => {
    setError('');
    const ok = await verifyBiometric();
    if (ok) onUnlock();
    else setError('生体認証に失敗しました。PINをお試しください。');
  };

  const pad = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="lock-screen">
      <div className="lock-box">
        <div className="lock-icon-big">🔒</div>
        <h2 className="lock-title">{title || 'ロックされています'}</h2>
        <div className={`pin-dots ${shake ? 'shake' : ''}`}>
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''} ${shake ? 'error-dot' : ''}`} />
          ))}
        </div>
        {error && <p className="lock-error">{error}</p>}
        <div className="pin-pad">
          {pad.map((k, i) => (
            <button
              key={i}
              className={`pin-key ${k === '' ? 'pin-key-empty' : ''}`}
              disabled={k === ''}
              onClick={() => { if (k === '⌫') setPin(p => p.slice(0,-1)); else if (k) handleDigit(k); }}
            >{k}</button>
          ))}
        </div>
        {biometricEnabled && hasBiometric && (
          <button className="biometric-unlock-btn" onClick={handleBiometric}>
            👤 Face ID / Touch ID を使用
          </button>
        )}
      </div>
    </div>
  );
};
