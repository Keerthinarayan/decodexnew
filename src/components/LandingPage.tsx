import React, { useState, useEffect } from 'react';
import { Scroll, Trophy, Settings } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (view: 'landing' | 'player' | 'admin') => void;
  onTeamLogin: (teamName: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, onTeamLogin }) => {
  const [showAdminButton, setShowAdminButton] = useState(false);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);

  const handleLaunchMission = () => {
    onNavigate('player');
  };

  const handleLeaderboard = () => {
    onNavigate('leaderboard' as any);
  };

  const handleAdminAccess = () => {
    onNavigate('admin');
  };

  const handleMouseEnter = () => {
    const timer = setTimeout(() => {
      setShowAdminButton(true);
    }, 2000);
    setHoverTimer(timer);
  };

  const handleMouseLeave = () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
    setShowAdminButton(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }
    };
  }, [hoverTimer]);

  // Add dev tools detection
useEffect(() => {
  const detectDevTools = () => {
    if (
      window.outerHeight - window.innerHeight > 200 || 
      window.outerWidth - window.innerWidth > 200
    ) {
      document.body.innerHTML = 'Access Denied';
      window.location.href = '/access-denied';
    }
  };

  window.addEventListener('resize', detectDevTools);
  return () => window.removeEventListener('resize', detectDevTools);
}, []);

  return (
    <div className="min-h-screen relative vintage-paper">
      {/* Vintage map dots background */}
      <div className="vintage-map-dots"></div>

      {/* Admin Access Button - Top Right (Hidden by default) */}
      <div 
        className="absolute top-6 right-6 z-30 w-12 h-12"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          onClick={handleAdminAccess}
          className={`w-12 h-12 vintage-btn rounded-lg flex items-center justify-center transition-all duration-300 group ${
            showAdminButton ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
        >
          <Settings className="w-6 h-6 text-vintage-brown group-hover:text-vintage-gold transition-colors duration-200" />
        </button>
      </div>

      {/* Main Content - Centered */}
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        {/* Ornate Header */}
        <div className="text-center mb-12"> {/* 'vintage-float' removed to stop wobbling */}
          <div className="vintage-card rounded-lg p-8 max-w-4xl mx-auto">
            {/* Decorative border */}
            <div className="border-4 border-double border-vintage-brown p-6 rounded-lg">
              {/* Logo/Emblem */}
              <div className="mb-6">
                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-vintage-gold to-vintage-brown rounded-full flex items-center justify-center shadow-lg border-4 border-vintage-brown">
                  <Scroll className="w-12 h-12 text-vintage-cream" />
                </div>
              </div>

              {/* Main Title */}
              <h1 className="vintage-headline text-6xl md:text-8xl mb-4 font-playfair">
                DecodeX
              </h1>
              
              {/* Subtitle */}
              <div className="mb-6">
                <div className="w-32 h-1 bg-vintage-brown mx-auto mb-4"></div>
                <h2 className="text-2xl md:text-3xl font-crimson text-vintage-dark-brown mb-2 italic">
                  The Great Signal Mystery
                </h2>
                <div className="w-32 h-1 bg-vintage-brown mx-auto"></div>
              </div>

              {/* Description */}
              <div className="max-w-2xl mx-auto mb-8">
                <p className="text-lg text-vintage-gray font-crimson leading-relaxed">
                  <span className="text-vintage-brown font-semibold">IEEE Signal Processing Society</span> presents 
                  an extraordinary investigation into the mysteries of the electromagnetic spectrum. 
                  Gather your finest minds and embark upon this most challenging of intellectual pursuits.
                </p>
              </div>

              {/* Ornamental divider */}
              <div className="flex items-center justify-center mb-8">
                <div className="w-16 h-px bg-vintage-brown"></div>
                <div className="w-3 h-3 bg-vintage-gold rounded-full mx-4 border-2 border-vintage-brown"></div>
                <div className="w-16 h-px bg-vintage-brown"></div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button
                  onClick={handleLaunchMission}
                  className="vintage-btn px-8 py-4 rounded-lg font-crimson text-lg font-semibold transition-all duration-300 flex items-center space-x-3 hover:scale-105"
                >
                  <Scroll className="w-6 h-6" />
                  <span>Begin Investigation</span>
                </button>
                
                <button
                  onClick={handleLeaderboard}
                  className="vintage-btn px-8 py-4 rounded-lg font-crimson text-lg font-semibold transition-all duration-300 flex items-center space-x-3 hover:scale-105"
                >
                  <Trophy className="w-6 h-6" />
                  <span>Hall of Fame</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <div className="vintage-card rounded-lg p-4 inline-block">
            <p className="text-vintage-gray text-sm font-crimson italic">
              "The game is afoot!" - A Study in Signals
            </p>
            <div className="mt-2">
              <p className="text-vintage-brown text-xs font-crimson">
                Powered by IEEE Signal Processing Society
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
