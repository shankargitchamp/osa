import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  GitBranch, AlertTriangle, CheckCircle, Clock, Cpu, 
  ChevronRight, ChevronDown, Activity, RefreshCw
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export function ProcessTree({ onClose }) {
  const { token } = useAuth();
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['1']));

  useEffect(() => {
    fetchProcessTree();
    const interval = setInterval(fetchProcessTree, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchProcessTree = async () => {
    try {
      const res = await fetch(`${API_BASE}/process-tree`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProcesses(data.processes || []);
      }
    } catch (err) {
      console.error('Failed to fetch process tree', err);
      // Use mock data if endpoint doesn't exist
      setProcesses(generateMockProcessTree());
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (pid) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pid)) {
        newSet.delete(pid);
      } else {
        newSet.add(pid);
      }
      return newSet;
    });
  };

  const renderProcess = (process, level = 0) => {
    const hasChildren = process.children && process.children.length > 0;
    const isExpanded = expandedNodes.has(process.pid);
    const isSuspicious = process.suspicious;

    return (
      <div key={process.pid} className="process-node">
        <div 
          className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer transition-all hover:bg-white/5 ${
            isSuspicious ? 'bg-red-500/10 border-l-2 border-red-500' : ''
          }`}
          style={{ marginLeft: `${level * 20}px` }}
          onClick={() => hasChildren && toggleNode(process.pid)}
          data-testid={`process-${process.pid}`}
        >
          {/* Expand/Collapse Icon */}
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={14} className="text-gray-500" />
            ) : (
              <ChevronRight size={14} className="text-gray-500" />
            )
          ) : (
            <div className="w-3.5" />
          )}

          {/* Process Icon */}
          <div className={`p-1.5 rounded ${isSuspicious ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
            {isSuspicious ? (
              <AlertTriangle size={14} className="text-red-400" />
            ) : (
              <Activity size={14} className="text-blue-400" />
            )}
          </div>

          {/* Process Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm truncate">{process.name}</span>
              <span className="text-xs text-gray-500">PID: {process.pid}</span>
            </div>
            {process.cmdline && (
              <p className="text-xs text-gray-600 truncate max-w-md">{process.cmdline}</p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-400 flex items-center gap-1">
              <Cpu size={12} />
              {process.cpu || 0}%
            </span>
            <span className="text-gray-400 flex items-center gap-1">
              <Clock size={12} />
              {process.runtime || '0s'}
            </span>
            {isSuspicious && (
              <span className="badge badge-critical text-xs">
                Suspicious
              </span>
            )}
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="process-children">
            {process.children.map(child => renderProcess(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="process-tree-modal">
      <div 
        className="modal-content max-w-4xl max-h-[80vh]" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-purple-500/20">
              <GitBranch className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-lg">Process Tree</h2>
              <p className="text-sm text-gray-500">Live process hierarchy visualization</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchProcessTree}
              className="btn-ghost flex items-center gap-2"
              data-testid="refresh-tree-btn"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded"
              data-testid="close-tree-btn"
            >
              ×
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/50" />
            <span className="text-gray-400">Normal Process</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50" />
            <span className="text-gray-400">Suspicious Activity</span>
          </div>
        </div>

        {/* Process Tree */}
        <div className="bg-black/30 rounded-lg p-4 max-h-96 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner" />
            </div>
          ) : processes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <GitBranch size={48} className="mx-auto mb-4 opacity-50" />
              <p>No process data available</p>
            </div>
          ) : (
            <div className="space-y-1">
              {processes.map(process => renderProcess(process))}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="p-3 bg-black/30 rounded">
            <p className="text-xs text-gray-500 uppercase">Total Processes</p>
            <p className="font-mono font-bold text-xl text-blue-400">
              {countProcesses(processes)}
            </p>
          </div>
          <div className="p-3 bg-black/30 rounded">
            <p className="text-xs text-gray-500 uppercase">Suspicious</p>
            <p className="font-mono font-bold text-xl text-red-400">
              {countSuspicious(processes)}
            </p>
          </div>
          <div className="p-3 bg-black/30 rounded">
            <p className="text-xs text-gray-500 uppercase">Max Depth</p>
            <p className="font-mono font-bold text-xl text-purple-400">
              {calculateMaxDepth(processes)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function countProcesses(processes) {
  let count = 0;
  const traverse = (procs) => {
    for (const p of procs) {
      count++;
      if (p.children) traverse(p.children);
    }
  };
  traverse(processes);
  return count;
}

function countSuspicious(processes) {
  let count = 0;
  const traverse = (procs) => {
    for (const p of procs) {
      if (p.suspicious) count++;
      if (p.children) traverse(p.children);
    }
  };
  traverse(processes);
  return count;
}

function calculateMaxDepth(processes, depth = 0) {
  let maxDepth = depth;
  for (const p of processes) {
    if (p.children && p.children.length > 0) {
      const childDepth = calculateMaxDepth(p.children, depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  }
  return maxDepth;
}

function generateMockProcessTree() {
  return [
    {
      pid: '1',
      name: 'systemd',
      cmdline: '/sbin/init splash',
      cpu: 0.1,
      runtime: '2h 34m',
      suspicious: false,
      children: [
        {
          pid: '423',
          name: 'sshd',
          cmdline: '/usr/sbin/sshd -D',
          cpu: 0.0,
          runtime: '2h 33m',
          suspicious: false,
          children: [
            {
              pid: '2341',
              name: 'bash',
              cmdline: '-bash',
              cpu: 0.1,
              runtime: '45m',
              suspicious: false,
              children: [
                {
                  pid: '5678',
                  name: 'python',
                  cmdline: 'python ultimate_safe_malicious.py',
                  cpu: 85.2,
                  runtime: '5m',
                  suspicious: true,
                  children: [
                    {
                      pid: '5679',
                      name: 'python',
                      cmdline: 'fork_bomb_child',
                      cpu: 25.1,
                      runtime: '3m',
                      suspicious: true,
                      children: []
                    },
                    {
                      pid: '5680',
                      name: 'python',
                      cmdline: 'ransomware_simulator',
                      cpu: 45.3,
                      runtime: '3m',
                      suspicious: true,
                      children: []
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          pid: '567',
          name: 'cron',
          cmdline: '/usr/sbin/cron -f',
          cpu: 0.0,
          runtime: '2h 33m',
          suspicious: false,
          children: []
        },
        {
          pid: '890',
          name: 'nginx',
          cmdline: 'nginx: master process',
          cpu: 0.2,
          runtime: '2h 32m',
          suspicious: false,
          children: [
            {
              pid: '891',
              name: 'nginx',
              cmdline: 'nginx: worker process',
              cpu: 0.1,
              runtime: '2h 32m',
              suspicious: false,
              children: []
            }
          ]
        }
      ]
    }
  ];
}

export default ProcessTree;
