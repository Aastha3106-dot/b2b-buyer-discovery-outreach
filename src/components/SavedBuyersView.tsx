import React, { useState } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Mail,
  Send,
  Building,
  MapPin,
  Phone,
  Globe,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileEdit,
  Eye,
  Plus,
} from 'lucide-react';
import { Buyer, DiscoveredEmail } from '../types';
import { deleteBuyer, discoverEmail, updateBuyer } from '../services/api';
import { NavTab } from './Navigation';

interface SavedBuyersViewProps {
  buyers: Buyer[];
  onBuyersUpdated: () => void;
  onNavigate: (tab: NavTab) => void;
  onOpenOutreachModal: (buyer: Buyer) => void;
  onSelectBuyersForCampaign?: (buyers: Buyer[]) => void;
  onViewDetails: (buyer: Buyer) => void;
}

export const SavedBuyersView: React.FC<SavedBuyersViewProps> = ({
  buyers,
  onBuyersUpdated,
  onNavigate,
  onOpenOutreachModal,
  onSelectBuyersForCampaign,
  onViewDetails,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all | has_email | needs_email | contacted
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);
  const [isDiscoveringMap, setIsDiscoveringMap] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filter buyers
  const filteredBuyers = buyers.filter((buyer) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      buyer.business_name.toLowerCase().includes(term) ||
      buyer.address.toLowerCase().includes(term) ||
      (buyer.city && buyer.city.toLowerCase().includes(term)) ||
      (buyer.state && buyer.state.toLowerCase().includes(term)) ||
      (buyer.website && buyer.website.toLowerCase().includes(term)) ||
      (buyer.discovered_emails && buyer.discovered_emails.some((e) => e.email.toLowerCase().includes(term)));

    const matchesCategory =
      categoryFilter === 'all' ||
      buyer.category.toLowerCase().includes(categoryFilter.toLowerCase());

    const hasEmail = buyer.discovered_emails && buyer.discovered_emails.length > 0;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'has_email' && hasEmail) ||
      (statusFilter === 'needs_email' && !hasEmail) ||
      (statusFilter === 'contacted' && buyer.email_status === 'contacted');

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = Array.from(new Set(buyers.map((b) => b.category))).filter(Boolean);

  const handleDelete = async (buyerId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from your saved directory?`)) {
      return;
    }
    const resp = await deleteBuyer(buyerId);
    if (resp.success) {
      setSelectedBuyerIds((prev) => prev.filter((id) => id !== buyerId));
      onBuyersUpdated();
      setStatusMessage(`Removed "${name}" from directory.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      alert(resp.error || 'Failed to remove buyer');
    }
  };

  const handleDiscoverSingleEmail = async (buyer: Buyer) => {
    if (!buyer.website) {
      alert('This business does not have a website URL listed to crawl.');
      return;
    }

    setIsDiscoveringMap((prev) => ({ ...prev, [buyer.id]: true }));
    const resp = await discoverEmail(buyer.website, buyer.id);
    setIsDiscoveringMap((prev) => ({ ...prev, [buyer.id]: false }));

    if (resp.success && resp.emails.length > 0) {
      onBuyersUpdated();
      setStatusMessage(`Found ${resp.emails.length} email(s) for "${buyer.business_name}"!`);
      setTimeout(() => setStatusMessage(null), 4000);
    } else {
      setStatusMessage(resp.message || `No public emails found for "${buyer.business_name}".`);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedBuyerIds(filteredBuyers.map((b) => b.id));
    } else {
      setSelectedBuyerIds([]);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedBuyerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleLaunchCampaignWithSelected = () => {
    const selected = buyers.filter((b) => selectedBuyerIds.includes(b.id));
    if (onSelectBuyersForCampaign) {
      onSelectBuyersForCampaign(selected);
    }
    onNavigate('campaigns');
  };

  const [isBatchDiscovering, setIsBatchDiscovering] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; name?: string } | null>(null);

  const handleBatchDiscover = async () => {
    const selected = buyers.filter((b) => selectedBuyerIds.includes(b.id) && b.website);
    if (selected.length === 0) {
      alert('None of the selected buyers have a website URL to crawl.');
      return;
    }

    setIsBatchDiscovering(true);
    let foundCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const b = selected[i];
      setBatchProgress({ current: i + 1, total: selected.length, name: b.business_name });
      try {
        const resp = await discoverEmail(b.website!, b.id);
        if (resp.success && resp.emails.length > 0) {
          foundCount++;
        }
      } catch (e) {
        console.error('Batch discover error:', e);
      }
      if (i < selected.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    setIsBatchDiscovering(false);
    setBatchProgress(null);
    onBuyersUpdated();
    setStatusMessage(`Batch discovery finished: found public emails for ${foundCount} of ${selected.length} buyers.`);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Saved Buyers Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Persistent CRM records of verified US home decor stockists, retailers, and wholesalers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {selectedBuyerIds.length > 0 && (
            <>
              <button
                onClick={handleBatchDiscover}
                disabled={isBatchDiscovering}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                title="Crawl websites of selected buyers to discover emails"
              >
                {isBatchDiscovering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
                    <span>Crawling ({batchProgress?.current}/{batchProgress?.total})...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Discover Emails ({selectedBuyerIds.length})</span>
                  </>
                )}
              </button>

              <button
                onClick={handleLaunchCampaignWithSelected}
                disabled={isBatchDiscovering}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Create Campaign ({selectedBuyerIds.length})</span>
              </button>
            </>
          )}

          <button
            onClick={() => onNavigate('find-buyers')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Search More Buyers</span>
          </button>
        </div>
      </div>

      {/* Batch Crawl Progress Card */}
      {isBatchDiscovering && batchProgress && (
        <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-950">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>Crawling website for {batchProgress.name}...</span>
            </span>
            <span className="font-mono tabular-nums">
              {batchProgress.current} / {batchProgress.total}
            </span>
          </div>
          <div className="w-full h-1.5 bg-indigo-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Notification Banner */}
      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Query Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by business name, city, state, website, or email..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Email Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="all">All Email Statuses</option>
            <option value="has_email">Has Discovered Email</option>
            <option value="needs_email">Needs Email Crawl</option>
            <option value="contacted">Already Contacted</option>
          </select>
        </div>
      </div>

      {/* Directory Table / Card Container */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {filteredBuyers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Building className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {buyers.length === 0 ? 'No Saved Buyers in Database' : 'No Matching Buyers Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {buyers.length === 0
                ? 'Use the Find Buyers tab to query US home decor businesses and save them to your database.'
                : 'Try adjusting your search query or filters to find saved businesses.'}
            </p>
            {buyers.length === 0 && (
              <button
                onClick={() => onNavigate('find-buyers')}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Go to Buyer Search</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredBuyers.length > 0 &&
                        selectedBuyerIds.length === filteredBuyers.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="py-3 px-4">Business & Category</th>
                  <th className="py-3 px-4">Location & Contact</th>
                  <th className="py-3 px-4">Discovered Emails (Public)</th>
                  <th className="py-3 px-4">Outreach Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBuyers.map((buyer) => {
                  const isSelected = selectedBuyerIds.includes(buyer.id);
                  const isDiscovering = isDiscoveringMap[buyer.id];
                  const hasEmail = buyer.discovered_emails && buyer.discovered_emails.length > 0;

                  return (
                    <tr
                      key={buyer.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(buyer.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Business & Category */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">
                          {buyer.business_name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {buyer.category}
                        </div>
                        {buyer.website && (
                          <a
                            href={buyer.website.startsWith('http') ? buyer.website : `https://${buyer.website}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span className="truncate">{buyer.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        )}
                      </td>

                      {/* Location & Phone */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-start gap-1 text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <span className="truncate">{buyer.address}</span>
                        </div>
                        {buyer.phone && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 font-mono">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{buyer.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Discovered Emails */}
                      <td className="py-3.5 px-4">
                        {hasEmail ? (
                          <div className="space-y-1">
                            {buyer.discovered_emails.map((e, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-800 font-medium">
                                  {e.email}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  · {e.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs">No public email found</span>
                            {buyer.website && (
                              <button
                                onClick={() => handleDiscoverSingleEmail(buyer)}
                                disabled={isDiscovering}
                                className="px-2 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                              >
                                {isDiscovering ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Crawling...</span>
                                  </>
                                ) : (
                                  <>
                                    <Mail className="w-3 h-3" />
                                    <span>Discover</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Outreach Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {buyer.email_status === 'contacted' ? (
                          <div className="text-indigo-700 font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Contacted</span>
                          </div>
                        ) : hasEmail ? (
                          <div className="text-emerald-700 font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Ready for outreach</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Needs email</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onViewDetails(buyer)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            title="View business details & notes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {hasEmail && (
                            <button
                              onClick={() => onOpenOutreachModal(buyer)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-colors"
                              title="Compose personalized email outreach"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(buyer.id, buyer.business_name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Remove buyer from directory"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
