const CRED_KEY = 'tw_biometric_cred';

export const isBiometricAvailable = async (): Promise<boolean> => {
  try {
    return !!(window.PublicKeyCredential) &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
};

export const registerBiometric = async (): Promise<boolean> => {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Take wins', id: window.location.hostname },
        user: { id: new Uint8Array(16), name: 'user', displayName: 'User' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      }
    }) as PublicKeyCredential;
    if (!cred) return false;
    const id = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    localStorage.setItem(CRED_KEY, id);
    return true;
  } catch (e) { console.error(e); return false; }
};

export const verifyBiometric = async (): Promise<boolean> => {
  try {
    const stored = localStorage.getItem(CRED_KEY);
    if (!stored) return false;
    const credId = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const result = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: credId, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      }
    });
    return !!result;
  } catch (e) { console.error(e); return false; }
};

export const clearBiometricCredential = () => localStorage.removeItem(CRED_KEY);
