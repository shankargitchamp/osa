import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Brain, X, AlertTriangle, Shield, Loader, Send } from 'lucide-react';

// const API_BASE = 'http://localhost:5000/api';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export function ThreatModal({ event, onClose }) {
  const { token } = useAuth();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertSent, setAlertSent] = useState(false);

  const analyzeWithAI = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE}/analyze-threat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ event })
      });
      
      if (!res.ok) {
        throw new Error('Analysis failed');
      }
      
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendAlert = async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          event,
          channels: ['email', 'slack']
        })
      });
      
      if (res.ok) {
        setAlertSent(true);
      }
    } catch (err) {
      console.error('Failed to send alert', err);
    }
  };

  const isCritical = event?.status === 'CRITICAL';

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="threat-modal">
      <div 
        className="modal-content max-w-2xl" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded ${isCritical ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              {isCritical ? (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              ) : (
                <Shield className="w-5 h-5 text-green-400" />
              )}
            </div>
            <div>
              <h2 className="font-mono font-bold text-lg">Threat Analysis</h2>
              <p className="text-sm text-gray-500">{event?.timestamp}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded"
            data-testid="close-modal-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Event Details */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-black/30 rounded">
            <p className="text-xs text-gray-500 uppercase mb-1">Status</p>
            <p className={`font-mono font-bold ${isCritical ? 'text-red-400' : 'text-green-400'}`}>
              {event?.status}
            </p>
          </div>
          <div className="p-3 bg-black/30 rounded">
            <p className="text-xs text-gray-500 uppercase mb-1">Probability</p>
            <p className="font-mono font-bold text-white">
              {((event?.probability || 0) * 100).toFixed(2)}%
            </p>
          </div>
          <div className="p-3 bg-black/30 rounded">
            <p className="text-xs text-gray-500 uppercase mb-1">Syscall Rate</p>
            <p className="font-mono font-bold text-blue-400">
              {event?.syscall_rate}/sec
            </p>
          </div>
          <div className="p-3 bg-black/30 rounded">
            <p className="text-xs text-gray-500 uppercase mb-1">File Churn</p>
            <p className="font-mono font-bold text-orange-400">
              {event?.churn_rate}/sec
            </p>
          </div>
        </div>

        {/* AI Analysis Section */}
        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono font-semibold flex items-center gap-2">
              <Brain size={18} className="text-blue-400" />
              AI Analysis
            </h3>
            {!analysis && !loading && (
              <button
                onClick={analyzeWithAI}
                className="btn-primary flex items-center gap-2"
                data-testid="analyze-ai-btn"
              >
                <Brain size={16} />
                Analyze with AI
              </button>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-gray-400">Analyzing threat pattern...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {analysis && (
            <div className="space-y-4 fade-in">
              {/* Classification */}
              <div className="p-4 bg-black/30 rounded">
                <p className="text-xs text-gray-500 uppercase mb-2">Classification</p>
                <p className="font-mono font-bold text-lg text-yellow-400">
                  {analysis.classification || 'Unknown'}
                </p>
              </div>

              {/* Severity */}
              <div className="p-4 bg-black/30 rounded">
                <p className="text-xs text-gray-500 uppercase mb-2">Severity</p>
                <span className={`badge ${
                  analysis.severity === 'Critical' ? 'badge-critical' :
                  analysis.severity === 'High' ? 'badge-warning' : 'badge-safe'
                }`}>
                  {analysis.severity || 'Unknown'}
                </span>
              </div>

              {/* Explanation */}
              <div className="p-4 bg-black/30 rounded">
                <p className="text-xs text-gray-500 uppercase mb-2">Explanation</p>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {analysis.explanation || 'No explanation available'}
                </p>
              </div>

              {/* Recommendations */}
              {analysis.recommendations && (
                <div className="p-4 bg-black/30 rounded">
                  <p className="text-xs text-gray-500 uppercase mb-2">Recommended Actions</p>
                  <ul className="list-disc list-inside space-y-1">
                    {(Array.isArray(analysis.recommendations) 
                      ? analysis.recommendations 
                      : [analysis.recommendations]
                    ).map((rec, i) => (
                      <li key={i} className="text-sm text-gray-300">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/10">
          {isCritical && (
            <button
              onClick={sendAlert}
              disabled={alertSent}
              className={`btn-danger flex items-center gap-2 ${alertSent ? 'opacity-50' : ''}`}
              data-testid="send-alert-btn"
            >
              <Send size={16} />
              {alertSent ? 'Alert Sent' : 'Send Alert'}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ThreatModal;
