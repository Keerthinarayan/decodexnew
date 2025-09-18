export interface Team {
  name: string;
  email: string;
  password: string;
  score: number;
  currentQuestion: number;
  powerUps: {
    doublePoints: number;
    hint: number;
    skip: number;
    brainBoost: number;
  };
  lastAnswered?: Date;
  teamName?: string;
  brainBoostActive?: boolean;
  completionTime?: Date;
  bonusPoints?: number;
  questionPath?: QuestionPathEntry[];
  currentQuestionId?: string;
}

export interface QuestionPathEntry {
  question_id: string;
  answer?: string;
  skipped?: boolean;
  points?: number;
  timestamp: string;
}

export interface QuestionChoice {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'hard';
  points: number;
  icon: string;
  question_id?: string;
}

export interface ChoiceQuestion {
  id: string;
  title: string;
  question: string;
  answer: string;
  hint?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  mediaUrl?: string;
  points: number;
  category: string;
  explanation?: string;
  difficultyLevel: 'easy' | 'hard';
  branchQuestionId: string;
  isActive: boolean;
}

export interface Question {
  id: string;
  title: string;
  question: string;
  answer: string;
  hint?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'file';
  mediaUrl?: string;
  points: number;
  category: string;
  explanation?: string;
  isActive: boolean;
  correctAnswer?: string;
  isBranchPoint?: boolean;
  branchChoices?: QuestionChoice[];
  difficultyLevel?: 'easy' | 'normal' | 'hard' | 'expert';
  nextQuestionId?: string;
  isChoiceQuestion?: boolean;
  choiceType?: 'difficulty' | 'speed' | 'topic';
  orderIndex?: number;
  hasChoices?: boolean;
  easyQuestion?: {
    question: string;
    correctAnswer: string;
    hint?: string;
    points?: number;
  };
  hardQuestion?: {
    question: string;
    correctAnswer: string;
    hint?: string;
    points?: number;
  };
}

export type GameState = 'waiting' | 'running' | 'paused' | 'ended';

export interface GameContextType {
  teams: Team[];
  questions: Question[];
  gameState: GameState;
  quizActive: boolean;
  quizPaused: boolean;
  totalQuestions?: number | null;
  loading?: boolean;
  loadInitialData?: () => Promise<void>;
  setQuizActive: (active: boolean) => void;
  setQuizPaused: (paused: boolean) => void;
  registerTeam: (name: string, email: string, password: string) => Promise<boolean>;
  loginTeam: (name: string, password: string) => Promise<boolean>;
  submitAnswer: (teamName: string, answer: string) => Promise<any>;
  selectQuestionChoice: (teamName: string, choiceDifficulty: string) => Promise<boolean>;
  usePowerUp: (teamName: string, type: 'doublePoints' | 'hint' | 'skip' | 'brainBoost') => Promise<boolean>;
  addQuestion: (question: any) => Promise<void>;
  removeQuestion: (questionId: string) => void;
  deleteQuestion: (index: number) => Promise<void>;
  reorderQuestions: (questions: Question[]) => Promise<void>;
  grantPowerUp: (teamEmail: string, powerUpId: 'brainBoost' | 'hint' | 'skip', amount: number) => Promise<void>;
  toggleGameState: () => void;
}