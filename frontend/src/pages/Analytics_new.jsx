import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart3, TrendingUp, TrendingDown, Calendar, Download,
  AlertTriangle, Shield, Clock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

// const API_BASE = 'http://localhost:5000/api';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function Analytics() {
  const { token } = useAuth();
  const [period, setPeriod] = useState('week');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period, token]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    window.open(`${API_BASE}/export/pdf`, '_blank');
  };

  const hourlyData = analytics?.hourly_distribution?.map(h => ({
    hour: `${h.hour}:00`,
    count: h.count
  })) || [];

  const COLORS = ['#FF3B30', '#34C759'];

  // Calculate totals for pie chart
  const totalThreats = analytics?.summary?.total_threats || 0;
  const totalEvents = analytics?.daily_stats?.reduce((sum, d) => sum + d.total_events, 0) || 0;
  const safeEvents = totalEvents - totalThreats;

  const pieData = [
    { name: 'Threats', value: totalThreats },
    { name: 'Safe', value: safeEvents > 0 ? safeEvents : 0 }
  ];

  return (
    <div className="space-y-8 fade-in" data-testid="analytics-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="font-mono font-bold text-3xl tracking-tight">ANALYTICS</h1>
          <p className="text-gray-500 text-sm mt-2">Historical threat analysis and trends</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <div className="flex bg-white/[0.03] rounded-xl overflow-hidden">
            {['week', 'month', 'year'].map((p) => (
              <button
                key={p}
                data-testid={`period-${p}-btn`}
                onClick={() => setPeriod(p)}
                className={`px-5 py-2.5 text-sm font-medium transition-all ${
                  period === p 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          
          <button 
            onClick={exportReport}
            className="btn-ghost flex items-center gap-2"
            data-testid="export-pdf-btn"
          >
            <Download size={16} />
            PDF Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <SummaryCard
              icon={AlertTriangle}
              label="Total Threats"
              value={totalThreats}
              color="critical"
              testId="summary-total-threats"
            />
            <SummaryCard
              icon={Shield}
              label="Avg Probability"
              value={`${((analytics?.summary?.avg_threat_prob || 0) * 100).toFixed(1)}%`}
              color="warning"
              testId="summary-avg-prob"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Max Threat Level"
              value={`${((analytics?.summary?.max_threat_prob || 0) * 100).toFixed(1)}%`}
              color="critical"
              testId="summary-max-prob"
            />
            <SummaryCard
              icon={BarChart3}
              label="Events Analyzed"
              value={totalEvents}
              color="info"
              testId="summary-total-events"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Threats Chart */}
            <div className="lg:col-span-2 glass-card p-8">
              <h2 className="font-mono font-semibold text-sm text-gray-500 mb-6 uppercase tracking-wider">
                Daily Threat Activity
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.daily_stats || []}>
                    <defs>
                      <linearGradient id="threatGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF3B30" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#FF3B30" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="rgba(255,255,255,0.05)"
                      tick={{ fill: '#52525B', fontSize: 11 }}
                      tickFormatter={(v) => v?.slice(5) || ''}
                    />
                    <YAxis stroke="rgba(255,255,255,0.05)" tick={{ fill: '#52525B', fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(15, 15, 20, 0.95)', 
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total_events" 
                      stroke="#007AFF" 
                      fill="url(#eventGrad)" 
                      strokeWidth={2}
                      name="Total Events"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="threats" 
                      stroke="#FF3B30" 
                      fill="url(#threatGrad)" 
                      strokeWidth={2}
                      name="Threats"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-8 mt-4">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-0.5 bg-blue-500 rounded-full" />
                  <span className="text-gray-500">Total Events</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-4 h-0.5 bg-red-500 rounded-full" />
                  <span className="text-gray-500">Threats</span>
                </div>
              </div>
            </div>

            {/* Threat Distribution Pie */}
            <div className="glass-card p-8">
              <h2 className="font-mono font-semibold text-sm text-gray-500 mb-6 uppercase tracking-wider">
                Threat Distribution
              </h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(15, 15, 20, 0.95)', 
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-gray-500">Threats ({totalThreats})</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-500">Safe ({safeEvents})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hourly Distribution */}
          <div className="glass-card p-8">
            <h2 className="font-mono font-semibold text-sm text-gray-500 mb-6 flex items-center gap-2 uppercase tracking-wider">
              <Clock size={16} />
              Threat Activity by Hour
            </h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis 
                    dataKey="hour" 
                    stroke="rgba(255,255,255,0.05)"
                    tick={{ fill: '#52525B', fontSize: 11 }}
                  />
                  <YAxis stroke="rgba(255,255,255,0.05)" tick={{ fill: '#52525B', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 15, 20, 0.95)', 
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
                    }}
                  />
                  <Bar dataKey="count" fill="#FF3B30" radius={[6, 6, 0, 0]} name="Threats" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Stats Table */}
          <div className="glass-card p-8">
            <h2 className="font-mono font-semibold text-sm text-gray-500 mb-6 uppercase tracking-wider">
              Detailed Daily Breakdown
            </h2>
            <div className="overflow-x-auto">
              <table className="table-dark" data-testid="daily-stats-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Events</th>
                    <th>Threats</th>
                    <th>Threat Rate</th>
                    <th>Avg Probability</th>
                    <th>Avg Syscalls</th>
                    <th>Avg Churn</th>
                  </tr>
                </thead>
                <tbody>
                  {(analytics?.daily_stats || []).slice().reverse().map((day, i) => (
                    <tr key={i} data-testid={`daily-row-${i}`}>
                      <td className="font-mono">{day.date}</td>
                      <td className="font-mono text-blue-400">{day.total_events}</td>
                      <td className="font-mono text-red-400">{day.threats}</td>
                      <td className="font-mono">
                        {((day.threats / Math.max(day.total_events, 1)) * 100).toFixed(1)}%
                      </td>
                      <td className="font-mono">
                        {((day.avg_probability || 0) * 100).toFixed(1)}%
                      </td>
                      <td className="font-mono text-gray-400">
                        {Math.round(day.avg_syscall_rate || 0)}
                      </td>
                      <td className="font-mono text-gray-400">
                        {Math.round(day.avg_churn_rate || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color = 'info', testId }) {
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
