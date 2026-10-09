import {
  Buyer,
  SearchResultItem,
  SearchRecord,
  EmailRecord,
  EmailAttachment,
  IntegrationsStatusResponse,
  DashboardStats,
  DiscoveredEmail,
} from '../types';
import { getAccessToken } from './googleAuth';

export async function searchBuyers(params: {
  query?: string;
  location: string;
  category: string;
  limit?: number;
  start?: number;
}): Promise<{
  success: boolean;
  results: SearchResultItem[];
  total: number;
  hasMore?: boolean;
  nextStart?: number;
  error?: string;
  code?: string;
}> {
  const resp = await fetch('/api/buyers/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return resp.json();
}

export async function discoverEmail(
  website: string,
  buyerId?: string
): Promise<{
  success: boolean;
  emails: DiscoveredEmail[];
  count: number;
  message?: string;
  error?: string;
  code?: string;
}> {
  const resp = await fetch('/api/buyers/discover-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ website, buyerId }),
  });
  return resp.json();
}

export async function getSavedBuyers(params?: {
  search?: string;
  category?: string;
  status?: string;
}): Promise<{
  success: boolean;
  buyers: Buyer[];
  total: number;
  error?: string;
}> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.category) query.set('category', params.category);
  if (params?.status) query.set('status', params.status);

  const resp = await fetch(`/api/buyers/saved?${query.toString()}`);
  return resp.json();
}

export async function saveBuyer(data: Partial<Buyer>): Promise<{
  success: boolean;
  buyer?: Buyer;
  error?: string;
  message?: string;
}> {
  const resp = await fetch('/api/buyers/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return resp.json();
}

export async function deleteBuyer(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  const resp = await fetch(`/api/buyers/saved/${id}`, {
    method: 'DELETE',
  });
  return resp.json();
}

export async function updateBuyer(
  id: string,
  updates: Partial<Buyer>
): Promise<{
  success: boolean;
  buyer?: Buyer;
  error?: string;
}> {
  const resp = await fetch(`/api/buyers/saved/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return resp.json();
}

export async function sendTestEmail(params: {
  testEmail: string;
  subject?: string;
  body?: string;
  attachments?: EmailAttachment[];
}): Promise<{
  success: boolean;
  status: 'Accepted' | 'Sent' | 'Failed';
  providerId?: string;
  error?: string;
  code?: string;
}> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch('/api/email/test', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return resp.json();
}

export async function sendEmail(params: {
  recipientEmail: string;
  recipientName?: string;
  businessName?: string;
  subject: string;
  body: string;
  buyerId?: string;
  attachments?: EmailAttachment[];
}): Promise<{
  success: boolean;
  status: 'Accepted' | 'Sent' | 'Failed';
  providerId?: string;
  error?: string;
  code?: string;
}> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const resp = await fetch('/api/email/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return resp.json();
}

export async function getEmailHistory(): Promise<{
  success: boolean;
  history: EmailRecord[];
  total: number;
}> {
  const resp = await fetch('/api/email/history');
  return resp.json();
}

export async function getSearchHistory(): Promise<{
  success: boolean;
  history: SearchRecord[];
  total: number;
}> {
  const resp = await fetch('/api/search/history');
  return resp.json();
}

export async function getDashboardStats(): Promise<{
  success: boolean;
  stats: DashboardStats;
}> {
  const resp = await fetch('/api/dashboard/stats');
  return resp.json();
}

export async function getIntegrationsStatus(): Promise<{
  success: boolean;
  integrations: IntegrationsStatusResponse;
}> {
  const resp = await fetch('/api/integrations/status');
  return resp.json();
}

export async function getEmailConfiguration(): Promise<{
  success: boolean;
  configuration: any;
}> {
  const resp = await fetch('/api/email/configuration');
  return resp.json();
}

export async function testIntegration(integration: 'serpapi' | 'firecrawl' | 'resend' | 'database'): Promise<{
  success: boolean;
  message: string;
}> {
  const resp = await fetch('/api/integrations/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integration }),
  });
  return resp.json();
}

export async function saveIntegrationSettings(settings: {
  serpapiKey?: string;
  firecrawlApiKey?: string;
  resendApiKey?: string;
  emailFrom?: string;
}): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  const resp = await fetch('/api/integrations/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return resp.json();
}
