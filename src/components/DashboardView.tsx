import React from 'react';
import {
  Users,
  Mail,
  Send,
  Search,
  ArrowRight,
  Sparkles,
  MapPin,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { DashboardStats } from '../types';
import { NavTab } from './Navigation';

interface DashboardViewProps {
  stats: DashboardStats | null;
  isLoading: boolean;
  onNavigate: (tab: NavTab) => void;
  onSelectBuyerForOutreach?: (buyerId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  isLoading,
  onNavigate,
}) => {
  if (isLoading && !stats) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-44 bg-slate-200 rounded-2xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-xl"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const totalBuyers = stats?.totalBuyers ?? 0;
  const totalEmails = stats?.totalEmailsDiscovered ?? 0;
  const totalContacted = stats?.totalContacted ?? 0;
  const totalSearches = stats?.totalSearches ?? 0;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Visual Showroom Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 text-white shadow-xs">
        <div className="absolute inset-0">
          <img
            src="/src/assets/images/homedecor_dashboard_hero_1790868229274.jpg"
            alt="Minimalist modern home decor showroom"
            className="w-full h-full object-cover opacity-25"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // Graceful fallback to rich dark aesthetic gradient if image cannot load
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/90 to-transparent"></div>
        </div>

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>US B2B Buyer Acquisition Pipeline</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Connect with Home Decor Retailers & Wholesalers
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Target independent boutique shops, commercial furniture showrooms, and interior design firms across the United States. Search local businesses, extract public contact emails via web crawling, and launch personalized B2B outreach.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('find-buyers')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <Search className="w-4 h-4" />
              <span>Find New Buyers</span>
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg transition-colors border border-white/10 whitespace-nowrap"
            >
              <span>Verify API Connections</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Saved Buyers
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {totalBuyers}
            </span>
            <span className="text-xs text-slate-400 font-medium">businesses saved</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>In persistent database</span>
            <button
              onClick={() => onNavigate('saved-buyers')}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              View directory →
            </button>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Discovered Emails
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {totalEmails}
            </span>
            <span className="text-xs text-slate-400 font-medium">public addresses</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Crawled via Firecrawl</span>
            <button
              onClick={() => onNavigate('saved-buyers')}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              Eligible for outreach →
            </button>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Contacted Buyers
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {totalContacted}
            </span>
            <span className="text-xs text-slate-400 font-medium">reached</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Outreach sent via Resend</span>
            <button
              onClick={() => onNavigate('email-history')}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              Delivery logs →
            </button>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Queries Executed
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Search className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-bold text-slate-900 font-mono tabular-nums">
              {totalSearches}
            </span>
            <span className="text-xs text-slate-400 font-medium">market runs</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Powered by SerpApi</span>
            <button
              onClick={() => onNavigate('search-history')}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              Search log →
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Directory Highlights & Recent Email Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Saved Buyers (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Recently Saved Buyers
              </h3>
              <p className="text-xs text-slate-500">
                Active prospective decor stores and wholesalers
              </p>
            </div>
            <button
              onClick={() => onNavigate('saved-buyers')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {!stats?.recentBuyers || stats.recentBuyers.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                <Building className="w-6 h-6" />
              </div>
              <div className="text-sm font-medium text-slate-700">No buyers saved yet</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Discover real retailers and furniture shops across the US using the Find Buyers search tool.
              </p>
              <button
                onClick={() => onNavigate('find-buyers')}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search US Buyers</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentBuyers.map((buyer) => {
                const hasEmail = buyer.discovered_emails && buyer.discovered_emails.length > 0;
                return (
                  <div
                    key={buyer.id}
                    className="p-4 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 truncate">
                          {buyer.business_name}
                        </span>
                        {buyer.category && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            · {buyer.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{buyer.address}</span>
                        </span>
                      </div>
                      {hasEmail ? (
                        <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5 pt-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{buyer.discovered_emails[0].email}</span>
                          {buyer.discovered_emails.length > 1 && (
                            <span className="text-slate-400 font-mono text-[11px]">
                              (+{buyer.discovered_emails.length - 1} more)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Email not discovered yet</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {buyer.website && (
                        <a
                          href={buyer.website.startsWith('http') ? buyer.website : `https://${buyer.website}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100"
                          title="Open website"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => onNavigate('saved-buyers')}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Outreach Telemetry & Category Spread (1 col) */}
        <div className="space-y-6">
          {/* Top States Distribution */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">
              Top Locations Saved
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Geographic concentration of prospective buyers
            </p>

            {stats?.topStates && stats.topStates.length > 0 ? (
              <div className="space-y-2.5">
                {stats.topStates.map((st) => {
                  const pct = Math.round((st.count / (totalBuyers || 1)) * 100);
                  return (
                    <div key={st.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700">{st.name || 'Other Region'}</span>
                        <span className="font-mono tabular-nums text-slate-500">{st.count} ({pct}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Save buyers from New York, California, Texas, etc., to populate state distribution.
              </p>
            )}
          </div>

          {/* Recent Email History Activity */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Recent Outreach Sent
              </h3>
              <button
                onClick={() => onNavigate('email-history')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                All Logs →
              </button>
            </div>

            {!stats?.recentEmails || stats.recentEmails.length === 0 ? (
              <p className="text-xs text-slate-500">
                No outreach emails sent yet. Once you launch a campaign with Resend, delivery records appear here.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recentEmails.slice(0, 3).map((email) => {
                  const isSuccess = email.status === 'Accepted' || email.status === 'Delivered';
                  return (
                    <div key={email.id} className="text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-slate-800 truncate max-w-[150px]">{email.recipient}</span>
                        <span
                          className={`font-semibold ${
                            isSuccess ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {email.status}
                        </span>
                      </div>
                      <div className="text-slate-500 truncate mt-0.5">{email.subject}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {new Date(email.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
