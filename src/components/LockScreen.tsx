import React, { useState, useEffect } from 'react';
import { hashPin } from '../lib/crypto';
import { verifyBiometric, isBiometricAvailable } from '../lib/biometric';
import { useTranslation } from '../hooks/useTranslation';

interface LockScreenProps {
  title?: string;
  pinHash: string;
  biometricEnabled: boolean;
  onUnlock: () => void;
  autoTryBiometric?: boolean;
}

export const LockScreen: React.FC<LockScreenProps> = ({ title, pinHash, biometricEnabled, onUnlock, autoTryBiometric = true }) => {
  const { t } = useTranslation();
  const lt = t.lock;
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        setPin(p => p.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

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
        setError(lt.invalidPin);
        setTimeout(() => { setPin(''); setShake(false); setError(''); }, 700);
      }
    }
  };

  const handleBiometric = async () => {
    setError('');
    const ok = await verifyBiometric();
    if (ok) onUnlock();
    else setError(lt.biometricFailed);
  };

  const pad = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="lock-screen">
      <div className="lock-box">
        <div className="lock-icon-big">🔒</div>
        <h2 className="lock-title">{title || lt.title}</h2>
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
            👤 {lt.useBiometric}
          </button>
        )}
      </div>
    </div>
  );
};
