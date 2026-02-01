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
    <div className="space-y-8 fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="font-mono font-bold text-3xl tracking-tight">THREAT MONITOR</h1>
          <p className="text-gray-500 text-sm mt-2">Real-time system integrity analysis</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`
            flex items-center gap-3 px-5 py-3 rounded-2xl font-mono text-sm
            ${isCritical 
              ? 'bg-red-500/10 text-red-400 pulse-critical' 
              : 'bg-green-500/10 text-green-400'}
          `} data-testid="status-badge">
            <div className={`w-2.5 h-2.5 rounded-full ${isCritical ? 'bg-red-500' : 'bg-green-500'} pulse-dot`} />
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart - Threat Level Over Time */}
        <div className="lg:col-span-2 glass-card p-8">
          <h2 className="font-mono font-semibold text-sm text-gray-500 mb-6 uppercase tracking-wider">
            Threat Probability Timeline
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={false}
                  stroke="rgba(255,255,255,0.05)"
                />
                <YAxis 
                  domain={[0, 1]}
                  stroke="rgba(255,255,255,0.05)"
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: '#52525B', fontSize: 11 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 15, 20, 0.95)', 
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
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
        <div className="glass-card p-8 flex flex-col items-center justify-center">
          <h2 className="font-mono font-semibold text-sm text-gray-500 mb-6 uppercase tracking-wider">
            Current Threat Level
          </h2>
          <ThreatGauge value={threatPercent} isCritical={isCritical} />
          <p className="mt-6 text-sm text-gray-600">
            {stats?.timestamp?.split(' ')[1] || '--:--:--'}
          </p>
        </div>
      </div>

      {/* System Activity Chart */}
      <div className="glass-card p-8">
        <h2 className="font-mono font-semibold text-sm text-gray-500 mb-6 uppercase tracking-wider">
          System Activity Metrics
        </h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history.slice(-50)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
              <XAxis dataKey="timestamp" tick={false} stroke="rgba(255,255,255,0.05)" />
              <YAxis stroke="rgba(255,255,255,0.05)" tick={{ fill: '#52525B', fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 15, 20, 0.95)', 
                  border: 'none',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
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
        <div className="flex justify-center gap-8 mt-4">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-0.5 bg-blue-500 rounded-full" />
            <span className="text-gray-500">Syscalls/sec</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-0.5 bg-orange-500 rounded-full" />
            <span className="text-gray-500">File Churn</span>
          </div>
        </div>
      </div>

      {/* Event Log */}
      <div className="glass-card p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono font-semibold text-sm text-gray-500 uppercase tracking-wider">
            Live Event Feed
          </h2>
          <span className="text-xs text-gray-600">Last 20 events</span>
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
                      className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-500/10"
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

  const bgClasses = {
    critical: 'bg-red-500/10',
    warning: 'bg-yellow-500/10',
    safe: 'bg-green-500/10',
    info: 'bg-blue-500/10'
  };

  return (
    <div className="glass-card p-6" data-testid={testId}>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${bgClasses[color]}`}>
          <Icon size={20} className={colorClasses[color]} />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <p className={`stat-value text-2xl ${colorClasses[color]}`}>
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
