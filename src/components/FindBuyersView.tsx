import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Building2,
  Globe,
  Phone,
  Bookmark,
  BookmarkCheck,
  Mail,
  Loader2,
  AlertCircle,
  ExternalLink,
  Star,
  CheckCircle2,
  SlidersHorizontal,
  KeyRound,
} from 'lucide-react';
import { SearchResultItem, Buyer } from '../types';
import { searchBuyers, saveBuyer, discoverEmail } from '../services/api';
import { NavTab } from './Navigation';

const US_STATES = [
  'All USA',
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

const DECOR_CATEGORIES = [
  'Home Decor Stores',
  'Furniture Wholesalers',
  'Home Furnishing Retailers',
  'Interior Design Companies',
  'Decor Boutiques',
  'Lighting & Rug Showrooms',
  'Architectural & Interior Suppliers',
  'Hospitality & Contract Furniture Wholesalers',
];

interface FindBuyersViewProps {
  savedBuyers: Buyer[];
  onBuyerSaved: (buyer: Buyer) => void;
  onNavigate: (tab: NavTab) => void;
  initialParams?: { query: string; location: string; category: string } | null;
  onClearInitialParams?: () => void;
}

export const FindBuyersView: React.FC<FindBuyersViewProps> = ({
  savedBuyers,
  onBuyerSaved,
  onNavigate,
  initialParams,
  onClearInitialParams,
}) => {
  const [keywords, setKeywords] = useState('Home decor stores');
  const [selectedState, setSelectedState] = useState('New York');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('Home Decor Stores');
  const [limit, setLimit] = useState(20);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextStart, setNextStart] = useState<number | undefined>(undefined);

  // Per-item action state
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [discoveringMap, setDiscoveringMap] = useState<Record<string, boolean>>({});
  const [discoveredEmailsMap, setDiscoveredEmailsMap] = useState<Record<string, string[]>>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Sync initial parameters when rerun from Search History
  React.useEffect(() => {
    if (initialParams) {
      if (initialParams.query) setKeywords(initialParams.query);
      if (initialParams.category) setCategory(initialParams.category);
      if (initialParams.location) {
        const parts = initialParams.location.split(',').map((p) => p.trim());
        if (parts.length > 1) {
          setCity(parts[0]);
          setSelectedState(parts[1] || 'All USA');
        } else {
          setSelectedState(parts[0] || 'All USA');
        }
      }
      if (onClearInitialParams) onClearInitialParams();
    }
  }, [initialParams, onClearInitialParams]);

  // Set of already saved website URLs or names to indicate saved status
  const savedKeySet = new Set(
    savedBuyers.map((b) => {
      if (b.website) {
        return b.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').toLowerCase();
      }
      return `${b.business_name.toLowerCase().trim()}_${b.address.toLowerCase().trim()}`;
    })
  );

  const isItemSaved = (item: SearchResultItem): boolean => {
    if (item.website) {
      const clean = item.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').toLowerCase();
      if (clean && savedKeySet.has(clean)) return true;
    }
    const fallbackKey = `${item.business_name.toLowerCase().trim()}_${item.address.toLowerCase().trim()}`;
    return savedKeySet.has(fallbackKey);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);
    setActionMessage(null);

    const locationStr = [city.trim(), selectedState === 'All USA' ? 'USA' : selectedState]
      .filter(Boolean)
      .join(', ');

    const resp = await searchBuyers({
      query: keywords.trim(),
      location: locationStr,
      category,
      limit,
      start: 0,
    });

    setIsLoading(false);
    setHasSearched(true);

    if (!resp.success) {
      setError(resp.error || 'Failed to search buyers with SerpApi.');
      setResults([]);
      setHasMore(false);
      setNextStart(undefined);
    } else {
      setResults(resp.results);
      setHasMore(Boolean(resp.hasMore));
      setNextStart(resp.nextStart);
    }
  };

  const handleLoadMore = async () => {
    if (nextStart === undefined || isLoadingMore) return;
    setIsLoadingMore(true);

    const locationStr = [city.trim(), selectedState === 'All USA' ? 'USA' : selectedState]
      .filter(Boolean)
      .join(', ');

    const resp = await searchBuyers({
      query: keywords.trim(),
      location: locationStr,
      category,
      limit,
      start: nextStart,
    });

    setIsLoadingMore(false);

    if (resp.success && resp.results.length > 0) {
      setResults((prev) => [...prev, ...resp.results]);
      setHasMore(Boolean(resp.hasMore));
      setNextStart(resp.nextStart);
    } else {
      setHasMore(false);
    }
  };

  const handleSaveBuyer = async (item: SearchResultItem) => {
    const key = item.website || item.business_name;
    setSavingMap((prev) => ({ ...prev, [key]: true }));

    const discoveredEmails = (discoveredEmailsMap[key] || []).map((email) => ({
      email,
      sourceUrl: item.website || '',
      label: 'Publicly Found' as const,
      discoveredAt: new Date().toISOString(),
    }));

    const resp = await saveBuyer({
      business_name: item.business_name,
      category: item.category || category,
      address: item.address,
      city: item.city || city || undefined,
      state: item.state || (selectedState !== 'All USA' ? selectedState : undefined),
      phone: item.phone,
      website: item.website,
      discovered_emails: discoveredEmails,
      rating: item.rating,
      reviews_count: item.reviews_count,
      source: item.source || 'SerpApi Search',
      search_query: `${keywords} in ${selectedState}`,
    });

    setSavingMap((prev) => ({ ...prev, [key]: false }));

    if (resp.success && resp.buyer) {
      onBuyerSaved(resp.buyer);
      setActionMessage(`"${item.business_name}" saved to your persistent directory.`);
      setTimeout(() => setActionMessage(null), 4000);
    } else {
      alert(resp.error || 'Failed to save buyer');
    }
  };

  const handleDiscoverEmail = async (item: SearchResultItem) => {
    if (!item.website) return;
    const key = item.website || item.business_name;
    setDiscoveringMap((prev) => ({ ...prev, [key]: true }));

    const resp = await discoverEmail(item.website);
    setDiscoveringMap((prev) => ({ ...prev, [key]: false }));

    if (resp.success && resp.emails.length > 0) {
      const emailList = resp.emails.map((e) => e.email);
      setDiscoveredEmailsMap((prev) => ({ ...prev, [key]: emailList }));
      setActionMessage(`Found ${resp.emails.length} public email(s) for ${item.business_name}!`);
      setTimeout(() => setActionMessage(null), 4000);
    } else {
      setActionMessage(`No public email found for ${item.business_name}.`);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Find US Home Decor Retailers & Wholesalers
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Query live Google Local data via SerpApi across 50 US states to identify commercial buyers.
          </p>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1.5 self-start md:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Live SerpApi Query Engine</span>
        </div>
      </div>

      {/* Global Notification Banner */}
      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Search Filter Form */}
      <form
        onSubmit={handleSearch}
        className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-xs space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Search Keywords
            </label>
            <div className="relative">
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. Home decor stores, luxury lighting"
                className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Business Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Business Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (!keywords || keywords.includes('store') || keywords.includes('wholesaler')) {
                  setKeywords(e.target.value);
                }
              }}
              className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {DECOR_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* US State */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              US State / Territory
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {US_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* City / Metro */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              City / Metro (Optional)
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. New York, Austin, Miami"
              className="w-full px-3.5 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="font-medium">Quick examples:</span>
            <button
              type="button"
              onClick={() => {
                setKeywords('Home decor stores');
                setSelectedState('New York');
                setCity('New York');
                setCategory('Home Decor Stores');
              }}
              className="text-indigo-600 hover:underline"
            >
              New York Stores
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => {
                setKeywords('Furniture wholesalers');
                setSelectedState('California');
                setCity('Los Angeles');
                setCategory('Furniture Wholesalers');
              }}
              className="text-indigo-600 hover:underline"
            >
              California Wholesalers
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => {
                setKeywords('Home furnishing retailers');
                setSelectedState('Texas');
                setCity('Austin');
                setCategory('Home Furnishing Retailers');
              }}
              className="text-indigo-600 hover:underline"
            >
              Texas Retailers
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Max:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={40}>40</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Querying SerpApi...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Execute Search</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Error / Key Missing State */}
      {error && (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-rose-900">SerpApi Search Failed</h3>
              <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
            </div>
          </div>
          {error.includes('SERPAPI_KEY') && (
            <div className="pt-2 border-t border-rose-200 flex items-center justify-between">
              <span className="text-xs text-rose-800">
                Configure your free SerpApi key (100 free searches/month) in the Settings tab.
              </span>
              <button
                onClick={() => onNavigate('settings')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Go to API Settings</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-5 bg-white border border-slate-200 rounded-xl space-y-3 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-3/4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              <div className="h-3 bg-slate-200 rounded w-full"></div>
              <div className="h-8 bg-slate-200 rounded mt-4"></div>
            </div>
          ))}
        </div>
      )}

      {/* Results Header */}
      {!isLoading && hasSearched && results.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="font-mono text-slate-800 tabular-nums">{results.length}</strong> real business results from Google Maps via SerpApi
          </div>
          <div className="flex items-center gap-2">
            <span>Already saved in DB:</span>
            <strong className="font-mono text-indigo-600 tabular-nums">
              {results.filter((r) => isItemSaved(r)).length}
            </strong>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {!isLoading && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((item, index) => {
            const key = item.website || item.business_name;
            const alreadySaved = isItemSaved(item);
            const isSaving = savingMap[key];
            const isDiscovering = discoveringMap[key];
            const foundEmails = discoveredEmailsMap[key] || [];

            return (
              <div
                key={item.place_id || index}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 shadow-xs flex flex-col justify-between transition-colors"
              >
                <div className="space-y-3">
                  {/* Category & Rating */}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="truncate font-medium text-slate-600">
                      {item.category || category}
                    </span>
                    {item.rating !== undefined && (
                      <span className="flex items-center gap-1 font-mono text-amber-600 font-semibold shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{item.rating.toFixed(1)}</span>
                        {item.reviews_count && (
                          <span className="text-slate-400 text-[11px]">({item.reviews_count})</span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Business Name */}
                  <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2">
                    {item.business_name}
                  </h3>

                  {/* Address */}
                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-relaxed">{item.address}</span>
                  </div>

                  {/* Phone & Website links */}
                  <div className="space-y-1.5 pt-1 text-xs">
                    {item.phone && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{item.phone}</span>
                      </div>
                    )}

                    {item.website ? (
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <a
                          href={item.website.startsWith('http') ? item.website : `https://${item.website}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-indigo-600 hover:text-indigo-800 hover:underline truncate flex items-center gap-1"
                        >
                          <span className="truncate">{item.website.replace(/^https?:\/\//, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">No official website listed</div>
                    )}
                  </div>

                  {/* Discovered Emails in this session */}
                  {foundEmails.length > 0 && (
                    <div className="mt-2 p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-xs space-y-1">
                      <div className="text-emerald-800 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Public Email Discovered</span>
                      </div>
                      {foundEmails.map((email) => (
                        <div key={email} className="font-mono text-emerald-700 text-[11px] truncate">
                          {email}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Email Discovery Button */}
                  {item.website ? (
                    <button
                      onClick={() => handleDiscoverEmail(item)}
                      disabled={isDiscovering}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      title="Scrape official website for public business email"
                    >
                      {isDiscovering ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-slate-600" />
                          <span>Crawling...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>Find Email</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No website to crawl</span>
                  )}

                  {/* Save Buyer Button */}
                  {alreadySaved ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200/60">
                      <BookmarkCheck className="w-3.5 h-3.5" />
                      <span>Saved</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSaveBuyer(item)}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>Save Buyer</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination / Load More */}
      {!isLoading && results.length > 0 && hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Loading Next Batch of US Buyers...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>Load More Business Results from Google Maps</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Empty Search State */}
      {!isLoading && hasSearched && results.length === 0 && !error && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No Business Results Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Google Maps / SerpApi returned 0 results for &quot;{keywords}&quot; in {selectedState}. Try broadening your search terms or selecting another US state.
          </p>
        </div>
      )}

      {/* Initial Guidance Card */}
      {!hasSearched && !isLoading && (
        <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-6 text-slate-700 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-950 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span>Search Guidance & Targeted B2B Decor Niches</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 pt-1">
            <div className="p-3 bg-white border border-indigo-100/60 rounded-lg space-y-1">
              <strong className="text-slate-900 block font-semibold">1. Independent Boutiques</strong>
              <p className="leading-relaxed">
                Search &quot;Decor boutiques&quot; or &quot;Home goods shop&quot; in lifestyle hubs like Brooklyn, Austin, or Scottsdale for high-margin stockist orders.
              </p>
            </div>
            <div className="p-3 bg-white border border-indigo-100/60 rounded-lg space-y-1">
              <strong className="text-slate-900 block font-semibold">2. Regional Wholesalers</strong>
              <p className="leading-relaxed">
                Target &quot;Furniture wholesalers&quot; in logistics centers like California, High Point NC, or Texas for container-load and repeat volume inquiries.
              </p>
            </div>
            <div className="p-3 bg-white border border-indigo-100/60 rounded-lg space-y-1">
              <strong className="text-slate-900 block font-semibold">3. Design Studios & Showrooms</strong>
              <p className="leading-relaxed">
                Target &quot;Interior design showroom&quot; in major metropolitan areas for specification on luxury residential and hospitality projects.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
