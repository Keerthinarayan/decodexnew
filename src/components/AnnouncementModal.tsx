import React, { useEffect, useState } from 'react';
import { X, AlertCircle, Info, CheckCircle, AlertTriangle, Volume2, Feather, Scroll } from 'lucide-react';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

interface AnnouncementModalProps {
  announcement: Announcement;
  onClose: () => void;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ announcement, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isUnfolding, setIsUnfolding] = useState(true);

  useEffect(() => {
    // Newspaper unfolding animation
    setTimeout(() => setIsVisible(true), 100);
    setTimeout(() => setIsUnfolding(false), 800);

    // Calculate time left if expires_at is set
    if (announcement.expires_at) {
      const updateTimeLeft = () => {
        const now = new Date().getTime();
        const expiresAt = new Date(announcement.expires_at!).getTime();
        const remaining = Math.max(0, expiresAt - now);
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          handleClose();
        }
      };

      updateTimeLeft();
      const interval = setInterval(updateTimeLeft, 1000);
      return () => clearInterval(interval);
    }
  }, [announcement.expires_at]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const getIcon = () => {
    switch (announcement.type) {
      case 'success':
        return <CheckCircle className="w-8 h-8 text-vintage-green" />;
      case 'warning':
        return <AlertTriangle className="w-8 h-8 text-vintage-gold" />;
      case 'urgent':
        return <AlertCircle className="w-8 h-8 text-vintage-red animate-pulse" />;
      default:
        return <Info className="w-8 h-8 text-vintage-blue" />;
    }
  };

  const getNewspaperStyles = () => {
    const baseStyles = "newspaper-column backdrop-blur-sm";
    switch (announcement.type) {
      case 'success':
        return `${baseStyles} bg-vintage-cream border-vintage-green`;
      case 'warning':
        return `${baseStyles} bg-vintage-cream border-vintage-gold`;
      case 'urgent':
        return `${baseStyles} bg-vintage-cream border-vintage-red shadow-2xl`;
      default:
        return `${baseStyles} bg-vintage-cream border-vintage-blue`;
    }
  };

  const getAnnouncementCategory = () => {
    switch (announcement.type) {
      case 'success':
        return 'OFFICIAL COMMENDATION';
      case 'warning':
        return 'IMPORTANT NOTICE';
      case 'urgent':
        return 'URGENT BULLETIN';
      default:
        return 'GENERAL NOTICE';
    }
  };

  const formatTimeLeft = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getCurrentDate = () => {
    const date = new Date(announcement.created_at);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className={`
      fixed inset-0 z-50 flex items-center justify-center p-4
      bg-black/60 backdrop-blur-sm
      transition-all duration-500 ease-out
      ${isVisible ? 'opacity-100' : 'opacity-0'}
    `}>
      {/* Sound effect for urgent announcements */}
      {announcement.type === 'urgent' && (
        <div className="absolute top-4 left-4 animate-bounce">
          <Volume2 className="w-8 h-8 text-vintage-red" />
        </div>
      )}

      {/* Newspaper */}
      <div className={`
        max-w-2xl w-full rounded-lg shadow-2xl
        transform transition-all duration-800 ease-out
        ${getNewspaperStyles()}
        ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
        ${isUnfolding ? 'rotate-1 scale-95' : 'rotate-0 scale-100'}
        ${announcement.type === 'urgent' ? 'animate-pulse' : ''}
        paper-flutter
      `}>
        
        {/* Newspaper Header */}
        <div className="border-b-4 border-double border-vintage-brown p-6">
          <div className="flex items-center justify-between mb-4">
            {/* Masthead */}
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <Feather className="w-6 h-6 text-vintage-brown" />
                <h1 className="font-playfair text-2xl font-black text-vintage-black tracking-wider">
                  THE SIGNAL GAZETTE
                </h1>
                <Feather className="w-6 h-6 text-vintage-brown" />
              </div>
              <div className="flex items-center space-x-4 text-xs text-vintage-brown font-crimson">
                <span>SPECIAL EDITION</span>
                <span>•</span>
                <span>{getCurrentDate()}</span>
                <span>•</span>
                <span>PRICE: ONE SHILLING</span>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="vintage-btn p-2 rounded-lg transition-colors duration-200 ml-4"
              title="Close Notice"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Category Banner */}
          <div className="text-center">
            <div className={`inline-block px-6 py-2 rounded border-2 ${
              announcement.type === 'urgent' ? 'border-vintage-red bg-vintage-red/20' :
              announcement.type === 'warning' ? 'border-vintage-gold bg-vintage-gold/20' :
              announcement.type === 'success' ? 'border-vintage-green bg-vintage-green/20' :
              'border-vintage-blue bg-vintage-blue/20'
            }`}>
              <span className="font-playfair font-bold text-sm tracking-widest">
                {getAnnouncementCategory()}
              </span>
            </div>
          </div>
        </div>

        {/* Main Article */}
        <div className="p-6">
          {/* Headline */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-4 mb-4">
              {getIcon()}
              <div className="flex-1">
                <h2 className="vintage-headline text-3xl font-playfair text-vintage-black leading-tight">
                  {announcement.title}
                </h2>
                <div className="w-32 h-1 bg-vintage-brown mx-auto mt-2"></div>
              </div>
            </div>
          </div>

          {/* Article Body */}
          <div className="newspaper-column rounded-lg p-6 mb-6">
            <div className="border-4 border-double border-vintage-brown p-4 rounded-lg bg-vintage-cream">
              {/* Article Header */}
              <div className="border-b-2 border-vintage-brown pb-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Scroll className="w-5 h-5 text-vintage-brown" />
                    <span className="font-playfair font-bold text-vintage-brown">
                      FROM OUR CORRESPONDENT
                    </span>
                  </div>
                  <span className="text-xs text-vintage-gray font-crimson italic">
                    Scotland Yard • London
                  </span>
                </div>
              </div>

              {/* Article Content */}
              <div className="prose prose-vintage max-w-none">
                <p className="text-vintage-black text-lg leading-relaxed font-crimson whitespace-pre-wrap first-letter:text-4xl first-letter:font-playfair first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1">
                  {announcement.message}
                </p>
              </div>

              {/* Article Footer */}
              <div className="mt-6 pt-4 border-t-2 border-vintage-brown">
                <div className="flex items-center justify-between text-xs text-vintage-gray font-crimson">
                  <span>Published by Authority of Scotland Yard</span>
                  <span>Distributed Throughout the Empire</span>
                </div>
              </div>
            </div>
          </div>

          {/* Time Remaining Notice */}
          {timeLeft !== null && timeLeft > 0 && (
            <div className="vintage-card rounded-lg p-4 mb-4">
              <div className="border-2 border-vintage-brown rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-playfair font-bold text-vintage-brown">NOTICE EXPIRES:</span>
                  <span className="font-playfair font-bold text-vintage-red">
                    {formatTimeLeft(timeLeft)}
                  </span>
                </div>
                <div className="vintage-progress">
                  <div
                    className="vintage-progress-fill transition-all duration-1000"
                    style={{
                      width: announcement.expires_at 
                        ? `${(timeLeft / (new Date(announcement.expires_at).getTime() - new Date(announcement.created_at).getTime())) * 100}%`
                        : '100%'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="text-center">
            <button
              onClick={handleClose}
              className={`vintage-btn px-8 py-3 rounded-lg font-crimson font-semibold transition-all duration-200 ${
                announcement.type === 'urgent' 
                  ? 'bg-vintage-red/20 border-vintage-red text-vintage-red hover:bg-vintage-red/30' 
                  : 'hover:scale-105'
              }`}
            >
              {announcement.type === 'urgent' ? 'Acknowledged' : 'Understood'}
            </button>
          </div>
        </div>

        {/* Newspaper Footer */}
        <div className="border-t-4 border-double border-vintage-brown p-4 text-center">
          <div className="flex items-center justify-center space-x-6 text-xs text-vintage-brown font-crimson">
            <span>PRINTED BY ROYAL APPOINTMENT</span>
            <span>•</span>
            <span>LONDON PRESS</span>
            <span>•</span>
            <span>EST. 1843</span>
          </div>
          <div className="mt-1 text-xs text-vintage-gray font-crimson italic">
            "All the News That's Fit to Decode"
          </div>
        </div>

        {/* Special Effects for Urgent */}
        {announcement.type === 'urgent' && (
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 rounded-lg border-4 border-vintage-red animate-ping opacity-75" />
              <div className="absolute -inset-1 rounded-lg border-2 border-vintage-red animate-pulse" />
            </div>
            
            {/* Urgent Stamp */}
            <div className="absolute top-4 right-4 transform rotate-12">
              <div className="vintage-badge bg-vintage-red text-vintage-cream px-4 py-2 rounded border-4 border-vintage-red font-playfair font-bold text-lg shadow-lg">
                URGENT
              </div>
            </div>
          </>
        )}

        {/* Newspaper Fold Lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-0 right-0 h-px bg-vintage-brown/20"></div>
          <div className="absolute top-2/3 left-0 right-0 h-px bg-vintage-brown/20"></div>
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-vintage-brown/20"></div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;