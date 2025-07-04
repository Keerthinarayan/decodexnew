import React, { useEffect, useState } from 'react';
import { ChevronRight, Star, Trophy } from 'lucide-react';

interface QuestionTransitionProps {
  isVisible: boolean;
  currentQuestion: number;
  totalQuestions: number;
  score: number;
  onComplete: () => void;
}

const QuestionTransition: React.FC<QuestionTransitionProps> = ({
  isVisible,
  currentQuestion,
  totalQuestions,
  score,
  onComplete
}) => {
  const [stage, setStage] = useState<'entering' | 'showing' | 'exiting'>('entering');

  useEffect(() => {
    if (isVisible) {
      setStage('entering');
      
      const showTimer = setTimeout(() => {
        setStage('showing');
      }, 500);
      
      const exitTimer = setTimeout(() => {
        setStage('exiting');
      }, 2000);
      
      const completeTimer = setTimeout(() => {
        onComplete();
      }, 2500);
      
      return () => {
        clearTimeout(showTimer);
        clearTimeout(exitTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className={`
      fixed inset-0 z-50 flex items-center justify-center
      bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-black/90
      backdrop-blur-sm transition-all duration-500
      ${stage === 'entering' ? 'opacity-0 scale-95' : ''}
      ${stage === 'showing' ? 'opacity-100 scale-100' : ''}
      ${stage === 'exiting' ? 'opacity-0 scale-105' : ''}
    `}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 50 }, (_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        {/* Progress Circle */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="url(#gradient)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(currentQuestion / totalQuestions) * 314} 314`}
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Question Number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">
                {currentQuestion}
              </div>
              <div className="text-sm text-gray-300">
                of {totalQuestions}
              </div>
            </div>
          </div>
        </div>
        
        {/* Title */}
        <h2 className="text-3xl font-bold text-white mb-4 animate-pulse">
          Next Signal Incoming
        </h2>
        
        {/* Score Display */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <span className="text-gray-300">Current Score</span>
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            {score.toLocaleString()} points
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-700/50 rounded-full h-2 mb-6">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${(currentQuestion / totalQuestions) * 100}%` }}
          />
        </div>
        
        {/* Loading Animation */}
        <div className="flex items-center justify-center space-x-2 text-gray-300">
          <span>Preparing signal</span>
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionTransition;