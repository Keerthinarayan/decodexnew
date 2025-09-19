import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import PlayerDashboard from './components/PlayerDashboard';
import AdminPanel from './components/AdminPanel';
import PlayerLogin from './components/PlayerLogin';
import AdminLogin from './components/AdminLogin';
import Leaderboard from './components/Leaderboard';
import VintageMapDots from './components/StarField';
import ToastContainer from './components/ToastContainer';
import AnnouncementModal from './components/AnnouncementModal';
import { GameProvider, useGame } from './context/GameContext';
import { useToast } from './hooks/useToast';
import { useAnnouncements } from './hooks/useAnnouncements';
import { useDisableDevTools } from './hooks/useDisableDevTools'; // ⬅️ Import

function AppContent() {
  const [currentView, setCurrentView] = useState<'landing' | 'player' | 'admin' | 'playerLogin' | 'adminLogin' | 'leaderboard'>('landing');
  const [currentTeam, setCurrentTeam] = useState<string | null>(null);
  const { loading } = useGame();
  const { toasts, removeToast } = useToast();
  const { currentAnnouncement, dismissAnnouncement, markAnnouncementAsRead } = useAnnouncements();

  // useDisableDevTools(); // ⬅️ Apply globally

  const handleTeamLogin = (teamName: string) => {
    setCurrentTeam(teamName);
    setCurrentView('player');
  };

  const handleAnnouncementClose = () => {
    if (currentAnnouncement) {
      markAnnouncementAsRead(currentAnnouncement.id);
    }
    dismissAnnouncement();
  };

  if (loading) {
    return (
      <div className="min-h-screen vintage-paper flex items-center justify-center">
        <div className="fixed inset-0 z-0">
          <VintageMapDots />
        </div>
        <div className="relative z-10 text-center">
          <div className="vintage-card rounded-lg p-8">
            <div className="vintage-spinner w-16 h-16 mx-auto mb-6"></div>
            <h2 className="vintage-headline text-2xl mb-4 font-playfair">Preparing Investigation</h2>
            <p className="text-vintage-gray font-crimson">Gathering evidence and preparing the case files...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen vintage-paper overflow-hidden">
      <div className="fixed inset-0 z-0">
        <VintageMapDots />
      </div>

      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

      {currentAnnouncement && (
        <AnnouncementModal
          announcement={currentAnnouncement}
          onClose={handleAnnouncementClose}
        />
      )}

      <div className="relative z-10">
        {currentView === 'landing' && (
          <LandingPage 
            onNavigate={(view) => {
              if (view === 'player') {
                setCurrentView('playerLogin');
              } else if (view === 'leaderboard' as any) {
                setCurrentView('leaderboard');
              } else if (view === 'admin') {
                setCurrentView('adminLogin');
              } else {
                setCurrentView(view);
              }
            }}
            onTeamLogin={handleTeamLogin}
          />
        )}
        {currentView === 'playerLogin' && (
          <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-md">
              <PlayerLogin 
                onNavigate={setCurrentView}
                onTeamLogin={handleTeamLogin}
              />
            </div>
          </div>
        )}
        {currentView === 'adminLogin' && (
          <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-md">
              <AdminLogin onNavigate={setCurrentView} />
            </div>
          </div>
        )}
        {currentView === 'leaderboard' && (
          <div className="min-h-screen px-4 py-8">
            <div className="max-w-6xl mx-auto">
              <Leaderboard onBack={() => setCurrentView('landing')} />
            </div>
          </div>
        )}
        {currentView === 'player' && currentTeam && (
          <PlayerDashboard 
            teamName={currentTeam}
            onNavigate={setCurrentView}
          />
        )}
        {currentView === 'admin' && (
          <AdminPanel onNavigate={setCurrentView} />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
