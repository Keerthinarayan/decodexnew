import React from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, Move } from 'lucide-react';

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'audio' | 'file';
  title?: string;
}

const MediaModal: React.FC<MediaModalProps> = ({ 
  isOpen, 
  onClose, 
  mediaUrl, 
  mediaType, 
  title 
}) => {
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleRotate = () => setRotation(prev => prev + 90);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (mediaType === 'image') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && mediaType === 'image') {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const renderContent = () => {
    switch (mediaType) {
      case 'image':
        return (
          <div className="relative flex items-center justify-center h-full overflow-hidden">
            <img
              src={mediaUrl}
              alt={title || 'Media content'}
              className="max-w-none transition-transform duration-200 cursor-move"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
                userSelect: 'none'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              draggable={false}
            />
          </div>
        );
      
      case 'video':
        return (
          <video
            src={mediaUrl}
            controls
            className="max-w-full max-h-full"
            style={{ width: 'auto', height: 'auto' }}
          >
            Your browser does not support the video tag.
          </video>
        );
      
      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center space-y-6 p-8">
            <div className="w-full max-w-md">
              <audio
                src={mediaUrl}
                controls
                className="w-full"
              >
                Your browser does not support the audio element.
              </audio>
            </div>
            
            {/* Audio Waveform Visualization */}
            <div className="w-full max-w-md">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-end justify-center space-x-1 h-20">
                  {Array.from({ length: 50 }, (_, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-t from-blue-500 to-cyan-400 rounded-sm animate-pulse"
                      style={{
                        width: '3px',
                        height: `${Math.random() * 60 + 10}px`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: `${1 + Math.random()}s`
                      }}
                    />
                  ))}
                </div>
                <div className="text-center text-gray-400 text-sm mt-2">
                  Audio Waveform Visualization
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'file':
        return (
          <div className="flex flex-col items-center justify-center space-y-6 p-8">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold mb-2">Document Preview</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Click the buttons below to view or download the document
                </p>
                <div className="flex space-x-3">
                  <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                  >
                    <ZoomIn className="w-4 h-4" />
                    <span>View</span>
                  </a>
                  <a
                    href={mediaUrl}
                    download
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
        <div className="text-white font-semibold">
          {title || 'Media Viewer'}
        </div>
        
        {/* Controls */}
        {mediaType === 'image' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-white text-sm px-2">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleRotate}
              className="p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
              title="Rotate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
              title="Reset"
            >
              <Move className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="p-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="w-full h-full mt-16 mb-4">
        {renderContent()}
      </div>

      {/* Download Button */}
      <div className="absolute bottom-4 right-4">
        <a
          href={mediaUrl}
          download
          className="flex items-center space-x-2 bg-blue-600/80 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </a>
      </div>
    </div>
  );
};

export default MediaModal;