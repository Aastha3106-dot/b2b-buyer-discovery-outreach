import { getEffectiveKeys, DiscoveredEmail } from '../db.ts';

export interface EmailDiscoveryResult {
  success: boolean;
  emails: DiscoveredEmail[];
  count: number;
  message?: string;
  error?: string;
  code?: string;
}

// Thorough email regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Extension & dummy blacklist
const INVALID_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|avif|ico|pdf|css|js|woff|woff2|ttf|eot)$/i;
const JUNK_DOMAINS = ['example.com', 'domain.com', 'email.com', 'yourdomain.com', 'sentry.io', 'wixpress.com', 'gravatar.com', 'cloudflare.com'];

export function sanitizeUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

function extractEmailsFromText(text: string, sourceUrl: string): DiscoveredEmail[] {
  if (!text) return [];

  const matches = text.match(EMAIL_REGEX) || [];
  const validMap = new Map<string, DiscoveredEmail>();

  for (const raw of matches) {
    const email = raw.toLowerCase().trim();

    // Check basic length and structure
    if (email.length < 6 || email.length > 80) continue;
    if (INVALID_EXTENSIONS.test(email)) continue;

    // Check junk domain
    const domain = email.split('@')[1];
    if (!domain || JUNK_DOMAINS.includes(domain)) continue;
    if (domain.includes('schema.org') || domain.includes('w3.org')) continue;

    if (!validMap.has(email)) {
      validMap.set(email, {
        email,
        sourceUrl,
        label: 'Publicly Found',
        discoveredAt: new Date().toISOString(),
      });
    }
  }

  return Array.from(validMap.values());
}

export async function scrapeWebsiteWithFirecrawl(targetUrl: string, apiKey: string): Promise<{ text: string; status: number; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 1000,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Firecrawl returned HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error) errorMsg = parsed.error;
      } catch (e) {
        if (errText) errorMsg += `: ${errText.substring(0, 100)}`;
      }
      return { text: '', status: response.status, error: errorMsg };
    }

    const data = await response.json();
    const markdown = data?.data?.markdown || '';
    const html = data?.data?.html || '';
    return { text: `${markdown}\n${html}`, status: 200 };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return { text: '', status: 0, error: err.name === 'AbortError' ? 'Scrape request timed out' : err.message };
  }
}

import { searchPublicEmailsWithSerpApi } from './serpapi.ts';

export async function discoverPublicEmails(websiteUrl: string, businessName?: string): Promise<EmailDiscoveryResult> {
  const { firecrawlApiKey } = await getEffectiveKeys();

  if (!websiteUrl || !websiteUrl.trim()) {
    return {
      success: false,
      emails: [],
      count: 0,
      error: 'No website URL provided for email discovery.',
      code: 'INVALID_INPUT',
    };
  }

  const primaryUrl = sanitizeUrl(websiteUrl);
  const discoveredMap = new Map<string, DiscoveredEmail>();

  // METHOD 1 (PRIMARY): Scrape official website with Firecrawl
  if (firecrawlApiKey) {
    try {
      // 1. Scrape Homepage
      const homeResult = await scrapeWebsiteWithFirecrawl(primaryUrl, firecrawlApiKey);
      if (homeResult.text) {
        const homeEmails = extractEmailsFromText(homeResult.text, primaryUrl);
        for (const item of homeEmails) {
          discoveredMap.set(item.email, item);
        }
      }

      // 2. If no email found on homepage, try contact/about page subroutes
      if (discoveredMap.size === 0) {
        const baseUrl = primaryUrl.replace(/\/+$/, '');
        const candidatePaths = ['/contact', '/contact-us', '/about', '/pages/contact'];
        
        for (const subPath of candidatePaths) {
          if (discoveredMap.size > 0) break;
          const contactUrl = `${baseUrl}${subPath}`;
          const subResult = await scrapeWebsiteWithFirecrawl(contactUrl, firecrawlApiKey);
          if (subResult.text) {
            const subEmails = extractEmailsFromText(subResult.text, contactUrl);
            for (const item of subEmails) {
              discoveredMap.set(item.email, item);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Firecrawl scrape encountered error, falling back to SerpApi search:', err);
    }
  }

  // METHOD 2 (FALLBACK): If Firecrawl found no email, use SerpApi Google Organic Search
  if (discoveredMap.size === 0) {
    try {
      const serpEmails = await searchPublicEmailsWithSerpApi(primaryUrl, businessName);
      if (serpEmails.length > 0) {
        for (const item of serpEmails) {
          discoveredMap.set(item.email, item);
        }
        return {
          success: true,
          emails: serpEmails,
          count: serpEmails.length,
          message: `Discovered ${serpEmails.length} public business email(s) via Google Search index (SerpApi).`,
        };
      }
    } catch (serpErr) {
      console.warn('SerpApi contact fallback error:', serpErr);
    }
  }

  const finalEmails = Array.from(discoveredMap.values());

  if (finalEmails.length === 0) {
    return {
      success: true,
      emails: [],
      count: 0,
      message: 'No public business email found on official website or Google index.',
    };
  }

  return {
    success: true,
    emails: finalEmails,
    count: finalEmails.length,
    message: `Discovered ${finalEmails.length} public business ${finalEmails.length === 1 ? 'email' : 'emails'}.`,
  };
}
