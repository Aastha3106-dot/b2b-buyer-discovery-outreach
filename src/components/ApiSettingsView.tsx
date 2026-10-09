import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  Database,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Lock,
  RefreshCw,
  HelpCircle,
  Save,
  Info,
  AlertCircle,
  Mail,
  ShieldAlert,
  AlertTriangle,
  Globe,
  LogOut,
  Send,
} from 'lucide-react';
import { IntegrationsStatusResponse } from '../types';
import { testIntegration, saveIntegrationSettings } from '../services/api';
import {
  initAuth,
  googleSignIn,
  disconnectGoogle,
  getConnectedUser,
  getAccessToken,
} from '../services/googleAuth';
import { User } from 'firebase/auth';

interface ApiSettingsViewProps {
  status: IntegrationsStatusResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const ApiSettingsView: React.FC<ApiSettingsViewProps> = ({
  status,
  isLoading,
  onRefresh,
}) => {
  const [testingService, setTestingService] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  // Google OAuth Auth State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setGoogleUser(user);
      },
      () => {
        const u = getConnectedUser();
        setGoogleUser(u);
      }
    );
    return () => unsub();
  }, []);

  const handleConnectGmail = async () => {
    setIsConnectingGoogle(true);
    setGoogleAuthError(null);
    try {
      const { user } = await googleSignIn();
      setGoogleUser(user);
      onRefresh();
    } catch (err: any) {
      setGoogleAuthError(err.message || 'Failed to authenticate with Google.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      await disconnectGoogle();
      setGoogleUser(null);
      onRefresh();
    } catch (err: any) {
      console.error(err);
    }
  };

  // Input states for updating configuration directly in-app
  const [serpapiKeyInput, setSerpapiKeyInput] = useState('');
  const [firecrawlApiKeyInput, setFirecrawlApiKeyInput] = useState('');
  const [resendApiKeyInput, setResendApiKeyInput] = useState('');
  const [emailFromInput, setEmailFromInput] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleTestConnection = async (integration: 'serpapi' | 'firecrawl' | 'resend' | 'database' | 'gmail') => {
    setTestingService(integration);
    const resp = await testIntegration(integration as any);
    setTestingService(null);
    setTestResults((prev) => ({
      ...prev,
      [integration]: { success: resp.success, message: resp.message },
    }));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    const payload: {
      serpapiKey?: string;
      firecrawlApiKey?: string;
      resendApiKey?: string;
      emailFrom?: string;
    } = {};

    if (serpapiKeyInput.trim()) payload.serpapiKey = serpapiKeyInput.trim();
    if (firecrawlApiKeyInput.trim()) payload.firecrawlApiKey = firecrawlApiKeyInput.trim();
    if (resendApiKeyInput.trim()) payload.resendApiKey = resendApiKeyInput.trim();
    if (emailFromInput.trim()) payload.emailFrom = emailFromInput.trim();

    const resp = await saveIntegrationSettings(payload);
    setIsSaving(false);

    if (resp.success) {
      setSaveMessage('Credentials saved securely into persistent database.');
      // Clear inputs
      setSerpapiKeyInput('');
      setFirecrawlApiKeyInput('');
      setResendApiKeyInput('');
      onRefresh();
      setTimeout(() => setSaveMessage(null), 4000);
    } else {
      alert(resp.error || 'Failed to update settings');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            API Integrations & Credential Settings
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Status of Google Maps SerpApi, Firecrawl Web Crawler, Resend Email Gateway, and persistent database.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {saveMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Primary Outbound Gateway: Gmail API + Google OAuth 2.0 */}
      {(() => {
        const gmailStatus = status?.gmail;
        const resendStatus = status?.resend;
        const isGmailConnected = Boolean(googleUser?.email || gmailStatus?.connected);
        const activeSender = googleUser?.email || gmailStatus?.connectedEmail || (resendStatus?.emailFrom || 'onboarding@resend.dev');
        const activeProvider = isGmailConnected ? 'Gmail API' : 'Resend';
        const operatingMode = isGmailConnected ? 'Production Mode' : 'Testing Mode';

        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm border border-red-100 shrink-0">
                  <Mail className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 tracking-tight">
                      Email Gateway: Gmail API (Google OAuth 2.0)
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                      Primary Provider
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Direct wholesale buyer outreach sent authenticated from your personal Gmail inbox
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isGmailConnected ? (
                  <>
                    <button
                      onClick={handleConnectGmail}
                      disabled={isConnectingGoogle}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isConnectingGoogle ? 'animate-spin' : ''}`} />
                      <span>{isConnectingGoogle ? 'Connecting...' : 'Reconnect Gmail'}</span>
                    </button>
                    <button
                      onClick={() => handleTestConnection('gmail')}
                      disabled={testingService === 'gmail'}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {testingService === 'gmail' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing Gmail API...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Test Connection</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDisconnectGmail}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 border border-slate-200"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleConnectGmail}
                    disabled={isConnectingGoogle}
                    type="button"
                    className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl border border-slate-300 shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isConnectingGoogle ? 'Opening Google Consent...' : 'Connect Gmail Account'}</span>
                  </button>
                )}
              </div>
            </div>

            {isGmailConnected && (gmailStatus?.tokenExpired || !gmailStatus?.hasRefreshToken) && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Gmail authorization expired. Please reconnect Gmail</strong> to grant offline refresh permissions and renew automatic sending.
                  </span>
                </div>
                <button
                  onClick={handleConnectGmail}
                  disabled={isConnectingGoogle}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg shrink-0 transition-colors shadow-xs"
                >
                  {isConnectingGoogle ? 'Opening Google...' : 'Reconnect Gmail'}
                </button>
              </div>
            )}

            {googleAuthError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{googleAuthError}</span>
              </div>
            )}

            {testResults.gmail && (
              <div
                className={`p-3.5 rounded-xl text-xs space-y-2 ${
                  testResults.gmail.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {testResults.gmail.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{testResults.gmail.message}</span>
                </div>
                {!testResults.gmail.success &&
                  (testResults.gmail.message.includes('expired') ||
                    testResults.gmail.message.includes('reconnect')) && (
                    <div className="pl-6.5">
                      <button
                        type="button"
                        onClick={handleConnectGmail}
                        disabled={isConnectingGoogle}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Authorize / Reconnect Gmail</span>
                      </button>
                    </div>
                  )}
              </div>
            )}

            {/* 4 Metric Summary Boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* 1. Connected Gmail */}
              <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
                  Connected Gmail
                </span>
                <div className="font-mono text-slate-900 font-semibold truncate text-[12px] pt-0.5" title={activeSender}>
                  {activeSender}
                </div>
                <div className="text-[11px] text-slate-500 pt-0.5">
                  Account: {isGmailConnected ? 'Authorized Personal Mailbox' : 'onboarding@resend.dev (Sandbox)'}
                </div>
              </div>

              {/* 2. Provider */}
              <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
                  Provider
                </span>
                <div className="pt-0.5 flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  {isGmailConnected ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                      <Send className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Gmail API</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      <span>Resend Fallback</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 pt-1">
                  Auth: {isGmailConnected ? 'OAuth 2.0 (Auto-Renewing)' : 'API Key Header'}
                </div>
              </div>

              {/* 3. Status */}
              <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
                  Status
                </span>
                <div className="pt-0.5">
                  {isGmailConnected ? (
                    gmailStatus?.tokenExpired ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Auth Expired</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Connected</span>
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Not Connected</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 pt-1">
                  {isGmailConnected
                    ? gmailStatus?.hasRefreshToken
                      ? 'Offline Refresh: Active'
                      : 'Outreach ready for real buyers'
                    : 'Click "Connect Gmail" to activate'}
                </div>
              </div>

              {/* 4. Operating Mode */}
              <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">
                  Testing vs Production
                </span>
                <div className="pt-0.5">
                  {isGmailConnected ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Production Mode</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Testing Mode</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 pt-1">
                  Domain verification: <strong className="text-slate-700 font-medium">Not Needed</strong>
                </div>
              </div>
            </div>

            {/* Mode & Domain Guidance Box */}
            {isGmailConnected ? (
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-950">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <strong className="font-bold text-emerald-950">
                    Production Gmail Outreach Active for {activeSender}
                  </strong>
                </div>
                <p className="leading-relaxed text-emerald-900 text-[11px]">
                  Outreach emails sent from the Email Composer or Batch Campaigns are dispatched through your personal Gmail account using the Google Workspace Gmail API. Recipient responses will arrive directly in your Gmail inbox.
                </p>
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800 font-mono">
                  <span>Scope: https://www.googleapis.com/auth/gmail.send (Least Privilege)</span>
                  <span>Security: Offline Refresh Token Stored on Server · Auto-Renewing</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3 text-xs text-amber-900">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="font-bold text-amber-950 block">
                      Connect Your Gmail Account to Enable Real Buyer Outreach
                    </strong>
                    <p className="leading-relaxed text-amber-900">
                      You do not need to buy or verify a custom domain. By connecting your Google account (<strong className="text-amber-950">pariaastha672@gmail.com</strong>), you grant permission to dispatch buyer pitches directly through Google’s secure Gmail API.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-200/80 space-y-1.5 text-amber-950">
                  <span className="font-semibold block uppercase tracking-wider text-[10px] text-amber-800">
                    Exact Steps to Switch to a Verified Domain (If ever desired in future):
                  </span>
                  <ol className="list-decimal pl-4 space-y-1 text-amber-900 text-[11px] leading-relaxed">
                    <li>
                      <strong>Default (No domain needed):</strong> Keep your personal Gmail account connected via the button above for instant production delivery.
                    </li>
                    <li>
                      <strong>Optional Company Domain:</strong> If you ever purchase or acquire a custom company domain in the future, add it at <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline font-semibold text-amber-950">resend.com/domains</a>.
                    </li>
                    <li>
                      <strong>DNS Records:</strong> Add the SPF/DKIM TXT records provided by Resend to your domain registrar.
                    </li>
                    <li>
                      <strong>Set EMAIL_FROM:</strong> Update <code className="font-mono bg-amber-100 px-1 rounded text-amber-950">EMAIL_FROM=&quot;contact@yourcompany.com&quot;</code> in your <code className="font-mono bg-amber-100 px-1 rounded text-amber-950">.env</code> file. No code modifications are required.
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Grid of 4 Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. SERPAPI */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                  S
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">SerpApi</h3>
                  <div className="text-[11px] text-slate-500">Google Local / Maps Data Provider</div>
                </div>
              </div>

              {status?.serpapi.configured ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Configured</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Missing Key</span>
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Environment Variable:</span>
                <code className="text-slate-800 font-mono text-[11px]">SERPAPI_KEY</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Key Status:</span>
                <span className="font-mono text-slate-700">
                  {status?.serpapi.maskedKey || 'Not configured'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Source:</span>
                <span className="text-slate-700 capitalize">
                  {status?.serpapi.source === 'env_var' ? 'Container Environment' : status?.serpapi.source === 'custom_settings' ? 'Database Settings' : 'Unset'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Provides real US business records including store address, phone numbers, website URLs, and ratings. 
              Free tier includes 100 free searches/month.
            </p>

            {testResults.serpapi && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  testResults.serpapi.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResults.serpapi.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{testResults.serpapi.message}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <a
              href="https://serpapi.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
            >
              <span>Get API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              onClick={() => handleTestConnection('serpapi')}
              disabled={testingService === 'serpapi' || !status?.serpapi.configured}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              {testingService === 'serpapi' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>
          </div>
        </div>

        {/* 2. FIRECRAWL */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                  F
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Firecrawl</h3>
                  <div className="text-[11px] text-slate-500">Web Scraper & Public Email Crawler</div>
                </div>
              </div>

              {status?.firecrawl.configured ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Configured</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Missing Key</span>
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Environment Variable:</span>
                <code className="text-slate-800 font-mono text-[11px]">FIRECRAWL_API_KEY</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Key Status:</span>
                <span className="font-mono text-slate-700">
                  {status?.firecrawl.maskedKey || 'Not configured'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Source:</span>
                <span className="text-slate-700 capitalize">
                  {status?.firecrawl.source === 'env_var' ? 'Container Environment' : status?.firecrawl.source === 'custom_settings' ? 'Database Settings' : 'Unset'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Scrapes publicly accessible official retailer websites and contact pages to discover verified public business emails.
              Free tier includes 500 crawl credits.
            </p>

            {testResults.firecrawl && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  testResults.firecrawl.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResults.firecrawl.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{testResults.firecrawl.message}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <a
              href="https://www.firecrawl.dev/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
            >
              <span>Get API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              onClick={() => handleTestConnection('firecrawl')}
              disabled={testingService === 'firecrawl' || !status?.firecrawl.configured}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              {testingService === 'firecrawl' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>
          </div>
        </div>

        {/* 3. RESEND */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                  R
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Resend</h3>
                  <div className="text-[11px] text-slate-500">Transactional & Outreach Email Dispatch</div>
                </div>
              </div>

              {status?.resend.configured ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Configured</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Missing Key</span>
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Environment Variables:</span>
                <code className="text-slate-800 font-mono text-[11px]">RESEND_API_KEY, EMAIL_FROM</code>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Key Status:</span>
                <span className="font-mono text-slate-700">
                  {status?.resend.maskedKey || 'Not configured'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sender Address:</span>
                <span className="font-mono text-slate-700 text-[11px] truncate max-w-[180px]">
                  {status?.resend.emailFrom || 'onboarding@resend.dev'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Dispatches personalized pitches directly to buyer inboxes with delivery receipt tracking.
              Free tier includes 3,000 emails/month.
            </p>

            {testResults.resend && (
              <div
                className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                  testResults.resend.success
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testResults.resend.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{testResults.resend.message}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <a
              href="https://resend.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
            >
              <span>Get API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              onClick={() => handleTestConnection('resend')}
              disabled={testingService === 'resend' || !status?.resend.configured}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              {testingService === 'resend' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>
          </div>
        </div>

        {/* 4. DATABASE */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Persistent Database</h3>
                  <div className="text-[11px] text-slate-500">Atomic Safe JSON Disk Storage</div>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Connected</span>
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Saved Buyers Table:</span>
                <span className="font-mono font-semibold text-slate-800 tabular-nums">
                  {status?.database.records.buyers ?? 0} records
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Search History Table:</span>
                <span className="font-mono font-semibold text-slate-800 tabular-nums">
                  {status?.database.records.searches ?? 0} queries
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email History Table:</span>
                <span className="font-mono font-semibold text-slate-800 tabular-nums">
                  {status?.database.records.emails ?? 0} transmissions
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              All saved business records, historical searches, and outreach logs survive app restarts and page reloads via atomic safe persistence.
            </p>

            {testResults.database && (
              <div className="p-2.5 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{testResults.database.message}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">Disk Location: ./data/db.json</span>
            <button
              onClick={() => handleTestConnection('database')}
              disabled={testingService === 'database'}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              {testingService === 'database' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <span>Verify Health</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* In-App Direct Key Configuration Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>Configure API Keys In-App (Internship Testing Console)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              You can set these keys directly here for evaluation without touching server environment files. Values are stored securely on the server.
            </p>
          </div>
          <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Never exposed to client browsers</span>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                SerpApi API Key
              </label>
              <input
                type="password"
                value={serpapiKeyInput}
                onChange={(e) => setSerpapiKeyInput(e.target.value)}
                placeholder={status?.serpapi.configured ? 'Configured (leave blank to keep)' : 'Paste SerpApi API key...'}
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Firecrawl API Key
              </label>
              <input
                type="password"
                value={firecrawlApiKeyInput}
                onChange={(e) => setFirecrawlApiKeyInput(e.target.value)}
                placeholder={status?.firecrawl.configured ? 'Configured (leave blank to keep)' : 'Paste Firecrawl API key...'}
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Resend API Key
              </label>
              <input
                type="password"
                value={resendApiKeyInput}
                onChange={(e) => setResendApiKeyInput(e.target.value)}
                placeholder={status?.resend.configured ? 'Configured (leave blank to keep)' : 're_123456...'}
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Resend Sender Address (EMAIL_FROM)
              </label>
              <input
                type="text"
                value={emailFromInput}
                onChange={(e) => setEmailFromInput(e.target.value)}
                placeholder="HomeDecor Outreach <onboarding@resend.dev>"
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-slate-400">
              * Note: Environment variables take precedence unless custom settings are entered here.
            </p>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Integration Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
