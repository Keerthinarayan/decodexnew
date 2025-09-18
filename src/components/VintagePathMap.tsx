import React from 'react';
import { Crown, Star, Lock, CheckCircle, MapPin, Scroll, Compass } from 'lucide-react';
import { Question } from '../types/game';
import RippleButton from './RippleButton';

interface VintagePathMapProps {
  questions: Question[];
  currentQuestionIndex: number;
  teamScore: number;
  teamName: string;
  onQuestionSelect: (index: number) => void;
  onStartCurrentQuestion: () => void;
  isQuizReady: boolean;
}

const VintagePathMap: React.FC<VintagePathMapProps> = ({
  questions,
  currentQuestionIndex,
  teamScore,
  teamName,
  onQuestionSelect,
  onStartCurrentQuestion,
  isQuizReady
}) => {
  // Generate path coordinates for questions with improved spacing and curves
  const generatePathCoordinates = (totalQuestions: number) => {
    const coordinates: Array<{ x: number; y: number; curve?: string }> = [];
    const mapWidth = 900;
    const mapHeight = 700;
    const padding = 100;
    
    for (let i = 0; i < totalQuestions; i++) {
      // Create a winding path that goes back and forth
      const row = Math.floor(i / 4);
      const col = i % 4;
      const isEvenRow = row % 2 === 0;
      
      let x, y;
      
      if (isEvenRow) {
        // Left to right
        x = padding + (col * (mapWidth - 2 * padding)) / 3;
      } else {
        // Right to left
        x = mapWidth - padding - (col * (mapWidth - 2 * padding)) / 3;
      }
      
      y = padding + (row * (mapHeight - 2 * padding)) / Math.ceil(totalQuestions / 4);
      
      // Add some randomness for a more natural, hand-drawn path
      x += (Math.sin(i * 0.7) * 25);
      y += (Math.cos(i * 0.4) * 20);
      
      coordinates.push({ x, y });
    }
    
    return coordinates;
  };

  const pathCoordinates = generatePathCoordinates(questions.length);

  const getQuestionStatus = (index: number) => {
    if (index < currentQuestionIndex) return 'completed';
    if (index === currentQuestionIndex) return 'current';
    return 'locked';
  };

  const getQuestionIcon = (_index: number, status: string) => {
    if (status === 'completed') {
      return <CheckCircle className="w-7 h-7 text-vintage-green drop-shadow-lg" />;
    } else if (status === 'current') {
      return <MapPin className="w-7 h-7 text-vintage-gold animate-pulse drop-shadow-lg" />;
    } else {
      return <Lock className="w-7 h-7 text-vintage-gray opacity-60" />;
    }
  };

  const getQuestionStyling = (_index: number, status: string) => {
    const baseClasses = "w-20 h-20 rounded-full border-4 flex items-center justify-center font-bold text-lg transition-all duration-300 cursor-pointer relative shadow-xl transform hover:scale-110";
    
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-gradient-to-br from-vintage-green/30 to-vintage-green/10 border-vintage-green text-vintage-green hover:shadow-2xl hover:border-vintage-green/80 backdrop-blur-sm`;
      case 'current':
        return `${baseClasses} bg-gradient-to-br from-vintage-gold/40 to-vintage-gold/20 border-vintage-gold text-vintage-gold hover:shadow-2xl hover:border-vintage-gold/80 animate-pulse backdrop-blur-sm ring-4 ring-vintage-gold/30`;
      case 'locked':
        return `${baseClasses} bg-gradient-to-br from-vintage-gray/20 to-vintage-gray/10 border-vintage-gray text-vintage-gray cursor-not-allowed opacity-50 hover:scale-105`;
      default:
        return baseClasses;
    }
  };

  // Generate SVG path for the trail
  const generateSVGPath = () => {
    if (pathCoordinates.length < 2) return '';
    
    let path = `M ${pathCoordinates[0].x} ${pathCoordinates[0].y}`;
    
    for (let i = 1; i < pathCoordinates.length; i++) {
      const prev = pathCoordinates[i - 1];
      const curr = pathCoordinates[i];
      
      // Create smooth curves between points
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      
      path += ` Q ${midX} ${midY} ${curr.x} ${curr.y}`;
    }
    
    return path;
  };

  return (
    <div className="vintage-card rounded-xl p-8 relative overflow-hidden shadow-2xl border-4 border-vintage-brown bg-gradient-to-br from-vintage-cream to-vintage-paper">
      {/* Enhanced Map Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-4 mb-6">
          <div className="p-3 rounded-full bg-vintage-brown/20 border-2 border-vintage-brown">
            <Compass className="w-10 h-10 text-vintage-brown" />
          </div>
          <div className="text-center">
            <h2 className="vintage-headline text-4xl font-playfair mb-2 text-vintage-black">Investigation Map</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-vintage-brown via-vintage-gold to-vintage-brown mx-auto"></div>
          </div>
          <div className="p-3 rounded-full bg-vintage-brown/20 border-2 border-vintage-brown">
            <Scroll className="w-10 h-10 text-vintage-brown" />
          </div>
        </div>
        <div className="flex items-center justify-center space-x-8 text-sm font-crimson bg-vintage-cream/50 rounded-lg p-4 border-2 border-vintage-brown/30">
          <span className="flex items-center space-x-2 text-vintage-green">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Evidence Collected</span>
          </span>
          <span className="flex items-center space-x-2 text-vintage-gold">
            <MapPin className="w-5 h-5" />
            <span className="font-semibold">Current Location</span>
          </span>
          <span className="flex items-center space-x-2 text-vintage-gray">
            <Lock className="w-5 h-5" />
            <span className="font-semibold">Unexplored Territory</span>
          </span>
        </div>
      </div>

      {/* Enhanced Detective Info Card */}
      <div className="absolute top-8 right-8 vintage-card bg-gradient-to-br from-vintage-cream to-vintage-paper rounded-xl p-6 border-4 border-vintage-brown shadow-2xl transform hover:scale-105 transition-transform duration-300">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-vintage-gold to-vintage-brown flex items-center justify-center border-4 border-vintage-brown shadow-lg">
            <Crown className="w-8 h-8 text-vintage-cream" />
          </div>
          <h3 className="font-playfair font-bold text-vintage-brown mb-2 text-lg">Detective {teamName}</h3>
          <div className="text-3xl font-bold text-vintage-gold font-playfair mb-1">{teamScore}</div>
          <div className="text-sm text-vintage-gray font-crimson">Evidence Points</div>
          <div className="mt-3 w-full bg-vintage-brown/20 rounded-full h-2">
            <div 
              className="h-2 bg-gradient-to-r from-vintage-gold to-vintage-brown rounded-full transition-all duration-500"
              style={{ width: `${Math.min((currentQuestionIndex / questions.length) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Enhanced Map Container */}
      <div className="relative bg-gradient-to-br from-vintage-paper via-vintage-cream to-vintage-paper rounded-xl border-4 border-double border-vintage-brown p-10 min-h-[700px] overflow-hidden shadow-inner">
        {/* Enhanced Vintage Map Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full" style={{
            backgroundImage: `
              radial-gradient(circle at 15% 25%, var(--vintage-brown) 2px, transparent 2px),
              radial-gradient(circle at 75% 65%, var(--vintage-brown) 1.5px, transparent 1.5px),
              radial-gradient(circle at 35% 85%, var(--vintage-brown) 1px, transparent 1px),
              radial-gradient(circle at 85% 15%, var(--vintage-brown) 2px, transparent 2px),
              radial-gradient(circle at 25% 75%, var(--vintage-brown) 1.5px, transparent 1.5px),
              linear-gradient(45deg, transparent 48%, rgba(139, 69, 19, 0.1) 49%, rgba(139, 69, 19, 0.1) 51%, transparent 52%),
              linear-gradient(-45deg, transparent 48%, rgba(139, 69, 19, 0.05) 49%, rgba(139, 69, 19, 0.05) 51%, transparent 52%)
            `,
            backgroundSize: '120px 120px, 180px 180px, 150px 150px, 100px 100px, 140px 140px, 30px 30px, 30px 30px'
          }} />
        </div>

        {/* Enhanced SVG Path Trail */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <defs>
            <pattern id="pathPattern" patternUnits="userSpaceOnUse" width="20" height="20">
              <rect width="20" height="20" fill="none" />
              <rect width="10" height="10" fill="var(--vintage-brown)" opacity="0.4" />
              <rect x="10" y="10" width="10" height="10" fill="var(--vintage-brown)" opacity="0.4" />
            </pattern>
            <filter id="pathGlow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="completedPathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--vintage-brown)" />
              <stop offset="50%" stopColor="var(--vintage-gold)" />
              <stop offset="100%" stopColor="var(--vintage-brown)" />
            </linearGradient>
          </defs>
          
          {/* Completed path with enhanced styling */}
          {currentQuestionIndex > 0 && (
            <path
              d={generateSVGPath()}
              stroke="url(#completedPathGradient)"
              strokeWidth="10"
              fill="none"
              strokeDasharray="15,8"
              strokeLinecap="round"
              filter="url(#pathGlow)"
              opacity="0.8"
              strokeDashoffset="0"
              style={{
                strokeDasharray: `${currentQuestionIndex * 60}, ${(questions.length - currentQuestionIndex) * 60}`,
                animation: 'pathDraw 2.5s ease-in-out'
              }}
            />
          )}
          
          {/* Future path (more subtle) */}
          <path
            d={generateSVGPath()}
            stroke="var(--vintage-gray)"
            strokeWidth="6"
            fill="none"
            strokeDasharray="8,15"
            strokeLinecap="round"
            opacity="0.4"
          />
        </svg>

        {/* Enhanced Question Nodes */}
        <div className="relative" style={{ zIndex: 2 }}>
          {questions.map((question, index) => {
            const coord = pathCoordinates[index];
            const status = getQuestionStatus(index);
            
            return (
              <div
                key={index}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: coord.x, top: coord.y }}
              >
                {/* Enhanced Question Node */}
                <div
                  className={getQuestionStyling(index, status)}
                  onClick={() => {
                    if (status === 'current' && isQuizReady) {
                      onStartCurrentQuestion();
                    } else if (status === 'completed') {
                      onQuestionSelect(index);
                    }
                  }}
                >
                  {/* Question Number with better typography */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-playfair font-bold text-xl">{index + 1}</span>
                  </div>
                  
                  {/* Enhanced Status Icon */}
                  <div className="absolute -top-3 -right-3 bg-vintage-cream rounded-full p-1 border-2 border-vintage-brown shadow-lg">
                    {getQuestionIcon(index, status)}
                  </div>
                  
                  {/* Enhanced Special Effects for Current Question */}
                  {status === 'current' && (
                    <>
                      <div className="absolute inset-0 rounded-full border-4 border-vintage-gold animate-ping opacity-50" />
                      <div className="absolute -inset-3 rounded-full border-2 border-vintage-gold animate-pulse opacity-30" />
                      <div className="absolute -inset-6 rounded-full border border-vintage-gold animate-ping opacity-20" />
                    </>
                  )}

                  {/* Completion glow effect */}
                  {status === 'completed' && (
                    <div className="absolute inset-0 rounded-full bg-vintage-green/20 animate-pulse" />
                  )}
                </div>

                {/* Enhanced Question Info Tooltip */}
                <div className="absolute top-24 left-1/2 transform -translate-x-1/2 vintage-card bg-gradient-to-br from-vintage-cream to-vintage-paper rounded-xl p-4 border-3 border-vintage-brown shadow-2xl min-w-[280px] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 scale-95 group-hover:scale-100">
                  <div className="relative">
                    {/* Tooltip arrow */}
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-vintage-brown"></div>
                    
                    <div className="flex items-start space-x-3 mb-3">
                      <div className={`p-2 rounded-lg ${
                        status === 'completed' ? 'bg-vintage-green/20 text-vintage-green' :
                        status === 'current' ? 'bg-vintage-gold/20 text-vintage-gold' :
                        'bg-vintage-gray/20 text-vintage-gray'
                      }`}>
                        {getQuestionIcon(index, status)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-playfair font-bold text-vintage-brown mb-1 text-lg">
                          Evidence #{index + 1}
                        </h4>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs bg-vintage-blue/20 text-vintage-blue px-2 py-1 rounded border border-vintage-blue/30 font-crimson">
                            {question.category}
                          </span>
                          <span className="text-xs bg-vintage-gold/20 text-vintage-gold px-2 py-1 rounded border border-vintage-gold/30 font-playfair font-bold">
                            {question.points} pts
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-vintage-black font-crimson leading-relaxed mb-3">
                      {question.title}
                    </p>
                    
                    <div className="border-t border-vintage-brown/30 pt-2">
                      <div className="flex items-center justify-between text-xs font-crimson">
                        <span className="text-vintage-gray">
                          {status === 'completed' ? '✓ Completed' : 
                           status === 'current' ? '→ Current' : 
                           '🔒 Locked'}
                        </span>
                        {question.hasChoices && (
                          <span className="text-vintage-blue">🔀 Branching</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Location Labels for Key Points */}
                {(index === 0 || index === Math.floor(questions.length / 2) || index === questions.length - 1) && (
                  <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center">
                    <div className="vintage-badge px-4 py-2 rounded-full text-sm font-crimson bg-vintage-brown/20 border-2 border-vintage-brown text-vintage-brown shadow-lg">
                      {index === 0 && "🕵️ Investigation Start"}
                      {index === Math.floor(questions.length / 2) && "🔍 Midpoint Checkpoint"}
                      {index === questions.length - 1 && "🏆 Case Resolution"}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Enhanced Decorative Elements */}
        <div className="absolute top-6 left-6 opacity-40 transform hover:opacity-60 transition-opacity duration-300">
          <div className="w-20 h-20 border-4 border-vintage-brown rounded-full flex items-center justify-center bg-vintage-cream shadow-lg">
            <Compass className="w-10 h-10 text-vintage-brown animate-spin" style={{ animationDuration: '12s' }} />
          </div>
          <div className="text-center mt-2">
            <div className="text-xs font-crimson text-vintage-brown font-bold">NORTH</div>
          </div>
        </div>

        <div className="absolute bottom-6 right-6 opacity-40 transform hover:opacity-60 transition-opacity duration-300">
          <div className="vintage-card bg-vintage-brown/20 rounded-lg p-3 border-2 border-vintage-brown">
            <div className="text-xs font-crimson text-vintage-brown text-center">
              <div className="font-bold mb-1">LEGEND</div>
              <div>Scale: 1 Evidence = 100 Yards</div>
              <div className="mt-1 text-vintage-gray">Est. 1843 • London</div>
            </div>
          </div>
        </div>

        {/* Enhanced Current Question Action Button */}
        {isQuizReady && currentQuestionIndex < questions.length && (
          <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
            <RippleButton
              onClick={onStartCurrentQuestion}
              className="vintage-btn bg-gradient-to-r from-vintage-gold/30 to-vintage-gold/20 border-3 border-vintage-gold text-vintage-gold hover:from-vintage-gold/40 hover:to-vintage-gold/30 px-10 py-5 rounded-2xl font-playfair font-bold text-xl transition-all duration-300 shadow-2xl transform hover:scale-105 flex items-center space-x-4 backdrop-blur-sm"
              rippleColor="rgba(212, 175, 55, 0.4)"
            >
              <MapPin className="w-8 h-8" />
              <span>Investigate Current Evidence</span>
              <div className="w-2 h-2 bg-vintage-gold rounded-full animate-pulse"></div>
            </RippleButton>
          </div>
        )}
      </div>

      {/* Enhanced Map Legend */}
      <div className="mt-8 vintage-card bg-gradient-to-br from-vintage-cream/80 to-vintage-paper/80 rounded-xl p-6 border-3 border-vintage-brown shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center space-x-3">
            <Star className="w-6 h-6 text-vintage-gold" />
            <h4 className="font-playfair font-bold text-vintage-brown text-xl">Investigation Progress Report</h4>
            <Star className="w-6 h-6 text-vintage-gold" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="bg-vintage-green/10 rounded-lg p-4 border-2 border-vintage-green/30">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="w-8 h-8 text-vintage-green mr-2" />
              <div className="text-3xl font-bold text-vintage-green font-playfair">{currentQuestionIndex}</div>
            </div>
            <div className="text-vintage-gray font-crimson font-semibold">Evidence Collected</div>
            <div className="text-xs text-vintage-green mt-1">
              {currentQuestionIndex > 0 ? `${((currentQuestionIndex / questions.length) * 100).toFixed(0)}% Complete` : 'Investigation Pending'}
            </div>
          </div>
          
          <div className="bg-vintage-gold/10 rounded-lg p-4 border-2 border-vintage-gold/30">
            <div className="flex items-center justify-center mb-2">
              <MapPin className="w-8 h-8 text-vintage-gold mr-2" />
              <div className="text-3xl font-bold text-vintage-gold font-playfair">{questions.length - currentQuestionIndex}</div>
            </div>
            <div className="text-vintage-gray font-crimson font-semibold">Remaining Clues</div>
            <div className="text-xs text-vintage-gold mt-1">
              {questions.length - currentQuestionIndex > 0 ? 'Investigation Ongoing' : 'Case Closed'}
            </div>
          </div>
          
          <div className="bg-vintage-brown/10 rounded-lg p-4 border-2 border-vintage-brown/30">
            <div className="flex items-center justify-center mb-2">
              <Crown className="w-8 h-8 text-vintage-brown mr-2" />
              <div className="text-3xl font-bold text-vintage-brown font-playfair">{Math.round((currentQuestionIndex / questions.length) * 100)}%</div>
            </div>
            <div className="text-vintage-gray font-crimson font-semibold">Case Progress</div>
            <div className="text-xs text-vintage-brown mt-1">
              {currentQuestionIndex === questions.length ? 'Investigation Complete!' : 'In Progress'}
            </div>
          </div>
        </div>

        {/* Enhanced Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-crimson text-vintage-gray">Overall Investigation Progress</span>
            <span className="text-sm font-playfair font-bold text-vintage-brown">{Math.round((currentQuestionIndex / questions.length) * 100)}%</span>
          </div>
          <div className="w-full bg-vintage-brown/20 rounded-full h-4 border-2 border-vintage-brown/30 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-vintage-gold via-vintage-brown to-vintage-gold rounded-full transition-all duration-1000 ease-out shadow-inner"
              style={{ width: `${Math.min((currentQuestionIndex / questions.length) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* CSS Styles */}
      <style>{`
        @keyframes pathDraw {
          from {
            stroke-dashoffset: 1000;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        
        .border-3 {
          border-width: 3px;
        }
        
        .group:hover .group-hover\\:opacity-100 {
          opacity: 1;
        }
        
        .group:hover .group-hover\\:scale-100 {
          transform: scale(1);
        }
      `}</style>
    </div>
  );
};

export default VintagePathMap;