import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, Send, Mail, MessageSquare, Clock, CheckCircle, 
  XCircle, AlertTriangle, RefreshCw, Filter
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function Alerts() {
  const { token } = useAuth();
  const [alertHistory, setAlertHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAlertHistory();
  }, [token]);

  const fetchAlertHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/alerts/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlertHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch alert history', err);
    } finally {
      setLoading(false);
    }
  };

  const parseStatus = (statusStr) => {
    try {
      return JSON.parse(statusStr);
    } catch {
      return { email: 'unknown', slack: 'unknown' };
    }
  };

  const parseChannels = (channelsStr) => {
    try {
      return JSON.parse(channelsStr);
    } catch {
      return [];
    }
  };

  const filteredAlerts = alertHistory.filter(alert => {
    if (filter === 'all') return true;
    const status = parseStatus(alert.status);
    if (filter === 'sent') {
      return status.email === 'sent' || status.slack === 'sent';
    }
    if (filter === 'failed') {
      return (status.email && status.email.includes('error')) || 
             (status.slack && status.slack.includes('error'));
    }
    return true;
  });

  return (
    <div className="space-y-8 fade-in" data-testid="alerts-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="font-mono font-bold text-3xl tracking-tight">ALERT CENTER</h1>
          <p className="text-gray-500 text-sm mt-2">Manage and monitor security notifications</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-white/[0.03] rounded-xl overflow-hidden">
            {['all', 'sent', 'failed'].map((f) => (
              <button
                key={f}
                data-testid={`filter-${f}-btn`}
                onClick={() => setFilter(f)}
                className={`px-5 py-2.5 text-sm font-medium transition-all ${
                  filter === f 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          
          <button 
            onClick={fetchAlertHistory}
            className="btn-ghost flex items-center gap-2"
            data-testid="refresh-alerts-btn"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Bell}
          label="Total Alerts"
          value={alertHistory.length}
          color="info"
          testId="stat-total-alerts"
        />
        <StatCard
          icon={CheckCircle}
          label="Successfully Sent"
          value={alertHistory.filter(a => {
            const s = parseStatus(a.status);
            return s.email === 'sent' || s.slack === 'sent';
          }).length}
          color="safe"
          testId="stat-sent-alerts"
        />
        <StatCard
          icon={Mail}
          label="Email Alerts"
          value={alertHistory.filter(a => parseChannels(a.alert_type).includes('email')).length}
          color="info"
          testId="stat-email-alerts"
        />
        <StatCard
          icon={MessageSquare}
          label="Slack Alerts"
          value={alertHistory.filter(a => parseChannels(a.alert_type).includes('slack')).length}
          color="warning"
          testId="stat-slack-alerts"
        />
      </div>

      {/* Alert Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NotificationCard
          icon={Mail}
          title="Email Notifications"
          description="Send critical threat alerts via email to your security team"
          color="blue"
          testId="email-notification-card"
        />
        <NotificationCard
          icon={MessageSquare}
          title="Slack Integration"
          description="Real-time alerts delivered directly to your Slack channels"
          color="purple"
          testId="slack-notification-card"
        />
      </div>

      {/* Alert History Table */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono font-semibold text-sm text-gray-500 flex items-center gap-2 uppercase tracking-wider">
            <Clock size={16} />
            Alert History
          </h2>
          <span className="text-xs text-gray-600">{filteredAlerts.length} alerts</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500">No alerts found</p>
            <p className="text-gray-600 text-sm mt-1">Alerts will appear here when threats are detected</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-dark" data-testid="alert-history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Channels</th>
                  <th>Email Status</th>
                  <th>Slack Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert, i) => {
                  const status = parseStatus(alert.status);
                  const channels = parseChannels(alert.alert_type);
                  
                  return (
                    <tr key={alert.id || i} data-testid={`alert-row-${i}`}>
                      <td className="font-mono text-xs text-gray-400">
                        {alert.sent_at?.split('T')[0]} {alert.sent_at?.split('T')[1]?.slice(0, 8)}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          {channels.includes('email') && (
                            <span className="badge bg-blue-500/10 text-blue-400">
                              <Mail size={12} className="mr-1.5" /> Email
                            </span>
                          )}
                          {channels.includes('slack') && (
                            <span className="badge bg-purple-500/10 text-purple-400">
                              <MessageSquare size={12} className="mr-1.5" /> Slack
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={status.email} />
                      </td>
                      <td>
                        <StatusBadge status={status.slack} />
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
}

function StatCard({ icon: Icon, label, value, color = 'info', testId }) {
  const colorClasses = {
    critical: 'text-red-400 bg-red-500/10',
    warning: 'text-yellow-400 bg-yellow-500/10',
    safe: 'text-green-400 bg-green-500/10',
    info: 'text-blue-400 bg-blue-500/10'
  };

  return (
    <div className="glass-card p-6" data-testid={testId}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <p className={`stat-value text-2xl ${colorClasses[color].split(' ')[0]}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function NotificationCard({ icon: Icon, title, description, color, testId }) {
  const gradients = {
    blue: 'from-blue-600/10 to-transparent',
    purple: 'from-purple-600/10 to-transparent',
  };

  const iconColors = {
    blue: 'text-blue-400 bg-blue-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
  };

  return (
    <div 
      className={`glass-card p-8 bg-gradient-to-br ${gradients[color]}`}
      data-testid={testId}
    >
      <div className="flex items-start gap-5">
        <div className={`p-4 rounded-2xl ${iconColors[color]}`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className="font-mono font-semibold text-lg mb-2">{title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
          <p className="text-xs text-gray-600 mt-3">Configure in Settings → Notifications</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) {
    return <span className="badge bg-gray-500/10 text-gray-400">N/A</span>;
  }
  
  if (status === 'sent') {
    return (
      <span className="badge badge-safe flex items-center gap-1.5">
        <CheckCircle size={12} /> Sent
      </span>
    );
  }
  
  if (status === 'not configured') {
    return (
      <span className="badge bg-gray-500/10 text-gray-400 flex items-center gap-1.5">
        <XCircle size={12} /> Not Configured
      </span>
    );
  }
  
  if (status.includes('error')) {
    return (
      <span className="badge badge-critical flex items-center gap-1.5">
        <AlertTriangle size={12} /> Failed
      </span>
    );
  }
  
  return <span className="badge bg-gray-500/10 text-gray-400">{status}</span>;
}
