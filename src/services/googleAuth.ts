import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');

// Request offline access so Google issues a refresh token, and prompt for consent + account selection
provider.setCustomParameters({
  access_type: 'offline',
  prompt: 'consent select_account',
});

const SESSION_TOKEN_KEY = 'gmail_oauth_token';
let isSigningIn = false;
let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_TOKEN_KEY) : null;
let cachedUser: User | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    cachedUser = user;
    if (user) {
      const token = await getAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const tokenResponse = (result as any)?._tokenResponse;

    const accessToken = credential?.accessToken || tokenResponse?.oauthAccessToken;
    if (!accessToken) {
      throw new Error('Failed to obtain Google OAuth access token.');
    }

    // Extract refresh token from OAuth response (NEVER store in sessionStorage or localStorage)
    const refreshToken =
      tokenResponse?.oauthRefreshToken ||
      tokenResponse?.refreshToken ||
      (credential as any)?.refreshToken ||
      result.user?.refreshToken ||
      null;

    const expiresIn = Number(tokenResponse?.oauthExpireIn) || 3600;

    cachedAccessToken = accessToken;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_TOKEN_KEY, accessToken);
    }
    cachedUser = result.user;

    // Securely persist credentials and refresh token to server database
    try {
      await fetch('/api/integrations/gmail/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          accessToken,
          refreshToken,
          expiresIn,
        }),
      });
    } catch (e) {
      console.warn('Backend notification failed:', e);
    }

    return { user: result.user, accessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  }
  return null;
};

export const hasValidToken = (): boolean => {
  if (cachedAccessToken) return true;
  if (typeof window !== 'undefined') {
    return Boolean(sessionStorage.getItem(SESSION_TOKEN_KEY));
  }
  return false;
};

export const getConnectedUser = (): User | null => {
  return cachedUser || auth.currentUser;
};

export const disconnectGoogle = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
  cachedUser = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
  try {
    await fetch('/api/integrations/gmail/disconnect', {
      method: 'POST',
    });
  } catch (e) {
    console.warn('Backend disconnect sync failed:', e);
  }
};
