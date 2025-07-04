import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Users, 
  FileText, 
  BarChart3, 
  Play, 
  Pause, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  LogOut,
  Scroll,
  Zap,
  Send,
  Upload,
  Download,
  RotateCcw,
  Crown,
  Medal,
  Award,
  Star,
  X,
  ChevronDown,
  ChevronUp,
  Image,
  Video,
  Volume2,
  FileIcon
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useToast } from '../hooks/useToast';
import { Question } from '../types/game';
import QuestionPreview from './QuestionPreview';
import QuestionTemplates from './QuestionTemplates';
import BulkImportExport from './BulkImportExport';
import QuestionAnalytics from './QuestionAnalytics';
import AnnouncementManager from './AnnouncementManager';
import RippleButton from './RippleButton';
import { supabase } from '../lib/supabase';

interface AdminPanelProps {
  onNavigate: (view: 'landing' | 'player' | 'admin' | 'playerLogin' | 'adminLogin' | 'leaderboard') => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onNavigate }) => {
  const { 
    teams, 
    questions, 
    quizActive, 
    quizPaused, 
    setQuizActive, 
    setQuizPaused, 
    addQuestion, 
    deleteQuestion, 
    reorderQuestions,
    grantPowerUp 
  } = useGame();
  
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'questions' | 'choices' | 'teams' | 'analytics' | 'settings'>('questions');
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<any | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [choiceQuestions, setChoiceQuestions] = useState<any[]>([]);

  const [questionForm, setQuestionForm] = useState({
    question: '',
    correctAnswer: '',
    hint: '',
    type: 'text' as 'text' | 'image' | 'video' | 'audio' | 'file',
    mediaUrl: '',
    points: 100,
    category: '',
    explanation: '',
    difficultyLevel: 'normal' as 'easy' | 'normal' | 'hard' | 'expert',
    isActive: true,
    isBranchPoint: false,
    easyQuestion: {
      question: '',
      correctAnswer: '',
      hint: '',
      points: 100,
      mediaUrl: ''
    },
    hardQuestion: {
      question: '',
      correctAnswer: '',
      hint: '',
      points: 200,
      mediaUrl: ''
    }
  });

  const [teamPowerUps, setTeamPowerUps] = useState<{[key: string]: {brainBoost: number, hint: number, skip: number}}>({});

  // Load choice questions
  useEffect(() => {
    loadChoiceQuestions();
  }, []);

  const loadChoiceQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_choice_questions')
        .select('*')
        .order('branch_question_title', { ascending: true });

      if (error) throw error;
      setChoiceQuestions(data || []);
    } catch (error) {
      console.error('Error loading choice questions:', error);
    }
  };

  const resetForm = () => {
    setQuestionForm({
      question: '',
      correctAnswer: '',
      hint: '',
      type: 'text',
      mediaUrl: '',
      points: 100,
      category: '',
      explanation: '',
      difficultyLevel: 'normal',
      isActive: true,
      isBranchPoint: false,
      easyQuestion: {
        question: '',
        correctAnswer: '',
        hint: '',
        points: 100,
        mediaUrl: ''
      },
      hardQuestion: {
        question: '',
        correctAnswer: '',
        hint: '',
        points: 200,
        mediaUrl: ''
      }
    });
    setEditingQuestion(null);
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!questionForm.question.trim() || !questionForm.correctAnswer.trim() || !questionForm.category.trim()) {
      showError('Validation Error', 'Please fill in all required fields.');
      return;
    }

    // Validate media URL if media type is selected
    if (questionForm.type !== 'text' && !questionForm.mediaUrl.trim()) {
      showError('Validation Error', 'Media URL is required when media type is selected.');
      return;
    }

    // Validate branch point questions
    if (questionForm.isBranchPoint) {
      if (!questionForm.easyQuestion.question.trim() || !questionForm.easyQuestion.correctAnswer.trim()) {
        showError('Validation Error', 'Easy path question and answer are required for branch points.');
        return;
      }
      if (!questionForm.hardQuestion.question.trim() || !questionForm.hardQuestion.correctAnswer.trim()) {
        showError('Validation Error', 'Hard path question and answer are required for branch points.');
        return;
      }
    }

    try {
      await addQuestion(questionForm);
      showSuccess('Evidence Added', 'New investigation evidence has been successfully catalogued.');
      setShowQuestionForm(false);
      resetForm();
      if (questionForm.isBranchPoint) {
        loadChoiceQuestions();
      }
    } catch (error) {
      showError('Addition Failed', 'Failed to add evidence. Please try again.');
    }
  };

  const handleDeleteQuestion = async (index: number) => {
    if (window.confirm('Are you certain you wish to remove this evidence from the investigation? This action cannot be undone.')) {
      try {
        await deleteQuestion(index);
        showSuccess('Evidence Removed', 'Investigation evidence has been successfully removed from the case files.');
        loadChoiceQuestions();
      } catch (error) {
        showError('Removal Failed', 'Failed to remove evidence. Please try again.');
      }
    }
  };

  const handleReorderQuestion = async (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;
    
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    
    try {
      await reorderQuestions(newQuestions);
      showSuccess('Evidence Reordered', 'Investigation sequence has been updated.');
    } catch (error) {
      showError('Reorder Failed', 'Failed to reorder evidence. Please try again.');
    }
  };

  const handleGrantPowerUp = async (teamEmail: string, powerUpId: 'brainBoost' | 'hint' | 'skip', amount: number) => {
    try {
      await grantPowerUp(teamEmail, powerUpId, amount);
      showSuccess('Investigation Tool Granted', `Investigation tool has been granted to the detective team.`);
    } catch (error) {
      showError('Grant Failed', 'Failed to grant investigation tool. Please try again.');
    }
  };

  const handleQuizToggle = async () => {
    try {
      await setQuizActive(!quizActive);
      showSuccess(
        quizActive ? 'Investigation Suspended' : 'Investigation Activated',
        quizActive ? 'All detective teams have been notified of the suspension.' : 'All detective teams have been notified and may now proceed.'
      );
    } catch (error) {
      showError('Status Change Failed', 'Failed to update investigation status. Please try again.');
    }
  };

  const handleQuizPause = async () => {
    try {
      await setQuizPaused(!quizPaused);
      showSuccess(
        quizPaused ? 'Investigation Resumed' : 'Investigation Paused',
        quizPaused ? 'Detective teams may now continue their investigation.' : 'All detective teams have been temporarily halted.'
      );
    } catch (error) {
      showError('Pause Failed', 'Failed to update investigation pause status. Please try again.');
    }
  };

  const handleBulkImport = async (questions: any[]) => {
    try {
      for (const question of questions) {
        await addQuestion(question);
      }
      showSuccess('Bulk Import Complete', `Successfully imported ${questions.length} investigation questions.`);
      setShowBulkImport(false);
    } catch (error) {
      showError('Import Failed', 'Failed to import questions. Please check the format and try again.');
    }
  };

  const toggleQuestionExpansion = (index: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedQuestions(newExpanded);
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Volume2 className="w-4 h-4" />;
      case 'file': return <FileIcon className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getQuestionTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'text-vintage-green';
      case 'video': return 'text-vintage-blue';
      case 'audio': return 'text-vintage-gold';
      case 'file': return 'text-vintage-red';
      default: return 'text-vintage-brown';
    }
  };

  const handleLogout = () => {
    onNavigate('landing');
  };

  const handleSelectTemplate = (template: any) => {
    setQuestionForm({
      ...questionForm,
      question: template.template.question,
      hint: template.template.hint,
      points: template.template.points,
      category: template.category,
      explanation: template.template.explanation,
      type: template.type
    });
    setShowTemplates(false);
    setShowQuestionForm(true);
  };

  return (
    <div className="min-h-screen vintage-paper relative">
      {/* Header */}
      <div className="vintage-card rounded-lg p-6 mb-8">
        <div className="border-4 border-double border-vintage-brown p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="vintage-headline text-4xl font-playfair mb-2">Chief Inspector's Command Center</h1>
              <p className="text-vintage-gray font-crimson italic">Scotland Yard Investigation Control</p>
            </div>
            <div className="flex items-center space-x-4">
              <RippleButton
                onClick={() => setShowAnnouncements(true)}
                className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
              >
                <Send className="w-4 h-4" />
                <span>Broadcast Notice</span>
              </RippleButton>
              <RippleButton
                onClick={handleLogout}
                className="vintage-btn bg-vintage-red/20 border-vintage-red text-vintage-red hover:bg-vintage-red/30 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
                rippleColor="rgba(139, 0, 0, 0.4)"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>End Session</span>
              </RippleButton>
            </div>
          </div>
        </div>
      </div>

      {/* Investigation Control */}
      <div className="vintage-card rounded-lg p-6 mb-8">
        <h2 className="vintage-headline text-2xl font-playfair mb-6">Investigation Control</h2>
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-4">
            <span className="text-vintage-brown font-crimson font-semibold">Investigation Status:</span>
            <RippleButton
              onClick={handleQuizToggle}
              className={`vintage-btn flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 font-crimson ${
                quizActive 
                  ? 'bg-vintage-green/20 border-vintage-green text-vintage-green' 
                  : 'bg-vintage-red/20 border-vintage-red text-vintage-red'
              }`}
              rippleColor={quizActive ? "rgba(45, 80, 22, 0.4)" : "rgba(139, 0, 0, 0.4)"}
            >
              <Play className="w-4 h-4" />
              <span>{quizActive ? 'ACTIVE' : 'INACTIVE'}</span>
            </RippleButton>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-vintage-brown font-crimson font-semibold">Operations:</span>
            <RippleButton
              onClick={handleQuizPause}
              disabled={!quizActive}
              className={`vintage-btn flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 font-crimson ${
                quizPaused 
                  ? 'bg-vintage-gold/20 border-vintage-gold text-vintage-gold' 
                  : 'bg-vintage-blue/20 border-vintage-blue text-vintage-blue'
              } disabled:opacity-50`}
              rippleColor={quizPaused ? "rgba(212, 175, 55, 0.4)" : "rgba(30, 58, 95, 0.4)"}
            >
              <Pause className="w-4 h-4" />
              <span>{quizPaused ? 'RESUME' : 'PAUSE'}</span>
            </RippleButton>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="vintage-card rounded-lg p-2 mb-8">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex items-center space-x-2 py-3 px-6 rounded-lg transition-all duration-200 font-crimson ${
              activeTab === 'questions'
                ? 'vintage-btn text-vintage-black shadow-lg'
                : 'text-vintage-gray hover:text-vintage-brown'
            }`}
          >
            <Scroll className="w-4 h-4" />
            <span>Main Questions</span>
          </button>
          <button
            onClick={() => setActiveTab('choices')}
            className={`flex items-center space-x-2 py-3 px-6 rounded-lg transition-all duration-200 font-crimson ${
              activeTab === 'choices'
                ? 'vintage-btn text-vintage-black shadow-lg'
                : 'text-vintage-gray hover:text-vintage-brown'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Choice Questions</span>
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center space-x-2 py-3 px-6 rounded-lg transition-all duration-200 font-crimson ${
              activeTab === 'teams'
                ? 'vintage-btn text-vintage-black shadow-lg'
                : 'text-vintage-gray hover:text-vintage-brown'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Detective Teams</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center space-x-2 py-3 px-6 rounded-lg transition-all duration-200 font-crimson ${
              activeTab === 'analytics'
                ? 'vintage-btn text-vintage-black shadow-lg'
                : 'text-vintage-gray hover:text-vintage-brown'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Investigation Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-2 py-3 px-6 rounded-lg transition-all duration-200 font-crimson ${
              activeTab === 'settings'
                ? 'vintage-btn text-vintage-black shadow-lg'
                : 'text-vintage-gray hover:text-vintage-brown'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Command Settings</span>
          </button>
        </div>
      </div>

      {/* Main Questions Tab */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          {/* Questions Header */}
          <div className="flex items-center justify-between">
            <h2 className="vintage-headline text-3xl font-playfair">Main Investigation Questions</h2>
            <div className="flex items-center space-x-4">
              <RippleButton
                onClick={() => setShowTemplates(true)}
                className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
              >
                <Scroll className="w-4 h-4" />
                <span>Templates</span>
              </RippleButton>
              <RippleButton
                onClick={() => setShowBulkImport(true)}
                className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
              >
                <Upload className="w-4 h-4" />
                <span>Bulk Import</span>
              </RippleButton>
              <RippleButton
                onClick={() => setShowQuestionForm(true)}
                className="vintage-btn bg-vintage-brown/20 border-vintage-brown text-vintage-brown hover:bg-vintage-brown/30 flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
                rippleColor="rgba(139, 69, 19, 0.3)"
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </RippleButton>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="vintage-card rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-vintage-brown rounded-full flex items-center justify-center text-vintage-cream font-bold text-lg font-playfair border-4 border-vintage-gold">
                      {index + 1}
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className={`flex items-center space-x-1 ${getQuestionTypeColor(question.type)}`}>
                        {getQuestionTypeIcon(question.type)}
                        <span className="text-xs font-crimson uppercase">{question.type}</span>
                      </div>
                      <span className="vintage-badge px-3 py-1 rounded-lg text-sm">
                        {question.category}
                      </span>
                      <span className="vintage-badge bg-vintage-green/20 border-vintage-green text-vintage-green px-3 py-1 rounded-lg text-sm">
                        {question.points} points
                      </span>
                      {question.hasChoices && (
                        <span className="vintage-badge bg-vintage-gold/20 border-vintage-gold text-vintage-gold px-3 py-1 rounded-lg text-sm">
                          Branch Point
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RippleButton
                      onClick={() => toggleQuestionExpansion(index)}
                      className="vintage-btn p-2 rounded-lg transition-colors duration-200"
                    >
                      {expandedQuestions.has(index) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </RippleButton>
                    <RippleButton
                      onClick={() => setPreviewQuestion(question)}
                      className="vintage-btn p-2 rounded-lg transition-colors duration-200"
                    >
                      <Eye className="w-4 h-4" />
                    </RippleButton>
                    <RippleButton
                      onClick={() => handleReorderQuestion(index, 'up')}
                      disabled={index === 0}
                      className="vintage-btn p-2 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </RippleButton>
                    <RippleButton
                      onClick={() => handleReorderQuestion(index, 'down')}
                      disabled={index === questions.length - 1}
                      className="vintage-btn p-2 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </RippleButton>
                    <RippleButton
                      onClick={() => handleDeleteQuestion(index)}
                      className="vintage-btn bg-vintage-red/20 border-vintage-red text-vintage-red hover:bg-vintage-red/30 p-2 rounded-lg transition-colors duration-200"
                      rippleColor="rgba(139, 0, 0, 0.4)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </RippleButton>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h3 className="vintage-headline text-xl font-playfair mb-2">{question.title}</h3>
                  <p className="text-vintage-black font-crimson leading-relaxed">
                    {expandedQuestions.has(index) ? question.question : `${question.question.substring(0, 150)}${question.question.length > 150 ? '...' : ''}`}
                  </p>
                </div>

                {expandedQuestions.has(index) && (
                  <div className="vintage-card bg-vintage-cream/50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-vintage-brown font-semibold font-playfair">Expected Answer:</span>
                        <p className="text-vintage-black font-crimson">{question.answer}</p>
                      </div>
                      {question.hint && (
                        <div>
                          <span className="text-vintage-brown font-semibold font-playfair">Investigation Hint:</span>
                          <p className="text-vintage-black font-crimson">{question.hint}</p>
                        </div>
                      )}
                    </div>
                    {question.mediaUrl && (
                      <div>
                        <span className="text-vintage-brown font-semibold font-playfair">Media Evidence:</span>
                        <p className="text-vintage-blue font-crimson break-all">{question.mediaUrl}</p>
                      </div>
                    )}
                    {question.explanation && (
                      <div>
                        <span className="text-vintage-brown font-semibold font-playfair">Case Notes:</span>
                        <p className="text-vintage-black font-crimson">{question.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Choice Questions Tab */}
      {activeTab === 'choices' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="vintage-headline text-3xl font-playfair">Choice Questions</h2>
            <p className="text-vintage-gray font-crimson italic">Questions created from branch points</p>
          </div>

          <div className="space-y-4">
            {choiceQuestions.map((choice, index) => (
              <div key={choice.id} className="vintage-card rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-vintage-cream font-bold text-lg font-playfair border-4 ${
                      choice.difficulty_level === 'easy' 
                        ? 'bg-vintage-green border-vintage-green' 
                        : 'bg-vintage-red border-vintage-red'
                    }`}>
                      {choice.difficulty_level === 'easy' ? 'E' : 'H'}
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className={`flex items-center space-x-1 ${getQuestionTypeColor(choice.type)}`}>
                        {getQuestionTypeIcon(choice.type)}
                        <span className="text-xs font-crimson uppercase">{choice.type}</span>
                      </div>
                      <span className="vintage-badge px-3 py-1 rounded-lg text-sm">
                        {choice.category}
                      </span>
                      <span className={`vintage-badge px-3 py-1 rounded-lg text-sm ${
                        choice.difficulty_level === 'easy' 
                          ? 'bg-vintage-green/20 border-vintage-green text-vintage-green' 
                          : 'bg-vintage-red/20 border-vintage-red text-vintage-red'
                      }`}>
                        {choice.difficulty_level.toUpperCase()} - {choice.points} points
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h3 className="vintage-headline text-xl font-playfair mb-2">{choice.title}</h3>
                  <p className="text-vintage-black font-crimson leading-relaxed mb-2">{choice.question}</p>
                  {choice.branch_question_title && (
                    <p className="text-vintage-gray font-crimson text-sm italic">
                      Branch from: {choice.branch_question_title}
                    </p>
                  )}
                </div>

                <div className="vintage-card bg-vintage-cream/50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-vintage-brown font-semibold font-playfair">Expected Answer:</span>
                      <p className="text-vintage-black font-crimson">{choice.answer}</p>
                    </div>
                    {choice.hint && (
                      <div>
                        <span className="text-vintage-brown font-semibold font-playfair">Investigation Hint:</span>
                        <p className="text-vintage-black font-crimson">{choice.hint}</p>
                      </div>
                    )}
                  </div>
                  {choice.media_url && (
                    <div>
                      <span className="text-vintage-brown font-semibold font-playfair">Media Evidence:</span>
                      <p className="text-vintage-blue font-crimson break-all">{choice.media_url}</p>
                    </div>
                  )}
                  {choice.explanation && (
                    <div>
                      <span className="text-vintage-brown font-semibold font-playfair">Case Notes:</span>
                      <p className="text-vintage-black font-crimson">{choice.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {choiceQuestions.length === 0 && (
            <div className="text-center py-12">
              <div className="vintage-card rounded-lg p-8 max-w-md mx-auto">
                <Zap className="w-16 h-16 text-vintage-brown mx-auto mb-4" />
                <h3 className="vintage-headline text-xl mb-4 font-playfair">No Choice Questions</h3>
                <p className="text-vintage-gray font-crimson">Choice questions are automatically created when you add branch point questions in the Main Questions tab.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detective Teams Tab */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          <h2 className="vintage-headline text-3xl font-playfair">Detective Teams</h2>
          
          <div className="space-y-4">
            {teams.map((team, index) => {
              const position = index + 1;
              const getPositionIcon = () => {
                switch (position) {
                  case 1: return <Crown className="w-6 h-6 text-vintage-gold" />;
                  case 2: return <Medal className="w-6 h-6 text-gray-400" />;
                  case 3: return <Award className="w-6 h-6 text-amber-600" />;
                  default: return <Star className="w-6 h-6 text-vintage-brown" />;
                }
              };

              return (
                <div key={team.name} className="vintage-card rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl border-4 ${
                        position === 1 ? 'bg-vintage-gold text-vintage-black border-vintage-brown' :
                        position === 2 ? 'bg-gray-300 text-vintage-black border-vintage-brown' :
                        position === 3 ? 'bg-amber-600 text-vintage-cream border-vintage-brown' :
                        'bg-vintage-brown text-vintage-cream border-vintage-gold'
                      }`}>
                        {position}
                      </div>
                      {getPositionIcon()}
                      <div>
                        <h3 className="vintage-headline text-xl font-playfair">{team.name}</h3>
                        <p className="text-vintage-gray font-crimson">{team.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-vintage-gold font-playfair">{team.score}</div>
                      <div className="text-sm text-vintage-gray font-crimson">Evidence Points</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="vintage-card bg-vintage-cream/50 rounded p-3">
                      <div className="text-vintage-brown font-semibold font-playfair text-sm">Progress</div>
                      <div className="text-vintage-black font-crimson">{team.currentQuestion} / {questions.length} questions</div>
                    </div>
                    <div className="vintage-card bg-vintage-cream/50 rounded p-3">
                      <div className="text-vintage-brown font-semibold font-playfair text-sm">Last Activity</div>
                      <div className="text-vintage-black font-crimson text-sm">
                        {team.lastAnswered ? new Date(team.lastAnswered).toLocaleString() : 'Not started'}
                      </div>
                    </div>
                    <div className="vintage-card bg-vintage-cream/50 rounded p-3">
                      <div className="text-vintage-brown font-semibold font-playfair text-sm">Status</div>
                      <div className="text-vintage-black font-crimson">
                        {team.completionTime ? 'Investigation Complete' : 'Active Investigation'}
                      </div>
                    </div>
                  </div>

                  <div className="border-t-2 border-vintage-brown pt-4">
                    <h4 className="text-vintage-brown font-semibold font-playfair mb-3">Investigation Tools</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-vintage-gold font-bold text-lg font-playfair">{team.powerUps.brainBoost}</div>
                        <div className="text-vintage-gray text-sm font-crimson">Mind Palace</div>
                        <div className="flex space-x-1 mt-2">
                          <button
                            onClick={() => handleGrantPowerUp(team.email, 'brainBoost', 1)}
                            className="vintage-btn text-xs px-2 py-1 rounded"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleGrantPowerUp(team.email, 'brainBoost', -1)}
                            className="vintage-btn text-xs px-2 py-1 rounded"
                          >
                            -1
                          </button>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-vintage-blue font-bold text-lg font-playfair">{team.powerUps.hint}</div>
                        <div className="text-vintage-gray text-sm font-crimson">Magnifying Glass</div>
                        <div className="flex space-x-1 mt-2">
                          <button
                            onClick={() => handleGrantPowerUp(team.email, 'hint', 1)}
                            className="vintage-btn text-xs px-2 py-1 rounded"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleGrantPowerUp(team.email, 'hint', -1)}
                            className="vintage-btn text-xs px-2 py-1 rounded"
                          >
                            -1
                          </button>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-vintage-green font-bold text-lg font-playfair">{team.powerUps.skip}</div>
                        <div className="text-vintage-gray text-sm font-crimson">Skip Evidence</div>
                        <div className="flex space-x-1 mt-2">
                          <button
                            onClick={() => handleGrantPowerUp(team.email, 'skip', 1)}
                            className="vintage-btn text-xs px-2 py-1 rounded"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleGrantPowerUp(team.email, 'skip', -1)}
                            className="vintage-btn text-xs px-2 py-1 rounded"
                          >
                            -1
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="vintage-headline text-3xl font-playfair">Investigation Analytics</h2>
            <RippleButton
              onClick={() => setShowAnalytics(true)}
              className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Detailed Analytics</span>
            </RippleButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="vintage-card rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-vintage-gold font-playfair mb-2">{teams.length}</div>
              <div className="text-vintage-brown font-crimson">Active Detective Teams</div>
            </div>
            <div className="vintage-card rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-vintage-blue font-playfair mb-2">{questions.length}</div>
              <div className="text-vintage-brown font-crimson">Investigation Questions</div>
            </div>
            <div className="vintage-card rounded-lg p-6 text-center">
              <div className="text-4xl font-bold text-vintage-green font-playfair mb-2">
                {teams.filter(t => t.completionTime).length}
              </div>
              <div className="text-vintage-brown font-crimson">Completed Investigations</div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <h2 className="vintage-headline text-3xl font-playfair">Command Settings</h2>
          
          <div className="vintage-card rounded-lg p-6">
            <h3 className="vintage-headline text-xl font-playfair mb-4">Investigation Management</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-vintage-brown font-semibold font-playfair">Investigation Status</div>
                  <div className="text-vintage-gray font-crimson text-sm">Control whether detective teams can access questions</div>
                </div>
                <RippleButton
                  onClick={handleQuizToggle}
                  className={`vintage-btn px-6 py-3 rounded-lg transition-all duration-200 font-crimson ${
                    quizActive 
                      ? 'bg-vintage-green/20 border-vintage-green text-vintage-green' 
                      : 'bg-vintage-red/20 border-vintage-red text-vintage-red'
                  }`}
                >
                  {quizActive ? 'ACTIVE' : 'INACTIVE'}
                </RippleButton>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-vintage-brown font-semibold font-playfair">Investigation Operations</div>
                  <div className="text-vintage-gray font-crimson text-sm">Temporarily pause all investigation activities</div>
                </div>
                <RippleButton
                  onClick={handleQuizPause}
                  disabled={!quizActive}
                  className={`vintage-btn px-6 py-3 rounded-lg transition-all duration-200 font-crimson ${
                    quizPaused 
                      ? 'bg-vintage-gold/20 border-vintage-gold text-vintage-gold' 
                      : 'bg-vintage-blue/20 border-vintage-blue text-vintage-blue'
                  } disabled:opacity-50`}
                >
                  {quizPaused ? 'PAUSED' : 'RUNNING'}
                </RippleButton>
              </div>
            </div>
          </div>

          <div className="vintage-card rounded-lg p-6">
            <h3 className="vintage-headline text-xl font-playfair mb-4">Data Management</h3>
            <div className="flex space-x-4">
              <RippleButton
                onClick={() => setShowBulkImport(true)}
                className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
              >
                <Upload className="w-4 h-4" />
                <span>Import Questions</span>
              </RippleButton>
              <RippleButton
                onClick={() => setShowBulkImport(true)}
                className="vintage-btn flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 font-crimson"
              >
                <Download className="w-4 h-4" />
                <span>Export Data</span>
              </RippleButton>
            </div>
          </div>
        </div>
      )}

      {/* Question Form Modal */}
      {showQuestionForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="vintage-card rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="vintage-headline text-2xl font-playfair">Add New Evidence</h3>
              <button
                onClick={() => {
                  setShowQuestionForm(false);
                  resetForm();
                }}
                className="vintage-btn p-2 rounded-lg transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitQuestion} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                    Question *
                  </label>
                  <textarea
                    value={questionForm.question}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, question: e.target.value }))}
                    className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none resize-none"
                    rows={4}
                    placeholder="Enter the investigation question..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                    Correct Answer *
                  </label>
                  <input
                    type="text"
                    value={questionForm.correctAnswer}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, correctAnswer: e.target.value }))}
                    className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                    placeholder="Enter the correct answer..."
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                    Category *
                  </label>
                  <input
                    type="text"
                    value={questionForm.category}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, category: e.target.value }))}
                    className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                    placeholder="e.g., Signal Processing"
                    required
                  />
                </div>
                <div>
                  <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                    Points
                  </label>
                  <input
                    type="number"
                    value={questionForm.points}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, points: parseInt(e.target.value) || 100 }))}
                    className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                    min="1"
                    max="1000"
                  />
                </div>
                <div>
                  <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                    Difficulty
                  </label>
                  <select
                    value={questionForm.difficultyLevel}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, difficultyLevel: e.target.value as any }))}
                    className="vintage-input w-full px-4 py-3 rounded-lg font-crimson focus:outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                    Question Type
                  </label>
                  <select
                    value={questionForm.type}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="vintage-input w-full px-4 py-3 rounded-lg font-crimson focus:outline-none"
                  >
                    <option value="text">Text Only</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                    <option value="file">Document/File</option>
                  </select>
                </div>
                <div>
                  <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                    Media URL {questionForm.type !== 'text' && '*'}
                  </label>
                  <input
                    type="url"
                    value={questionForm.mediaUrl}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
                    className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                    placeholder={
                      questionForm.type === 'image' ? 'https://example.com/image.jpg' :
                      questionForm.type === 'video' ? 'https://example.com/video.mp4' :
                      questionForm.type === 'audio' ? 'https://example.com/audio.mp3' :
                      questionForm.type === 'file' ? 'https://example.com/document.pdf' :
                      'Enter media URL...'
                    }
                    required={questionForm.type !== 'text'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                  Hint (Optional)
                </label>
                <textarea
                  value={questionForm.hint}
                  onChange={(e) => setQuestionForm(prev => ({ ...prev, hint: e.target.value }))}
                  className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none resize-none"
                  rows={2}
                  placeholder="Provide a helpful hint..."
                />
              </div>

              {/* Branch Point Section */}
              <div className="vintage-card bg-vintage-gold/10 border-vintage-gold rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <input
                    type="checkbox"
                    id="isBranchPoint"
                    checked={questionForm.isBranchPoint}
                    onChange={(e) => setQuestionForm(prev => ({ ...prev, isBranchPoint: e.target.checked }))}
                    className="w-5 h-5 text-vintage-gold"
                  />
                  <label htmlFor="isBranchPoint" className="text-vintage-brown font-semibold font-playfair">
                    Make this a Branch Point (Choice Question)
                  </label>
                </div>

                {questionForm.isBranchPoint && (
                  <div className="space-y-6">
                    <p className="text-vintage-brown font-crimson text-sm">
                      After answering this question correctly, players will choose between easy and hard paths.
                    </p>

                    {/* Easy Path */}
                    <div className="vintage-card bg-vintage-green/10 border-vintage-green rounded-lg p-4">
                      <h4 className="flex items-center space-x-2 text-vintage-green font-semibold font-playfair mb-4">
                        <Star className="w-5 h-5" />
                        <span>Easy Path (Speed Route)</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Easy Question *
                          </label>
                          <textarea
                            value={questionForm.easyQuestion.question}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              easyQuestion: { ...prev.easyQuestion, question: e.target.value }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none resize-none"
                            rows={3}
                            placeholder="Enter easy question..."
                            required={questionForm.isBranchPoint}
                          />
                        </div>
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Easy Answer *
                          </label>
                          <input
                            type="text"
                            value={questionForm.easyQuestion.correctAnswer}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              easyQuestion: { ...prev.easyQuestion, correctAnswer: e.target.value }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                            placeholder="Correct answer..."
                            required={questionForm.isBranchPoint}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Easy Hint
                          </label>
                          <input
                            type="text"
                            value={questionForm.easyQuestion.hint}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              easyQuestion: { ...prev.easyQuestion, hint: e.target.value }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                            placeholder="Optional hint..."
                          />
                        </div>
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Easy Points
                          </label>
                          <input
                            type="number"
                            value={questionForm.easyQuestion.points}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              easyQuestion: { ...prev.easyQuestion, points: parseInt(e.target.value) || 100 }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                            min="1"
                            max="1000"
                          />
                        </div>
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Easy Media URL
                          </label>
                          <input
                            type="url"
                            value={questionForm.easyQuestion.mediaUrl}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              easyQuestion: { ...prev.easyQuestion, mediaUrl: e.target.value }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                            placeholder="Optional media URL..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hard Path */}
                    <div className="vintage-card bg-vintage-red/10 border-vintage-red rounded-lg p-4">
                      <h4 className="flex items-center space-x-2 text-vintage-red font-semibold font-playfair mb-4">
                        <Zap className="w-5 h-5" />
                        <span>Hard Path (Challenge Route)</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Hard Question *
                          </label>
                          <textarea
                            value={questionForm.hardQuestion.question}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              hardQuestion: { ...prev.hardQuestion, question: e.target.value }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none resize-none"
                            rows={3}
                            placeholder="Enter hard question..."
                            required={questionForm.isBranchPoint}
                          />
                        </div>
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Hard Answer *
                          </label>
                          <input
                            type="text"
                            value={questionForm.hardQuestion.correctAnswer}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              hardQuestion: { ...prev.hardQuestion, correctAnswer: e.target.value }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                            placeholder="Correct answer..."
                            required={questionForm.isBranchPoint}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Hard Hint
                          </label>
                          <input
                            type="text"
                            value={questionForm.hardQuestion.hint}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              hardQuestion: { ...prev.hardQuestion, hint: e.target.value }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                            placeholder="Optional hint..."
                          />
                        </div>
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Hard Points
                          </label>
                          <input
                            type="number"
                            value={questionForm.hardQuestion.points}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              hardQuestion: { ...prev.hardQuestion, points: parseInt(e.target.value) || 200 }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                            min="1"
                            max="1000"
                          />
                        </div>
                        <div>
                          <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair">
                            Hard Media URL
                          </label>
                          <input
                            type="url"
                            value={questionForm.hardQuestion.mediaUrl}
                            onChange={(e) => setQuestionForm(prev => ({
                              ...prev,
                              hardQuestion: { ...prev.hardQuestion, mediaUrl: e.target.value }
                            }))}
                            className="vintage-input w-full px-4 py-3 rounded-lg font-crimson placeholder-vintage-gray focus:outline-none"
                            placeholder="Optional media URL..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-4 pt-6 border-t-2 border-vintage-brown">
                <RippleButton
                  type="button"
                  onClick={() => {
                    setShowQuestionForm(false);
                    resetForm();
                  }}
                  className="vintage-btn flex-1 px-6 py-3 rounded-lg font-crimson font-semibold transition-all duration-200"
                >
                  Cancel Investigation
                </RippleButton>
                <RippleButton
                  type="submit"
                  className="vintage-btn bg-vintage-brown/20 border-vintage-brown text-vintage-brown hover:bg-vintage-brown/30 flex-1 px-6 py-3 rounded-lg font-crimson font-semibold transition-all duration-200"
                  rippleColor="rgba(139, 69, 19, 0.3)"
                >
                  Add Evidence to Case Files
                </RippleButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      {previewQuestion && (
        <QuestionPreview
          question={previewQuestion}
          onClose={() => setPreviewQuestion(null)}
        />
      )}

      {showTemplates && (
        <QuestionTemplates
          onSelectTemplate={handleSelectTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showBulkImport && (
        <BulkImportExport
          questions={questions}
          onImport={handleBulkImport}
          onClose={() => setShowBulkImport(false)}
        />
      )}

      {showAnalytics && (
        <QuestionAnalytics
          questions={questions}
          teams={teams}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {showAnnouncements && (
        <AnnouncementManager
          onClose={() => setShowAnnouncements(false)}
        />
      )}
    </div>
  );
};

export default AdminPanel;