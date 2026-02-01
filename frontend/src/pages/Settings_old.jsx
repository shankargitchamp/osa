import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Settings as SettingsIcon, Shield, Bell, Sliders, Users, Save,
  Mail, MessageSquare, AlertTriangle, ChevronRight, Check, X,
  Cpu, HardDrive, Zap, Network, Lock
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export default function Settings() {
  const { token, user } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('detection');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchConfig();
  }, [token]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Failed to fetch config', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (user?.role !== 'admin') {
      setMessage({ type: 'error', text: 'Admin access required to modify settings' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'Configuration saved successfully' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updatePattern = (pattern, key, value) => {
    setConfig(prev => ({
      ...prev,
      attack_patterns: {
        ...prev.attack_patterns,
        [pattern]: {
          ...prev.attack_patterns[pattern],
          [key]: value
        }
      }
    }));
  };

  const tabs = [
    { id: 'detection', label: 'Detection', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'patterns', label: 'Attack Patterns', icon: AlertTriangle },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in" data-testid="settings-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-mono font-bold text-2xl tracking-tight">CONFIGURATION</h1>
          <p className="text-gray-500 text-sm">System settings and detection thresholds</p>
        </div>
        
        <button 
          onClick={saveConfig}
          disabled={saving || user?.role !== 'admin'}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
          data-testid="save-config-btn"
        >
          {saving ? <div className="spinner" /> : <Save size={16} />}
          Save Changes
        </button>
      </div>

      {/* Status Message */}
      {message.text && (
        <div className={`p-4 rounded flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' ? <Check size={18} /> : <X size={18} />}
          {message.text}
        </div>
      )}

      {/* Admin Notice */}
      {user?.role !== 'admin' && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded flex items-center gap-2 text-yellow-400">
          <Lock size={18} />
          <span>View only mode - Admin access required to modify settings</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <div className="space-y-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              data-testid={`tab-${id}`}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded text-left transition-all ${
                activeTab === id
                  ? 'bg-blue-600/20 text-white border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={16} className="ml-auto opacity-50" />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 glass-card p-6">
          {activeTab === 'detection' && (
            <DetectionSettings config={config} updateConfig={updateConfig} />
          )}
          {activeTab === 'notifications' && (
            <NotificationSettings config={config} updateConfig={updateConfig} />
          )}
          {activeTab === 'patterns' && (
            <PatternSettings config={config} updatePattern={updatePattern} />
          )}
        </div>
      </div>
    </div>
  );
}

function DetectionSettings({ config, updateConfig }) {
  return (
    <div className="space-y-6" data-testid="detection-settings">
      <div>
        <h2 className="font-mono font-semibold text-lg mb-4 flex items-center gap-2">
          <Shield size={20} className="text-blue-400" />
          Detection Thresholds
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Adjust sensitivity and alert thresholds for threat detection
        </p>
      </div>

      {/* Detection Threshold Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Detection Threshold</label>
          <span className="font-mono text-blue-400">
            {((config?.detection_threshold || 0.7) * 100).toFixed(0)}%
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="0.99"
          step="0.01"
          value={config?.detection_threshold || 0.7}
          onChange={(e) => updateConfig('detection_threshold', parseFloat(e.target.value))}
          className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-blue-500"
          data-testid="detection-threshold-slider"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>High Sensitivity</span>
          <span>Low Sensitivity</span>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Lower values increase sensitivity (more alerts). Higher values reduce false positives.
        </p>
      </div>

      {/* Alert Cooldown */}
      <div className="space-y-3 pt-6 border-t border-white/10">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Alert Cooldown</label>
          <span className="font-mono text-blue-400">
            {config?.alert_cooldown_minutes || 5} min
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="60"
          step="1"
          value={config?.alert_cooldown_minutes || 5}
          onChange={(e) => updateConfig('alert_cooldown_minutes', parseInt(e.target.value))}
          className="w-full h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-blue-500"
          data-testid="cooldown-slider"
        />
        <p className="text-xs text-gray-600">
          Minimum time between repeated alerts for the same threat type.
        </p>
      </div>
    </div>
  );
}

function NotificationSettings({ config, updateConfig }) {
  const addEmailRecipient = (email) => {
    if (email && !config?.email_recipients?.includes(email)) {
      updateConfig('email_recipients', [...(config?.email_recipients || []), email]);
    }
  };

  const removeEmailRecipient = (email) => {
    updateConfig('email_recipients', config?.email_recipients?.filter(e => e !== email) || []);
  };

  return (
    <div className="space-y-6" data-testid="notification-settings">
      <div>
        <h2 className="font-mono font-semibold text-lg mb-4 flex items-center gap-2">
          <Bell size={20} className="text-blue-400" />
          Notification Channels
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Configure how you receive threat alerts
        </p>
      </div>

      {/* Email Settings */}
      <div className="p-4 bg-black/30 rounded-lg border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mail size={20} className="text-blue-400" />
            <div>
              <h3 className="font-medium">Email Notifications</h3>
              <p className="text-xs text-gray-500">Send alerts to email addresses</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={config?.email_enabled || false}
            onChange={(v) => updateConfig('email_enabled', v)}
            testId="email-toggle"
          />
        </div>

        {config?.email_enabled && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <label className="text-xs text-gray-500 uppercase">Recipients</label>
            <div className="flex flex-wrap gap-2">
              {(config?.email_recipients || []).map((email, i) => (
                <span 
                  key={i} 
                  className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm flex items-center gap-2"
                >
                  {email}
                  <button 
                    onClick={() => removeEmailRecipient(email)}
                    className="hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="email"
              placeholder="Add email address"
              className="input-dark text-sm"
              data-testid="add-email-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addEmailRecipient(e.target.value);
                  e.target.value = '';
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Slack Settings */}
      <div className="p-4 bg-black/30 rounded-lg border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MessageSquare size={20} className="text-purple-400" />
            <div>
              <h3 className="font-medium">Slack Notifications</h3>
              <p className="text-xs text-gray-500">Send alerts to Slack channels</p>
            </div>
          </div>
          <ToggleSwitch
            enabled={config?.slack_enabled || false}
            onChange={(v) => updateConfig('slack_enabled', v)}
            testId="slack-toggle"
          />
        </div>

        {config?.slack_enabled && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-2">Bot Token</label>
              <input
                type="password"
                placeholder="xoxb-..."
                value={config?.slack_bot_token || ''}
                onChange={(e) => updateConfig('slack_bot_token', e.target.value)}
                className="input-dark text-sm"
                data-testid="slack-token-input"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-2">Channel</label>
              <input
                type="text"
                placeholder="#security-alerts"
                value={config?.slack_channel || ''}
                onChange={(e) => updateConfig('slack_channel', e.target.value)}
                className="input-dark text-sm"
                data-testid="slack-channel-input"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PatternSettings({ config, updatePattern }) {
  const patterns = [
    { key: 'ransomware', label: 'Ransomware', icon: HardDrive, color: 'red', desc: 'High file encryption/deletion activity' },
    { key: 'fork_bomb', label: 'Fork Bomb', icon: Zap, color: 'orange', desc: 'Rapid process spawning' },
    { key: 'crypto_miner', label: 'Crypto Miner', icon: Cpu, color: 'yellow', desc: 'High CPU usage patterns' },
    { key: 'privilege_escalation', label: 'Privilege Escalation', icon: Shield, color: 'purple', desc: 'Unauthorized permission changes' },
    { key: 'reverse_shell', label: 'Reverse Shell', icon: Network, color: 'blue', desc: 'Outbound shell connections' },
  ];

  const colorMap = {
    red: 'text-red-400 bg-red-500/10',
    orange: 'text-orange-400 bg-orange-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  };

  return (
    <div className="space-y-6" data-testid="pattern-settings">
      <div>
        <h2 className="font-mono font-semibold text-lg mb-4 flex items-center gap-2">
          <AlertTriangle size={20} className="text-yellow-400" />
          Attack Pattern Detection
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Enable or disable specific attack pattern detectors
        </p>
      </div>

      <div className="space-y-3">
        {patterns.map(({ key, label, icon: Icon, color, desc }) => (
          <div 
            key={key}
            className="p-4 bg-black/30 rounded-lg border border-white/5 flex items-center justify-between"
            data-testid={`pattern-${key}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded ${colorMap[color]}`}>
                <Icon size={20} />
              </div>
              <div>
                <h3 className="font-medium">{label}</h3>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
            <ToggleSwitch
              enabled={config?.attack_patterns?.[key]?.enabled ?? true}
              onChange={(v) => updatePattern(key, 'enabled', v)}
              testId={`toggle-${key}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleSwitch({ enabled, onChange, testId }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      data-testid={testId}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
        enabled ? 'bg-blue-600' : 'bg-gray-700'
      }`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
        enabled ? 'left-7' : 'left-1'
      }`} />
    </button>
  );
}
