import { getEffectiveKeys, DiscoveredEmail } from '../db.ts';

export interface SerpApiBusinessResult {
  place_id?: string;
  business_name: string;
  category: string;
  address: string;
  city?: string;
  state?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  source: string;
  thumbnail?: string;
  google_maps_link?: string;
  fit_score?: number;
  fit_score_reason?: string;
  matched_query?: string;
}

export interface SerpApiSearchResponse {
  success: boolean;
  results: SerpApiBusinessResult[];
  total: number;
  hasMore?: boolean;
  nextStart?: number;
  queries_executed?: string[];
  error?: string;
  code?: string;
}

// Thorough email regex matching standard RFC format
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const INVALID_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp|avif|ico|pdf|css|js|woff|woff2|ttf|eot)$/i;
const JUNK_DOMAINS = ['example.com', 'domain.com', 'email.com', 'yourdomain.com', 'sentry.io', 'wixpress.com', 'gravatar.com', 'cloudflare.com'];

/**
 * 1. SMARTER SERPAPI QUERY GENERATOR
 * Generates targeted buyer-intent search variations based on product, category, and location.
 */
export function generateBuyerIntentQueries(params: {
  query?: string;
  category?: string;
  location?: string;
}): string[] {
  const loc = (params.location || 'USA').trim();
  const rawQuery = (params.query || '').trim();
  const category = (params.category || 'Home Decor').trim();

  // Primary subject: user's specific query if available, otherwise category
  const subject = rawQuery || category;
  const queries: string[] = [];

  // 1. Direct Wholesale Intent (e.g. "glass votive candle holder wholesale Austin Texas")
  queries.push(`${subject} wholesale ${loc}`.trim());

  // 2. Wholesaler / Stockist Intent (e.g. "candle holder wholesaler Austin Texas")
  if (rawQuery && !rawQuery.toLowerCase().includes('wholesaler')) {
    queries.push(`${rawQuery} wholesaler ${loc}`.trim());
  } else {
    queries.push(`${category} wholesaler ${loc}`.trim());
  }

  // 3. Category Wholesale Intent (e.g. "home decor wholesale Austin Texas")
  if (rawQuery && rawQuery.toLowerCase() !== category.toLowerCase()) {
    queries.push(`${category} wholesale ${loc}`.trim());
  }

  // 4. Commercial Distributor Intent (e.g. "home decor distributor Austin Texas")
  queries.push(`${subject} distributor ${loc}`.trim());

  // 5. Specialized B2B Supplier Intent (e.g. "wedding event decor supplier Austin Texas")
  queries.push(`wedding event decor supplier ${loc}`.trim());

  // Deduplicate and clean queries
  const uniqueQueries = Array.from(
    new Set(queries.map((q) => q.replace(/\s+/g, ' ').trim()))
  ).filter(Boolean);

  return uniqueQueries;
}

/**
 * Helper to normalize website URLs for exact deduplication
 */
function normalizeUrl(url?: string): string {
  if (!url) return '';
  return url
    .trim()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

/**
 * 2. BUYER FIT SCORE CALCULATION (0–100)
 * Uses strictly observable, transparent signals without inventing facts.
 */
export function calculateBuyerFitScore(
  item: {
    business_name: string;
    category?: string;
    address?: string;
    website?: string;
    rating?: number;
    reviews_count?: number;
  },
  context: {
    query?: string;
    category?: string;
    location?: string;
  }
): { score: number; reason: string } {
  let score = 30; // Baseline for passing local Google Maps business verification
  const reasons: string[] = [];

  const textToScan = `${item.business_name} ${item.category || ''} ${item.address || ''}`.toLowerCase();
  const queryTerms = (context.query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['and', 'the', 'for', 'with'].includes(w));
  const categoryTerms = (context.category || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // A. Wholesale / Commercial Signals (+25 pts)
  const wholesaleSignals = ['wholesale', 'wholesaler', 'distributor', 'supplier', 'showroom', 'contract', 'importer', 'supply', 'studio', 'boutique'];
  const matchedWholesale = wholesaleSignals.some((sig) => textToScan.includes(sig));
  if (matchedWholesale) {
    score += 25;
    reasons.push('Wholesale/commercial signal');
  }

  // B. Product / Category Relevance (+20 pts)
  const productMatched = queryTerms.some((term) => textToScan.includes(term));
  const categoryMatched = categoryTerms.some((term) => textToScan.includes(term));
  if (productMatched) {
    score += 20;
    reasons.push('Direct product match');
  } else if (categoryMatched) {
    score += 15;
    reasons.push('Category relevance');
  }

  // C. Home Décor & Furnishing Relevance (+15 pts)
  const decorKeywords = ['decor', 'furniture', 'home', 'lighting', 'interior', 'candle', 'gift', 'design', 'goods', 'furnishing', 'textile'];
  const decorMatch = decorKeywords.some((kw) => textToScan.includes(kw));
  if (decorMatch) {
    score += 15;
    reasons.push('Home décor relevance');
  }

  // D. Official Website Verified (+12 pts)
  if (item.website && item.website.trim().length > 3) {
    score += 12;
    reasons.push('Official website');
  }

  // E. Location Match (+8 pts)
  if (context.location) {
    const locTerms = context.location
      .toLowerCase()
      .split(/[,\s]+/)
      .filter((w) => w.length > 2);
    const locMatch = locTerms.some((loc) => textToScan.includes(loc));
    if (locMatch) {
      score += 8;
      reasons.push('Location match');
    }
  }

  // F. Google Rating & Review Supporting Signals (+8 pts max)
  if (item.rating && item.rating >= 4.0) {
    score += 4;
    if (item.reviews_count && item.reviews_count >= 10) {
      score += 4;
      reasons.push('Established local reputation');
    }
  }

  // Cap transparent score at 98 (never claim artificial perfection 100)
  const finalScore = Math.min(Math.max(score, 25), 98);
  const explanation = reasons.length > 0
    ? reasons.slice(0, 3).join(' + ') + '.'
    : 'Local commercial listing verified on Google Maps.';

  return { score: finalScore, reason: explanation };
}

/**
 * Executes a single SerpApi Google Maps search for a given query string.
 */
async function executeGoogleMapsQuery(
  queryStr: string,
  serpapiKey: string,
  start: number = 0,
  limit: number = 20
): Promise<{ rawResults: any[]; error?: string; status?: number }> {
  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('engine', 'google_maps');
  serpUrl.searchParams.set('q', queryStr);
  serpUrl.searchParams.set('hl', 'en');
  serpUrl.searchParams.set('gl', 'us');
  serpUrl.searchParams.set('start', String(start));
  serpUrl.searchParams.set('api_key', serpapiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(serpUrl.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `SerpApi returned HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error) errorMsg = parsed.error;
      } catch (e) {
        if (errText) errorMsg += `: ${errText.substring(0, 100)}`;
      }
      return { rawResults: [], error: errorMsg, status: response.status };
    }

    const data = await response.json();
    if (data.error) {
      return { rawResults: [], error: data.error };
    }

    return { rawResults: data.local_results || [] };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      rawResults: [],
      error: err.name === 'AbortError' ? 'SerpApi request timed out after 20 seconds.' : err.message,
    };
  }
}

/**
 * Searches buyers using SerpApi Google Maps.
 * Supports multi-intent query generation and transparent Buyer Fit scoring.
 */
export async function searchBuyersWithSerpApi(params: {
  query?: string;
  location: string;
  category: string;
  limit?: number;
  start?: number;
  multiQuery?: boolean;
}): Promise<SerpApiSearchResponse> {
  const { serpapiKey } = await getEffectiveKeys();

  if (!serpapiKey) {
    return {
      success: false,
      results: [],
      total: 0,
      error: 'SERPAPI_KEY is not configured. Please add SERPAPI_KEY to your environment or configure it on the API Settings page.',
      code: 'MISSING_KEY',
    };
  }

  const limit = Math.min(Math.max(params.limit || 20, 5), 40);
  const start = Math.max(params.start || 0, 0);

  // Determine queries to execute
  const queriesToRun: string[] = [];
  if (params.multiQuery !== false) {
    // Generate up to 3 high-yield buyer intent queries to discover wholesalers, distributors & stockists
    const intentQueries = generateBuyerIntentQueries({
      query: params.query,
      category: params.category,
      location: params.location,
    });
    queriesToRun.push(...intentQueries.slice(0, 3));
  } else {
    // Single query mode
    const searchTerms: string[] = [];
    if (params.query?.trim()) searchTerms.push(params.query.trim());
    else searchTerms.push(params.category || 'home decor store');
    if (params.location?.trim()) searchTerms.push(params.location.trim());
    queriesToRun.push(searchTerms.join(' '));
  }

  try {
    // Run queries (with start offset applied to primary query if paginating)
    const queryPromises = queriesToRun.map((q, idx) =>
      executeGoogleMapsQuery(q, serpapiKey, idx === 0 ? start : 0, Math.ceil(limit * 0.8))
    );

    const outcomes = await Promise.allSettled(queryPromises);

    // Track duplicates using website domain or business_name + address
    const seenUrls = new Set<string>();
    const seenNameAddr = new Set<string>();
    const combinedResults: SerpApiBusinessResult[] = [];
    let firstError: string | undefined;

    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      const queryUsed = queriesToRun[i];

      if (outcome.status === 'fulfilled') {
        const { rawResults, error } = outcome.value;
        if (error && !firstError) firstError = error;

        for (const item of rawResults) {
          if (!item.title) continue;

          // Normalize and check duplicates
          const normUrl = normalizeUrl(item.website);
          const normKey = `${item.title.toLowerCase().trim()}_${(item.address || '').toLowerCase().trim()}`;

          if (normUrl && seenUrls.has(normUrl)) continue;
          if (seenNameAddr.has(normKey)) continue;

          if (normUrl) seenUrls.add(normUrl);
          seenNameAddr.add(normKey);

          // Extract city & state from address
          let city = '';
          let state = '';
          if (item.address) {
            const parts = item.address.split(',').map((p: string) => p.trim());
            if (parts.length >= 2) {
              city = parts[parts.length - 2] || '';
              const stateZip = parts[parts.length - 1] || '';
              state = stateZip.split(' ')[0] || '';
            }
          }

          const businessItem: SerpApiBusinessResult = {
            place_id: item.place_id || item.data_id || item.cid,
            business_name: item.title,
            category: item.type || params.category || 'Home Decor',
            address: item.address || 'Address not listed',
            city,
            state,
            phone: item.phone || undefined,
            website: item.website || undefined,
            rating: item.rating ? Number(item.rating) : undefined,
            reviews_count: item.reviews ? Number(item.reviews) : undefined,
            source: 'Google Maps via SerpApi',
            thumbnail: item.thumbnail,
            google_maps_link: item.link,
            matched_query: queryUsed,
          };

          // Calculate transparent Buyer Fit Score (0–100)
          const fit = calculateBuyerFitScore(businessItem, {
            query: params.query,
            category: params.category,
            location: params.location,
          });

          businessItem.fit_score = fit.score;
          businessItem.fit_score_reason = fit.reason;

          combinedResults.push(businessItem);
        }
      } else {
        if (!firstError) firstError = outcome.reason?.message || 'Query failed';
      }
    }

    if (combinedResults.length === 0 && firstError) {
      return {
        success: false,
        results: [],
        total: 0,
        error: firstError,
        code: 'API_ERROR',
      };
    }

    // Sort by Buyer Fit Score descending so strongest matches appear first
    combinedResults.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));

    const finalResults = combinedResults.slice(0, limit);

    return {
      success: true,
      results: finalResults,
      total: finalResults.length,
      hasMore: combinedResults.length >= limit,
      nextStart: start + finalResults.length,
      queries_executed: queriesToRun,
    };
  } catch (err: any) {
    return {
      success: false,
      results: [],
      total: 0,
      error: err.message || 'Error processing SerpApi search',
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * 3. SERPAPI GOOGLE ORGANIC SEARCH FALLBACK FOR CONTACT DISCOVERY
 * Used strictly as a fallback when Firecrawl cannot find an email on the business website.
 * Queries publicly indexed Google Organic Search snippets for official company contact emails.
 */
export async function searchPublicEmailsWithSerpApi(
  websiteUrl: string,
  businessName?: string
): Promise<DiscoveredEmail[]> {
  const { serpapiKey } = await getEffectiveKeys();
  if (!serpapiKey) return [];

  const domain = normalizeUrl(websiteUrl).split('/')[0];
  if (!domain && !businessName) return [];

  // Construct search query for publicly indexed business contact pages
  // e.g. "site:example.com (email OR contact OR sales OR wholesale OR buyer)"
  let query = domain
    ? `site:${domain} (email OR contact OR sales OR wholesale OR buyer)`
    : `"${businessName}" wholesale contact email`;

  const serpUrl = new URL('https://serpapi.com/search.json');
  serpUrl.searchParams.set('engine', 'google');
  serpUrl.searchParams.set('q', query);
  serpUrl.searchParams.set('hl', 'en');
  serpUrl.searchParams.set('gl', 'us');
  serpUrl.searchParams.set('num', '5'); // Top 5 relevant pages
  serpUrl.searchParams.set('api_key', serpapiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(serpUrl.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const data = await response.json();
    const organicResults = data.organic_results || [];
    const discoveredMap = new Map<string, DiscoveredEmail>();

    for (const item of organicResults) {
      // Check title, snippet, and rich snippet for emails
      const textToSearch = `${item.title || ''} ${item.snippet || ''} ${JSON.stringify(item.rich_snippet || {})}`;
      const matches = textToSearch.match(EMAIL_REGEX) || [];

      for (const raw of matches) {
        const email = raw.toLowerCase().trim();
        if (email.length < 6 || email.length > 80) continue;
        if (INVALID_EXTENSIONS.test(email)) continue;

        const emailDomain = email.split('@')[1];
        if (!emailDomain || JUNK_DOMAINS.includes(emailDomain)) continue;
        if (emailDomain.includes('schema.org') || emailDomain.includes('w3.org')) continue;

        if (!discoveredMap.has(email)) {
          discoveredMap.set(email, {
            email,
            sourceUrl: item.link || websiteUrl,
            label: 'Google Search via SerpApi',
            discoveredAt: new Date().toISOString(),
          });
        }
      }
    }

    return Array.from(discoveredMap.values());
  } catch (err) {
    clearTimeout(timeoutId);
    return [];
  }
}
