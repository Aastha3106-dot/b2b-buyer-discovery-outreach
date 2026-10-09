import fs from 'fs/promises';
import path from 'path';

export interface DiscoveredEmail {
  email: string;
  sourceUrl: string;
  label: 'Publicly Found' | 'Google Search via SerpApi' | string;
  discoveredAt: string;
}

export interface Buyer {
  id: string;
  business_name: string;
  category: string;
  address: string;
  city?: string;
  state?: string;
  phone?: string;
  website?: string;
  discovered_emails: DiscoveredEmail[];
  email_status: 'none' | 'discovered' | 'contacted';
  date_saved: string;
  last_contacted_at?: string;
  search_query?: string;
  notes?: string;
  rating?: number;
  reviews_count?: number;
  source?: string;
  fit_score?: number;
  fit_score_reason?: string;
}

export interface SearchRecord {
  id: string;
  timestamp: string;
  query: string;
  location: string;
  category: string;
  result_count: number;
  status: 'success' | 'failed';
  duration_ms: number;
  error?: string;
  queries_executed?: string[];
}

export interface EmailRecord {
  id: string;
  timestamp: string;
  recipient: string;
  recipient_name?: string;
  business_name?: string;
  buyer_id?: string;
  subject: string;
  body_preview: string;
  provider: 'Gmail API' | 'Resend';
  provider_id?: string;
  status: 'Accepted' | 'Failed' | 'Delivered' | 'Bounced' | 'Sent';
  error?: string;
  raw_response?: any;
  attachment_names?: string[];
  attachments_count?: number;
}

export interface AppSettings {
  custom_serpapi_key?: string;
  custom_firecrawl_api_key?: string;
  custom_resend_api_key?: string;
  custom_email_from?: string;
  custom_google_client_secret?: string;
  gmail?: {
    connected: boolean;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    connectedAt?: string;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: number | null;
    lastRefreshedAt?: string | null;
    tokenExpired?: boolean;
  };
}

export interface DatabaseSchema {
  buyers: Buyer[];
  search_history: SearchRecord[];
  email_history: EmailRecord[];
  settings: AppSettings;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

const INITIAL_DB: DatabaseSchema = {
  buyers: [],
  search_history: [],
  email_history: [],
  settings: {},
};

let cachedDb: DatabaseSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }
}

export async function getDatabase(): Promise<DatabaseSchema> {
  if (cachedDb) return cachedDb;

  await ensureDataDir();
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedDb = {
      buyers: Array.isArray(parsed.buyers) ? parsed.buyers : [],
      search_history: Array.isArray(parsed.search_history) ? parsed.search_history : [],
      email_history: Array.isArray(parsed.email_history) ? parsed.email_history : [],
      settings: parsed.settings || {},
    };
    return cachedDb;
  } catch (err) {
    cachedDb = { ...INITIAL_DB };
    await saveDatabase(cachedDb);
    return cachedDb;
  }
}

export async function saveDatabase(db: DatabaseSchema): Promise<void> {
  cachedDb = db;
  await ensureDataDir();

  // Chain writes to prevent concurrent file corruption
  writeQueue = writeQueue.then(async () => {
    const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
    const payload = JSON.stringify(db, null, 2);
    await fs.writeFile(tempFile, payload, 'utf-8');
    await fs.rename(tempFile, DB_FILE);
  });

  return writeQueue;
}

export async function getEffectiveKeys() {
  const db = await getDatabase();
  return {
    serpapiKey: process.env.SERPAPI_KEY?.trim() || db.settings.custom_serpapi_key?.trim() || '',
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY?.trim() || db.settings.custom_firecrawl_api_key?.trim() || '',
    resendApiKey: process.env.RESEND_API_KEY?.trim() || db.settings.custom_resend_api_key?.trim() || '',
    emailFrom: process.env.EMAIL_FROM?.trim() || db.settings.custom_email_from?.trim() || 'HomeDecor Outreach <onboarding@resend.dev>',
  };
}
