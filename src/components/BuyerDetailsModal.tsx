import React, { useState } from 'react';
import {
  X,
  Building,
  MapPin,
  Phone,
  Globe,
  Mail,
  Send,
  Save,
  CheckCircle2,
  ExternalLink,
  Clock,
  Star,
  FileText,
} from 'lucide-react';
import { Buyer } from '../types';
import { updateBuyer } from '../services/api';

interface BuyerDetailsModalProps {
  buyer: Buyer | null;
  onClose: () => void;
  onBuyerUpdated: () => void;
  onOpenCompose: (buyer: Buyer) => void;
}

export const BuyerDetailsModal: React.FC<BuyerDetailsModalProps> = ({
  buyer,
  onClose,
  onBuyerUpdated,
  onOpenCompose,
}) => {
  if (!buyer) return null;

  const [notes, setNotes] = useState(buyer.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    const resp = await updateBuyer(buyer.id, { notes });
    setIsSavingNotes(false);
    if (resp.success) {
      setNotesSaved(true);
      onBuyerUpdated();
      setTimeout(() => setNotesSaved(false), 3000);
    }
  };

  const hasEmail = buyer.discovered_emails && buyer.discovered_emails.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">
              {buyer.category}
            </span>
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {buyer.business_name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Business Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Address</span>
            <div className="flex items-start gap-1.5 text-slate-800">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{buyer.address}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Phone</span>
            <div className="flex items-center gap-1.5 text-slate-800">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-mono">{buyer.phone || 'Not listed'}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Website</span>
            {buyer.website ? (
              <a
                href={buyer.website.startsWith('http') ? buyer.website : `https://${buyer.website}`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-medium truncate"
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{buyer.website}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            ) : (
              <span className="text-slate-400 italic">No website available</span>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lead Source</span>
            <div className="text-slate-800 font-medium">
              {buyer.source || 'SerpApi Search'}
            </div>
          </div>
        </div>

        {/* Discovered Emails Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              <span>Publicly Discovered Emails</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              {buyer.discovered_emails?.length || 0} found
            </span>
          </div>

          {hasEmail ? (
            <div className="space-y-2">
              {buyer.discovered_emails.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 border border-slate-200 rounded-xl bg-emerald-50/30 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-mono font-bold text-slate-900 truncate">
                      {item.email}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span>Label: {item.label}</span>
                      <span className="text-slate-300">·</span>
                      <span className="truncate">Source: {item.sourceUrl}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 font-semibold px-2 py-0.5 rounded shrink-0">
                    Publicly Found
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
              No public email has been discovered yet for this buyer.
            </div>
          )}
        </div>

        {/* Private Notes Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Account Notes & Buyer Intel</span>
            </label>
            {notesSaved && (
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Notes Saved</span>
              </span>
            )}
          </div>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about buyer preferences, order volume, catalog sent, or follow-up dates..."
            className="w-full p-3 text-xs bg-slate-50/70 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSaveNotes}
              disabled={isSavingNotes}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            Saved on {new Date(buyer.date_saved).toLocaleDateString()}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
            {hasEmail && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCompose(buyer);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Pitch Email</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
