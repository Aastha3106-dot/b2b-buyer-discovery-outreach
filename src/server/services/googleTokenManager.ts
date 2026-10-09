import { getDatabase, saveDatabase, AppSettings } from '../db.ts';
import firebaseConfig from '../../../firebase-applet-config.json' with { type: 'json' };

export interface GoogleTokenStatus {
  connected: boolean;
  email: string | null;
  displayName: string | null;
  hasRefreshToken: boolean;
  isExpired: boolean;
  expiresAt: number | null;
  lastRefreshedAt: string | null;
}

export interface GetTokenResult {
  success: boolean;
  accessToken?: string;
  email?: string;
  error?: string;
  code?: 'AUTH_REQUIRED' | 'AUTH_EXPIRED' | 'NETWORK_ERROR' | 'INVALID_GRANT';
}

const OAUTH_CLIENT_ID =
  process.env.GOOGLE_OAUTH_CLIENT_ID ||
  process.env.VITE_FIREBASE_OAUTH_CLIENT_ID ||
  firebaseConfig.oAuthClientId;

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  firebaseConfig.apiKey;

/**
 * Retrieves the stored Gmail credentials and token status from the server database
 */
export async function getGmailTokenStatus(): Promise<GoogleTokenStatus> {
  const db = await getDatabase();
  const gmail = db.settings?.gmail;

  if (!gmail || !gmail.connected) {
    return {
      connected: false,
      email: null,
      displayName: null,
      hasRefreshToken: false,
      isExpired: true,
      expiresAt: null,
      lastRefreshedAt: null,
    };
  }

  const now = Date.now();
  const isExpired = Boolean(
    gmail.tokenExpired ||
    (gmail.expiresAt && now >= gmail.expiresAt - 60_000) ||
    !gmail.accessToken
  );

  return {
    connected: true,
    email: gmail.email || 'pariaastha672@gmail.com',
    displayName: gmail.displayName || null,
    hasRefreshToken: Boolean(gmail.refreshToken),
    isExpired,
    expiresAt: gmail.expiresAt || null,
    lastRefreshedAt: gmail.lastRefreshedAt || null,
  };
}

/**
 * Refreshes an expired Google OAuth access token using the stored refresh token
 */
export async function refreshGoogleAccessToken(): Promise<GetTokenResult> {
  const db = await getDatabase();
  const gmail = db.settings?.gmail;

  if (!gmail || !gmail.connected) {
    return {
      success: false,
      error: 'Gmail account is not connected. Please connect your Gmail account in Settings.',
      code: 'AUTH_REQUIRED',
    };
  }

  const refreshToken = gmail.refreshToken;
  if (!refreshToken) {
    console.warn('[GMAIL_OAUTH_REFRESH] No refresh token stored on server.');
    gmail.tokenExpired = true;
    await saveDatabase(db);
    return {
      success: false,
      error: 'Gmail authorization expired. Please reconnect Gmail.',
      code: 'AUTH_EXPIRED',
    };
  }

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    db.settings?.custom_google_client_secret?.trim() ||
    '';

  console.log('[GMAIL_OAUTH_REFRESH] Attempting to refresh Google access token for:', gmail.email);

  // Strategy 1: Google OAuth2 token endpoint (https://oauth2.googleapis.com/token)
  try {
    const params = new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const tokenData = await tokenRes.json();

    if (tokenRes.ok && tokenData.access_token) {
      const expiresInSec = Number(tokenData.expires_in) || 3600;
      const newExpiresAt = Date.now() + expiresInSec * 1000;

      gmail.accessToken = tokenData.access_token;
      gmail.expiresAt = newExpiresAt;
      gmail.lastRefreshedAt = new Date().toISOString();
      gmail.tokenExpired = false;
      await saveDatabase(db);

      console.log('[GMAIL_OAUTH_REFRESH] Successfully refreshed access token via Google OAuth2 endpoint.');
      return {
        success: true,
        accessToken: tokenData.access_token,
        email: gmail.email || 'pariaastha672@gmail.com',
      };
    } else {
      console.warn('[GMAIL_OAUTH_REFRESH] Google OAuth2 endpoint returned:', tokenData);
    }
  } catch (err: any) {
    console.warn('[GMAIL_OAUTH_REFRESH] Error calling Google OAuth2 endpoint:', err.message);
  }

  // Strategy 2: Firebase SecureToken API (https://securetoken.googleapis.com/v1/token)
  try {
    const stsParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const stsRes = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stsParams.toString(),
    });

    const stsData = await stsRes.json();

    if (stsRes.ok && (stsData.access_token || stsData.id_token)) {
      const effectiveToken = stsData.access_token || stsData.id_token;
      const expiresInSec = Number(stsData.expires_in) || 3600;
      const newExpiresAt = Date.now() + expiresInSec * 1000;

      // Check if new refresh token was rotated
      if (stsData.refresh_token) {
        gmail.refreshToken = stsData.refresh_token;
      }

      gmail.accessToken = effectiveToken;
      gmail.expiresAt = newExpiresAt;
      gmail.lastRefreshedAt = new Date().toISOString();
      gmail.tokenExpired = false;
      await saveDatabase(db);

      console.log('[GMAIL_OAUTH_REFRESH] Successfully refreshed token via SecureToken endpoint.');
      return {
        success: true,
        accessToken: effectiveToken,
        email: gmail.email || 'pariaastha672@gmail.com',
      };
    } else {
      console.warn('[GMAIL_OAUTH_REFRESH] SecureToken endpoint returned:', stsData);
    }
  } catch (err: any) {
    console.warn('[GMAIL_OAUTH_REFRESH] Error calling SecureToken endpoint:', err.message);
  }

  // If both failed, flag the token as expired
  gmail.tokenExpired = true;
  await saveDatabase(db);

  return {
    success: false,
    error: 'Gmail authorization expired. Please reconnect Gmail.',
    code: 'AUTH_EXPIRED',
  };
}

/**
 * Returns a valid, non-expired access token for sending via Gmail API.
 * Automatically refreshes using the stored refresh token if the current token is expired.
 */
export async function getValidGmailAccessToken(fallbackToken?: string | null): Promise<GetTokenResult> {
  const db = await getDatabase();
  const gmail = db.settings?.gmail;

  if (!gmail || !gmail.connected) {
    return {
      success: false,
      error: 'Gmail account is not connected. Please connect your Gmail account in Settings.',
      code: 'AUTH_REQUIRED',
    };
  }

  const now = Date.now();
  const currentToken = gmail.accessToken || fallbackToken || null;
  const isExpired = Boolean(
    gmail.tokenExpired ||
    (gmail.expiresAt && now >= gmail.expiresAt - 60_000) ||
    !currentToken
  );

  // If current token is valid and not close to expiring, return it
  if (currentToken && !isExpired) {
    return {
      success: true,
      accessToken: currentToken,
      email: gmail.email || 'pariaastha672@gmail.com',
    };
  }

  console.log('[GMAIL_OAUTH] Access token expired or missing. Refreshing using stored refresh token...');
  const refreshResult = await refreshGoogleAccessToken();
  if (refreshResult.success && refreshResult.accessToken) {
    return refreshResult;
  }

  // If refresh failed but fallback token is provided and hasn't been flagged expired yet,
  // allow one try with fallback token
  if (fallbackToken && !gmail.tokenExpired) {
    return {
      success: true,
      accessToken: fallbackToken,
      email: gmail.email || 'pariaastha672@gmail.com',
    };
  }

  return {
    success: false,
    error: 'Gmail authorization expired. Please reconnect Gmail.',
    code: 'AUTH_EXPIRED',
  };
}

/**
 * Securely stores updated credentials from the client-side Google popup authorization
 */
export async function storeGoogleCredentials(params: {
  email?: string;
  displayName?: string | null;
  photoURL?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresIn?: number | null;
}): Promise<void> {
  const db = await getDatabase();
  db.settings = db.settings || {};

  const currentGmail = db.settings.gmail || { connected: true };
  const expiresInSec = Number(params.expiresIn) || 3600;
  const expiresAt = Date.now() + expiresInSec * 1000;

  db.settings.gmail = {
    connected: true,
    email: params.email || currentGmail.email || 'pariaastha672@gmail.com',
    displayName: params.displayName !== undefined ? params.displayName : currentGmail.displayName,
    photoURL: params.photoURL !== undefined ? params.photoURL : currentGmail.photoURL,
    connectedAt: currentGmail.connectedAt || new Date().toISOString(),
    accessToken: params.accessToken || currentGmail.accessToken || null,
    // Store refresh token securely in database if received
    refreshToken: params.refreshToken || currentGmail.refreshToken || null,
    expiresAt,
    lastRefreshedAt: new Date().toISOString(),
    tokenExpired: false,
  };

  await saveDatabase(db);
  console.log(`[GMAIL_OAUTH_STORE] Securely saved credentials for ${db.settings.gmail.email}. Refresh token stored: ${Boolean(db.settings.gmail.refreshToken)}`);
}
