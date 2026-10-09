import React, { useState } from 'react';
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Send,
  Eye,
  X,
  Code,
  Paperclip,
} from 'lucide-react';
import { EmailRecord } from '../types';
import { NavTab } from './Navigation';

interface EmailHistoryViewProps {
  history: EmailRecord[];
  isLoading: boolean;
  onNavigate: (tab: NavTab) => void;
}

export const EmailHistoryView: React.FC<EmailHistoryViewProps> = ({
  history,
  isLoading,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState<EmailRecord | null>(null);

  const filteredHistory = history.filter((item) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      item.recipient.toLowerCase().includes(term) ||
      (item.business_name && item.business_name.toLowerCase().includes(term)) ||
      item.subject.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Email Delivery History & Logs
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real transmission telemetry for all test messages and outreach campaigns dispatched via Resend.
          </p>
        </div>

        <button
          onClick={() => onNavigate('campaigns')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          <Send className="w-3.5 h-3.5" />
          <span>New Outreach Campaign</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by recipient email, business name, or subject line..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50/70 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Provider Statuses</option>
            <option value="Sent">Sent (Gmail API)</option>
            <option value="Accepted">Accepted (Resend)</option>
            <option value="Failed">Failed / Rejected</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {history.length === 0 ? 'No Email Outreach History Yet' : 'No Matching Email Records'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {history.length === 0
                ? 'Dispatched test emails and buyer outreach messages will be recorded here with Resend provider IDs.'
                : 'Try adjusting your search filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Recipient & Business</th>
                  <th className="py-3 px-4">Subject & Preview</th>
                  <th className="py-3 px-4">Provider & ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Delivery Status</th>
                  <th className="py-3 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((item) => {
                  const isAccepted = item.status === 'Accepted' || item.status === 'Delivered' || item.status === 'Sent';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Recipient */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 font-mono truncate">
                          {item.recipient}
                        </div>
                        {item.business_name && (
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {item.business_name}
                          </div>
                        )}
                      </td>

                      {/* Subject & Preview */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="font-medium text-slate-800 truncate">
                          {item.subject}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.body_preview}
                        </div>
                        {item.attachment_names && item.attachment_names.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-200/80 truncate max-w-xs"
                              title={item.attachment_names.join(', ')}
                            >
                              <Paperclip className="w-2.5 h-2.5 shrink-0 text-indigo-500" />
                              <span className="truncate">{item.attachment_names.join(', ')}</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Provider & ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-700">{item.provider}</div>
                        {item.provider_id ? (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {item.provider_id.substring(0, 14)}...
                          </div>
                        ) : (
                          <span className="text-[10px] text-rose-500">None</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isAccepted ? (
                          <div className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{item.status === 'Sent' ? 'Sent' : 'Accepted'}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Failed</span>
                          </div>
                        )}
                      </td>

                      {/* Inspect */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedRecord(item)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Inspector Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Outreach Delivery Log Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Recipient</span>
                  <span className="font-mono text-slate-900 font-semibold">{selectedRecord.recipient}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status</span>
                  <span className={selectedRecord.status === 'Accepted' || selectedRecord.status === 'Sent' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                    {selectedRecord.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Message ID</span>
                  <span className="font-mono text-slate-700 text-[11px] truncate block">
                    {selectedRecord.provider_id || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Logged At</span>
                  <span className="text-slate-700 font-mono text-[11px]">
                    {new Date(selectedRecord.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Subject</span>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-800">
                  {selectedRecord.subject}
                </div>
              </div>

              {selectedRecord.attachment_names && selectedRecord.attachment_names.length > 0 && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">
                    Attached Files ({selectedRecord.attachment_names.length})
                  </span>
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-800 space-y-1.5">
                    {selectedRecord.attachment_names.map((name, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-800">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="font-mono text-[11px] truncate">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.error && (
                <div>
                  <span className="text-rose-600 font-semibold block mb-1">Provider Error Message</span>
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 font-mono text-[11px]">
                    {selectedRecord.error}
                  </div>
                </div>
              )}

              {selectedRecord.raw_response && (
                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Raw API Provider Response</span>
                  <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto max-h-36">
                    {JSON.stringify(selectedRecord.raw_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
