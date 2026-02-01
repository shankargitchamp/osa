import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, AlertTriangle, Lock, User } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Login Card */}
      <div className="glass-card p-10 w-full max-w-md relative z-10 fade-in" data-testid="login-card">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-blue-600/15 rounded-xl mb-5">
            <Shield className="w-12 h-12 text-blue-400" />
          </div>
          <h1 className="page-title text-center">Sentinel Overwatch</h1>
          <p className="page-subtitle text-center">Security Monitoring System</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400 text-sm">
            <AlertTriangle size={18} />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <input
                type="text"
                data-testid="username-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-dark input-with-icon"
                placeholder="Enter username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Lock className="w-4 h-4 text-gray-500" />
              </div>
              <input
                type="password"
                data-testid="password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark input-with-icon"
                placeholder="Enter password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            data-testid="login-submit-btn"
            disabled={loading}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
          >
            {loading ? (
              <div className="spinner" />
            ) : (
              <>
                <Lock size={16} />
                Authenticate
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-400 text-center">
            Demo: <span className="font-mono font-medium">admin</span> / <span className="font-mono font-medium">sentinel123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
