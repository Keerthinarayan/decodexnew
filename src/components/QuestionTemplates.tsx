import React, { useState } from 'react';
import { Plus, FileText, Image, Video, Volume2, Upload, X } from 'lucide-react';

interface QuestionTemplate {
  id: string;
  name: string;
  description: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  category: string;
  template: {
    question: string;
    hint: string;
    points: number;
    explanation: string;
  };
}

interface QuestionTemplatesProps {
  onSelectTemplate: (template: QuestionTemplate) => void;
  onClose: () => void;
}

const QuestionTemplates: React.FC<QuestionTemplatesProps> = ({ onSelectTemplate, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const templates: QuestionTemplate[] = [
    {
      id: 'signal-frequency',
      name: 'Signal Frequency Analysis',
      description: 'Calculate frequency from period or wavelength',
      type: 'text',
      category: 'Signal Processing',
      template: {
        question: 'A signal has a period of [X] seconds. What is its frequency in Hz?',
        hint: 'Remember: Frequency = 1/Period',
        points: 100,
        explanation: 'The frequency of a signal is the reciprocal of its period: f = 1/T'
      }
    },
    {
      id: 'fourier-transform',
      name: 'Fourier Transform',
      description: 'Questions about frequency domain analysis',
      type: 'text',
      category: 'Signal Processing',
      template: {
        question: 'What is the Fourier Transform of [signal description]?',
        hint: 'Consider the properties of the Fourier Transform',
        points: 150,
        explanation: 'The Fourier Transform converts signals from time domain to frequency domain'
      }
    },
    {
      id: 'image-analysis',
      name: 'Image Signal Analysis',
      description: 'Analyze signals or patterns in images',
      type: 'image',
      category: 'Image Processing',
      template: {
        question: 'Analyze the signal pattern shown in the image. What is the [specific parameter]?',
        hint: 'Look for repeating patterns or specific features',
        points: 200,
        explanation: 'Image analysis requires identifying key features and patterns'
      }
    },
    {
      id: 'audio-spectrum',
      name: 'Audio Spectrum Analysis',
      description: 'Analyze frequency content of audio signals',
      type: 'audio',
      category: 'Audio Processing',
      template: {
        question: 'Listen to the audio signal and identify the dominant frequency component.',
        hint: 'Focus on the strongest frequency peak',
        points: 150,
        explanation: 'Audio spectrum analysis reveals frequency components of sound signals'
      }
    },
    {
      id: 'video-motion',
      name: 'Video Motion Analysis',
      description: 'Analyze motion or temporal changes in video',
      type: 'video',
      category: 'Video Processing',
      template: {
        question: 'Analyze the video and determine the [motion parameter or change].',
        hint: 'Observe changes over time',
        points: 250,
        explanation: 'Video analysis involves tracking changes across temporal frames'
      }
    },
    {
      id: 'filter-design',
      name: 'Filter Design',
      description: 'Questions about digital filter characteristics',
      type: 'text',
      category: 'Filter Design',
      template: {
        question: 'Design a [filter type] with cutoff frequency [X] Hz. What is the [parameter]?',
        hint: 'Consider the filter specifications and requirements',
        points: 200,
        explanation: 'Filter design involves meeting specific frequency response requirements'
      }
    },
    {
      id: 'modulation',
      name: 'Signal Modulation',
      description: 'AM, FM, and digital modulation techniques',
      type: 'text',
      category: 'Communications',
      template: {
        question: 'A [modulation type] signal has [parameters]. Calculate the [output parameter].',
        hint: 'Use the appropriate modulation formula',
        points: 150,
        explanation: 'Modulation techniques encode information onto carrier signals'
      }
    },
    {
      id: 'sampling',
      name: 'Sampling Theory',
      description: 'Nyquist theorem and sampling rate questions',
      type: 'text',
      category: 'Digital Signal Processing',
      template: {
        question: 'A signal with maximum frequency [X] Hz needs to be sampled. What is the minimum sampling rate?',
        hint: 'Apply the Nyquist sampling theorem',
        points: 100,
        explanation: 'The Nyquist theorem states that sampling rate must be at least twice the maximum frequency'
      }
    },
    {
      id: 'document-analysis',
      name: 'Technical Document Analysis',
      description: 'Analyze specifications or research papers',
      type: 'file',
      category: 'Research',
      template: {
        question: 'Based on the provided document, what is the [specific technical detail]?',
        hint: 'Look for key technical specifications or results',
        points: 200,
        explanation: 'Document analysis requires extracting relevant technical information'
      }
    }
  ];

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Volume2 className="w-5 h-5" />;
      case 'file': return <Upload className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'video': return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
      case 'audio': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'file': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      default: return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900/90 border border-blue-400/30 rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Question Templates</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                {category === 'all' ? 'All Categories' : category}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <div
              key={template.id}
              className="bg-gray-800/50 border border-gray-600/30 rounded-lg p-6 hover:border-blue-400/50 transition-all duration-200 cursor-pointer group"
              onClick={() => onSelectTemplate(template)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-lg border ${getTypeColor(template.type)}`}>
                  {getTypeIcon(template.type)}
                </div>
                <span className="text-xs bg-gray-700/50 text-gray-300 px-2 py-1 rounded">
                  {template.category}
                </span>
              </div>
              
              <h4 className="text-white font-semibold mb-2 group-hover:text-blue-300 transition-colors duration-200">
                {template.name}
              </h4>
              
              <p className="text-gray-400 text-sm mb-4">
                {template.description}
              </p>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span className="text-gray-300 capitalize">{template.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Points:</span>
                  <span className="text-gray-300">{template.template.points}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-600/30">
                <div className="flex items-center justify-center space-x-2 text-blue-400 group-hover:text-blue-300 transition-colors duration-200">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Use Template</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No templates found for this category</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionTemplates;