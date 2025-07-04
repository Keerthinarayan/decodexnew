import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, Zap, Users, Star, Brain, Eye, SkipForward, Play, LogOut, Crown, Medal, Award, Scroll, Map } from 'lucide-react';
import { useGame } from '../context/GameContext';
import QuestionInterface from './QuestionInterface';
import VintageMapDots from './StarField';
import VintagePathMap from './VintagePathMap';
import RippleButton from './RippleButton';
import AnimatedCounter from './AnimatedCounter';

interface PlayerDashboardProps {
  teamName: string;
  onNavigate: (view: 'landing' | 'player' | 'admin' | 'playerLogin' | 'adminLogin' | 'leaderboard') => void;
}

const PlayerDashboard: React.FC<PlayerDashboardProps> = ({ teamName, onNavigate }) => {
  const { teams, questions, quizActive, quizPaused } = useGame();
  const [currentView, setCurrentView] = useState<'dashboard' | 'question' | 'map'>('map');
  
  const team = teams.find(t => t.name === teamName);
  
  if (!team) {
    return (
      <div className="min-h-screen vintage-paper flex items-center justify-center">
        <div className="text-center">
          <div className="vintage-card rounded-lg p-8">
            <h2 className="vintage-headline text-2xl mb-4 font-playfair">Detective Team Not Found</h2>
            <p className="text-vintage-gray font-crimson mb-6">The specified investigation team could not be located in our records.</p>
            <RippleButton
              onClick={() => onNavigate('landing')}
              className="vintage-btn px-6 py-3 rounded-lg font-crimson"
            >
              Return to Investigation
            </RippleButton>
          </div>
        </div>
      </div>
    );
  }

  // Calculate team position
  const sortedTeams = [...teams].sort((a, b) => {
    if (a.score === b.score) {
      return new Date(a.lastAnswered || 0).getTime() - new Date(b.lastAnswered || 0).getTime();
    }
    return b.score - a.score;
  });
  
  const teamPosition = sortedTeams.findIndex(t => t.name === teamName) + 1;
  const totalTeams = teams.length;

  const currentQuestion = questions[team.currentQuestion];
  const isQuizReady = quizActive && !quizPaused;
  const missionComplete = team.currentQuestion >= questions.length;

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="w-6 h-6 text-vintage-gold" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400" />;
      case 3: return <Award className="w-6 h-6 text-amber-600" />;
      default: return <Trophy className="w-6 h-6 text-vintage-brown" />;
    }
  };

  const getPositionStyling = (position: number) => {
    switch (position) {
      case 1: return 'vintage-rank-1';
      case 2: return 'vintage-rank-2';
      case 3: return 'vintage-rank-3';
      default: return 'vintage-card';
    }
  };

  const handleLogout = () => {
    onNavigate('landing');
  };

  const handleStartQuiz = () => {
    if (currentQuestion && isQuizReady) {
      setCurrentView('question');
    }
  };

  const handleBackToMap = () => {
    setCurrentView('map');
  };

  const handleQuestionSelect = (index: number) => {
    // For now, just show info about completed questions
    // Could be extended to allow reviewing completed questions
  };

  const handleViewToggle = (view: 'dashboard' | 'map') => {
    setCurrentView(view);
  };

  if (currentView === 'question' && currentQuestion && isQuizReady && !missionComplete) {
    return (
      <div className="min-h-screen vintage-paper relative">
        <VintageMapDots />
        <div className="relative z-10 px-4 py-8">
          <QuestionInterface
            question={currentQuestion}
            teamName={teamName}
            onBackToMap={handleBackToMap}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen vintage-paper relative">
      <VintageMapDots />
      
      <div className="relative z-10 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="text-left">
                <h1 className="vintage-headline text-3xl font-playfair">Detective {team.name}</h1>
                <p className="text-vintage-gray font-crimson italic">Investigation Command Center</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* View Toggle */}
              <div className="flex vintage-card rounded-lg p-1">
                <button
                  onClick={() => handleViewToggle('map')}
                  className={`flex items-center space-x-2 py-2 px-4 rounded-md transition-all duration-200 font-crimson ${
                    currentView === 'map'
                      ? 'vintage-btn text-vintage-black shadow-lg'
                      : 'text-vintage-gray hover:text-vintage-brown'
                  }`}
                >
                  <Map className="w-4 h-4" />
                  <span>Map View</span>
                </button>
                <button
                  onClick={() => handleViewToggle('dashboard')}
                  className={`flex items-center space-x-2 py-2 px-4 rounded-md transition-all duration-200 font-crimson ${
                    currentView === 'dashboard'
                      ? 'vintage-btn text-vintage-black shadow-lg'
                      : 'text-vintage-gray hover:text-vintage-brown'
                  }`}
                >
                  <Scroll className="w-4 h-4" />
                  <span>Details</span>
                </button>
              </div>

              <RippleButton
                onClick={() => onNavigate('leaderboard')}
                className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
              >
                <Trophy className="w-4 h-4" />
                <span>Hall of Fame</span>
              </RippleButton>
              
              <RippleButton
                onClick={handleLogout}
                className="vintage-btn bg-vintage-red/20 border-vintage-red text-vintage-red hover:bg-vintage-red/30 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
                rippleColor="rgba(139, 0, 0, 0.4)"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>End Investigation</span>
              </RippleButton>
            </div>
          </div>

          {/* Mission Status Alert */}
          {!isQuizReady && !missionComplete && (
            <div className="vintage-card bg-vintage-gold/10 border-vintage-gold rounded-lg p-6 mb-8 text-center">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <Star className="w-8 h-8 text-vintage-gold" />
                <h2 className="vintage-headline text-2xl font-playfair text-vintage-gold">
                  {!quizActive ? 'Investigation Standby' : 'Investigation Paused'}
                </h2>
              </div>
              <p className="text-vintage-brown font-crimson">
                {!quizActive 
                  ? 'Awaiting orders from Scotland Yard. Stand by for further instructions from headquarters.'
                  : 'Investigation temporarily suspended. Please await resumption orders from the Chief Inspector.'
                }
              </p>
            </div>
          )}

          {/* Map View */}
          {currentView === 'map' && (
            <>
              {missionComplete ? (
                // Mission Complete
                <div className="vintage-card bg-vintage-green/10 border-vintage-green rounded-lg p-8 text-center">
                  <div className="flex items-center justify-center space-x-3 mb-6">
                    <div className="relative">
                      <Trophy className="w-20 h-20 text-vintage-gold animate-pulse" />
                      <div className="absolute -top-2 -right-2">
                        <Star className="w-8 h-8 text-vintage-gold animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                    </div>
                  </div>
                  <h2 className="vintage-headline text-5xl font-playfair text-vintage-green mb-4">
                    Case Successfully Closed!
                  </h2>
                  <p className="text-vintage-green text-xl mb-6 max-w-2xl mx-auto font-crimson">
                    Exceptional detective work, {team.name}! You have successfully unraveled all the mysteries and 
                    brought this most perplexing case to a satisfactory conclusion. Scotland Yard commends your dedication.
                  </p>
                  <div className="vintage-card bg-vintage-gold/20 border-vintage-gold rounded-xl p-6 mb-8 max-w-md mx-auto">
                    <div className="text-4xl font-bold text-vintage-gold mb-2 font-playfair">
                      Final Score: <AnimatedCounter value={team.score} />
                    </div>
                    <div className="text-vintage-brown font-crimson">
                      Ranking: #{teamPosition} of {totalTeams} detective teams
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
                    <RippleButton
                      onClick={() => onNavigate('leaderboard')}
                      className="vintage-btn bg-vintage-gold/20 border-vintage-gold text-vintage-gold hover:bg-vintage-gold/30 px-8 py-4 rounded-xl font-crimson font-medium transition-all duration-200 shadow-lg transform hover:scale-105 flex items-center justify-center space-x-2"
                      rippleColor="rgba(212, 175, 55, 0.3)"
                    >
                      <Trophy className="w-5 h-5" />
                      <span>View Final Rankings</span>
                    </RippleButton>
                    <RippleButton
                      onClick={handleLogout}
                      className="vintage-btn bg-vintage-brown/20 border-vintage-brown text-vintage-brown hover:bg-vintage-brown/30 px-8 py-4 rounded-xl font-crimson font-medium transition-all duration-200 shadow-lg transform hover:scale-105 flex items-center justify-center space-x-2"
                      rippleColor="rgba(139, 69, 19, 0.3)"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Return to Scotland Yard</span>
                    </RippleButton>
                  </div>
                </div>
              ) : (
                // Investigation Map
                <VintagePathMap
                  questions={questions}
                  currentQuestionIndex={team.currentQuestion}
                  teamScore={team.score}
                  teamName={team.name}
                  onQuestionSelect={handleQuestionSelect}
                  onStartCurrentQuestion={handleStartQuiz}
                  isQuizReady={isQuizReady}
                />
              )}
            </>
          )}

          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <>
              {/* Team Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Current Position */}
                <div className={`${getPositionStyling(teamPosition)} rounded-lg p-6`}>
                  <div className="flex items-center space-x-3 mb-4">
                    {getPositionIcon(teamPosition)}
                    <h3 className="vintage-headline text-xl font-playfair">Ranking</h3>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold font-playfair mb-1">#{teamPosition}</div>
                    <div className="text-sm font-crimson opacity-80">of {totalTeams} teams</div>
                  </div>
                </div>

                {/* Current Score */}
                <div className="vintage-card rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Star className="w-6 h-6 text-vintage-gold" />
                    <h3 className="vintage-headline text-xl font-playfair">Evidence Points</h3>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-vintage-gold font-playfair mb-1">
                      <AnimatedCounter value={team.score} />
                    </div>
                    <div className="text-sm text-vintage-gray font-crimson">points collected</div>
                  </div>
                </div>

                {/* Progress */}
                <div className="vintage-card rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Scroll className="w-6 h-6 text-vintage-brown" />
                    <h3 className="vintage-headline text-xl font-playfair">Case Progress</h3>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-vintage-brown font-playfair mb-1">
                      <AnimatedCounter value={team.currentQuestion} />
                    </div>
                    <div className="text-sm text-vintage-gray font-crimson">of {questions.length} clues</div>
                    <div className="vintage-progress mt-3">
                      <div
                        className="vintage-progress-fill transition-all duration-300"
                        style={{ width: `${(team.currentQuestion / questions.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Investigation Tools */}
                <div className="vintage-card rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Zap className="w-6 h-6 text-vintage-gold" />
                    <h3 className="vintage-headline text-xl font-playfair">Investigation Tools</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Brain className="w-4 h-4 text-vintage-gold" />
                        <span className="text-sm text-vintage-gray font-crimson">Mind Palace</span>
                      </div>
                      <span className="text-vintage-gold font-bold font-playfair">
                        <AnimatedCounter value={team.powerUps.brainBoost} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-4 h-4 text-vintage-blue" />
                        <span className="text-sm text-vintage-gray font-crimson">Magnifying Glass</span>
                      </div>
                      <span className="text-vintage-blue font-bold font-playfair">
                        <AnimatedCounter value={team.powerUps.hint} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <SkipForward className="w-4 h-4 text-vintage-green" />
                        <span className="text-sm text-vintage-gray font-crimson">Skip Clue</span>
                      </div>
                      <span className="text-vintage-green font-bold font-playfair">
                        <AnimatedCounter value={team.powerUps.skip} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="vintage-card rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <Users className="w-6 h-6 text-vintage-brown" />
                    <h3 className="vintage-headline text-2xl font-playfair">Detective Team Details</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-vintage-gray font-crimson">Team Designation</label>
                      <div className="text-lg font-semibold text-vintage-brown font-playfair">{team.name}</div>
                    </div>
                    <div>
                      <label className="text-sm text-vintage-gray font-crimson">Telegraph Address</label>
                      <div className="text-lg text-vintage-black font-crimson">{team.email}</div>
                    </div>
                    <div>
                      <label className="text-sm text-vintage-gray font-crimson">Investigation Status</label>
                      <div className="text-lg text-vintage-black font-crimson">
                        {missionComplete ? 'Case Closed' : 'Active Investigation'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="vintage-card rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <Star className="w-6 h-6 text-vintage-gold" />
                    <h3 className="vintage-headline text-2xl font-playfair">Investigation Statistics</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-vintage-gray font-crimson">Clues Solved:</span>
                      <span className="text-vintage-gold font-bold font-playfair">
                        <AnimatedCounter value={team.currentQuestion} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-vintage-gray font-crimson">Total Clues:</span>
                      <span className="text-vintage-gold font-bold font-playfair">{questions.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-vintage-gray font-crimson">Success Rate:</span>
                      <span className="text-vintage-gold font-bold font-playfair">
                        <AnimatedCounter value={Math.round((team.currentQuestion / questions.length) * 100)} suffix="%" />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-vintage-gray font-crimson">Average Points:</span>
                      <span className="text-vintage-gold font-bold font-playfair">
                        <AnimatedCounter value={team.currentQuestion > 0 ? Math.round(team.score / team.currentQuestion) : 0} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Question Status */}
              {!missionComplete && currentQuestion && isQuizReady && (
                <div className="vintage-card rounded-lg p-8">
                  <div className="text-center mb-8">
                    <h2 className="vintage-headline text-4xl font-playfair mb-4">Next Clue Ready for Investigation</h2>
                    <p className="text-vintage-gray text-lg font-crimson">Evidence {team.currentQuestion + 1} of {questions.length}</p>
                  </div>

                  <div className="vintage-card bg-vintage-cream/50 rounded-xl p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="vintage-headline text-2xl font-playfair">{currentQuestion.title}</h3>
                      <div className="flex items-center space-x-4">
                        <span className="vintage-badge px-3 py-1 rounded-lg text-sm">
                          {currentQuestion.category}
                        </span>
                        <span className="vintage-badge bg-vintage-green/20 border-vintage-green text-vintage-green px-3 py-1 rounded-lg text-sm">
                          {currentQuestion.points} points
                          {team.brainBoostActive && (
                            <span className="ml-1 text-vintage-gold">(x2)</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="text-vintage-black text-lg leading-relaxed font-crimson">
                      {currentQuestion.question.length > 200 
                        ? currentQuestion.question.substring(0, 200) + '...' 
                        : currentQuestion.question
                      }
                    </p>
                  </div>

                  <div className="text-center">
                    <RippleButton
                      onClick={handleStartQuiz}
                      className="vintage-btn bg-vintage-brown/20 border-vintage-brown text-vintage-brown hover:bg-vintage-brown/30 px-12 py-4 rounded-xl font-playfair font-bold text-lg transition-all duration-200 shadow-lg transform hover:scale-105 flex items-center space-x-3 mx-auto"
                      rippleColor="rgba(139, 69, 19, 0.3)"
                    >
                      <Play className="w-6 h-6" />
                      <span>Begin Evidence Analysis</span>
                    </RippleButton>
                  </div>
                </div>
              )}

              {/* Waiting for Quiz */}
              {!missionComplete && !isQuizReady && (
                <div className="vintage-card rounded-lg p-8 text-center">
                  <div className="flex items-center justify-center space-x-3 mb-6">
                    <Scroll className="w-12 h-12 text-vintage-brown" />
                  </div>
                  <h2 className="vintage-headline text-2xl font-playfair text-vintage-brown mb-4">Awaiting Investigation Orders</h2>
                  <p className="text-vintage-gray text-lg font-crimson">
                    Stand by for case activation from Scotland Yard headquarters.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerDashboard;