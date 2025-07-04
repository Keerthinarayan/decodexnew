import React, { useEffect } from 'react';
import { Trophy, Medal, Star, Clock, ArrowLeft, Crown, Award, Scroll, Feather, Zap } from 'lucide-react';
import { useGame } from '../context/GameContext';
import AnimatedCounter from './AnimatedCounter';

interface LeaderboardProps {
  onBack?: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onBack }) => {
  const { teams, loadInitialData } = useGame();
  
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (loadInitialData) {
        loadInitialData();
      }
    }, 45000);

    return () => clearInterval(refreshInterval);
  }, [loadInitialData]);
  
  const sortedTeams = [...teams].sort((a, b) => {
    if (a.score === b.score) {
      if (!a.lastAnswered && !b.lastAnswered) return 0;
      if (!a.lastAnswered) return 1;
      if (!b.lastAnswered) return -1;
      return new Date(a.lastAnswered).getTime() - new Date(b.lastAnswered).getTime();
    }
    return b.score - a.score;
  });

  const formatTime = (date?: Date) => {
    if (!date) return 'Investigation not begun';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="w-8 h-8 text-vintage-gold" />;
      case 2: return <Medal className="w-7 h-7 text-gray-400" />;
      case 3: return <Award className="w-7 h-7 text-amber-600" />;
      default: return <Star className="w-6 h-6 text-vintage-brown" />;
    }
  };

  const getRankStyling = (position: number) => {
    switch (position) {
      case 1: return 'bg-vintage-gold/20 border-4 border-double border-vintage-gold';
      case 2: return 'bg-gray-300/20 border-4 border-double border-gray-400';
      case 3: return 'bg-amber-400/20 border-4 border-double border-amber-600';
      default: return 'bg-vintage-cream/50 border-2 border-vintage-brown';
    }
  };

  if (sortedTeams.length === 0) {
    return (
      <div className="text-center py-12">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-vintage-gray hover:text-vintage-brown transition-colors duration-200 mb-8 font-crimson"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Return to Investigation</span>
          </button>
        )}
        <div className="newspaper-column rounded-lg p-8 max-w-md mx-auto">
          <div className="w-16 h-16 bg-vintage-brown rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-vintage-gold">
            <Trophy className="w-8 h-8 text-vintage-cream" />
          </div>
          <h3 className="vintage-headline text-xl mb-4 font-playfair">No Distinguished Detectives</h3>
          <p className="text-vintage-gray font-crimson italic">The investigation awaits brave souls to begin the quest for truth and glory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-vintage-gray hover:text-vintage-brown transition-all duration-300 font-crimson vintage-transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Return to Investigation</span>
        </button>
      )}

      {/* Newspaper Header */}
      <div className="newspaper-column rounded-lg p-8 text-center paper-flutter">
        <div className="border-4 border-double border-vintage-brown p-6 rounded-lg bg-vintage-cream">
          {/* Newspaper Masthead */}
          <div className="mb-6">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <div className="w-16 h-px bg-vintage-brown"></div>
              <Feather className="w-8 h-8 text-vintage-brown" />
              <div className="w-16 h-px bg-vintage-brown"></div>
            </div>
            
            <h1 className="font-playfair text-5xl font-black text-vintage-black mb-2 tracking-wider">
              THE SIGNAL GAZETTE
            </h1>
            
            <div className="flex items-center justify-center space-x-6 text-sm text-vintage-brown font-crimson">
              <span>SPECIAL EDITION</span>
              <span>•</span>
              <span>LONDON, {new Date().getFullYear()}</span>
              <span>•</span>
              <span>PRICE: ONE SHILLING</span>
            </div>
          </div>

          {/* Main Headline */}
          <div className="border-t-4 border-b-4 border-double border-vintage-brown py-4 mb-6">
            <h2 className="vintage-headline text-4xl font-playfair text-vintage-black mb-2">
              HALL OF DISTINGUISHED DETECTIVES
            </h2>
            <p className="text-lg text-vintage-brown font-crimson italic">
              "The most celebrated investigators in the realm of electromagnetic mysteries"
            </p>
          </div>

          {/* Decorative elements */}
          <div className="flex items-center justify-center space-x-4">
            <div className="w-12 h-px bg-vintage-brown"></div>
            <Scroll className="w-6 h-6 text-vintage-gold" />
            <div className="w-12 h-px bg-vintage-brown"></div>
          </div>
        </div>
      </div>

      {/* Main Rankings Article */}
      <div className="newspaper-column rounded-lg p-8">
        <div className="border-4 border-double border-vintage-brown p-6 rounded-lg bg-vintage-cream">
          {/* Article Header */}
          <div className="border-b-2 border-vintage-brown pb-4 mb-6">
            <div className="flex items-center space-x-3 mb-2">
              <Trophy className="w-8 h-8 text-vintage-gold" />
              <h3 className="vintage-headline text-3xl font-playfair">INVESTIGATION RANKINGS</h3>
            </div>
            <p className="text-vintage-gray font-crimson italic">
              By our Special Correspondent • Latest intelligence from Scotland Yard
            </p>
          </div>
          
          {/* Rankings Content */}
          <div className="space-y-6">
            {sortedTeams.slice(0, 10).map((team, index) => {
              const position = index + 1;
              return (
                <div 
                  key={team.name} 
                  className={`${getRankStyling(position)} rounded-lg p-6 vintage-transition hover:shadow-lg`}
                >
                  {/* Rank Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl border-4 ${
                        position === 1 ? 'bg-vintage-gold text-vintage-black border-vintage-brown' :
                        position === 2 ? 'bg-gray-300 text-vintage-black border-vintage-brown' :
                        position === 3 ? 'bg-amber-600 text-vintage-cream border-vintage-brown' :
                        'bg-vintage-brown text-vintage-cream border-vintage-gold'
                      }`}>
                        {position}
                      </div>
                      {getRankIcon(position)}
                      <div>
                        <div className={`font-bold text-2xl font-playfair ${
                          position === 1 ? 'text-vintage-gold' :
                          position === 2 ? 'text-gray-600' :
                          position === 3 ? 'text-amber-600' :
                          'text-vintage-black'
                        }`}>
                          {team.name}
                        </div>
                        {position === 1 && (
                          <div className="vintage-badge bg-vintage-gold text-vintage-black px-3 py-1 rounded-full text-sm font-crimson font-bold">
                            ★ MASTER DETECTIVE ★
                          </div>
                        )}
                        {position === 2 && (
                          <div className="vintage-badge bg-gray-400 text-vintage-black px-3 py-1 rounded-full text-sm font-crimson font-bold">
                            DISTINGUISHED INVESTIGATOR
                          </div>
                        )}
                        {position === 3 && (
                          <div className="vintage-badge bg-amber-600 text-vintage-cream px-3 py-1 rounded-full text-sm font-crimson font-bold">
                            ACCOMPLISHED DETECTIVE
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-4xl font-bold font-playfair ${
                        position === 1 ? 'text-vintage-gold' :
                        position === 2 ? 'text-gray-600' :
                        position === 3 ? 'text-amber-600' :
                        'text-vintage-brown'
                      }`}>
                        <AnimatedCounter value={team.score} />
                      </div>
                      <div className="text-sm text-vintage-gray font-crimson">EVIDENCE POINTS</div>
                      {team.bonusPoints && team.bonusPoints > 0 && (
                        <div className="flex items-center justify-end space-x-1 mt-1">
                          <Zap className="w-3 h-3 text-vintage-gold" />
                          <span className="text-xs text-vintage-gold font-crimson font-bold">
                            +{team.bonusPoints} bonus
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detective Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="newspaper-column rounded p-3">
                      <div className="font-semibold text-vintage-brown font-playfair mb-1">TELEGRAPH ADDRESS</div>
                      <div className="text-vintage-gray font-crimson">{team.email}</div>
                    </div>
                    
                    <div className="newspaper-column rounded p-3">
                      <div className="font-semibold text-vintage-brown font-playfair mb-1">CASES SOLVED</div>
                      <div className="text-vintage-green font-bold font-playfair text-lg">
                        <AnimatedCounter value={team.currentQuestion} />
                      </div>
                    </div>
                    
                    <div className="newspaper-column rounded p-3">
                      <div className="font-semibold text-vintage-brown font-playfair mb-1">
                        {team.completionTime ? 'COMPLETION TIME' : 'LAST ACTIVITY'}
                      </div>
                      <div className="text-vintage-gray font-crimson flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(team.completionTime || team.lastAnswered)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Special Recognition for Top 3 */}
                  {position <= 3 && (
                    <div className="mt-4 pt-4 border-t-2 border-vintage-brown">
                      <div className="italic text-vintage-brown font-crimson text-center">
                        {position === 1 && "\"A detective of unparalleled skill and deduction\" - Chief Inspector"}
                        {position === 2 && "\"Demonstrates exceptional investigative prowess\" - Scotland Yard"}
                        {position === 3 && "\"A most capable and distinguished investigator\" - The Metropolitan Police"}
                      </div>
                    </div>
                  )}

                  {/* Completion Badge */}
                  {team.completionTime && (
                    <div className="mt-4 pt-4 border-t-2 border-vintage-brown">
                      <div className="flex items-center justify-center space-x-2">
                        <Trophy className="w-5 h-5 text-vintage-gold" />
                        <span className="vintage-badge bg-vintage-gold/20 border-vintage-gold text-vintage-gold px-3 py-1 rounded-full text-sm font-crimson font-bold">
                          INVESTIGATION COMPLETE
                        </span>
                        <Trophy className="w-5 h-5 text-vintage-gold" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Additional Teams Notice */}
          {sortedTeams.length > 10 && (
            <div className="mt-8 pt-6 border-t-2 border-vintage-brown text-center">
              <div className="newspaper-column rounded-lg p-4 inline-block">
                <p className="text-vintage-gray font-crimson italic">
                  <strong>EDITOR'S NOTE:</strong> Displaying the top 10 most distinguished detective teams. 
                  {sortedTeams.length - 10} additional teams are currently engaged in active investigations 
                  throughout the Empire.
                </p>
              </div>
            </div>
          )}

          {/* Newspaper Footer */}
          <div className="mt-8 pt-6 border-t-4 border-double border-vintage-brown text-center">
            <div className="flex items-center justify-center space-x-6 text-xs text-vintage-brown font-crimson">
              <span>PUBLISHED BY THE ROYAL SIGNAL PROCESSING SOCIETY</span>
              <span>•</span>
              <span>PRINTED IN LONDON</span>
            </div>
            <div className="mt-2 text-xs text-vintage-gray font-crimson italic">
              "All the News That's Fit to Decode"
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;