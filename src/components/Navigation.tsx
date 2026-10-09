import React from 'react';
import {
  LayoutDashboard,
  Search,
  BookmarkCheck,
  MailCheck,
  History,
  Clock,
  KeyRound,
  Store,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'find-buyers'
  | 'saved-buyers'
  | 'campaigns'
  | 'email-history'
  | 'search-history'
  | 'settings';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  savedBuyersCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  savedBuyersCount,
}) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navItems: { id: NavTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'find-buyers', label: 'Find Buyers', icon: Search },
    { id: 'saved-buyers', label: 'Saved Buyers', icon: BookmarkCheck, badge: savedBuyersCount },
    { id: 'campaigns', label: 'Email Campaigns', icon: MailCheck },
    { id: 'email-history', label: 'Email History', icon: History },
    { id: 'search-history', label: 'Search History', icon: Clock },
    { id: 'settings', label: 'API Settings', icon: KeyRound },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            <Store className="w-4 h-4" />
          </div>
          <span className="font-semibold text-slate-900 text-sm tracking-tight">HomeDecor Buyer Finder</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-base leading-tight tracking-tight">
              HomeDecor
            </div>
            <div className="text-[11px] text-slate-500 font-medium tracking-tight">
              Buyer Finder · B2B Outreach
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Prospecting
          </div>
          {navItems.slice(0, 3).map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-xs font-mono tabular-nums px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-5 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Outreach & Logs
          </div>
          {navItems.slice(3).map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer Info Box */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60">
          <div className="text-xs text-slate-600">
            <div className="font-semibold text-slate-900 mb-1 flex items-center justify-between">
              <span>API Integrations</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-2.5">
              Powered by SerpApi for buyer search, Firecrawl for email discovery, and Resend for outreach.
            </p>
            <button
              onClick={() => {
                onSelectTab('settings');
                setMobileOpen(false);
              }}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              Verify API Status <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
