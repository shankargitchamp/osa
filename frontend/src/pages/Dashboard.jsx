import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, AlertTriangle, Activity, Database, Cpu, HardDrive,
  TrendingUp, Clock, Zap, Brain, Send, Download, GitBranch
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
    <div className="space-y-6 fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-mono font-bold text-2xl tracking-tight">THREAT MONITOR</h1>
          <p className="text-gray-500 text-sm">Real-time system integrity analysis</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`
            flex items-center gap-2 px-4 py-2 rounded font-mono text-sm
            ${isCritical 
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 pulse-critical' 
              : 'bg-green-500/20 text-green-400 border border-green-500/30'}
          `} data-testid="status-badge">
            <div className={`w-2 h-2 rounded-full ${isCritical ? 'bg-red-500' : 'bg-green-500'} pulse-dot`} />
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
          
          <a 
            href={`${API_BASE}/export/csv`}
            data-testid="export-csv-btn"
            className="btn-ghost flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={AlertTriangle}
          label="Threat Level"
          value={`${threatPercent.toFixed(1)}%`}
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
          color="info"
          testId="stat-total-events"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Chart - Threat Level Over Time */}
        <div className="lg:col-span-2 glass-card p-4">
          <h2 className="font-mono font-semibold text-sm text-gray-400 mb-4">
            THREAT PROBABILITY TIMELINE
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history.slice(-50)}>
                <defs>
                  <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF3B30" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={false}
                  stroke="rgba(255,255,255,0.1)"
                />
                <YAxis 
                  domain={[0, 1]}
                  stroke="rgba(255,255,255,0.1)"
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: '#71717A', fontSize: 10 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1A1A1A', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px'
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value) => [`${(value * 100).toFixed(2)}%`, 'Probability']}
                />
                <Area 
                  type="monotone" 
                  dataKey="probability" 
                  stroke="#FF3B30" 
                  fill="url(#probGradient)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Threat Gauge */}
        <div className="glass-card p-4 flex flex-col items-center justify-center">
          <h2 className="font-mono font-semibold text-sm text-gray-400 mb-4">
            CURRENT THREAT LEVEL
          </h2>
          <ThreatGauge value={threatPercent} isCritical={isCritical} />
          <p className="mt-4 text-sm text-gray-500">
            {stats?.timestamp?.split(' ')[1] || '--:--:--'}
          </p>
        </div>
      </div>

      {/* System Activity Chart */}
      <div className="glass-card p-4">
        <h2 className="font-mono font-semibold text-sm text-gray-400 mb-4">
          SYSTEM ACTIVITY METRICS
        </h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history.slice(-50)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timestamp" tick={false} stroke="rgba(255,255,255,0.1)" />
              <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#71717A', fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1A1A1A', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="syscall_rate" 
                stroke="#007AFF" 
                dot={false} 
                strokeWidth={2}
                name="Syscalls/sec"
              />
              <Line 
                type="monotone" 
                dataKey="churn_rate" 
                stroke="#FF9500" 
                dot={false} 
                strokeWidth={2}
                name="File Churn"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span className="text-gray-500">Syscalls/sec</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-0.5 bg-orange-500" />
            <span className="text-gray-500">File Churn</span>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono font-semibold text-sm text-gray-400">
            LIVE EVENT FEED
          </h2>
          <span className="text-xs text-gray-500">Last 20 events</span>
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
                  <td className="font-mono">
                    {(event.probability * 100).toFixed(2)}%
                  </td>
                  <td className="font-mono text-blue-400">
                    {event.syscall_rate}
                  </td>
                  <td className="font-mono text-orange-400">
                    {event.churn_rate}
                  </td>
                  <td>
                    <button
                      data-testid={`analyze-btn-${i}`}
                      onClick={() => handleAnalyze(event)}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
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

// Stat Card Component
function StatCard({ icon: Icon, label, value, suffix = '', color = 'info', testId }) {
  const colorClasses = {
    critical: 'text-red-400',
    warning: 'text-yellow-400',
    safe: 'text-green-400',
    info: 'text-blue-400'
  };

  return (
    <div className="glass-card p-4" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded bg-white/5 ${colorClasses[color]}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={`stat-value text-xl ${colorClasses[color]}`}>
            {value}{suffix}
          </p>
        </div>
      </div>
    </div>
  );
}

// Threat Gauge Component
function ThreatGauge({ value, isCritical }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (value / 100) * circumference;
  
  return (
    <div className="relative w-40 h-40">
      <svg className="w-full h-full transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="80"
          cy="80"
          r="45"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="10"
        />
        {/* Progress circle */}
        <circle
          cx="80"
          cy="80"
          r="45"
          fill="none"
          stroke={isCritical ? '#FF3B30' : '#34C759'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono font-bold text-3xl ${isCritical ? 'text-red-400' : 'text-green-400'}`}>
          {value.toFixed(1)}%
        </span>
        <span className="text-xs text-gray-500 uppercase">Threat</span>
      </div>
    </div>
  );
}
