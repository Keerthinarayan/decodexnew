import React, { useState } from 'react';

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  rippleColor?: string;
}

const RippleButton: React.FC<RippleButtonProps> = ({ 
  children, 
  className = '', 
  rippleColor = 'rgba(139, 69, 19, 0.6)',
  onClick,
  ...props 
}) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newRipple = {
      id: Date.now(),
      x,
      y
    };
    
    setRipples(prev => [...prev, newRipple]);
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      {...props}
      className={`relative overflow-hidden ink-effect ${className}`}
      onClick={handleClick}
    >
      {children}
      
      {/* Ripple effects */}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none animate-ping"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
            backgroundColor: rippleColor,
            animationDuration: '0.6s',
            animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)'
          }}
        />
      ))}
    </button>
  );
};

export default RippleButton;