import React, { useEffect, useRef } from 'react';

const VintageMapDots: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const mapDots: Array<{
      x: number;
      y: number;
      size: number;
      opacity: number;
      drift: number;
      driftSpeed: number;
    }> = [];

    // Create vintage map-style dots
    for (let i = 0; i < 80; i++) {
      mapDots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.6 + 0.2,
        drift: Math.random() * Math.PI * 2,
        driftSpeed: Math.random() * 0.02 + 0.01,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      mapDots.forEach((dot) => {
        // Update drift for subtle movement
        dot.drift += dot.driftSpeed;
        
        // Create vintage brown color with varying opacity
        const brown = `rgba(139, 69, 19, ${dot.opacity})`;
        
        // Draw main dot
        ctx.beginPath();
        ctx.arc(
          dot.x + Math.sin(dot.drift) * 2, 
          dot.y + Math.cos(dot.drift) * 2, 
          dot.size, 
          0, 
          Math.PI * 2
        );
        ctx.fillStyle = brown;
        ctx.fill();

        // Add vintage paper texture effect around larger dots
        if (dot.size > 2) {
          ctx.beginPath();
          ctx.arc(
            dot.x + Math.sin(dot.drift) * 2, 
            dot.y + Math.cos(dot.drift) * 2, 
            dot.size + 2, 
            0, 
            Math.PI * 2
          );
          ctx.strokeStyle = `rgba(139, 69, 19, ${dot.opacity * 0.3})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Slowly move dots to simulate old map aging
        dot.y += 0.1;
        if (dot.y > canvas.height + 10) {
          dot.y = -10;
          dot.x = Math.random() * canvas.width;
        }
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
      style={{ zIndex: 1 }}
    />
  );
};

export default VintageMapDots;