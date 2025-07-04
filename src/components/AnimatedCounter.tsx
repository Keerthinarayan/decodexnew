import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1000,
  className = '',
  prefix = '',
  suffix = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value === displayValue) return;

    setIsAnimating(true);
    const startValue = displayValue;
    const difference = value - startValue;
    const startTime = Date.now();

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (difference * easeOutCubic));

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration, displayValue]);

  return (
    <span 
      className={`${className} ${isAnimating ? 'text-green-400 scale-110' : ''} transition-all duration-300`}
    >
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
};

export default AnimatedCounter;