import React from 'react';
import { Search, PlusCircle, RefreshCw, Sparkles } from 'lucide-react';
import { NavTab } from './Navigation';

interface TopBarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const TAB_TITLES: Record<NavTab, { title: string; category: string }> = {
  dashboard: { title: 'Executive Overview', category: 'Dashboard' },
  'find-buyers': { title: 'Discover US Retailers & Wholesalers', category: 'SerpApi Search' },
  'saved-buyers': { title: 'Saved Buyers Directory', category: 'CRM Directory' },
  campaigns: { title: 'Batch Email Outreach', category: 'Outreach' },
  'email-history': { title: 'Sent Message Delivery Logs', category: 'Outreach Logs' },
  'search-history': { title: 'Historical Query Log', category: 'SerpApi Logs' },
  settings: { title: 'API Connections & Credentials', category: 'System Settings' },
};

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  onSelectTab,
  onRefresh,
  isRefreshing,
}) => {
  const info = TAB_TITLES[currentTab] || { title: 'HomeDecor Buyer Finder', category: 'Portal' };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Zone 1: Contextual Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
          {info.category}
        </span>
        <span className="text-slate-300" aria-hidden="true">/</span>
        <h1 className="text-sm md:text-base font-semibold text-slate-900 truncate">
          {info.title}
        </h1>
      </div>

      {/* Zone 2: Navigation / Quick Indicator */}
      <div className="hidden md:flex items-center gap-4 text-xs font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Database Persistent
        </span>
        <span className="text-slate-300">·</span>
        <span>Google Maps / SerpApi</span>
        <span className="text-slate-300">·</span>
        <span>Firecrawl Crawler</span>
        <span className="text-slate-300">·</span>
        <span className="text-indigo-600 font-medium">Gmail API (Google OAuth 2.0)</span>
      </div>

      {/* Zone 3: Primary Action buttons */}
      <div className="flex items-center gap-2.5 shrink-0">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh current data"
            aria-label="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        )}

        {currentTab !== 'find-buyers' && (
          <button
            onClick={() => onSelectTab('find-buyers')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Buyers</span>
          </button>
        )}

        {currentTab !== 'campaigns' && (
          <button
            onClick={() => onSelectTab('campaigns')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Campaign</span>
          </button>
        )}
      </div>
    </header>
  );
};
