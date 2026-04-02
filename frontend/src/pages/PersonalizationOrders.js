import { useState, useEffect } from 'react';
import { Mail, CheckCircle, Clock, AlertCircle, RefreshCw, ExternalLink, Copy, User } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_CONFIG = {
  ready:      { color: 'bg-blue-100 text-blue-700',   icon: Clock,         label: 'Waiting for customer' },
  submitted:  { color: 'bg-yellow-100 text-yellow-700', icon: Clock,       label: 'Processing' },
  completed:  { color: 'bg-green-100 text-green-700',  icon: CheckCircle,  label: 'Completed' },
  expired:    { color: 'bg-red-100 text-red-700',      icon: AlertCircle,  label: 'Expired' },
  processing: { color: 'bg-purple-100 text-purple-700', icon: RefreshCw,   label: 'Processing' },
};

export default function PersonalizationOrders() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/personalization/sessions?limit=50`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  const resendEmail = async (token) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/personalization/sessions/${token}/resend-email`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('Email resent!');
      } else {
        toast.error('Failed to resend email');
      }
    } catch {
      toast.error('Failed to resend email');
    }
  };

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Personalization Orders</h2>
          <p className="text-sm text-gray-500 mt-0.5">{sessions.length} total sessions</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition"
          data-testid="refresh-sessions-btn"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'ready', 'submitted', 'completed', 'expired'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`filter-${f}`}
          >
            {f === 'all' ? `All (${sessions.length})` : `${f} (${sessions.filter(s => s.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Sessions Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No {filter === 'all' ? '' : filter} sessions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(session => {
            const cfg = STATUS_CONFIG[session.status] || STATUS_CONFIG.processing;
            const StatusIcon = cfg.icon;
            const baseUrl = API_URL.replace('/api', '') || window.location.origin;
            const personalizationLink = `${baseUrl}/personalize/${session.session_token}`;
            const created = session.created_at
              ? new Date(session.created_at).toLocaleString()
              : '—';

            return (
              <div
                key={session.session_token}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition"
                data-testid={`session-${session.session_token}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Left: customer + template */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        <StatusIcon size={11} />
                        {cfg.label}
                      </span>
                      {session.email_sent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600">
                          <Mail size={10} /> Email sent
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 truncate">
                      {session.customer_email || 'Unknown email'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {session.template_snapshot?.title || 'Unknown template'} · {created}
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      checkout: {session.checkout_id || '—'}
                    </p>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {session.status !== 'expired' && (
                      <>
                        <button
                          onClick={() => copyLink(personalizationLink)}
                          title="Copy personalization link"
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                          data-testid={`copy-link-${session.session_token}`}
                        >
                          <Copy size={14} />
                        </button>
                        <a
                          href={personalizationLink}
                          target="_blank"
                          rel="noreferrer"
                          title="Open form"
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                          data-testid={`open-link-${session.session_token}`}
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          onClick={() => resendEmail(session.session_token)}
                          title="Resend email"
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          data-testid={`resend-email-${session.session_token}`}
                        >
                          <Mail size={14} />
                        </button>
                      </>
                    )}
                    {session.customer_view_url && (
                      <a
                        href={session.customer_view_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
                        data-testid={`view-storybook-${session.session_token}`}
                      >
                        View Storybook
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
