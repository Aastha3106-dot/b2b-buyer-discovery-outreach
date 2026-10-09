import React, { useState } from 'react';
import {
  Send,
  Users,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldAlert,
  Mail,
  RefreshCw,
  HelpCircle,
  Sliders,
  Check,
  Paperclip,
  Trash2,
  FileText,
} from 'lucide-react';
import { Buyer, EmailAttachment } from '../types';
import { sendEmail, sendTestEmail } from '../services/api';
import { initAuth, googleSignIn, getConnectedUser, getAccessToken } from '../services/googleAuth';
import { NavTab } from './Navigation';

interface EmailCampaignsViewProps {
  allSavedBuyers: Buyer[];
  preselectedBuyers?: Buyer[];
  onOutreachComplete: () => void;
  onNavigate: (tab: NavTab) => void;
}

const EMAIL_TEMPLATES = [
  {
    id: 'wholesale_catalog',
    name: 'Wholesale Catalog & Stockist Inquiry',
    subject: 'Wholesale Catalog & Product Inquiry for {{business_name}}',
    body: `Hello {{contact_name}},

I hope you are having a wonderful week.

I came across {{business_name}} while reviewing prominent home decor and design retailers in {{city}}, and I am truly impressed by your curated collection and aesthetic.

We are an established design and manufacturing studio specializing in handcrafted home decor, statement lighting, and artisanal accent furnishings. We are currently expanding our retail stockist network and would love to introduce our latest wholesale catalog to your purchasing team.

Highlights of our wholesale partnership program:
• Low opening order minimums ($500)
• Net-30 terms available on approved accounts
• 2-3 week domestic US shipping fulfillment
• High-margin retail markups (2.2x to 2.5x)

Would you be open to receiving a digital lookbook and sample catalog for {{business_name}}?

Warm regards,

B2B Trade Relations Team
HomeDecor Buyer Finder`,
  },
  {
    id: 'artisan_collection',
    name: 'Handcrafted Artisan Decor Showcase',
    subject: 'New Artisan Home Decor Collection for {{business_name}}',
    body: `Dear {{business_name}} Team,

We have been following your curated showroom in {{city}} and love the focus on exceptional interior aesthetics.

Our studio crafts sustainable ceramic homeware, organic linen textiles, and architectural table accents tailored specifically for discerning boutique buyers.

We would love to provide {{business_name}} with exclusive regional territory rights for our upcoming seasonal collection.

May I send over our linesheet with trade pricing and product samples?

Best regards,

Artisan Collections Representative`,
  },
  {
    id: 'interior_design_trade',
    name: 'Interior Designer & Trade Program',
    subject: 'Exclusive Trade Discount Program for {{business_name}}',
    body: `Hello {{contact_name}},

We recognize the high caliber of interior projects curated by {{business_name}}.

We are pleased to invite your firm to join our Direct Trade Program, offering up to 35% off retail list pricing, expedited priority fulfillment, and custom fabrication capabilities for residential and commercial spaces.

Could I share our designer trade package and swatch kits with your team?

Sincerely,

Trade Director`,
  },
];

export const EmailCampaignsView: React.FC<EmailCampaignsViewProps> = ({
  allSavedBuyers,
  preselectedBuyers,
  onOutreachComplete,
  onNavigate,
}) => {
  // Eligible buyers must have at least one discovered email
  const eligibleBuyers = allSavedBuyers.filter(
    (b) => b.discovered_emails && b.discovered_emails.length > 0
  );

  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>(
    preselectedBuyers && preselectedBuyers.length > 0
      ? preselectedBuyers.filter((b) => b.discovered_emails?.length > 0).map((b) => b.id)
      : eligibleBuyers.slice(0, 5).map((b) => b.id)
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState(EMAIL_TEMPLATES[0].id);
  const [subject, setSubject] = useState(EMAIL_TEMPLATES[0].subject);
  const [body, setBody] = useState(EMAIL_TEMPLATES[0].body);

  // Test email state
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Preview state
  const [previewIndex, setPreviewIndex] = useState(0);

  // Confirmation & sending state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number; currentBuyer?: string } | null>(null);
  const [batchResults, setBatchResults] = useState<{
    successful: number;
    failed: number;
    details: { name: string; email: string; success: boolean; error?: string }[];
  } | null>(null);

  const selectedBuyers = eligibleBuyers.filter((b) => selectedBuyerIds.includes(b.id));

  // Change template handler
  const handleTemplateChange = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const tmpl = EMAIL_TEMPLATES.find((t) => t.id === tmplId);
    if (tmpl) {
      setSubject(tmpl.subject);
      setBody(tmpl.body);
    }
  };

  const getPersonalizedContent = (buyer?: Buyer) => {
    const bName = buyer?.business_name || 'Boutique Home Decor';
    const cCity = buyer?.city || buyer?.state || 'your market';
    const cName = 'Purchasing Team';

    const pSubject = subject
      .replace(/\{\{\s*business_name\s*\}\}/gi, bName)
      .replace(/\{\{\s*city\s*\}\}/gi, cCity)
      .replace(/\{\{\s*contact_name\s*\}\}/gi, cName);

    const pBody = body
      .replace(/\{\{\s*business_name\s*\}\}/gi, bName)
      .replace(/\{\{\s*city\s*\}\}/gi, cCity)
      .replace(/\{\{\s*contact_name\s*\}\}/gi, cName);

    return { subject: pSubject, body: pBody };
  };

  // Attachments State
  interface SelectedAttachment {
    id: string;
    filename: string;
    contentType: string;
    size: number;
    base64: string;
    formattedSize: string;
  }

  const [attachments, setAttachments] = useState<SelectedAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAttachmentError(null);

    const currentTotal = attachments.reduce((sum, a) => sum + a.size, 0);
    let newTotal = currentTotal;
    const newAttachments: SelectedAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > 10 * 1024 * 1024) {
        setAttachmentError(`"${file.name}" exceeds the 10 MB limit for Gmail attachments.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      newTotal += file.size;
      if (newTotal > 18 * 1024 * 1024) {
        setAttachmentError('Total attachments exceed 18 MB limit (Gmail allows max 25 MB message size including encoding).');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      try {
        const base64Data = await new Promise<{ base64: string; contentType: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const commaIdx = res.indexOf(',');
            resolve({
              base64: commaIdx !== -1 ? res.substring(commaIdx + 1) : res,
              contentType: file.type || 'application/octet-stream',
            });
          };
          reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`));
          reader.readAsDataURL(file);
        });

        newAttachments.push({
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          filename: file.name,
          contentType: base64Data.contentType,
          size: file.size,
          base64: base64Data.base64,
          formattedSize: formatFileSize(file.size),
        });
      } catch (err: any) {
        setAttachmentError(err.message || 'Error processing attachment');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachmentError(null);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      alert('Please enter a valid email address to receive the test.');
      return;
    }

    setIsSendingTest(true);
    setTestStatus(null);

    const emailAttachments: EmailAttachment[] = attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      base64: a.base64,
    }));

    const preview = getPersonalizedContent(selectedBuyers[0]);
    const resp = await sendTestEmail({
      testEmail: testEmailAddress,
      subject: `[Test] ${preview.subject}`,
      body: preview.body,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });

    setIsSendingTest(false);
    if (resp.success) {
      const attMsg = attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : '';
      setTestStatus({
        success: true,
        message: `Test email successfully sent via Gmail API${attMsg}! Check ${testEmailAddress}. Provider ID: ${resp.providerId || 'Confirmed'}`,
      });
    } else {
      const isExpired =
        resp.code === 'AUTH_EXPIRED' ||
        resp.code === 'TOKEN_EXPIRED' ||
        resp.error?.toLowerCase().includes('expired') ||
        resp.error?.toLowerCase().includes('reconnect');

      setTestStatus({
        success: false,
        message: isExpired
          ? 'Gmail authorization expired. Please reconnect Gmail.'
          : `Test email failed: ${resp.error || 'Failed to dispatch test message.'}`,
      });
    }
  };

  const handleStartBatchSend = async () => {
    setShowConfirmModal(false);

    setIsSendingBatch(true);
    setBatchResults(null);

    const emailAttachments: EmailAttachment[] = attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      base64: a.base64,
    }));

    const details: { name: string; email: string; success: boolean; error?: string }[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < selectedBuyers.length; i++) {
      const buyer = selectedBuyers[i];
      const targetEmail = buyer.discovered_emails[0]?.email;

      setSendProgress({
        current: i + 1,
        total: selectedBuyers.length,
        currentBuyer: buyer.business_name,
      });

      if (!targetEmail) {
        failed++;
        details.push({
          name: buyer.business_name,
          email: 'None',
          success: false,
          error: 'No email found',
        });
        continue;
      }

      const { subject: pSubject, body: pBody } = getPersonalizedContent(buyer);

      const resp = await sendEmail({
        recipientEmail: targetEmail,
        recipientName: 'Purchasing Manager',
        businessName: buyer.business_name,
        subject: pSubject,
        body: pBody,
        buyerId: buyer.id,
        attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
      });

      if (resp.success) {
        successful++;
        details.push({
          name: buyer.business_name,
          email: targetEmail,
          success: true,
        });
      } else {
        failed++;
        const isExpired =
          resp.code === 'AUTH_EXPIRED' ||
          resp.code === 'TOKEN_EXPIRED' ||
          resp.error?.toLowerCase().includes('expired') ||
          resp.error?.toLowerCase().includes('reconnect');

        details.push({
          name: buyer.business_name,
          email: targetEmail,
          success: false,
          error: isExpired
            ? 'Gmail authorization expired. Please reconnect Gmail.'
            : (resp.error || 'Provider rejected request'),
        });
      }

      // Small throttle to be courteous to email API provider limits
      if (i < selectedBuyers.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    setIsSendingBatch(false);
    setSendProgress(null);
    setBatchResults({ successful, failed, details });
    onOutreachComplete();
  };

  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  React.useEffect(() => {
    const unsub = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(getConnectedUser())
    );
    return () => unsub();
  }, []);

  const handleConnectGmail = async () => {
    setIsConnectingGoogle(true);
    try {
      const res = await googleSignIn();
      setGoogleUser(res.user);
    } catch (e) {
      console.error(e);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Email Campaigns & B2B Outreach
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Personalize and dispatch professional wholesale pitches to saved decor buyers with discovered emails.
          </p>
        </div>
        <div className="text-xs text-slate-600 flex items-center gap-2 self-start sm:self-auto bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <span className={`w-2 h-2 rounded-full ${googleUser ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          <span>{googleUser ? `Connected: ${googleUser.email} (Gmail API)` : 'Gmail Awaiting Connection'}</span>
        </div>
      </div>

      {!googleUser && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong className="font-bold text-amber-950 block">Connect Your Gmail Account to Dispatch Campaigns</strong>
              <span>Authorize your personal Gmail account via Google OAuth 2.0 to send emails directly from your inbox with no custom domain verification needed.</span>
            </div>
          </div>
          <button
            onClick={handleConnectGmail}
            disabled={isConnectingGoogle}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl shrink-0 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{isConnectingGoogle ? 'Connecting...' : 'Connect Gmail'}</span>
          </button>
        </div>
      )}

      {/* Batch Send Results Card */}
      {batchResults && (
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Outreach Campaign Summary</span>
            </h3>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-emerald-700 font-semibold">{batchResults.successful} Sent</span>
              <span className="text-rose-600 font-semibold">{batchResults.failed} Failed</span>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs border border-slate-100 rounded-lg">
            {batchResults.details.map((item, idx) => (
              <div key={idx} className="p-2.5 flex items-center justify-between">
                <div>
                  <strong className="text-slate-900">{item.name}</strong>
                  <span className="text-slate-400 font-mono ml-2">({item.email})</span>
                </div>
                <div>
                  {item.success ? (
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                      Sent via Gmail API
                    </span>
                  ) : (
                    <span className="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded">
                      {item.error || 'Failed'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {batchResults.failed > 0 && batchResults.details.some(d => d.error?.includes('not connected') || d.error?.includes('AUTH_REQUIRED')) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Buyer emails were blocked because your Gmail account is not yet connected.</span>
              </div>
              <button
                onClick={handleConnectGmail}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Connect Gmail Account →
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => onNavigate('email-history')}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              View Full Email History →
            </button>
          </div>
        </div>
      )}

      {/* Sending Progress Overlay Card */}
      {isSendingBatch && sendProgress && (
        <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-950">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Dispatching email to {sendProgress.currentBuyer}...</span>
            </div>
            <span className="font-mono tabular-nums">
              {sendProgress.current} / {sendProgress.total}
            </span>
          </div>
          <div className="w-full h-2 bg-indigo-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-indigo-700">
            Applying personalization tokens and recording delivery responses in Resend log...
          </p>
        </div>
      )}

      {/* Main Grid: 2 Columns (Configuration + Live Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recipients & Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Select Recipients */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>1. Select Verified Recipients ({selectedBuyers.length} selected)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Only saved buyers with discovered emails are eligible.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBuyerIds(eligibleBuyers.map((b) => b.id))}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Select All
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedBuyerIds([])}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Clear
                </button>
              </div>
            </div>

            {eligibleBuyers.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-2">
                <p>No saved buyers currently have discovered email addresses.</p>
                <button
                  onClick={() => onNavigate('saved-buyers')}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Go to Saved Buyers to crawl websites with Firecrawl →
                </button>
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg text-xs">
                {eligibleBuyers.map((buyer) => {
                  const isChecked = selectedBuyerIds.includes(buyer.id);
                  const email = buyer.discovered_emails[0]?.email;
                  return (
                    <label
                      key={buyer.id}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50/70 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedBuyerIds((prev) =>
                              isChecked
                                ? prev.filter((id) => id !== buyer.id)
                                : [...prev, buyer.id]
                            );
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-semibold text-slate-900 truncate">
                          {buyer.business_name}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 shrink-0">
                        {email}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Choose Template & Customize Draft */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>2. Pitch Template & Message Personalization</span>
              </h3>
            </div>

            {/* Template Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {EMAIL_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleTemplateChange(tmpl.id)}
                  className={`p-2.5 text-left rounded-lg border text-xs transition-colors ${
                    selectedTemplateId === tmpl.id
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="truncate">{tmpl.name}</div>
                </button>
              ))}
            </div>

            {/* Token Cheat Sheet */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Available tokens:</span>
              <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
                &#123;&#123;business_name&#125;&#125;
              </code>
              <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
                &#123;&#123;city&#125;&#125;
              </code>
              <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
                &#123;&#123;contact_name&#125;&#125;
              </code>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Body Text
              </label>
              <textarea
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full p-3.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed font-sans"
              />
            </div>

            {/* Campaign Attachments Section */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span>Attach File</span>
                  </button>

                  {attachments.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Attachments ({attachments.length})
                    </span>
                  )}
                </div>

                {attachments.length > 0 ? (
                  <span className="text-[11px] text-slate-500 font-mono">
                    Total: {formatFileSize(attachments.reduce((sum, a) => sum + a.size, 0))} / 18 MB limit
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    Max 10 MB per file · 18 MB total
                  </span>
                )}
              </div>

              {attachmentError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  <span>{attachmentError}</span>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate" title={att.filename}>
                            {att.filename}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {att.contentType.split('/')[1]?.toUpperCase() || 'FILE'} · {att.formattedSize}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0"
                        title="Remove attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Recipient Preview & Dispatch Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Preview Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>Personalized Recipient Preview</span>
              </h3>
              {selectedBuyers.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                    disabled={previewIndex === 0}
                    className="px-2 py-0.5 border border-slate-200 rounded text-slate-600 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="font-mono text-slate-500">
                    {previewIndex + 1}/{selectedBuyers.length}
                  </span>
                  <button
                    onClick={() =>
                      setPreviewIndex((prev) =>
                        Math.min(selectedBuyers.length - 1, prev + 1)
                      )
                    }
                    disabled={previewIndex >= selectedBuyers.length - 1}
                    className="px-2 py-0.5 border border-slate-200 rounded text-slate-600 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {selectedBuyers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                Select at least one recipient to view live personalized rendering.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 text-xs">
                <div className="space-y-1 pb-2 border-b border-slate-200">
                  <div className="text-slate-500">
                    To:{' '}
                    <strong className="text-slate-900 font-mono">
                      {selectedBuyers[previewIndex]?.discovered_emails[0]?.email}
                    </strong>{' '}
                    ({selectedBuyers[previewIndex]?.business_name})
                  </div>
                  <div className="text-slate-500">
                    Subject:{' '}
                    <span className="text-slate-900 font-semibold">
                      {getPersonalizedContent(selectedBuyers[previewIndex]).subject}
                    </span>
                  </div>
                </div>

                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-sans max-h-72 overflow-y-auto pr-1">
                  {getPersonalizedContent(selectedBuyers[previewIndex]).body}
                </div>

                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-400">
                  Previewing dynamic values for:{' '}
                  <strong className="text-slate-600 font-medium">
                    {selectedBuyers[previewIndex]?.business_name}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Test Email Section */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>Send Verification Test to Your Inbox</span>
            </h3>
            <p className="text-xs text-slate-500">
              Verify your Gmail API connection, template formatting, and file attachments before contacting real buyers.
            </p>

            <form onSubmit={handleSendTest} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="your-email@domain.com"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="submit"
                  disabled={isSendingTest || !testEmailAddress}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {isSendingTest ? 'Sending...' : 'Send Test'}
                </button>
              </div>

              {testStatus && (
                <div
                  className={`p-2.5 rounded-lg text-xs space-y-1.5 ${
                    testStatus.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {testStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{testStatus.message}</span>
                  </div>
                  {!testStatus.success && testStatus.message.includes('expired') && (
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await googleSignIn();
                            setTestStatus({
                              success: true,
                              message: 'Gmail account re-authorized successfully! You can now send tests and campaigns.',
                            });
                          } catch (e: any) {
                            alert(e.message || 'Failed to connect Gmail');
                          }
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] rounded-md transition-colors"
                      >
                        Authorize / Reconnect Gmail
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Primary Dispatch Action */}
          <div className="bg-indigo-600 rounded-xl p-5 text-white shadow-xs space-y-3">
            <div className="font-bold text-sm">Ready to Send Campaign?</div>
            <p className="text-xs text-indigo-100 leading-relaxed">
              Every message is uniquely personalized. Before sending, an explicit confirmation modal reviews all recipients.
            </p>
            <button
              type="button"
              disabled={selectedBuyers.length === 0 || isSendingBatch}
              onClick={() => setShowConfirmModal(true)}
              className="w-full py-2.5 bg-white hover:bg-slate-50 text-indigo-900 font-bold text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-indigo-600" />
              <span>Review & Confirm Outreach ({selectedBuyers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-indigo-950">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Confirm B2B Campaign Outreach</h3>
                <p className="text-xs text-slate-500">
                  Verify recipient count and Gmail API delivery parameters.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Recipients:</span>
                <strong className="text-slate-900 font-mono">{selectedBuyers.length} businesses</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sending Account:</span>
                <strong className="text-slate-900 font-mono">{googleUser?.email || 'pariaastha672@gmail.com'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email Gateway:</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Gmail API (Google OAuth 2.0)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Subject:</span>
                <span className="text-slate-900 font-semibold truncate max-w-[240px]">{subject}</span>
              </div>
              {attachments.length > 0 && (
                <div className="flex justify-between items-start gap-2 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 shrink-0">Attached Files ({attachments.length}):</span>
                  <div className="text-right">
                    <span className="text-indigo-900 font-semibold block truncate max-w-[240px]">
                      {attachments.map((a) => a.filename).join(', ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatFileSize(attachments.reduce((sum, a) => sum + a.size, 0))} total
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-600 leading-relaxed space-y-1.5">
              <p>
                • Each business will receive a uniquely personalized pitch tailored to their store name and location.
              </p>
              <p>
                • Dispatched directly through your personal Gmail account with official Google message IDs logged to your Email History.
              </p>
              <p>
                • Prospective buyer responses will arrive directly into your personal Gmail inbox.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartBatchSend}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Confirm & Send Campaign</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
