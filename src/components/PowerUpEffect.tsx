import React, { useEffect, useState } from 'react';
import { Zap, Eye, SkipForward, Star } from 'lucide-react';

interface PowerUpEffectProps {
  type: 'brainBoost' | 'hint' | 'skip';
  isActive: boolean;
  onComplete?: () => void;
}

const PowerUpEffect: React.FC<PowerUpEffectProps> = ({ type, isActive, onComplete }) => {
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    if (isActive) {
      setShowEffect(true);
      const timer = setTimeout(() => {
        setShowEffect(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isActive, onComplete]);

  if (!showEffect) return null;

  const getEffectConfig = () => {
    switch (type) {
      case 'brainBoost':
        return {
          icon: <Zap className="w-12 h-12" />,
          color: 'from-purple-500 to-pink-500',
          title: 'Brain Boost Activated!',
          subtitle: 'Next answer worth double points',
          particles: Array.from({ length: 20 }, (_, i) => ({
            id: i,
            delay: i * 0.1,
            color: 'bg-purple-400'
          }))
        };
      case 'hint':
        return {
          icon: <Eye className="w-12 h-12" />,
          color: 'from-cyan-500 to-blue-500',
          title: 'Cosmic Hint Revealed!',
          subtitle: 'Check below for guidance',
          particles: Array.from({ length: 15 }, (_, i) => ({
            id: i,
            delay: i * 0.15,
            color: 'bg-cyan-400'
          }))
        };
      case 'skip':
        return {
          icon: <SkipForward className="w-12 h-12" />,
          color: 'from-green-500 to-emerald-500',
          title: 'Question Skipped!',
          subtitle: 'Moving to next challenge',
          particles: Array.from({ length: 12 }, (_, i) => ({
            id: i,
            delay: i * 0.2,
            color: 'bg-green-400'
          }))
        };
    }
  };

  const config = getEffectConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-pulse" />
      
      {/* Main Effect */}
      <div className="relative z-10 text-center">
        {/* Icon with glow effect */}
        <div className={`
          w-24 h-24 mx-auto mb-6 rounded-full 
          bg-gradient-to-r ${config.color} 
          flex items-center justify-center
          animate-bounce shadow-2xl
        `}>
          <div className="text-white animate-pulse">
            {config.icon}
          </div>
        </div>
        
        {/* Text */}
        <h2 className="text-4xl font-bold text-white mb-2 animate-pulse">
          {config.title}
        </h2>
        <p className="text-xl text-gray-300 animate-fade-in">
          {config.subtitle}
        </p>
        
        {/* Particle Effects */}
        <div className="absolute inset-0 pointer-events-none">
          {config.particles.map((particle) => (
            <div
              key={particle.id}
              className={`
                absolute w-2 h-2 ${particle.color} rounded-full
                animate-ping opacity-75
              `}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${particle.delay}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
        
        {/* Ripple Effect */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`
            w-32 h-32 rounded-full border-4 border-white/30
            animate-ping
          `} />
          <div className={`
            absolute w-48 h-48 rounded-full border-2 border-white/20
            animate-ping
          `} style={{ animationDelay: '0.5s' }} />
        </div>
      </div>
    </div>
  );
};

export default PowerUpEffect;