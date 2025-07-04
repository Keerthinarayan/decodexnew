import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X, Zap, Star, Eye, SkipForward } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'powerup';
  title: string;
  message: string;
  duration?: number;
  powerUpType?: 'brainBoost' | 'hint' | 'skip';
}

interface ToastNotificationProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);

    const timer = setTimeout(() => {
      handleRemove();
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-vintage-green" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-vintage-red" />;
      case 'info':
        return <Info className="w-5 h-5 text-vintage-blue" />;
      case 'powerup':
        switch (toast.powerUpType) {
          case 'brainBoost':
            return <Zap className="w-5 h-5 text-vintage-gold" />;
          case 'hint':
            return <Eye className="w-5 h-5 text-vintage-blue" />;
          case 'skip':
            return <SkipForward className="w-5 h-5 text-vintage-green" />;
          default:
            return <Star className="w-5 h-5 text-vintage-gold" />;
        }
      default:
        return <Info className="w-5 h-5 text-vintage-blue" />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'vintage-toast-success';
      case 'error':
        return 'vintage-toast-error';
      case 'info':
        return 'vintage-toast-info';
      case 'powerup':
        return 'vintage-powerup';
      default:
        return 'vintage-toast';
    }
  };

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 max-w-sm w-full p-4 rounded-lg shadow-lg
        transform transition-all duration-300 ease-out vintage-toast
        ${getStyles()}
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-vintage-black font-semibold text-sm font-playfair">{toast.title}</h4>
          <p className="text-vintage-gray text-sm mt-1 font-crimson">{toast.message}</p>
        </div>
        <button
          onClick={handleRemove}
          className="flex-shrink-0 text-vintage-gray hover:text-vintage-black transition-colors duration-200"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-vintage-brown/20 rounded-b-lg overflow-hidden">
        <div
          className="vintage-progress-fill rounded-b-lg"
          style={{
            animation: `shrink ${toast.duration || 5000}ms linear forwards`
          }}
        />
      </div>
    </div>
  );
};

export default ToastNotification;