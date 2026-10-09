import React, { useState } from 'react';
import {
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Mail,
  ShieldCheck,
  Paperclip,
  Trash2,
  FileText,
} from 'lucide-react';
import { Buyer, EmailAttachment } from '../types';
import { sendEmail } from '../services/api';
import { getConnectedUser, googleSignIn, getAccessToken, hasValidToken } from '../services/googleAuth';

interface ComposeEmailModalProps {
  buyer: Buyer | null;
  onClose: () => void;
  onSent: () => void;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  buyer,
  onClose,
  onSent,
}) => {
  if (!buyer) return null;

  const defaultEmail = buyer.discovered_emails?.[0]?.email || '';
  const connectedUser = getConnectedUser();

  const [recipientEmail, setRecipientEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState(
    `Wholesale Home Decor Catalog Inquiry for ${buyer.business_name}`
  );
  const [body, setBody] = useState(
    `Hello Purchasing Team at ${buyer.business_name},

I hope this message finds you well.

I came across ${buyer.business_name} in ${buyer.city || buyer.state || 'your area'} and wanted to reach out regarding our artisan home decor collections. We specialize in handcrafted ceramics, decorative tableware, and statement furnishings designed for discerning boutique retailers.

We offer low minimum order quantities, fast domestic delivery, and favorable wholesale margins for our retail partners.

Would you be open to reviewing our current digital line sheet and catalog?

Warm regards,

Aastha Arora
Product Zone International`
  );

  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);

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

      // Single file limit: 10MB
      if (file.size > 10 * 1024 * 1024) {
        setAttachmentError(`"${file.name}" exceeds the 10 MB limit for Gmail attachments.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      newTotal += file.size;
      // Total raw attachment limit: 18MB (stays under 25MB base64 message size)
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

  const handleConnectGmail = async () => {
    setIsConnectingGmail(true);
    setStatus(null);
    try {
      await googleSignIn();
      setStatus({
        success: true,
        message: 'Gmail account connected successfully! You can now send this pitch.',
      });
    } catch (err: any) {
      setStatus({
        success: false,
        message: err.message || 'Failed to connect Google account.',
      });
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail || !recipientEmail.includes('@')) {
      alert('Please enter a valid recipient email.');
      return;
    }

    setIsSending(true);
    setStatus(null);

    const emailAttachments: EmailAttachment[] = attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      base64: a.base64,
    }));

    const resp = await sendEmail({
      recipientEmail,
      recipientName: 'Purchasing Manager',
      businessName: buyer.business_name,
      subject,
      body,
      buyerId: buyer.id,
      attachments: emailAttachments.length > 0 ? emailAttachments : undefined,
    });

    setIsSending(false);

    if (resp.success) {
      const attMsg = attachments.length > 0 ? ` with ${attachments.length} attachment(s)` : '';
      setStatus({
        success: true,
        message: `Email successfully sent via Gmail API${attMsg}! Message ID: ${resp.providerId || 'Confirmed'}`,
      });
      onSent();
      setTimeout(() => {
        onClose();
      }, 2000);
    } else {
      const isExpired =
        resp.code === 'AUTH_EXPIRED' ||
        resp.code === 'TOKEN_EXPIRED' ||
        resp.error?.toLowerCase().includes('expired') ||
        resp.error?.toLowerCase().includes('reconnect');

      setStatus({
        success: false,
        message: isExpired
          ? 'Gmail authorization expired. Please reconnect Gmail.'
          : (resp.error || 'Failed to send email through Gmail API.'),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs border border-red-100">
              <Mail className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Direct Pitch to {buyer.business_name}
              </h3>
              <p className="text-[11px] text-slate-500">
                Dispatched via Google Workspace Gmail API from your inbox
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sender Info Badge */}
        <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-500 shrink-0 font-medium">Sending From:</span>
            <span className="font-mono text-slate-900 font-semibold truncate">
              {connectedUser?.email || 'pariaastha672@gmail.com'}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
              Gmail API
            </span>
          </div>
          <button
            type="button"
            onClick={handleConnectGmail}
            disabled={isConnectingGmail}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>{isConnectingGmail ? 'Connecting...' : hasValidToken() ? 'Reconnect Gmail' : 'Authorize Gmail'}</span>
          </button>
        </div>

        {!hasValidToken() && !status && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Gmail authorization expired. Please reconnect Gmail.</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleConnectGmail}
              disabled={isConnectingGmail}
              className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-[11px] rounded-lg shrink-0 transition-colors shadow-xs"
            >
              {isConnectingGmail ? 'Opening Google...' : 'Reconnect Gmail'}
            </button>
          </div>
        )}

        {status && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
              status.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {status.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1.5 flex-1">
              <div className="font-semibold">
                {status.success ? 'Outreach Delivered' : 'Delivery Failed'}
              </div>
              <p className="leading-relaxed text-[11px]">{status.message}</p>
              {!status.success &&
                (status.message.toLowerCase().includes('expired') ||
                  status.message.toLowerCase().includes('reconnect') ||
                  status.message.toLowerCase().includes('not connected') ||
                  status.message.toLowerCase().includes('authorization')) && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleConnectGmail}
                      disabled={isConnectingGmail}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] rounded-lg transition-colors shadow-xs"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{isConnectingGmail ? 'Opening Google...' : 'Authorize / Connect Gmail'}</span>
                    </button>
                  </div>
                )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Recipient Email Address
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Body
            </label>
            <textarea
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3.5 bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-sans leading-relaxed"
              required
            />
          </div>

          {/* Attachments Section */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
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

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Requires user confirmation · Logged in Email History</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
