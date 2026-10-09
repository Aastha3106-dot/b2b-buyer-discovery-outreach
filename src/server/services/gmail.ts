import { EmailRecord, getDatabase } from '../db.ts';
import { getValidGmailAccessToken, refreshGoogleAccessToken } from './googleTokenManager.ts';

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  base64: string;
}

export interface SendGmailPayload {
  to: string;
  from?: string;
  subject: string;
  body: string;
  recipientName?: string;
  businessName?: string;
  buyerId?: string;
  accessToken?: string;
  attachments?: EmailAttachment[];
}

export interface SendGmailResult {
  success: boolean;
  status: 'Sent' | 'Failed';
  providerId?: string;
  error?: string;
  code?: string;
  record?: EmailRecord;
}

export function replacePlaceholders(
  template: string,
  variables: {
    business_name?: string;
    contact_name?: string;
    category?: string;
    city?: string;
    state?: string;
    website?: string;
  }
): string {
  let result = template;
  result = result.replace(/\{\{\s*business_name\s*\}\}/gi, variables.business_name || 'Valued Business Partner');
  result = result.replace(/\{\{\s*contact_name\s*\}\}/gi, variables.contact_name || 'Purchasing Manager');
  result = result.replace(/\{\{\s*category\s*\}\}/gi, variables.category || 'Home Decor');
  result = result.replace(/\{\{\s*city\s*\}\}/gi, variables.city || 'your area');
  result = result.replace(/\{\{\s*state\s*\}\}/gi, variables.state || 'US');
  result = result.replace(/\{\{\s*website\s*\}\}/gi, variables.website || '');
  return result;
}

function createMimeMessage(
  to: string,
  from: string,
  subject: string,
  htmlBody: string,
  attachments?: EmailAttachment[]
): string {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;

  if (!attachments || attachments.length === 0) {
    const messageParts = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody, 'utf-8').toString('base64'),
    ];
    const message = messageParts.join('\r\n');
    return Buffer.from(message, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Construct multipart/mixed MIME message for emails with attachments
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const lines: string[] = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody, 'utf-8').toString('base64'),
  ];

  for (const att of attachments) {
    const safeFilename = (att.filename || 'attachment').replace(/["\r\n]/g, '_');
    const mimeType = att.contentType || 'application/octet-stream';
    const cleanBase64 = att.base64.replace(/^data:[^;]+;base64,/, '').trim();
    // Break base64 into standard 76-character chunks
    const chunkedBase64 = cleanBase64.match(/.{1,76}/g)?.join('\r\n') || cleanBase64;

    lines.push(
      `--${boundary}`,
      `Content-Type: ${mimeType}; name="${safeFilename}"`,
      `Content-Disposition: attachment; filename="${safeFilename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      chunkedBase64
    );
  }

  lines.push(`--${boundary}--`, '');

  const fullMessage = lines.join('\r\n');
  return Buffer.from(fullMessage, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmailWithGmail(payload: SendGmailPayload): Promise<SendGmailResult> {
  if (!payload.to || !payload.to.includes('@')) {
    return {
      success: false,
      status: 'Failed',
      error: 'Invalid recipient email address.',
      code: 'INVALID_RECIPIENT',
    };
  }

  // Obtain valid token (refreshes automatically if expired using server refresh token)
  let activeToken = payload.accessToken;
  const tokenCheck = await getValidGmailAccessToken(payload.accessToken);
  if (!tokenCheck.success || !tokenCheck.accessToken) {
    return {
      success: false,
      status: 'Failed',
      error: tokenCheck.error || 'Gmail authorization expired. Please reconnect Gmail.',
      code: tokenCheck.code || 'AUTH_EXPIRED',
    };
  }
  activeToken = tokenCheck.accessToken;

  // Validate attachments size
  if (payload.attachments && payload.attachments.length > 0) {
    let totalSize = 0;
    for (const att of payload.attachments) {
      if (att.size > 12 * 1024 * 1024) {
        return {
          success: false,
          status: 'Failed',
          error: `Attachment "${att.filename}" (${(att.size / (1024 * 1024)).toFixed(1)} MB) exceeds 12 MB limit.`,
          code: 'ATTACHMENT_TOO_LARGE',
        };
      }
      totalSize += att.size;
    }

    if (totalSize > 18 * 1024 * 1024) {
      return {
        success: false,
        status: 'Failed',
        error: `Total attachments size (${(totalSize / (1024 * 1024)).toFixed(1)} MB) exceeds Gmail 18 MB raw limit (base64 encoded message limit is 25 MB).`,
        code: 'ATTACHMENT_TOO_LARGE',
      };
    }
  }

  // Personalize subject and body if variables provided
  const variables = {
    business_name: payload.businessName,
    contact_name: payload.recipientName,
  };
  const finalSubject = replacePlaceholders(payload.subject, variables);
  const finalBody = replacePlaceholders(payload.body, variables);

  const senderAddress = payload.from || tokenCheck.email || 'me';

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
      <div style="white-space: pre-wrap; font-size: 15px;">${finalBody
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px 0;" />
      <div style="font-size: 12px; color: #64748b;">
        Sent via <strong>HomeDecor Outreach</strong> · Direct Wholesale Inquiries
      </div>
    </div>
  `;

  try {
    const rawEncoded = createMimeMessage(
      payload.to,
      senderAddress,
      finalSubject,
      htmlContent,
      payload.attachments
    );

    let response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${activeToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: rawEncoded,
      }),
    });

    let data = await response.json();

    // If 401 Unauthorized occurs, automatically attempt token refresh using stored refresh token
    if (response.status === 401) {
      console.warn('[GMAIL_API] Access token was rejected with 401. Automatically refreshing token with refresh token...');
      const refreshRes = await refreshGoogleAccessToken();
      if (refreshRes.success && refreshRes.accessToken) {
        activeToken = refreshRes.accessToken;
        console.log('[GMAIL_API] Re-attempting Gmail API send with refreshed access token...');
        response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: rawEncoded,
          }),
        });
        data = await response.json();
      } else {
        return {
          success: false,
          status: 'Failed',
          error: 'Gmail authorization expired. Please reconnect Gmail.',
          code: 'AUTH_EXPIRED',
        };
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          status: 'Failed',
          error: 'Gmail authorization expired. Please reconnect Gmail.',
          code: 'AUTH_EXPIRED',
        };
      }
      const errorMsg = data?.error?.message || `Gmail API HTTP error ${response.status}`;
      return {
        success: false,
        status: 'Failed',
        error: errorMsg,
        code: 'GMAIL_API_ERROR',
      };
    }

    if (!data.id) {
      return {
        success: false,
        status: 'Failed',
        error: 'Gmail API did not return a valid message confirmation ID.',
        code: 'NO_CONFIRMATION',
      };
    }

    const emailRecord: EmailRecord = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      recipient: payload.to,
      recipient_name: payload.recipientName,
      business_name: payload.businessName,
      buyer_id: payload.buyerId,
      subject: finalSubject,
      body_preview: finalBody.substring(0, 140),
      provider: 'Gmail API',
      provider_id: data.id,
      status: 'Sent',
      raw_response: data,
      attachment_names: payload.attachments?.map((a) => a.filename) || [],
      attachments_count: payload.attachments?.length || 0,
    };

    return {
      success: true,
      status: 'Sent',
      providerId: data.id,
      record: emailRecord,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'Failed',
      error: err.message || 'Network error reaching Google Gmail API',
      code: 'NETWORK_ERROR',
    };
  }
}
