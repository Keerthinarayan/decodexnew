import React from 'react';
import { Eye, X, Play, Download } from 'lucide-react';

interface QuestionPreviewProps {
  question: {
    question: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'file';
    mediaUrl?: string;
    correctAnswer: string;
    hint?: string;
    points: number;
    category: string;
    explanation?: string;
  };
  onClose: () => void;
}

const QuestionPreview: React.FC<QuestionPreviewProps> = ({ question, onClose }) => {
  const renderMedia = () => {
    if (!question.mediaUrl) return null;

    switch (question.type) {
      case 'image':
        return (
          <div className="mb-6">
            <img 
              src={question.mediaUrl} 
              alt="Question Image" 
              className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600 max-h-96 object-contain mx-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling!.style.display = 'block';
              }}
            />
            <div className="hidden bg-red-900/50 border border-red-500 rounded-lg p-4 text-center">
              <p className="text-red-300">Failed to load image</p>
            </div>
          </div>
        );
      
      case 'video':
        return (
          <div className="mb-6">
            <video 
              controls 
              className="max-w-full h-auto rounded-lg shadow-lg border border-gray-600 max-h-96"
              src={question.mediaUrl}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );
      
      case 'audio':
        return (
          <div className="mb-6">
            <audio 
              controls 
              className="w-full"
              src={question.mediaUrl}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        );
      
      case 'file':
        return (
          <div className="mb-6 bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-semibold mb-2">Document Required</h4>
                <p className="text-gray-300 text-sm">File analysis question</p>
              </div>
              <a
                href={question.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
              >
                <Download className="w-4 h-4" />
                <span>View File</span>
              </a>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900/90 border border-blue-400/30 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Eye className="w-6 h-6 text-blue-400" />
            <h3 className="text-2xl font-bold text-white">Question Preview</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Question Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Preview Question</h2>
            <div className="flex items-center space-x-3">
              <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-lg text-sm border border-blue-400/30">
                {question.category}
              </span>
              <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-lg text-sm border border-green-400/30">
                {question.points} points
              </span>
            </div>
          </div>
          <p className="text-gray-300 text-lg leading-relaxed">{question.question}</p>
        </div>

        {/* Media Content */}
        {renderMedia()}

        {/* Hint */}
        {question.hint && (
          <div className="mb-6 p-4 bg-blue-900/30 border border-blue-500/30 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Eye className="w-5 h-5 text-blue-400" />
              <span className="text-blue-400 font-medium">Hint Available</span>
            </div>
            <p className="text-gray-300">{question.hint}</p>
          </div>
        )}

        {/* Answer Section (Admin Preview) */}
        <div className="bg-gray-800/50 rounded-lg p-6 mb-6">
          <h4 className="text-white font-semibold mb-4 flex items-center space-x-2">
            <span>🔒</span>
            <span>Admin Information (Hidden from Players)</span>
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-1">Expected Answer:</label>
              <div className="bg-gray-700/50 rounded p-3 text-green-300 font-mono">
                {question.correctAnswer}
              </div>
            </div>
            
            {question.explanation && (
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">Explanation:</label>
                <div className="bg-gray-700/50 rounded p-3 text-gray-300">
                  {question.explanation}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Note */}
        <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-300 text-sm">
            <strong>Preview Mode:</strong> This is how the question will appear to players. 
            The answer and explanation sections are only visible to administrators.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuestionPreview;