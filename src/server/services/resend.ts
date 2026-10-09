import { getEffectiveKeys, EmailRecord } from '../db.ts';

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  recipientName?: string;
  businessName?: string;
  buyerId?: string;
}

export interface SendEmailResult {
  success: boolean;
  status: 'Accepted' | 'Failed';
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

export async function sendEmailWithResend(payload: SendEmailPayload): Promise<SendEmailResult> {
  const { resendApiKey, emailFrom } = await getEffectiveKeys();

  if (!resendApiKey) {
    return {
      success: false,
      status: 'Failed',
      error: 'RESEND_API_KEY is not configured. Please add it to your environment or configure it in the API Settings page.',
      code: 'MISSING_KEY',
    };
  }

  if (!payload.to || !payload.to.includes('@')) {
    return {
      success: false,
      status: 'Failed',
      error: 'Invalid recipient email address.',
      code: 'INVALID_RECIPIENT',
    };
  }

  // Personalize subject and body if variables provided
  const variables = {
    business_name: payload.businessName,
    contact_name: payload.recipientName,
  };
  const finalSubject = replacePlaceholders(payload.subject, variables);
  const finalBody = replacePlaceholders(payload.body, variables);

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; line-height: 1.6;">
      <div style="white-space: pre-wrap; font-size: 15px;">${finalBody
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px 0;" />
      <div style="font-size: 12px; color: #64748b;">
        Sent via <strong>HomeDecor Buyer Finder</strong> · B2B Outreach Portal
      </div>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [payload.to],
        subject: finalSubject,
        text: finalBody,
        html: htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      let errorMsg = data?.message || data?.error?.message || `Resend error HTTP ${response.status}`;
      
      // Specifically detect domain verification and sandbox restrictions
      const isDomainRestriction =
        response.status === 403 ||
        errorMsg.toLowerCase().includes('testing emails') ||
        errorMsg.toLowerCase().includes('verify a domain') ||
        errorMsg.toLowerCase().includes('own email address') ||
        errorMsg.toLowerCase().includes('domain is not verified');

      if (isDomainRestriction) {
        errorMsg = `Resend Domain Restriction: You are currently operating in TESTING MODE with sender "${emailFrom}". Resend permits sending testing emails ONLY to your own verified account email. Outbound delivery to external buyer leads requires verifying your own company domain at resend.com/domains and configuring EMAIL_FROM.`;
      }

      return {
        success: false,
        status: 'Failed',
        error: errorMsg,
        code: isDomainRestriction ? 'DOMAIN_UNVERIFIED' : response.status === 401 ? 'INVALID_KEY' : 'SEND_ERROR',
      };
    }

    return {
      success: true,
      status: 'Accepted',
      providerId: data.id,
      record: {
        id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        recipient: payload.to,
        recipient_name: payload.recipientName,
        business_name: payload.businessName,
        buyer_id: payload.buyerId,
        subject: finalSubject,
        body_preview: finalBody.substring(0, 140),
        provider: 'Resend',
        provider_id: data.id,
        status: 'Accepted',
        raw_response: data,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'Failed',
      error: err.message || 'Network error reaching Resend API',
      code: 'NETWORK_ERROR',
    };
  }
}

export function extractDomainFromEmail(emailString: string): string {
  if (!emailString) return '';
  const match = /<([^>]+)>/.exec(emailString);
  const cleanEmail = (match ? match[1] : emailString).trim();
  const parts = cleanEmail.split('@');
  return parts[1]?.toLowerCase() || '';
}

export async function getResendDomainVerificationStatus() {
  const { resendApiKey, emailFrom } = await getEffectiveKeys();

  if (!resendApiKey) {
    return {
      senderEmail: emailFrom,
      senderDomain: extractDomainFromEmail(emailFrom),
      mode: 'Testing Mode' as const,
      isTestingDomain: true,
      domainStatus: 'no_key' as const,
      isDomainVerified: false,
      instructions: [
        'RESEND_API_KEY is not configured in your environment variables.',
        'Add RESEND_API_KEY to your .env or API Settings page.',
      ],
    };
  }

  const senderDomain = extractDomainFromEmail(emailFrom);
  const isTestingDomain = senderDomain === 'resend.dev' || !senderDomain;

  let registeredDomains: { id: string; name: string; status: string; region?: string }[] = [];

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.data)) {
        registeredDomains = data.data.map((d: any) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          region: d.region,
        }));
      }
    }
  } catch (e) {
    console.error('Failed to fetch Resend domains:', e);
  }

  // Determine domain verification status & mode
  let mode: 'Testing Mode' | 'Production Mode' = 'Testing Mode';
  let domainStatus: 'verified' | 'not_started' | 'pending' | 'testing_mode' | 'unregistered' = 'testing_mode';
  let isDomainVerified = false;

  if (isTestingDomain) {
    mode = 'Testing Mode';
    domainStatus = 'testing_mode';
  } else {
    const matched = registeredDomains.find(
      (d) => d.name.toLowerCase() === senderDomain.toLowerCase()
    );
    if (matched) {
      if (matched.status === 'verified') {
        mode = 'Production Mode';
        domainStatus = 'verified';
        isDomainVerified = true;
      } else if (matched.status === 'pending') {
        mode = 'Testing Mode';
        domainStatus = 'pending';
      } else {
        mode = 'Testing Mode';
        domainStatus = 'not_started';
      }
    } else {
      mode = 'Testing Mode';
      domainStatus = 'unregistered';
    }
  }

  // Generate actionable instructions
  const instructions: string[] = [];

  if (isTestingDomain) {
    instructions.push(
      'TESTING MODE ACTIVE: The application is configured to use Resend sandbox sender (onboarding@resend.dev).'
    );
    instructions.push(
      'In Testing Mode, Resend allows outbound emails to be sent to your verified personal account email only.'
    );
    instructions.push(
      'External buyer emails are strictly restricted by Resend until a company domain is verified.'
    );
    instructions.push(
      'HOW TO SWITCH TO PRODUCTION MODE LATER: When you have your own verified company domain, simply set EMAIL_FROM="Your Name <contact@yourcompany.com>" in your .env file or Settings form. No code changes are required.'
    );
  } else if (!isDomainVerified) {
    instructions.push(
      `Your custom sender domain "${senderDomain}" is currently in status: "${domainStatus}".`
    );
    instructions.push(
      'Please verify that the DKIM and SPF TXT records are added in your DNS provider and verified in Resend.'
    );
    instructions.push(
      'Until verification completes, Resend restricts delivery to your registered account owner email only.'
    );
  } else {
    instructions.push(
      `PRODUCTION MODE ACTIVE: Domain "${senderDomain}" is verified with Resend. Outbound outreach to external buyers is fully enabled!`
    );
  }

  return {
    senderEmail: emailFrom,
    senderDomain,
    mode,
    isTestingDomain,
    domainStatus,
    isDomainVerified,
    instructions,
  };
}

