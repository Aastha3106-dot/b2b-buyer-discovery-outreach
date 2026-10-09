import React, { useState, useEffect, useCallback } from 'react';
import { Navigation, NavTab } from './components/Navigation';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { FindBuyersView } from './components/FindBuyersView';
import { SavedBuyersView } from './components/SavedBuyersView';
import { EmailCampaignsView } from './components/EmailCampaignsView';
import { EmailHistoryView } from './components/EmailHistoryView';
import { SearchHistoryView } from './components/SearchHistoryView';
import { ApiSettingsView } from './components/ApiSettingsView';
import { BuyerDetailsModal } from './components/BuyerDetailsModal';
import { ComposeEmailModal } from './components/ComposeEmailModal';
import {
  Buyer,
  EmailRecord,
  SearchRecord,
  DashboardStats,
  IntegrationsStatusResponse,
} from './types';
import {
  getSavedBuyers,
  getEmailHistory,
  getSearchHistory,
  getDashboardStats,
  getIntegrationsStatus,
} from './services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  // Application data states
  const [savedBuyers, setSavedBuyers] = useState<Buyer[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailRecord[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchRecord[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [integrationsStatus, setIntegrationsStatus] = useState<IntegrationsStatusResponse | null>(null);

  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active modals & preselected data
  const [activeDetailsBuyer, setActiveDetailsBuyer] = useState<Buyer | null>(null);
  const [activeComposeBuyer, setActiveComposeBuyer] = useState<Buyer | null>(null);
  const [campaignPreselectedBuyers, setCampaignPreselectedBuyers] = useState<Buyer[]>([]);

  // Fetch all primary app data
  const refreshAllData = useCallback(async (isRefreshAction = false) => {
    if (isRefreshAction) setIsRefreshing(true);

    try {
      const [buyersRes, emailsRes, searchesRes, statsRes, statusRes] = await Promise.all([
        getSavedBuyers(),
        getEmailHistory(),
        getSearchHistory(),
        getDashboardStats(),
        getIntegrationsStatus(),
      ]);

      if (buyersRes.success) setSavedBuyers(buyersRes.buyers);
      if (emailsRes.success) setEmailHistory(emailsRes.history);
      if (searchesRes.success) setSearchHistory(searchesRes.history);
      if (statsRes.success) setDashboardStats(statsRes.stats);
      if (statusRes.success) setIntegrationsStatus(statusRes.integrations);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setIsInitialLoading(false);
      if (isRefreshAction) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Search Rerun state
  const [pendingSearchParams, setPendingSearchParams] = useState<{
    query: string;
    location: string;
    category: string;
  } | null>(null);

  const handleBuyerSaved = (newBuyer: Buyer) => {
    setSavedBuyers((prev) => [newBuyer, ...prev]);
    refreshAllData();
  };

  const handleRerunSearch = (query: string, location: string, category: string) => {
    setPendingSearchParams({ query, location, category });
    setCurrentTab('find-buyers');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex font-sans antialiased">
      {/* Sidebar Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'campaigns') setCampaignPreselectedBuyers([]);
        }}
        savedBuyersCount={savedBuyers.length}
      />

      {/* Main Viewport Content */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navigation Bar */}
        <TopBar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onRefresh={() => refreshAllData(true)}
          isRefreshing={isRefreshing}
        />

        {/* Tab Content Router */}
        <main className="flex-1 pb-16">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={dashboardStats}
              isLoading={isInitialLoading}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'find-buyers' && (
            <FindBuyersView
              savedBuyers={savedBuyers}
              onBuyerSaved={handleBuyerSaved}
              onNavigate={setCurrentTab}
              initialParams={pendingSearchParams}
              onClearInitialParams={() => setPendingSearchParams(null)}
            />
          )}

          {currentTab === 'saved-buyers' && (
            <SavedBuyersView
              buyers={savedBuyers}
              onBuyersUpdated={refreshAllData}
              onNavigate={setCurrentTab}
              onOpenOutreachModal={(buyer) => setActiveComposeBuyer(buyer)}
              onSelectBuyersForCampaign={(selected) => {
                setCampaignPreselectedBuyers(selected);
              }}
              onViewDetails={(buyer) => setActiveDetailsBuyer(buyer)}
            />
          )}

          {currentTab === 'campaigns' && (
            <EmailCampaignsView
              allSavedBuyers={savedBuyers}
              preselectedBuyers={campaignPreselectedBuyers}
              onOutreachComplete={refreshAllData}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'email-history' && (
            <EmailHistoryView
              history={emailHistory}
              isLoading={isInitialLoading}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'search-history' && (
            <SearchHistoryView
              history={searchHistory}
              isLoading={isInitialLoading}
              onNavigate={setCurrentTab}
              onRerunSearch={handleRerunSearch}
            />
          )}

          {currentTab === 'settings' && (
            <ApiSettingsView
              status={integrationsStatus}
              isLoading={isRefreshing}
              onRefresh={() => refreshAllData(true)}
            />
          )}
        </main>
      </div>

      {/* Buyer Details Modal */}
      {activeDetailsBuyer && (
        <BuyerDetailsModal
          buyer={activeDetailsBuyer}
          onClose={() => setActiveDetailsBuyer(null)}
          onBuyerUpdated={refreshAllData}
          onOpenCompose={(buyer) => setActiveComposeBuyer(buyer)}
        />
      )}

      {/* Direct Compose Pitch Modal */}
      {activeComposeBuyer && (
        <ComposeEmailModal
          buyer={activeComposeBuyer}
          onClose={() => setActiveComposeBuyer(null)}
          onSent={refreshAllData}
        />
      )}
    </div>
  );
}
