import React, { useState } from 'react';
import { Shield, Lock, User, ArrowLeft } from 'lucide-react';
import { signInAdmin, createAdminUser } from '../lib/auth';

interface AdminLoginProps {
  onNavigate: (view: 'landing' | 'player' | 'admin' | 'playerLogin' | 'adminLogin' | 'leaderboard') => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onNavigate }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);

  const handleSetupAdmin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const success = await createAdminUser();
      if (success) {
        setError('');
        setSetupMode(false);
        setCredentials({ username: '', password: '' });
      } else {
        setError('Failed to setup admin user. Please try again.');
      }
    } catch (err) {
      setError('Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await signInAdmin(credentials.username, credentials.password);
      if (success) {
        onNavigate('admin');
      } else {
        setError('Invalid admin credentials');
        setSetupMode(true);
      }
    } catch (err) {
      setError('Authentication failed. Please try again.');
      setSetupMode(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen vintage-paper flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center space-x-2 text-vintage-gray hover:text-vintage-brown transition-colors duration-200 mb-8 font-crimson"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Return to Investigation</span>
        </button>

        {/* Admin Login Card */}
        <div className="vintage-card rounded-lg p-8 border-4 border-double border-vintage-red">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-vintage-red to-vintage-dark-brown rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-vintage-brown">
              <Shield className="w-8 h-8 text-vintage-cream" />
            </div>
            <h2 className="vintage-headline text-2xl mb-2 font-playfair text-vintage-red">Chief Inspector Access</h2>
            <p className="text-vintage-gray font-crimson">Restricted Investigation Control</p>
          </div>

          {setupMode ? (
            <div className="space-y-6">
              <div className="vintage-card bg-vintage-blue/10 border-vintage-blue rounded-lg p-4">
                <p className="text-vintage-blue font-crimson text-sm mb-4">
                  It appears the Chief Inspector credentials have not been established. 
                  Initialize the command structure to proceed with the investigation.
                </p>
                <button
                  onClick={handleSetupAdmin}
                  disabled={loading}
                  className="vintage-btn w-full py-3 px-4 rounded-lg font-crimson font-medium transition-all duration-200 disabled:cursor-not-allowed"
                >
                  {loading ? 'Establishing Authority...' : 'Initialize Chief Inspector'}
                </button>
              </div>
              
              <button
                onClick={() => setSetupMode(false)}
                className="w-full py-2 px-4 text-vintage-gray hover:text-vintage-brown transition-colors duration-200 font-crimson"
              >
                Return to Authentication
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-vintage-dark-brown mb-2 font-playfair uppercase tracking-wide">
                  Inspector Designation
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-vintage-brown" />
                  <input
                    type="text"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                    required
                    className="vintage-input w-full pl-10 pr-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                    placeholder="Inspector identification"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-vintage-dark-brown mb-2 font-playfair uppercase tracking-wide">
                  Authorization Code
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-vintage-brown" />
                  <input
                    type="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    required
                    className="vintage-input w-full pl-10 pr-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                    placeholder="Inspector authorization"
                  />
                </div>
              </div>

              {error && (
                <div className="vintage-error rounded-lg p-3">
                  <p className="text-sm font-crimson">{error}</p>
                  {error.includes('Invalid') && (
                    <button
                      type="button"
                      onClick={() => setSetupMode(true)}
                      className="mt-2 text-vintage-blue hover:text-vintage-dark-brown text-sm underline font-crimson"
                    >
                      Initialize Chief Inspector
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="vintage-btn w-full py-3 px-4 rounded-lg font-crimson font-semibold transition-all duration-200 disabled:cursor-not-allowed hover:scale-105"
              >
                {loading ? 'Verifying Authority...' : 'Access Command Center'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;