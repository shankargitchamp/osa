import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, AlertTriangle, Activity, Database, Cpu, HardDrive,
  TrendingUp, Clock, Zap, Brain, Send, Download, GitBranch, Loader2
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line 
} from 'recharts';
import ThreatModal from '../components/ThreatModal';
import ProcessTree from '../components/ProcessTree';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showProcessTree, setShowProcessTree] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [statsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/stats`, { headers }),
        fetch(`${API_BASE}/history?limit=100`, { headers })
      ]);
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAnalyze = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  const isCritical = stats?.status === 'CRITICAL';
  const threatPercent = (stats?.probability || 0) * 100;

  return (
    <div className="space-y-8 fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Threat Monitor</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time system integrity analysis</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`
            status-badge ${isCritical ? 'status-badge-critical pulse-critical' : 'status-badge-safe'}
          `} data-testid="status-badge">
            <div className={`w-2 h-2 rounded-full ${isCritical ? 'bg-red-400' : 'bg-green-400'} pulse-dot`} />
            {isCritical ? 'THREAT DETECTED' : 'SYSTEM SECURE'}
          </div>
          
          <button
            onClick={() => setShowProcessTree(true)}
            className="btn-ghost flex items-center gap-2"
            data-testid="process-tree-btn"
          >
            <GitBranch size={16} />
            Process Tree
          </button>
          
          <div className="relative group">
            <button 
              onClick={async () => {
                setExportLoading(true);
                setExportError('');
                try {
                  const res = await fetch(`${API_BASE}/export/csv`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `events-export-${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                  } else {
                    setExportError('Export not available');
                    setTimeout(() => setExportError(''), 3000);
                  }
                } catch (err) {
                  setExportError('Export not available');
                  setTimeout(() => setExportError(''), 3000);
                } finally {
                  setExportLoading(false);
                }
              }}
              disabled={exportLoading}
              data-testid="export-csv-btn"
              className={`btn-ghost flex items-center gap-2 ${exportLoading ? 'opacity-70 cursor-wait' : ''}`}
              title="Export events to CSV"
            >
              {exportLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {exportLoading ? 'Exporting...' : 'Export'}
            </button>
            {exportError && (
              <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-xs whitespace-nowrap z-10">
                {exportError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Container - Unified KPI Section */}
      <div className="stats-container">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            icon={AlertTriangle}
            label="Threat Level"
            value={`${threatPercent.toFixed(1)}`}
            suffix="%"
            color={isCritical ? 'critical' : 'safe'}
            testId="stat-threat-level"
          />
          <StatCard 
            icon={Cpu}
            label="Syscall Rate"
            value={stats?.syscall_rate || 0}
            suffix="/sec"
            color="info"
            testId="stat-syscall-rate"
          />
          <StatCard 
            icon={HardDrive}
            label="File Churn"
            value={stats?.churn_rate || 0}
            suffix="/sec"
            color={stats?.churn_rate > 100 ? 'warning' : 'info'}
            testId="stat-file-churn"
          />
          <StatCard 
            icon={Database}
            label="Events Analyzed"
            value={stats?.total_events || 0}
            suffix=""
            color="info"
            testId="stat-total-events"
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Chart - Threat Level Over Time */}
        <div className="lg:col-span-2 glass-card p-5">
          <h2 className="section-header mb-5">
            Threat Probability Timeline
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history.slice(-50)}>
                <defs>
                  <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={false}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
                <YAxis 
                  domain={[0, 1]}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  width={45}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1c1c22', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 14px'
                  }}
                  labelStyle={{ color: '#a1a1aa', fontSize: '12px' }}
                  formatter={(value) => [`${(value * 100).toFixed(2)}%`, 'Probability']}
                />
                <Area 
                  type="monotone" 
                  dataKey="probability" 
                  stroke="#ef4444" 
                  fill="url(#probGradient)" 
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {history.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 text-sm">No data available</p>
            </div>
          )}
        </div>

        {/* Threat Gauge */}
        <div className="glass-card p-5 flex flex-col items-center justify-center">
          <h2 className="section-header mb-4">
            Current Threat Level
          </h2>
          <ThreatGauge value={threatPercent} isCritical={isCritical} />
          <p className="mt-3 text-sm text-gray-500">
            {stats?.timestamp?.split(' ')[1] || '--:--:--'}
          </p>
          {/* Status indicator connected to gauge */}
          <div className={`mt-4 px-4 py-2 rounded-lg text-xs font-semibold tracking-wide
            ${isCritical 
              ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
              : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}
          >
            {isCritical ? 'Immediate Action Required' : 'All Systems Normal'}
          </div>
        </div>
      </div>

      {/* System Activity Chart */}
      <div className="glass-card p-5">
        <h2 className="section-header mb-5">
          System Activity Metrics
        </h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history.slice(-50)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="timestamp" tick={false} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
              <YAxis stroke="rgba(255,255,255,0.08)" strokeWidth={1} tick={{ fill: '#71717a', fontSize: 11, fontFamily: 'IBM Plex Mono' }} width={45} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1c1c22', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '10px 14px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="syscall_rate" 
                stroke="#3b82f6" 
                dot={false} 
                strokeWidth={2.5}
                name="Syscalls/sec"
              />
              <Line 
                type="monotone" 
                dataKey="churn_rate" 
                stroke="#f59e0b" 
                dot={false} 
                strokeWidth={2.5}
                name="File Churn"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-8 mt-4 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-1 rounded-full bg-blue-500" />
            <span className="text-xs text-gray-400 font-medium">Syscalls/sec</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-1 rounded-full bg-amber-500" />
            <span className="text-xs text-gray-400 font-medium">File Churn</span>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-header">
            Live Event Feed
          </h2>
          <span className="text-xs text-gray-500 font-medium">Last 20 events</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="table-dark" data-testid="event-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Status</th>
                <th>Probability</th>
                <th>Syscalls</th>
                <th>Churn</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(-20).reverse().map((event, i) => (
                <tr key={event.id || i} data-testid={`event-row-${i}`}>
                  <td className="font-mono text-xs text-gray-400">
                    {event.timestamp?.split(' ')[1] || '--'}
                  </td>
                  <td>
                    <span className={`badge ${event.status === 'CRITICAL' ? 'badge-critical' : 'badge-safe'}`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="font-mono text-sm">
                    {(event.probability * 100).toFixed(2)}%
                  </td>
                  <td className="font-mono text-blue-400">
                    {event.syscall_rate}
                  </td>
                  <td className="font-mono text-amber-400">
                    {event.churn_rate}
                  </td>
                  <td>
                    <button
                      data-testid={`analyze-btn-${i}`}
                      onClick={() => handleAnalyze(event)}
                      className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      <Brain size={14} />
                      Analyze
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Analysis Modal */}
      {showModal && (
        <ThreatModal 
          event={selectedEvent} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </div>
  );
}

// Stat Card Component - Improved
function StatCard({ icon: Icon, label, value, suffix = '', color = 'info', testId }) {
  const colorClasses = {
    critical: 'text-red-400',
    warning: 'text-amber-400',
    safe: 'text-green-400',
    info: 'text-blue-400'
  };
  
  const bgClasses = {
    critical: 'bg-red-500/10',
    warning: 'bg-amber-500/10',
    safe: 'bg-green-500/10',
    info: 'bg-blue-500/10'
  };

  return (
    <div className="metric-card" data-testid={testId}>
      <div className={`p-2.5 rounded-lg ${bgClasses[color]}`}>
        <Icon size={20} className={colorClasses[color]} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="kpi-label mb-1">{label}</p>
        <div className="flex items-baseline gap-0.5">
          <span className={`kpi-value ${colorClasses[color]}`}>
            {value}
          </span>
          {suffix && (
            <span className={`text-sm font-medium ${colorClasses[color]} opacity-70`}>
              {suffix}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Threat Gauge Component - Fixed centering
function ThreatGauge({ value, isCritical }) {
  const radius = 52;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const center = 70;
  
  return (
    <div className="relative w-[140px] h-[140px]">
      <svg 
        className="w-full h-full" 
        viewBox="0 0 140 140"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={isCritical ? '#ef4444' : '#22c55e'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Centered text - using absolute positioning for perfect optical centering */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ transform: 'translateY(-2px)' }}
      >
        <div className="flex items-baseline">
          <span 
            className={`gauge-value ${isCritical ? 'text-red-400' : 'text-green-400'}`}
          >
            {value.toFixed(1)}
          </span>
          <span 
            className={`gauge-value-sm ml-0.5 ${isCritical ? 'text-red-400' : 'text-green-400'}`}
          >
            %
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-gray-500 mt-1 font-medium">
          Threat
        </span>
      </div>
    </div>
  );
}
