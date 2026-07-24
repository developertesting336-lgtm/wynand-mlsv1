import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

export function AdminMaintenanceModal({ booking, onClose }) {
  const [mrSearch, setMrSearch] = useState('');
  const [mrPage, setMrPage] = useState(1);
  const mrPageSize = 5;

  const allRequests = [...(booking.maintenance_requests || [])].reverse();
  const filtered = allRequests.filter(req =>
    (req.subject || '').toLowerCase().includes(mrSearch.toLowerCase()) ||
    (req.details || '').toLowerCase().includes(mrSearch.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / mrPageSize));
  const paginated = filtered.slice((mrPage - 1) * mrPageSize, mrPage * mrPageSize);

  const getAttachmentUrls = (req) => {
    const urls = [];
    const normalize = (item) => {
      if (!item) return null;
      if (typeof item === 'string') return item;
      if (typeof item === 'object') return item.url || item.fileUrl || item.pdfUrl || null;
      return null;
    };

    if (Array.isArray(req.attachments)) {
      urls.push(...req.attachments.map(normalize).filter(Boolean));
    }
    if (Array.isArray(req.files)) {
      urls.push(...req.files.map(normalize).filter(Boolean));
    }
    if (req.pdfUrl) urls.push(req.pdfUrl);
    if (req.fileUrl) urls.push(req.fileUrl);
    if (req.url) urls.push(req.url);
    return [...new Set(urls)];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 h-[32rem] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">🔧 Maintenance Requests</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search by subject or details..."
            value={mrSearch}
            onChange={(e) => { setMrSearch(e.target.value); setMrPage(1); }}
          />
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {mrSearch ? 'No requests match your search.' : 'No maintenance requests yet.'}
            </p>
          ) : (
            paginated.map((req, idx) => {
              const attachmentUrls = getAttachmentUrls(req);
              return (
                <div key={idx} className="border rounded-xl p-4 bg-slate-50 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{req.subject || 'Maintenance request'}</p>
                      <p className="text-[10px] text-slate-400">{req.created_at ? new Date(req.created_at).toLocaleString() : 'No date'}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] py-1 px-2">
                      {req.status || 'Open'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{req.details || 'No details provided.'}</p>
                  {attachmentUrls.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-600">Attachments</p>
                      <div className="flex flex-col gap-1">
                        {attachmentUrls.map((url, attachmentIndex) => {
                          const fileName = typeof url === 'string'
                            ? url.split('/').pop()?.replace(/\?.*$/, '') || `Attachment ${attachmentIndex + 1}`
                            : `Attachment ${attachmentIndex + 1}`;
                          return (
                            <a
                              key={attachmentIndex}
                              href={url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-xs text-primary hover:underline break-words"
                            >
                              {fileName}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {totalPages > 1 && (
              <>
                <Button size="sm" variant="outline" disabled={mrPage === 1} onClick={() => setMrPage(mrPage - 1)}>Prev</Button>
                <span>Page {mrPage} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={mrPage === totalPages} onClick={() => setMrPage(mrPage + 1)}>Next</Button>
              </>
            )}
            {filtered.length > 0 && <span className="text-xs text-slate-400">({filtered.length} total)</span>}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
