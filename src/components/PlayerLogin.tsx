import React, { useState } from 'react';
import { LogIn, UserPlus, Mail, Lock, Users, ArrowLeft } from 'lucide-react';
import { useGame } from '../context/GameContext';

interface PlayerLoginProps {
  onNavigate: (view: 'landing' | 'player' | 'admin' | 'playerLogin' | 'leaderboard') => void;
  onTeamLogin: (teamName: string) => void;
}

const PlayerLogin: React.FC<PlayerLoginProps> = ({ onNavigate, onTeamLogin }) => {
  const { registerTeam, loginTeam } = useGame();
  const [isRegistering, setIsRegistering] = useState(false);
  const [formData, setFormData] = useState({
    teamName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }

        const success = await registerTeam(formData.teamName, formData.email, formData.password);
        if (success) {
          onTeamLogin(formData.teamName);
        } else {
          setError('Team name or email already exists. Choose different values.');
        }
      } else {
        const success = await loginTeam(formData.teamName, formData.password);
        if (success) {
          onTeamLogin(formData.teamName);
        } else {
          setError('Invalid team name or password');
        }
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
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

        {/* Login Card */}
        <div className="vintage-card rounded-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-vintage-gold to-vintage-brown rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-vintage-brown">
              <Users className="w-8 h-8 text-vintage-cream" />
            </div>
            <h2 className="vintage-headline text-2xl mb-2 font-playfair">Detective Registry</h2>
            <p className="text-vintage-gray font-crimson">Join the investigation team</p>
          </div>

          <div className="space-y-6">
            {/* Toggle Buttons */}
            <div className="flex vintage-card rounded-lg p-1">
              <button
                onClick={() => setIsRegistering(false)}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-md transition-all duration-200 font-crimson ${
                  !isRegistering 
                    ? 'vintage-btn text-vintage-black shadow-lg' 
                    : 'text-vintage-gray hover:text-vintage-brown'
                }`}
              >
                <LogIn className="w-4 h-4" />
                <span>Return</span>
              </button>
              <button
                onClick={() => setIsRegistering(true)}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-md transition-all duration-200 font-crimson ${
                  isRegistering 
                    ? 'vintage-btn text-vintage-black shadow-lg' 
                    : 'text-vintage-gray hover:text-vintage-brown'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Enlist</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Team Name */}
              <div>
                <label className="block text-sm font-medium text-vintage-dark-brown mb-2 font-playfair uppercase tracking-wide">
                  Detective Team Name
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-vintage-brown" />
                  <input
                    type="text"
                    name="teamName"
                    value={formData.teamName}
                    onChange={handleInputChange}
                    required
                    className="vintage-input w-full pl-10 pr-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                    placeholder="Enter your team designation"
                  />
                </div>
              </div>

              {/* Email (Registration only) */}
              {isRegistering && (
                <div>
                  <label className="block text-sm font-medium text-vintage-dark-brown mb-2 font-playfair uppercase tracking-wide">
                    Telegraph Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-vintage-brown" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="vintage-input w-full pl-10 pr-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                      placeholder="Enter your correspondence address"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-vintage-dark-brown mb-2 font-playfair uppercase tracking-wide">
                  Secret Code
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-vintage-brown" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="vintage-input w-full pl-10 pr-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                    placeholder="Enter your secret cipher"
                  />
                </div>
              </div>

              {/* Confirm Password (Registration only) */}
              {isRegistering && (
                <div>
                  <label className="block text-sm font-medium text-vintage-dark-brown mb-2 font-playfair uppercase tracking-wide">
                    Confirm Secret Code
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-vintage-brown" />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      required
                      className="vintage-input w-full pl-10 pr-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                      placeholder="Confirm your secret cipher"
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="vintage-error rounded-lg p-3">
                  <p className="text-sm font-crimson">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`vintage-btn w-full py-3 px-4 rounded-lg font-crimson font-semibold transition-all duration-200 disabled:cursor-not-allowed ${
                  loading ? 'opacity-50' : 'hover:scale-105'
                }`}
              >
                {loading 
                  ? (isRegistering ? 'Enlisting Detective...' : 'Verifying Credentials...') 
                  : (isRegistering ? 'Join Investigation' : 'Enter Case Files')
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerLogin;