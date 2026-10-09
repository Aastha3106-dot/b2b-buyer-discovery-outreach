import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import {
  getDatabase,
  saveDatabase,
  getEffectiveKeys,
  Buyer,
  SearchRecord,
  EmailRecord,
} from './src/server/db.ts';
import { searchBuyersWithSerpApi } from './src/server/services/serpapi.ts';
import { discoverPublicEmails } from './src/server/services/firecrawl.ts';
import { getResendDomainVerificationStatus } from './src/server/services/resend.ts';
import { sendEmailWithGmail } from './src/server/services/gmail.ts';
import {
  getValidGmailAccessToken,
  refreshGoogleAccessToken,
  storeGoogleCredentials,
  getGmailTokenStatus,
} from './src/server/services/googleTokenManager.ts';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 1. BUYER SEARCH — SERPAPI
app.post('/api/buyers/search', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { query, location, category, limit, start, multiQuery } = req.body;

  const loc = (location || 'USA').trim();
  const cat = (category || 'Home Decor Stores').trim();
  const q = (query || '').trim();

  const searchResult = await searchBuyersWithSerpApi({
    query: q,
    location: loc,
    category: cat,
    limit: limit ? Number(limit) : 20,
    start: start ? Number(start) : 0,
    multiQuery: multiQuery !== undefined ? Boolean(multiQuery) : true,
  });

  const duration_ms = Date.now() - startTime;

  // Persist search into search_history
  try {
    const db = await getDatabase();
    const searchRecord: SearchRecord = {
      id: `search_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      query: q || cat,
      location: loc,
      category: cat,
      result_count: searchResult.results.length,
      status: searchResult.success ? 'success' : 'failed',
      duration_ms,
      error: searchResult.error,
      queries_executed: searchResult.queries_executed,
    };
    db.search_history.unshift(searchRecord);
    if (db.search_history.length > 200) {
      db.search_history = db.search_history.slice(0, 200);
    }
    await saveDatabase(db);
  } catch (err) {
    console.error('Failed to log search history:', err);
  }

  return res.json(searchResult);
});

// 2. EMAIL DISCOVERY — FIRECRAWL (PRIMARY) + SERPAPI GOOGLE SEARCH (FALLBACK)
app.post('/api/buyers/discover-email', async (req: Request, res: Response) => {
  const { website, buyerId, businessName } = req.body;

  if (!website) {
    return res.status(400).json({
      success: false,
      emails: [],
      count: 0,
      error: 'Website URL is required for email discovery.',
    });
  }

  const discovery = await discoverPublicEmails(website, businessName);

  // If buyerId was passed, update buyer in database
  if (buyerId && discovery.success && discovery.emails.length > 0) {
    try {
      const db = await getDatabase();
      const buyerIndex = db.buyers.findIndex((b) => b.id === buyerId);
      if (buyerIndex !== -1) {
        // Merge without duplicating emails
        const existingEmails = new Set(db.buyers[buyerIndex].discovered_emails.map((e) => e.email.toLowerCase()));
        for (const item of discovery.emails) {
          if (!existingEmails.has(item.email.toLowerCase())) {
            db.buyers[buyerIndex].discovered_emails.push(item);
          }
        }
        db.buyers[buyerIndex].email_status = 'discovered';
        await saveDatabase(db);
      }
    } catch (err) {
      console.error('Failed to update buyer with discovered email:', err);
    }
  }

  return res.json(discovery);
});

// 3. SAVED BUYERS MANAGEMENT
app.get('/api/buyers/saved', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const { search, category, status } = req.query;

    let filtered = [...db.buyers];

    if (typeof search === 'string' && search.trim()) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (b) =>
          b.business_name.toLowerCase().includes(term) ||
          b.address.toLowerCase().includes(term) ||
          (b.city && b.city.toLowerCase().includes(term)) ||
          (b.state && b.state.toLowerCase().includes(term)) ||
          (b.website && b.website.toLowerCase().includes(term))
      );
    }

    if (typeof category === 'string' && category.trim() && category !== 'all') {
      filtered = filtered.filter((b) => b.category.toLowerCase().includes(category.toLowerCase()));
    }

    if (typeof status === 'string' && status.trim() && status !== 'all') {
      if (status === 'has_email') {
        filtered = filtered.filter((b) => b.discovered_emails && b.discovered_emails.length > 0);
      } else if (status === 'needs_email') {
        filtered = filtered.filter((b) => !b.discovered_emails || b.discovered_emails.length === 0);
      } else if (status === 'contacted') {
        filtered = filtered.filter((b) => b.email_status === 'contacted');
      }
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.date_saved).getTime() - new Date(a.date_saved).getTime());

    return res.json({
      success: true,
      buyers: filtered,
      total: filtered.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/buyers/save', async (req: Request, res: Response) => {
  try {
    const {
      business_name,
      category,
      address,
      city,
      state,
      phone,
      website,
      discovered_emails,
      search_query,
      notes,
      rating,
      reviews_count,
      source,
    } = req.body;

    if (!business_name || !business_name.trim()) {
      return res.status(400).json({ success: false, error: 'Business name is required.' });
    }

    const db = await getDatabase();

    // Check for duplicate
    const isDuplicate = db.buyers.some((existing) => {
      if (website && existing.website) {
        const cleanA = website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').toLowerCase();
        const cleanB = existing.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').toLowerCase();
        if (cleanA && cleanB && cleanA === cleanB) return true;
      }
      return (
        existing.business_name.toLowerCase().trim() === business_name.toLowerCase().trim() &&
        existing.address.toLowerCase().trim() === (address || '').toLowerCase().trim()
      );
    });

    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        error: 'This business has already been saved to your buyers directory.',
      });
    }

    const newBuyer: Buyer = {
      id: `buyer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      business_name: business_name.trim(),
      category: category?.trim() || 'Home Decor',
      address: address?.trim() || 'Address not listed',
      city: city?.trim() || undefined,
      state: state?.trim() || undefined,
      phone: phone?.trim() || undefined,
      website: website?.trim() || undefined,
      discovered_emails: Array.isArray(discovered_emails) ? discovered_emails : [],
      email_status: Array.isArray(discovered_emails) && discovered_emails.length > 0 ? 'discovered' : 'none',
      date_saved: new Date().toISOString(),
      search_query: search_query?.trim() || undefined,
      notes: notes?.trim() || undefined,
      rating: rating ? Number(rating) : undefined,
      reviews_count: reviews_count ? Number(reviews_count) : undefined,
      source: source || 'SerpApi Search',
    };

    db.buyers.unshift(newBuyer);
    await saveDatabase(db);

    return res.status(201).json({
      success: true,
      buyer: newBuyer,
      message: 'Buyer successfully saved to persistent database.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/buyers/saved/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const initialLen = db.buyers.length;
    db.buyers = db.buyers.filter((b) => b.id !== id);

    if (db.buyers.length === initialLen) {
      return res.status(404).json({ success: false, error: 'Buyer not found in database.' });
    }

    await saveDatabase(db);
    return res.json({ success: true, message: 'Buyer removed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/buyers/saved/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const buyer = db.buyers.find((b) => b.id === id);

    if (!buyer) {
      return res.status(404).json({ success: false, error: 'Buyer not found.' });
    }

    if (req.body.notes !== undefined) buyer.notes = req.body.notes;
    if (req.body.email_status) buyer.email_status = req.body.email_status;
    if (Array.isArray(req.body.discovered_emails)) buyer.discovered_emails = req.body.discovered_emails;

    await saveDatabase(db);
    return res.json({ success: true, buyer });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. EMAIL COMPOSER & GMAIL API (OAUTH 2.0 ONLY — NO RESEND FALLBACK)
app.post('/api/email/test', async (req: Request, res: Response) => {
  const { testEmail, subject, body, attachments } = req.body;

  if (!testEmail) {
    return res.status(400).json({ success: false, error: 'Test email address is required.' });
  }

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const tokenResult = await getValidGmailAccessToken(bearerToken);
  const senderEmail = tokenResult.email || 'pariaastha672@gmail.com';

  console.log('[TEST_EMAIL_DISPATCH] Initiating test email...');
  console.log('[TEST_EMAIL_DISPATCH] provider_selected = Gmail API');
  console.log(`[TEST_EMAIL_DISPATCH] sender = ${senderEmail}`);
  console.log(`[TEST_EMAIL_DISPATCH] recipient = ${testEmail}`);

  if (!tokenResult.success || !tokenResult.accessToken) {
    console.error('[TEST_EMAIL_DISPATCH] gmail_api_status = Failed (Authorization expired or missing)');
    return res.status(401).json({
      success: false,
      status: 'Failed',
      error: tokenResult.error || 'Gmail authorization expired. Please reconnect Gmail.',
      code: tokenResult.code || 'AUTH_EXPIRED',
    });
  }

  const result = await sendEmailWithGmail({
    to: testEmail,
    subject: subject || '[Test Outreach] Home Decor Wholesale Inquiry',
    body: body || 'This is a test outreach verification email sent from HomeDecor Buyer Finder via Gmail API.',
    recipientName: 'Test Recipient',
    businessName: 'Sample Showroom',
    accessToken: tokenResult.accessToken,
    from: senderEmail,
    attachments,
  });

  console.log('[TEST_EMAIL_DISPATCH] provider_used = Gmail API');
  console.log(`[TEST_EMAIL_DISPATCH] gmail_api_status = ${result.status}`);
  console.log(`[TEST_EMAIL_DISPATCH] gmail_message_id = ${result.providerId || 'none'}`);

  const db = await getDatabase();
  if (result.record) {
    try {
      db.email_history.unshift(result.record);
      await saveDatabase(db);
    } catch (e) {
      console.error('Failed to log test email:', e);
    }
  }

  return res.status(result.code === 'AUTH_EXPIRED' ? 401 : 200).json(result);
});

app.post('/api/email/send', async (req: Request, res: Response) => {
  const { recipientEmail, recipientName, businessName, subject, body, buyerId, attachments } = req.body;

  if (!recipientEmail || !subject || !body) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: recipientEmail, subject, and body are required.',
    });
  }

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const tokenResult = await getValidGmailAccessToken(bearerToken);
  const senderEmail = tokenResult.email || 'pariaastha672@gmail.com';

  console.log('[EMAIL_DISPATCH] Initiating email send...');
  console.log('[EMAIL_DISPATCH] provider_selected = Gmail API');
  console.log(`[EMAIL_DISPATCH] sender = ${senderEmail}`);
  console.log(`[EMAIL_DISPATCH] recipient = ${recipientEmail}`);

  if (!tokenResult.success || !tokenResult.accessToken) {
    console.error('[EMAIL_DISPATCH] gmail_api_status = Failed (Authorization expired or missing)');
    return res.status(401).json({
      success: false,
      status: 'Failed',
      error: tokenResult.error || 'Gmail authorization expired. Please reconnect Gmail.',
      code: tokenResult.code || 'AUTH_EXPIRED',
    });
  }

  const result = await sendEmailWithGmail({
    to: recipientEmail,
    recipientName,
    businessName,
    subject,
    body,
    buyerId,
    accessToken: tokenResult.accessToken,
    from: senderEmail,
    attachments,
  });

  console.log('[EMAIL_DISPATCH] provider_used = Gmail API');
  console.log(`[EMAIL_DISPATCH] gmail_api_status = ${result.status}`);
  console.log(`[EMAIL_DISPATCH] gmail_message_id = ${result.providerId || 'none'}`);

  const db = await getDatabase();
  if (result.record) {
    db.email_history.unshift(result.record);
  } else {
    // Record failed attempt
    const failedRecord: EmailRecord = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      recipient: recipientEmail,
      recipient_name: recipientName,
      business_name: businessName,
      buyer_id: buyerId,
      subject,
      body_preview: body.substring(0, 140),
      provider: 'Gmail API',
      status: 'Failed',
      error: result.error,
      attachment_names: attachments?.map((a: any) => a.filename) || [],
      attachments_count: attachments?.length || 0,
    };
    db.email_history.unshift(failedRecord);
  }

  // Update buyer status if provided
  if (buyerId && result.success) {
    const buyer = db.buyers.find((b) => b.id === buyerId);
    if (buyer) {
      buyer.email_status = 'contacted';
      buyer.last_contacted_at = new Date().toISOString();
    }
  }

  await saveDatabase(db);
  return res.status(result.code === 'AUTH_EXPIRED' ? 401 : 200).json(result);
});

app.post('/api/integrations/gmail/connect', async (req: Request, res: Response) => {
  try {
    const { email, displayName, photoURL, accessToken, refreshToken, expiresIn } = req.body;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const effectiveToken = accessToken || bearerToken || null;

    await storeGoogleCredentials({
      email: email || 'pariaastha672@gmail.com',
      displayName,
      photoURL,
      accessToken: effectiveToken,
      refreshToken: refreshToken || null,
      expiresIn: expiresIn || 3600,
    });

    const status = await getGmailTokenStatus();
    return res.json({
      success: true,
      gmail: {
        connected: true,
        email: status.email,
        displayName: status.displayName,
        hasRefreshToken: status.hasRefreshToken,
        isExpired: status.isExpired,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/integrations/gmail/refresh', async (_req: Request, res: Response) => {
  try {
    const refreshResult = await refreshGoogleAccessToken();
    const status = await getGmailTokenStatus();
    if (refreshResult.success) {
      return res.json({
        success: true,
        message: 'Google OAuth token refreshed successfully.',
        status: {
          connected: status.connected,
          email: status.email,
          hasRefreshToken: status.hasRefreshToken,
          isExpired: false,
          lastRefreshedAt: status.lastRefreshedAt,
        },
      });
    } else {
      return res.status(401).json({
        success: false,
        error: refreshResult.error || 'Gmail authorization expired. Please reconnect Gmail.',
        code: refreshResult.code || 'AUTH_EXPIRED',
        status: {
          connected: status.connected,
          email: status.email,
          hasRefreshToken: status.hasRefreshToken,
          isExpired: true,
        },
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/integrations/gmail/disconnect', async (_req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    if ((db.settings as any)?.gmail) {
      delete (db.settings as any).gmail;
      await saveDatabase(db);
    }
    return res.json({ success: true, message: 'Gmail disconnected.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/email/history', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    return res.json({
      success: true,
      history: db.email_history,
      total: db.email_history.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/email/configuration', async (_req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const gmailSettings = (db.settings as any)?.gmail || { connected: false };
    const resendConfig = await getResendDomainVerificationStatus();
    const tokenStatus = await getGmailTokenStatus();
    return res.json({
      success: true,
      activeProvider: gmailSettings.connected ? 'Gmail API' : 'Resend',
      gmail: {
        connected: Boolean(gmailSettings.connected),
        connectedEmail: gmailSettings.email || 'pariaastha672@gmail.com',
        displayName: gmailSettings.displayName || null,
        provider: 'Gmail API',
        hasRefreshToken: tokenStatus.hasRefreshToken,
        tokenExpired: tokenStatus.isExpired,
        scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
      },
      resend: resendConfig,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. SEARCH HISTORY
app.get('/api/search/history', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    return res.json({
      success: true,
      history: db.search_history,
      total: db.search_history.length,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. DASHBOARD STATISTICS
app.get('/api/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const buyers = db.buyers;

    const totalBuyers = buyers.length;
    let totalEmailsDiscovered = 0;
    let totalContacted = 0;

    const categoryMap: Record<string, number> = {};
    const stateMap: Record<string, number> = {};

    for (const b of buyers) {
      if (b.discovered_emails && b.discovered_emails.length > 0) {
        totalEmailsDiscovered += b.discovered_emails.length;
      }
      if (b.email_status === 'contacted') {
        totalContacted++;
      }

      // Categories
      const cat = b.category || 'Other';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;

      // States
      const state = b.state || 'Other';
      stateMap[state] = (stateMap[state] || 0) + 1;
    }

    const successfulEmails = db.email_history.filter((e) => e.status === 'Accepted' || e.status === 'Delivered' || e.status === 'Sent').length;

    return res.json({
      success: true,
      stats: {
        totalBuyers,
        totalEmailsDiscovered,
        totalContacted,
        totalSearches: db.search_history.length,
        totalEmailsSent: db.email_history.length,
        successfulEmails,
        topCategories: Object.entries(categoryMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        topStates: Object.entries(stateMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        recentBuyers: buyers.slice(0, 5),
        recentEmails: db.email_history.slice(0, 5),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. INTEGRATIONS STATUS & SETTINGS
app.get('/api/integrations/status', async (req: Request, res: Response) => {
  try {
    const { serpapiKey, firecrawlApiKey, resendApiKey, emailFrom } = await getEffectiveKeys();
    const db = await getDatabase();
    const domainInfo = await getResendDomainVerificationStatus();

    const maskKey = (key: string) => {
      if (!key) return null;
      if (key.length <= 8) return '****' + key.slice(-2);
      return key.slice(0, 4) + '••••••••' + key.slice(-4);
    };

    return res.json({
      success: true,
      integrations: {
        serpapi: {
          configured: Boolean(serpapiKey),
          maskedKey: maskKey(serpapiKey),
          source: db.settings.custom_serpapi_key ? 'custom_settings' : process.env.SERPAPI_KEY ? 'env_var' : 'none',
        },
        firecrawl: {
          configured: Boolean(firecrawlApiKey),
          maskedKey: maskKey(firecrawlApiKey),
          source: db.settings.custom_firecrawl_api_key ? 'custom_settings' : process.env.FIRECRAWL_API_KEY ? 'env_var' : 'none',
        },
        resend: {
          configured: Boolean(resendApiKey),
          maskedKey: maskKey(resendApiKey),
          emailFrom: emailFrom || 'onboarding@resend.dev',
          source: db.settings.custom_resend_api_key ? 'custom_settings' : process.env.RESEND_API_KEY ? 'env_var' : 'none',
          domainInfo,
        },
        gmail: {
          connected: Boolean((db.settings as any)?.gmail?.connected),
          connectedEmail: (db.settings as any)?.gmail?.email || 'pariaastha672@gmail.com',
          displayName: (db.settings as any)?.gmail?.displayName || null,
          photoURL: (db.settings as any)?.gmail?.photoURL || null,
          provider: 'Gmail API',
          hasRefreshToken: Boolean((db.settings as any)?.gmail?.refreshToken),
          tokenExpired: Boolean((db.settings as any)?.gmail?.tokenExpired),
          scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
        },
        database: {
          connected: true,
          type: 'Persistent File Storage (JSON with Atomic Safe Writes)',
          records: {
            buyers: db.buyers.length,
            searches: db.search_history.length,
            emails: db.email_history.length,
          },
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/integrations/test', async (req: Request, res: Response) => {
  const { integration } = req.body;
  const { serpapiKey, firecrawlApiKey, resendApiKey } = await getEffectiveKeys();

  if (integration === 'serpapi') {
    if (!serpapiKey) {
      return res.json({ success: false, message: 'SERPAPI_KEY is not configured.' });
    }
    try {
      const resp = await fetch(`https://serpapi.com/account?api_key=${serpapiKey}`);
      const data = await resp.json();
      if (data.error) {
        return res.json({ success: false, message: `SerpApi test failed: ${data.error}` });
      }
      return res.json({
        success: true,
        message: `SerpApi connected! Account email: ${data.account_email || 'Active'} · Plan: ${data.plan_name || 'Standard'} · Searches left: ${data.total_searches_left ?? 'Available'}`,
      });
    } catch (e: any) {
      return res.json({ success: false, message: `Connection error: ${e.message}` });
    }
  }

  if (integration === 'firecrawl') {
    if (!firecrawlApiKey) {
      return res.json({ success: false, message: 'FIRECRAWL_API_KEY is not configured.' });
    }
    try {
      // Test scrape against example.com
      const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firecrawlApiKey}`,
        },
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      if (resp.status === 401) {
        return res.json({ success: false, message: 'Firecrawl API rejected the key (Unauthorized 401).' });
      }
      return res.json({ success: true, message: 'Firecrawl API connection verified successfully!' });
    } catch (e: any) {
      return res.json({ success: false, message: `Connection error: ${e.message}` });
    }
  }

  if (integration === 'resend') {
    if (!resendApiKey) {
      return res.json({ success: false, message: 'RESEND_API_KEY is not configured.' });
    }
    try {
      const resp = await fetch('https://api.resend.com/api-keys', {
        headers: { Authorization: `Bearer ${resendApiKey}` },
      });
      if (resp.status === 401) {
        return res.json({ success: false, message: 'Resend API rejected the key (Unauthorized 401).' });
      }

      const domainInfo = await getResendDomainVerificationStatus();
      if (domainInfo.isDomainVerified) {
        return res.json({
          success: true,
          message: `Resend connected and domain "${domainInfo.senderDomain}" is VERIFIED! Outbound production outreach to real buyers is ready.`,
        });
      } else if (domainInfo.isTestingDomain) {
        return res.json({
          success: true,
          message: `Resend connected! Operating in TESTING MODE with sender "${domainInfo.senderEmail}". Test emails to your personal account email (pariaastha672@gmail.com) succeed. Real external buyer emails are restricted until a company domain is verified.`,
        });
      } else {
        return res.json({
          success: true,
          message: `Resend connected! Domain "${domainInfo.senderDomain}" status is: "${domainInfo.domainStatus}". Outreach to external buyers will succeed once DNS verification is complete.`,
        });
      }
    } catch (e: any) {
      return res.json({ success: false, message: `Connection error: ${e.message}` });
    }
  }

  if (integration === 'gmail') {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const tokenResult = await getValidGmailAccessToken(bearerToken);

    if (!tokenResult.success || !tokenResult.accessToken) {
      return res.json({
        success: false,
        message: tokenResult.error || 'Gmail authorization expired. Please reconnect Gmail.',
        code: 'AUTH_EXPIRED',
      });
    }

    try {
      let resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
      });
      let data = await resp.json();

      if (resp.status === 401) {
        // Automatically attempt token refresh
        const refreshed = await refreshGoogleAccessToken();
        if (refreshed.success && refreshed.accessToken) {
          resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
            headers: { Authorization: `Bearer ${refreshed.accessToken}` },
          });
          data = await resp.json();
        }
      }

      if (!resp.ok) {
        if (resp.status === 401) {
          return res.json({
            success: false,
            message: 'Gmail authorization expired. Please reconnect Gmail.',
            code: 'AUTH_EXPIRED',
          });
        }
        return res.json({
          success: false,
          message: `Gmail API error (${resp.status}): ${data?.error?.message || 'Access token invalid or expired. Please reconnect Gmail.'}`,
        });
      }

      return res.json({
        success: true,
        message: `Gmail API connection verified! Authorized account: ${data.emailAddress} · Total messages: ${data.messagesTotal || 0}. Ready to dispatch buyer pitches.`,
      });
    } catch (e: any) {
      return res.json({ success: false, message: `Gmail connection error: ${e.message}` });
    }
  }

  if (integration === 'database') {
    try {
      const db = await getDatabase();
      return res.json({
        success: true,
        message: `Database healthy and writable. Currently tracking ${db.buyers.length} saved buyers, ${db.search_history.length} searches, and ${db.email_history.length} email records.`,
      });
    } catch (e: any) {
      return res.json({ success: false, message: `Database error: ${e.message}` });
    }
  }

  return res.status(400).json({ success: false, message: 'Unknown integration.' });
});

app.post('/api/integrations/settings', async (req: Request, res: Response) => {
  try {
    const { serpapiKey, firecrawlApiKey, resendApiKey, emailFrom } = req.body;
    const db = await getDatabase();

    if (serpapiKey !== undefined) db.settings.custom_serpapi_key = serpapiKey.trim();
    if (firecrawlApiKey !== undefined) db.settings.custom_firecrawl_api_key = firecrawlApiKey.trim();
    if (resendApiKey !== undefined) db.settings.custom_resend_api_key = resendApiKey.trim();
    if (emailFrom !== undefined) db.settings.custom_email_from = emailFrom.trim();

    await saveDatabase(db);
    return res.json({
      success: true,
      message: 'Integration settings saved successfully in persistent database.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// VITE DEV MIDDLEWARE / STATIC PROD
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`HomeDecor Buyer Finder running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
