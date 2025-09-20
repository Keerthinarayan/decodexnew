import React from 'react';
import { Crown, Medal, Award, Star, Lock, CheckCircle, MapPin, Scroll, Compass } from 'lucide-react';
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
  // Generate path coordinates for questions
  const generatePathCoordinates = (totalQuestions: number) => {
    const coordinates: Array<{ x: number; y: number; curve?: string }> = [];
    const mapWidth = 800;
    const mapHeight = 600;
    const padding = 80;
    
    for (let i = 0; i < totalQuestions; i++) {
      const progress = i / (totalQuestions - 1);
      
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
      
      // Add some randomness for a more natural path
      x += (Math.sin(i * 0.5) * 20);
      y += (Math.cos(i * 0.3) * 15);
      
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

  const getQuestionIcon = (index: number, status: string) => {
    if (status === 'completed') {
      return <CheckCircle className="w-6 h-6 text-vintage-green" />;
    } else if (status === 'current') {
      return <MapPin className="w-6 h-6 text-vintage-gold animate-pulse" />;
    } else {
      return <Lock className="w-6 h-6 text-vintage-gray" />;
    }
  };

  const getQuestionStyling = (index: number, status: string) => {
    const baseClasses = "w-16 h-16 rounded-full border-4 flex items-center justify-center font-bold text-lg transition-all duration-300 cursor-pointer relative";
    
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-vintage-green/20 border-vintage-green text-vintage-green hover:scale-110 shadow-lg`;
      case 'current':
        return `${baseClasses} bg-vintage-gold/20 border-vintage-gold text-vintage-gold hover:scale-110 shadow-xl animate-pulse`;
      case 'locked':
        return `${baseClasses} bg-vintage-gray/20 border-vintage-gray text-vintage-gray cursor-not-allowed opacity-60`;
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
    <div className="vintage-card rounded-lg p-6 relative overflow-hidden">
      {/* Map Header */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center space-x-4 mb-4">
          <Compass className="w-8 h-8 text-vintage-brown" />
          <h2 className="vintage-headline text-3xl font-playfair">Investigation Map</h2>
          <Scroll className="w-8 h-8 text-vintage-brown" />
        </div>
        <div className="flex items-center justify-center space-x-6 text-sm font-crimson">
          <span className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-vintage-green" />
            <span>Evidence Collected</span>
          </span>
          <span className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-vintage-gold" />
            <span>Current Location</span>
          </span>
          <span className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-vintage-gray" />
            <span>Unexplored Territory</span>
          </span>
        </div>
      </div>

      {/* Detective Info */}
      <div className="absolute top-6 right-6 vintage-card bg-vintage-cream/80 rounded-lg p-4 border-2 border-vintage-brown">
        <div className="text-center">
          <h3 className="font-playfair font-bold text-vintage-brown mb-2">Detective {teamName}</h3>
          <div className="text-2xl font-bold text-vintage-gold font-playfair">{teamScore} pts</div>
          <div className="text-sm text-vintage-gray font-crimson">Evidence Points</div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative bg-vintage-paper rounded-lg border-4 border-double border-vintage-brown p-8 min-h-[600px] overflow-hidden">
        {/* Vintage Map Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, var(--vintage-brown) 1px, transparent 1px),
              radial-gradient(circle at 70% 60%, var(--vintage-brown) 1px, transparent 1px),
              radial-gradient(circle at 40% 80%, var(--vintage-brown) 1px, transparent 1px),
              radial-gradient(circle at 90% 20%, var(--vintage-brown) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px, 150px 150px, 120px 120px, 80px 80px'
          }} />
        </div>

        {/* SVG Path Trail */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          <defs>
            <pattern id="pathPattern" patternUnits="userSpaceOnUse" width="20" height="20">
              <rect width="20" height="20" fill="none" />
              <rect width="10" height="10" fill="var(--vintage-brown)" opacity="0.3" />
              <rect x="10" y="10" width="10" height="10" fill="var(--vintage-brown)" opacity="0.3" />
            </pattern>
            <filter id="pathGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Completed path */}
          {currentQuestionIndex > 0 && (
            <path
              d={generateSVGPath()}
              stroke="var(--vintage-brown)"
              strokeWidth="8"
              fill="none"
              strokeDasharray="10,5"
              strokeLinecap="round"
              filter="url(#pathGlow)"
              opacity="0.6"
              strokeDashoffset="0"
              style={{
                strokeDasharray: `${currentQuestionIndex * 50}, ${(questions.length - currentQuestionIndex) * 50}`,
                animation: 'pathDraw 2s ease-in-out'
              }}
            />
          )}
          
          {/* Future path (faded) */}
          <path
            d={generateSVGPath()}
            stroke="var(--vintage-gray)"
            strokeWidth="4"
            fill="none"
            strokeDasharray="5,10"
            strokeLinecap="round"
            opacity="0.3"
          />
        </svg>

        {/* Question Nodes */}
        <div className="relative" style={{ zIndex: 2 }}>
          {questions.map((question, index) => {
            const coord = pathCoordinates[index];
            const status = getQuestionStatus(index);
            
            return (
              <div
                key={index}
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: coord.x, top: coord.y }}
              >
                {/* Question Node */}
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
                  {/* Question Number */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-playfair font-bold">{index + 1}</span>
                  </div>
                  
                  {/* Status Icon */}
                  <div className="absolute -top-2 -right-2">
                    {getQuestionIcon(index, status)}
                  </div>
                  
                  {/* Special Effects for Current Question */}
                  {status === 'current' && (
                    <>
                      <div className="absolute inset-0 rounded-full border-4 border-vintage-gold animate-ping opacity-75" />
                      <div className="absolute -inset-2 rounded-full border-2 border-vintage-gold animate-pulse" />
                    </>
                  )}
                </div>

                {/* Question Info Tooltip */}
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 vintage-card bg-vintage-cream rounded-lg p-3 border-2 border-vintage-brown shadow-lg min-w-[200px] opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <h4 className="font-playfair font-bold text-vintage-brown mb-1 text-sm">
                    Evidence #{index + 1}
                  </h4>
                  <p className="text-xs text-vintage-gray font-crimson mb-2">
                    {question.category}
                  </p>
                  <p className="text-xs text-vintage-black font-crimson">
                    {question.title}
                  </p>
                  <div className="text-xs text-vintage-gold font-playfair font-bold mt-1">
                    {question.points} points
                  </div>
                </div>

                {/* Location Labels for Key Points */}
                
              </div>
            );
          })}
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-4 left-4 opacity-30">
          <div className="w-16 h-16 border-4 border-vintage-brown rounded-full flex items-center justify-center">
            <Compass className="w-8 h-8 text-vintage-brown animate-spin" style={{ animationDuration: '10s' }} />
          </div>
        </div>

        <div className="absolute bottom-4 right-4 opacity-30">
          <div className="vintage-card bg-vintage-brown/20 rounded-lg p-2 border border-vintage-brown">
            <div className="text-xs font-crimson text-vintage-brown">
              Scale: 1 Evidence = 100 Yards
            </div>
          </div>
        </div>

        {/* Current Question Action Button */}
        {isQuizReady && currentQuestionIndex < questions.length && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <RippleButton
              onClick={onStartCurrentQuestion}
              className="vintage-btn bg-vintage-gold/20 border-vintage-gold text-vintage-gold hover:bg-vintage-gold/30 px-8 py-4 rounded-xl font-playfair font-bold text-lg transition-all duration-200 shadow-lg transform hover:scale-105 flex items-center space-x-3"
              rippleColor="rgba(212, 175, 55, 0.3)"
            >
              <MapPin className="w-6 h-6" />
              <span>Investigate Current Evidence</span>
            </RippleButton>
          </div>
        )}
      </div>

      {/* Map Legend */}
      <div className="mt-6 vintage-card bg-vintage-cream/50 rounded-lg p-4 border-2 border-vintage-brown">
        <h4 className="font-playfair font-bold text-vintage-brown mb-3 text-center">Investigation Progress Map</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-crimson">
          <div className="text-center">
            <div className="text-vintage-green font-bold text-lg font-playfair">{currentQuestionIndex}</div>
            <div className="text-vintage-gray">Evidence Collected</div>
          </div>
          <div className="text-center">
            <div className="text-vintage-gold font-bold text-lg font-playfair">{questions.length - currentQuestionIndex}</div>
            <div className="text-vintage-gray">Remaining Clues</div>
          </div>
          <div className="text-center">
            <div className="text-vintage-brown font-bold text-lg font-playfair">{Math.round((currentQuestionIndex / questions.length) * 100)}%</div>
            <div className="text-vintage-gray">Case Progress</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pathDraw {
          from {
            stroke-dashoffset: 1000;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default VintagePathMap;