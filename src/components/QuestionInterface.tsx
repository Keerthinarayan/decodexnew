import React, { useState, useEffect } from 'react';
import { Download, Zap, Eye, SkipForward, Send, AlertCircle, ArrowLeft, CheckCircle, ZoomIn, Play, Volume2, FileText, Scroll, Brain, Trophy, Clock, Star, FastForward } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { Question, QuestionChoice } from '../types/game';
import { useToast } from '../hooks/useToast';
import MediaModal from './MediaModal';
import RippleButton from './RippleButton';
import PowerUpEffect from './PowerUpEffect';
import QuestionTransition from './QuestionTransition';
import { supabase } from '../lib/supabase';

interface QuestionInterfaceProps {
  teamName: string;
  onBackToMap: () => void;
}

const QuestionInterface: React.FC<QuestionInterfaceProps> = ({ 
  teamName, 
  onBackToMap 
}) => {
  const { teams, submitAnswer, usePowerUp, questions } = useGame();
  const { showSuccess, showError, showPowerUp } = useToast();
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [activePowerUp, setActivePowerUp] = useState<'brainBoost' | 'hint' | 'skip' | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [showChoices, setShowChoices] = useState(false);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [branchChoices, setBranchChoices] = useState<QuestionChoice[]>([]);

  const team = teams.find(t => t.name === teamName);
  
  if (!team) return null;

  // Load current question securely using the enhanced function
  useEffect(() => {
    const loadCurrentQuestion = async () => {
      try {
        console.log('Loading question for team:', teamName);
        
        const { data, error } = await supabase.rpc('get_next_question_for_team', {
          p_team_name: teamName
        });

        if (error) {
          console.error('Error loading question:', error);
          return;
        }

        console.log('Question data received:', data);

        if (data && data.length > 0) {
          const questionData = data[0];
          setCurrentQuestion({
            id: questionData.id,
            title: questionData.title,
            question: questionData.question,
            answer: '',
            hint: questionData.hint,
            type: questionData.type,
            mediaUrl: questionData.media_url,
            points: questionData.points,
            category: questionData.category,
            explanation: '',
            isActive: questionData.is_active,
            isBranchPoint: questionData.is_branch_point,
            branchChoices: questionData.branch_choices || [],
            difficultyLevel: questionData.difficulty_level,
            isChoiceQuestion: questionData.is_choice_question,
            choiceType: questionData.choice_type
          });
        } else {
          console.log('No question data received');
          setCurrentQuestion(null);
        }
      } catch (error) {
        console.error('Error loading question:', error);
      }
    };

    loadCurrentQuestion();
  }, [teamName, team.currentQuestion, team.currentQuestionId]);

  // Reset states when question changes
  useEffect(() => {
    setAnswer('');
    setError('');
    setSuccess('');
    setIsCorrect(false);
    setShowHint(false);
    setIsSubmitting(false);
    setShowMediaModal(false);
    setActivePowerUp(null);
    setShowTransition(false);
    setShowChoices(false);
    setAnswerResult(null);
    setBranchChoices([]);
  }, [currentQuestion?.id]);

  const handleTransitionComplete = () => {
    setShowTransition(false);
    onBackToMap();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) {
      setError('Please provide your deduction');
      showError('Evidence Required', 'Please provide your deduction before submitting.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');
    
    const result = await submitAnswer(teamName, answer.trim());
    setAnswerResult(result);
    
    if (result.success) {
      setIsCorrect(true);
      let successMessage = `Correct deduction! You earned ${result.points_earned} evidence points!`;
      
      if (result.bonus_points > 0) {
        successMessage += ` Plus ${result.bonus_points} bonus points for completion rank #${result.completion_rank}!`;
      }
      
      setSuccess(successMessage);
      showSuccess('Brilliant Deduction!', successMessage);
      
      // Check if this question has choices after answering
      if (result.has_choices && result.branch_choices && result.branch_choices.length > 0) {
        console.log('Setting up branch choices:', result.branch_choices);
        setBranchChoices(result.branch_choices);
        setTimeout(() => {
          setShowChoices(true);
        }, 2000);
      } else if (result.is_complete) {
        setTimeout(() => {
          setShowTransition(true);
        }, 3000);
      } else {
        setTimeout(() => {
          setShowTransition(true);
        }, 2000);
      }
    } else {
      setError('Incorrect deduction. Review the evidence and try again.');
      showError('Incorrect Deduction', 'That\'s not quite right. Examine the evidence more carefully.');
    }
    
    setIsSubmitting(false);
  };

  const handleChoiceSelection = async (choice: QuestionChoice) => {
    try {
      console.log('Selecting choice:', choice);
      console.log('Choice difficulty:', choice.difficulty);
      
      // Call the backend function directly with the difficulty
      const { data, error } = await supabase.rpc('select_question_choice', {
        p_team_name: teamName,
        p_choice_difficulty: choice.difficulty
      });
      
      console.log('Choice selection response:', { data, error });
      
      if (error) {
        console.error('Choice selection error:', error);
        showError('Selection Error', 'An error occurred while selecting your path: ' + error.message);
        return;
      }

      if (data) {
        showSuccess('Path Selected', `You chose the ${choice.title}! Proceeding to your selected challenge.`);
        setShowChoices(false);
        setTimeout(() => {
          setShowTransition(true);
        }, 1500);
      } else {
        showError('Selection Failed', 'Failed to select question path. Please try again.');
      }
    } catch (error) {
      console.error('Choice selection error:', error);
      showError('Selection Error', 'An error occurred while selecting your path.');
    }
  };

  const handlePowerUp = async (type: 'doublePoints' | 'hint' | 'skip' | 'brainBoost') => {
    const success = await usePowerUp(teamName, type);
    if (success) {
      setActivePowerUp(type as any);
      
      if (type === 'hint') {
        setShowHint(true);
        showPowerUp('Magnifying Glass Activated!', 'A helpful clue has been revealed below.', 'hint');
      } else if (type === 'skip') {
        setSuccess('Clue skipped! Moving to next evidence...');
        showPowerUp('Evidence Skipped!', 'Proceeding to the next clue.', 'skip');
        setTimeout(() => {
          setShowTransition(true);
        }, 1500);
      } else if (type === 'brainBoost') {
        setSuccess('Mind Palace activated! Next correct deduction will earn double points!');
        showPowerUp('Mind Palace Activated!', 'Your next correct deduction will earn double points!', 'brainBoost');
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      }
    } else {
      showError('Investigation Tool Unavailable', 'You don\'t have any of this investigation tool remaining.');
    }
  };

  const getChoiceIcon = (iconName: string) => {
    switch (iconName) {
      case 'zap': return <Zap className="w-6 h-6" />;
      case 'fast-forward': return <FastForward className="w-6 h-6" />;
      case 'star': return <Star className="w-6 h-6" />;
      case 'clock': return <Clock className="w-6 h-6" />;
      default: return <Trophy className="w-6 h-6" />;
    }
  };

  const getChoiceColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-vintage-green/20 border-vintage-green text-vintage-green hover:bg-vintage-green/30';
      case 'normal': return 'bg-vintage-blue/20 border-vintage-blue text-vintage-blue hover:bg-vintage-blue/30';
      case 'hard': return 'bg-vintage-red/20 border-vintage-red text-vintage-red hover:bg-vintage-red/30';
      case 'expert': return 'bg-vintage-gold/20 border-vintage-gold text-vintage-gold hover:bg-vintage-gold/30';
      default: return 'bg-vintage-brown/20 border-vintage-brown text-vintage-brown hover:bg-vintage-brown/30';
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image': return <ZoomIn className="w-4 h-4" />;
      case 'video': return <Play className="w-4 h-4" />;
      case 'audio': return <Volume2 className="w-4 h-4" />;
      case 'file': return <FileText className="w-4 h-4" />;
      default: return <Download className="w-4 h-4" />;
    }
  };

  const renderMediaPreview = () => {
    if (!currentQuestion?.mediaUrl) return null;

    const commonClasses = "vintage-card rounded-lg p-4 mb-6";

    switch (currentQuestion.type) {
      case 'image':
        return (
          <div className={commonClasses}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-vintage-brown font-medium font-playfair">Photographic Evidence Required</span>
              <div className="flex space-x-2">
                <RippleButton
                  onClick={() => setShowMediaModal(true)}
                  className="vintage-btn flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors duration-200 text-sm font-crimson"
                >
                  <ZoomIn className="w-4 h-4" />
                  <span>Examine</span>
                </RippleButton>
                <a
                  href={currentQuestion.mediaUrl}
                  download
                  className="vintage-btn flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors duration-200 text-sm font-crimson"
                >
                  <Download className="w-4 h-4" />
                  <span>Preserve</span>
                </a>
              </div>
            </div>
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity duration-200"
              onClick={() => setShowMediaModal(true)}
            >
              <img 
                src={currentQuestion.mediaUrl} 
                alt="Evidence Photograph" 
                className="max-w-full h-auto rounded-lg shadow-lg border-2 border-vintage-brown max-h-96 object-contain mx-auto"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling!.style.display = 'block';
                }}
              />
              <div className="hidden vintage-error rounded-lg p-4 text-center">
                <p className="font-crimson">Failed to load photographic evidence. Please check the source.</p>
                <a href={currentQuestion.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-vintage-red underline font-crimson">
                  {currentQuestion.mediaUrl}
                </a>
              </div>
            </div>
            <div className="text-center mt-2">
              <span className="text-vintage-gray text-sm font-crimson italic">Click photograph to examine closely</span>
            </div>
          </div>
        );
      
      case 'video':
        return (
          <div className={commonClasses}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-vintage-brown font-medium font-playfair">Moving Picture Evidence Required</span>
              <div className="flex space-x-2">
                <RippleButton
                  onClick={() => setShowMediaModal(true)}
                  className="vintage-btn flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors duration-200 text-sm font-crimson"
                >
                  <Play className="w-4 h-4" />
                  <span>Full View</span>
                </RippleButton>
                <a
                  href={currentQuestion.mediaUrl}
                  download
                  className="vintage-btn flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors duration-200 text-sm font-crimson"
                >
                  <Download className="w-4 h-4" />
                  <span>Preserve</span>
                </a>
              </div>
            </div>
            <video 
              controls 
              className="max-w-full h-auto rounded-lg shadow-lg border-2 border-vintage-brown max-h-96"
              src={currentQuestion.mediaUrl}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling!.style.display = 'block';
              }}
            >
              Your viewing apparatus does not support moving pictures.
            </video>
            <div className="hidden vintage-error rounded-lg p-4 text-center mt-3">
              <p className="font-crimson">Failed to load moving picture evidence. Please use the preservation link.</p>
              <a href={currentQuestion.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-vintage-red underline font-crimson">
                {currentQuestion.mediaUrl}
              </a>
            </div>
          </div>
        );
      
      case 'audio':
        return (
          <div className={commonClasses}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-vintage-brown font-medium font-playfair">Audio Evidence Required</span>
              <div className="flex space-x-2">
                <RippleButton
                  onClick={() => setShowMediaModal(true)}
                  className="vintage-btn flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors duration-200 text-sm font-crimson"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Enhanced Listen</span>
                </RippleButton>
                <a
                  href={currentQuestion.mediaUrl}
                  download
                  className="vintage-btn flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors duration-200 text-sm font-crimson"
                >
                  <Download className="w-4 h-4" />
                  <span>Preserve</span>
                </a>
              </div>
            </div>
            <audio 
              controls 
              className="w-full mb-4"
              src={currentQuestion.mediaUrl}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling!.style.display = 'block';
              }}
            >
              Your listening apparatus does not support audio recordings.
            </audio>
            
            {/* Vintage Audio Visualization */}
            <div className="vintage-card bg-vintage-brown/10 rounded-lg p-3">
              <div className="flex items-end justify-center space-x-1 h-12">
                {Array.from({ length: 30 }, (_, i) => (
                  <div
                    key={i}
                    className="bg-gradient-to-t from-vintage-brown to-vintage-gold rounded-sm animate-pulse"
                    style={{
                      width: '2px',
                      height: `${Math.random() * 40 + 5}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${1 + Math.random()}s`
                    }}
                  />
                ))}
              </div>
              <div className="text-center text-vintage-gray text-xs mt-2 font-crimson italic">
                Audio Waveform Analysis
              </div>
            </div>
            
            <div className="hidden vintage-error rounded-lg p-4 text-center mt-3">
              <p className="font-crimson">Failed to load audio evidence. Please use the preservation link.</p>
              <a href={currentQuestion.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-vintage-red underline font-crimson">
                {currentQuestion.mediaUrl}
              </a>
            </div>
          </div>
        );
      
      case 'file':
        return (
          <div className={commonClasses}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-vintage-black font-semibold mb-2 font-playfair">Document Evidence Required</h4>
                <p className="text-vintage-gray text-sm font-crimson">Examine and analyze the provided documentation</p>
              </div>
              <div className="flex space-x-2">
                <RippleButton
                  onClick={() => setShowMediaModal(true)}
                  className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 font-crimson"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview</span>
                </RippleButton>
                <a
                  href={currentQuestion.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 font-crimson"
                >
                  <ZoomIn className="w-4 h-4" />
                  <span>Examine</span>
                </a>
                <a
                  href={currentQuestion.mediaUrl}
                  download
                  className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 font-crimson"
                >
                  <Download className="w-4 h-4" />
                  <span>Preserve</span>
                </a>
              </div>
            </div>
            <div className="mt-3 p-3 vintage-card rounded border-2 border-vintage-brown">
              <p className="text-vintage-gray text-xs break-all font-crimson">
                Document Location: {currentQuestion.mediaUrl}
              </p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (!currentQuestion) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <div className="flex justify-start mb-6">
          <RippleButton
            onClick={onBackToMap}
            className="flex items-center space-x-2 text-vintage-gray hover:text-vintage-brown transition-colors duration-200 bg-transparent font-crimson"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Return to Command Center</span>
          </RippleButton>
        </div>
        <div className="vintage-card rounded-lg p-8">
          <h2 className="vintage-headline text-2xl mb-4 font-playfair">No Further Evidence</h2>
          <p className="text-vintage-gray font-crimson">You have examined all available evidence in this investigation!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <div className="flex justify-start mb-6">
        <RippleButton
          onClick={onBackToMap}
          className="flex items-center space-x-2 text-vintage-gray hover:text-vintage-brown transition-colors duration-200 bg-transparent font-crimson"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Return to Command Center</span>
        </RippleButton>
      </div>

      {/* Investigation Tools Header */}
      <div className="flex justify-end mb-8">
        <div className="flex items-center space-x-3">
          <RippleButton
            onClick={() => handlePowerUp('brainBoost')}
            disabled={team.powerUps.brainBoost === 0 || isCorrect}
            className={`vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson ${
              team.powerUps.brainBoost > 0 && !isCorrect
                ? 'bg-vintage-gold/20 border-vintage-gold text-vintage-gold hover:bg-vintage-gold/30'
                : 'opacity-50 cursor-not-allowed'
            }`}
            rippleColor="rgba(212, 175, 55, 0.4)"
          >
            <Brain className="w-4 h-4" />
            <span>Mind Palace ({team.powerUps.brainBoost})</span>
            {team.brainBoostActive && (
              <span className="ml-1 text-xs vintage-badge text-vintage-gold animate-pulse">
                ACTIVE
              </span>
            )}
          </RippleButton>

          <RippleButton
            onClick={() => handlePowerUp('hint')}
            disabled={team.powerUps.hint === 0 || isCorrect}
            className={`vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson ${
              team.powerUps.hint > 0 && !isCorrect
                ? 'bg-vintage-blue/20 border-vintage-blue text-vintage-blue hover:bg-vintage-blue/30'
                : 'opacity-50 cursor-not-allowed'
            }`}
            rippleColor="rgba(30, 58, 95, 0.4)"
          >
            <Eye className="w-4 h-4" />
            <span>Magnifying Glass ({team.powerUps.hint})</span>
          </RippleButton>

          <RippleButton
            onClick={() => handlePowerUp('skip')}
            disabled={team.powerUps.skip === 0 || isCorrect}
            className={`vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson ${
              team.powerUps.skip > 0 && !isCorrect
                ? 'bg-vintage-green/20 border-vintage-green text-vintage-green hover:bg-vintage-green/30'
                : 'opacity-50 cursor-not-allowed'
            }`}
            rippleColor="rgba(45, 80, 22, 0.4)"
          >
            <SkipForward className="w-4 h-4" />
            <span>Skip Evidence ({team.powerUps.skip})</span>
          </RippleButton>
        </div>
      </div>

      {/* Evidence Card */}
      <div className="vintage-question-card rounded-lg p-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="vintage-headline text-2xl font-playfair">{currentQuestion.title}</h2>
            <div className="flex items-center space-x-3">
              <span className="vintage-badge px-3 py-1 rounded-lg text-sm">
                {currentQuestion.category}
              </span>
              <span className={`vintage-badge px-3 py-1 rounded-lg text-sm ${
                currentQuestion.difficultyLevel === 'hard' ? 'bg-vintage-red/20 border-vintage-red text-vintage-red' :
                currentQuestion.difficultyLevel === 'easy' ? 'bg-vintage-green/20 border-vintage-green text-vintage-green' :
                'bg-vintage-blue/20 border-vintage-blue text-vintage-blue'
              }`}>
                {currentQuestion.difficultyLevel?.toUpperCase()}
              </span>
              <span className="vintage-badge bg-vintage-green/20 border-vintage-green text-vintage-green px-3 py-1 rounded-lg text-sm">
                {currentQuestion.points} points
                {team.brainBoostActive && (
                  <span className="ml-1 text-vintage-gold font-bold">(x2)</span>
                )}
              </span>
            </div>
          </div>
          <p className="text-vintage-black text-lg leading-relaxed font-crimson">{currentQuestion.question}</p>
        </div>

        {/* Evidence Content */}
        {renderMediaPreview()}

        {/* Investigation Hint */}
        {showHint && currentQuestion.hint && (
          <div className="mb-6 p-4 vintage-card bg-vintage-blue/10 border-vintage-blue rounded-lg animate-fade-in">
            <div className="flex items-center space-x-2 mb-2">
              <Eye className="w-5 h-5 text-vintage-blue" />
              <span className="text-vintage-blue font-medium font-playfair">Magnifying Glass Reveals</span>
            </div>
            <p className="text-vintage-black font-crimson">{currentQuestion.hint}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 vintage-success rounded-lg animate-fade-in">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-5 h-5 text-vintage-green" />
              <span className="text-vintage-green font-medium font-playfair">{success}</span>
            </div>
            {isCorrect && !showChoices && (
              <div className="mt-3">
                <div className="flex items-center space-x-2 text-vintage-green">
                  <div className="w-4 h-4 bg-vintage-green rounded-full animate-pulse"></div>
                  <span className="text-sm font-crimson">Preparing next evidence...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Question Choices Modal */}
        {showChoices && branchChoices && branchChoices.length > 0 && (
          <div className="mb-6 p-6 vintage-card bg-vintage-gold/10 border-vintage-gold rounded-lg animate-fade-in">
            <div className="text-center mb-6">
              <h3 className="vintage-headline text-2xl font-playfair mb-2">Choose Your Investigation Path</h3>
              <p className="text-vintage-brown font-crimson">
                You've reached a crossroads in the investigation. Choose your next approach:
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {branchChoices.map((choice, index) => (
                <RippleButton
                  key={index}
                  onClick={() => handleChoiceSelection(choice)}
                  className={`vintage-btn ${getChoiceColor(choice.difficulty)} p-6 rounded-lg transition-all duration-300 text-left hover:scale-105 font-crimson`}
                >
                  <div className="flex items-center space-x-4 mb-3">
                    <div className={`p-3 rounded-full ${getChoiceColor(choice.difficulty)}`}>
                      {getChoiceIcon(choice.icon)}
                    </div>
                    <div>
                      <h4 className="font-playfair font-bold text-lg">{choice.title}</h4>
                      <p className="text-sm opacity-80">{choice.points} points</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed">{choice.description}</p>
                </RippleButton>
              ))}
            </div>
          </div>
        )}

        {/* Deduction Form - Hidden when correct or showing choices */}
        {!isCorrect && !showChoices && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-vintage-dark-brown mb-2 font-playfair uppercase tracking-wide">
                Your Deduction
              </label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={4}
                className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none resize-none"
                placeholder="Enter your deduction based on the evidence..."
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="vintage-error rounded-lg p-3 animate-fade-in">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-vintage-red" />
                  <span className="font-crimson">{error}</span>
                </div>
              </div>
            )}

            <RippleButton
              type="submit"
              disabled={isSubmitting || !answer.trim()}
              className="vintage-btn w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-crimson font-medium transition-all duration-200 shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              rippleColor="rgba(139, 69, 19, 0.3)"
            >
              <Send className="w-5 h-5" />
              <span>{isSubmitting ? 'Analyzing Deduction...' : 'Submit Deduction'}</span>
            </RippleButton>
          </form>
        )}
      </div>

      {/* Media Modal */}
      <MediaModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        mediaUrl={currentQuestion.mediaUrl || ''}
        mediaType={currentQuestion.type}
        title={currentQuestion.title}
      />

      {/* Power-Up Effect */}
      {activePowerUp && (
        <PowerUpEffect
          type={activePowerUp}
          isActive={true}
          onComplete={() => setActivePowerUp(null)}
        />
      )}

      {/* Question Transition */}
      <QuestionTransition
        isVisible={showTransition}
        currentQuestion={team.currentQuestion + 1}
        totalQuestions={questions.length}
        score={team.score}
        onComplete={handleTransitionComplete}
      />
    </div>
  );
};

export default QuestionInterface;