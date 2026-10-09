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

export interface SearchResultItem {
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

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  base64: string;
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

export interface DomainVerificationInfo {
  senderEmail: string;
  senderDomain: string;
  mode: 'Testing Mode' | 'Production Mode';
  isTestingDomain: boolean;
  domainStatus: 'verified' | 'not_started' | 'pending' | 'testing_mode' | 'unregistered' | 'no_key';
  isDomainVerified: boolean;
  instructions: string[];
}

export interface IntegrationInfo {
  configured: boolean;
  maskedKey: string | null;
  source: 'env_var' | 'custom_settings' | 'none';
  emailFrom?: string;
  domainInfo?: DomainVerificationInfo;
}

export interface GmailIntegrationInfo {
  connected: boolean;
  connectedEmail: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  provider: 'Gmail API';
  scopes: string[];
  hasRefreshToken?: boolean;
  tokenExpired?: boolean;
}

export interface DatabaseStatus {
  connected: boolean;
  type: string;
  records: {
    buyers: number;
    searches: number;
    emails: number;
  };
}

export interface IntegrationsStatusResponse {
  serpapi: IntegrationInfo;
  firecrawl: IntegrationInfo;
  resend: IntegrationInfo;
  gmail?: GmailIntegrationInfo;
  database: DatabaseStatus;
}

export interface DashboardStats {
  totalBuyers: number;
  totalEmailsDiscovered: number;
  totalContacted: number;
  totalSearches: number;
  totalEmailsSent: number;
  successfulEmails: number;
  topCategories: { name: string; count: number }[];
  topStates: { name: string; count: number }[];
  recentBuyers: Buyer[];
  recentEmails: EmailRecord[];
}
