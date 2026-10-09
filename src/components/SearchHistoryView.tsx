import React, { useState } from 'react';
import {
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  RotateCcw,
  MapPin,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { SearchRecord } from '../types';
import { NavTab } from './Navigation';

interface SearchHistoryViewProps {
  history: SearchRecord[];
  isLoading: boolean;
  onNavigate: (tab: NavTab) => void;
  onRerunSearch?: (query: string, location: string, category: string) => void;
}

export const SearchHistoryView: React.FC<SearchHistoryViewProps> = ({
  history,
  isLoading,
  onNavigate,
  onRerunSearch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter((item) => {
    const term = searchTerm.toLowerCase().trim();
    return (
      !term ||
      item.query.toLowerCase().includes(term) ||
      item.location.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Search History & Market Queries
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Audit trail of all SerpApi search operations executed across US regions and decor categories.
          </p>
        </div>

        <button
          onClick={() => onNavigate('find-buyers')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Search className="w-3.5 h-3.5" />
          <span>New Market Search</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter past searches by keywords, state, city, or category..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {history.length === 0 ? 'No Searches Executed Yet' : 'No Matching Search Records'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {history.length === 0
                ? 'Whenever you run a query in Find Buyers, the search parameters and result counts are recorded here.'
                : 'Try adjusting your search filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Query Keywords</th>
                  <th className="py-3 px-4">Target Location</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Results Count</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Rerun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Query */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {item.query}
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{item.location}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{item.category}</span>
                      </div>
                    </td>

                    {/* Results Count */}
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 tabular-nums">
                      {item.result_count} businesses
                    </td>

                    {/* Latency */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 tabular-nums">
                      {item.duration_ms}ms
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.status === 'success' ? (
                        <div className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Success</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Failed</span>
                        </div>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>

                    {/* Rerun */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (onRerunSearch) {
                            onRerunSearch(item.query, item.location, item.category);
                          } else {
                            onNavigate('find-buyers');
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors inline-flex items-center gap-1"
                        title="Rerun this search query in Find Buyers"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Rerun</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
