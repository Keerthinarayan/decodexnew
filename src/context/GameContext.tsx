import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Team, Question, GameState, GameContextType } from '../types/game';

const GameContext = createContext<GameContextType | null>(null);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [quizActive, setQuizActive] = useState(false);
  const [quizPaused, setQuizPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gameSettingsId, setGameSettingsId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
    setupRealtimeSubscriptions();
  }, []);

  const loadInitialData = async () => {
    try {
      // Load teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('score', { ascending: false });

      if (teamsError) throw teamsError;

      // Load questions for admin only. Players should NOT load all questions.
      // Players will fetch only the current question via RPC in QuestionInterface.
      const { data: userData } = await supabase.auth.getUser();
      const isAdmin = !!userData?.user;
      let adminQuestions: any[] = [];
      if (isAdmin) {
        const { data: adminQs, error: adminQsError } = await supabase
          .from('admin_questions')
          .select('*')
          .order('order_index');
        if (adminQsError) throw adminQsError;
        adminQuestions = adminQs || [];
      }

      // Load game settings
      const { data: gameSettingsData, error: gameSettingsError } = await supabase
        .from('game_settings')
        .select('*')
        .limit(1)
        .single();

      if (gameSettingsError && gameSettingsError.code !== 'PGRST116') {
        console.warn('Game settings error (non-critical):', gameSettingsError);
        // Don't throw error for missing game settings, just use defaults
      }

      // Transform data to match frontend types
  const transformedTeams: Team[] = (teamsData || []).map((team: any) => ({
        name: team.name,
        email: team.email,
        password: '', // Don't store passwords in frontend
        score: team.score,
        currentQuestion: team.current_question,
        powerUps: team.power_ups || {
          doublePoints: 1,
          hint: 1,
          skip: 1,
          brainBoost: 1
        },
        lastAnswered: team.last_answered ? new Date(team.last_answered) : undefined,
        brainBoostActive: team.brain_boost_active,
        completionTime: team.completion_time ? new Date(team.completion_time) : undefined,
        bonusPoints: team.bonus_points || 0,
        questionPath: team.question_path || [],
        currentQuestionId: team.current_question_id
      }));

      const transformedQuestions: Question[] = (isAdmin ? adminQuestions : []).map((question: any) => ({
        id: question.id,
        title: question.title,
        question: question.question,
        answer: question.answer || '',
        hint: question.hint || undefined,
        type: question.type as any,
        mediaUrl: question.media_url || undefined,
        points: question.points,
        category: question.category,
        explanation: question.explanation || undefined,
        isActive: question.is_active,
        isBranchPoint: question.has_choices || false,
        branchChoices: [],
        difficultyLevel: question.difficulty_level || 'normal',
        nextQuestionId: question.next_question_id || undefined,
        isChoiceQuestion: false,
        choiceType: undefined,
        orderIndex: question.order_index || 0,
        hasChoices: question.has_choices || false
      }));

      setTeams(transformedTeams);
      setQuestions(transformedQuestions);
      
      // Only update quiz state if we have valid game settings
      if (gameSettingsData) {
        setGameSettingsId(gameSettingsData.id);
        setQuizActive(gameSettingsData.quiz_active || false);
        setQuizPaused(gameSettingsData.quiz_paused || false);
      } else {
        // Set default values if no game settings exist
        console.log('No game settings found, using defaults');
        setQuizActive(false);
        setQuizPaused(false);
      }

      // Load total questions count via secure RPC (does not leak content)
      try {
        const { data: totalCount, error: totalError } = await supabase.rpc('get_total_questions');
        if (totalError) {
          console.warn('Could not load total questions count:', totalError.message);
          setTotalQuestions(null);
        } else {
          // Some PostgREST versions return scalar in data, others wrap; handle both
          const countValue = typeof totalCount === 'number' ? totalCount : (Array.isArray(totalCount) ? totalCount[0] : null);
          setTotalQuestions(countValue as number);
        }
      } catch (e) {
        console.warn('Error fetching total questions count:', e);
        setTotalQuestions(null);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Set safe defaults on error
      setQuizActive(false);
      setQuizPaused(false);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to teams changes
    const teamsSubscription = supabase
      .channel('teams_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'teams' },
        () => {
          loadInitialData();
        }
      )
      .subscribe();

    // Subscribe to questions changes
    const questionsSubscription = supabase
      .channel('questions_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'questions' },
        () => {
          loadInitialData();
        }
      )
      .subscribe();

    // Subscribe to game settings changes
    const gameSettingsSubscription = supabase
      .channel('game_settings_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'game_settings' },
  (payload: any) => {
          console.log('Game settings changed:', payload);
          // Only update state if we have valid new data
          if (payload.new && typeof payload.new.quiz_active === 'boolean') {
            setQuizActive(payload.new.quiz_active);
            setQuizPaused(payload.new.quiz_paused || false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(teamsSubscription);
      supabase.removeChannel(questionsSubscription);
      supabase.removeChannel(gameSettingsSubscription);
    };
  };

  // Simple hash function for password storage (in production, use bcrypt)
  const hashPassword = (password: string): string => {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  };

  const registerTeam = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      // Hash the password before storing
      const hashedPassword = hashPassword(password);
      
      const { error } = await supabase
        .from('teams')
        .insert({
          name,
          email,
          password_hash: hashedPassword, // Store hashed password
          score: 0,
          current_question: 0,
          power_ups: {
            doublePoints: 1,
            hint: 1,
            skip: 1,
            brainBoost: 1
          }
        })
        .select()
        .single();

      if (error) {
        console.error('Registration error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const loginTeam = async (name: string, password: string): Promise<boolean> => {
    try {
      // Hash the provided password to compare with stored hash
      const hashedPassword = hashPassword(password);
      
      const { data, error } = await supabase
        .from('teams')
        .select('name, password_hash')
        .eq('name', name);

      if (error) {
        console.error('Login error:', error);
        return false;
      }

      if (!data || data.length === 0) {
        console.log('Team not found:', name);
        return false;
      }

      const team = data[0];
      
      // Compare hashed passwords
      if (team.password_hash && team.password_hash === hashedPassword) {
        return true;
      } else {
        console.log('Invalid password for team:', name);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const submitAnswer = async (teamName: string, answer: string): Promise<any> => {
    try {
      // Use the enhanced server-side function with branching support
      const { data, error } = await supabase.rpc('verify_answer_with_branching', {
        p_team_name: teamName,
        p_answer: answer.trim()
      });

      if (error) {
        console.error('Submit answer error:', error);
        return { success: false, error: error.message };
      }

      // Force immediate reload of data to update UI
      await loadInitialData();
      
      return data || { success: false };
    } catch (error) {
      console.error('Submit answer error:', error);
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  };

  const selectQuestionChoice = async (teamName: string, choiceDifficulty: string): Promise<boolean> => {
    try {
      console.log('Calling select_question_choice with:', { teamName, choiceDifficulty });
      
      const { data, error } = await supabase.rpc('select_question_choice', {
        p_team_name: teamName,
        p_choice_difficulty: choiceDifficulty
      });

      if (error) {
        console.error('Select question choice error:', error);
        return false;
      }

      console.log('select_question_choice result:', data);

      // Force immediate reload of data to update UI
      await loadInitialData();
      
      return data || false;
    } catch (error) {
      console.error('Select question choice error:', error);
      return false;
    }
  };

  const usePowerUp = async (teamName: string, type: 'doublePoints' | 'hint' | 'skip' | 'brainBoost'): Promise<boolean> => {
    try {
      const team = teams.find(t => t.name === teamName);
      if (!team || team.powerUps[type] <= 0) return false;

      const updatedPowerUps = { ...team.powerUps };
      updatedPowerUps[type] -= 1;

      if (type === 'skip') {
        // Use enhanced server-side function for skipping with branching support
        const { error } = await supabase.rpc('skip_question_with_branching', {
          p_team_name: teamName
        });

        if (error) throw error;

        // Update power-ups
        const { error: updateError } = await supabase
          .from('teams')
          .update({ power_ups: updatedPowerUps })
          .eq('name', teamName);

        if (updateError) throw updateError;
      } else {
        const updateData: any = {
          power_ups: updatedPowerUps
        };

        if (type === 'brainBoost') {
          updateData.brain_boost_active = true;
        }

        const { error } = await supabase
          .from('teams')
          .update(updateData)
          .eq('name', teamName);

        if (error) throw error;
      }
      
      // Force immediate reload of data to update UI
      await loadInitialData();
      
      return true;
    } catch (error) {
      console.error('Use power-up error:', error);
      return false;
    }
  };

  const addQuestion = async (questionData: any): Promise<void> => {
    try {
      const maxOrder = Math.max(...questions.map(q => q.orderIndex || 0), 0);
      
      // Check if this is a branch question with easy/hard questions
      if (questionData.isBranchPoint && questionData.easyQuestion && questionData.hardQuestion) {
        // First create the main question
        const { data: mainQuestion, error: mainError } = await supabase
          .from('questions')
          .insert({
            title: questionData.question.substring(0, 50) + '...',
            question: questionData.question,
            answer: questionData.correctAnswer,
            hint: questionData.hint,
            type: questionData.type,
            media_url: questionData.mediaUrl,
            points: questionData.points,
            category: questionData.category,
            explanation: questionData.explanation,
            is_active: questionData.isActive,
            order_index: maxOrder + 1,
            difficulty_level: questionData.difficultyLevel || 'normal',
            has_choices: true
          })
          .select()
          .single();

        if (mainError) throw mainError;

        // Then create the choice questions
        const { error: choiceError } = await supabase.rpc('create_choice_questions_for_branch', {
          p_branch_question_id: mainQuestion.id,
          p_easy_question: questionData.easyQuestion.question,
          p_easy_answer: questionData.easyQuestion.correctAnswer || '',
          p_easy_hint: questionData.easyQuestion.hint || '',
          p_easy_points: questionData.easyQuestion.points || 100,
          p_hard_question: questionData.hardQuestion.question,
          p_hard_answer: questionData.hardQuestion.correctAnswer || '',
          p_hard_hint: questionData.hardQuestion.hint || '',
          p_hard_points: questionData.hardQuestion.points || 200,
          p_category: questionData.category
        });

        if (choiceError) throw choiceError;
      } else {
        // Regular question
        const { error } = await supabase
          .from('questions')
          .insert({
            title: questionData.question.substring(0, 50) + '...',
            question: questionData.question,
            answer: questionData.correctAnswer,
            hint: questionData.hint,
            type: questionData.type,
            media_url: questionData.mediaUrl,
            points: questionData.points,
            category: questionData.category,
            explanation: questionData.explanation,
            is_active: questionData.isActive,
            order_index: maxOrder + 1,
            difficulty_level: questionData.difficultyLevel || 'normal',
            has_choices: false
          });

        if (error) throw error;
      }
      
      // Force immediate reload of data without affecting UI state
      await loadInitialData();
    } catch (error) {
      console.error('Add question error:', error);
    }
  };

  const deleteQuestion = async (index: number): Promise<void> => {
    try {
      const question = questions[index];
      if (!question) return;

      console.log('Deleting question:', question.id);

      // Step 1: Update any teams that currently reference this question
      // Set their current_question_id to NULL to break the foreign key dependency
      const { error: updateTeamsError } = await supabase
        .from('teams')
        .update({ current_question_id: null })
        .eq('current_question_id', question.id);

      if (updateTeamsError) {
        console.error('Error updating teams before question deletion:', updateTeamsError);
        throw updateTeamsError;
      }

      // Step 2: Get all choice questions that reference this question as their branch
      const { data: choiceQuestions, error: getChoicesError } = await supabase
        .from('choice_questions')
        .select('id')
        .eq('branch_question_id', question.id);

      if (getChoicesError) {
        console.error('Error getting choice questions:', getChoicesError);
        throw getChoicesError;
      }

      // Step 3: Update any teams that might be referencing choice questions
      if (choiceQuestions && choiceQuestions.length > 0) {
  const choiceQuestionIds = choiceQuestions.map((cq: any) => cq.id);
        
        for (const choiceId of choiceQuestionIds) {
          const { error: updateTeamsChoiceError } = await supabase
            .from('teams')
            .update({ current_question_id: null })
            .eq('current_question_id', choiceId);

          if (updateTeamsChoiceError) {
            console.error('Error updating teams with choice question references:', updateTeamsChoiceError);
            throw updateTeamsChoiceError;
          }
        }
      }

      // Step 4: Delete choice questions that reference this question
      if (question.hasChoices) {
        const { error: deleteChoicesError } = await supabase
          .from('choice_questions')
          .delete()
          .eq('branch_question_id', question.id);

        if (deleteChoicesError) {
          console.error('Error deleting choice questions:', deleteChoicesError);
          throw deleteChoicesError;
        }
      }

      // Step 5: Update any questions that reference this question as their next_question_id
      const { error: updateNextQuestionError } = await supabase
        .from('questions')
        .update({ next_question_id: null })
        .eq('next_question_id', question.id);

      if (updateNextQuestionError) {
        console.error('Error updating next_question_id references:', updateNextQuestionError);
        throw updateNextQuestionError;
      }

      // Step 6: Now delete the question (all foreign key constraints should be resolved)
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', question.id);

      if (error) {
        console.error('Error deleting question:', error);
        throw error;
      }

      console.log('Successfully deleted question and all references');
      
      // Force immediate reload of data
      await loadInitialData();
    } catch (error) {
      console.error('Delete question error:', error);
      throw error;
    }
  };

  const reorderQuestions = async (newQuestions: Question[]): Promise<void> => {
    try {
      const updates = newQuestions.map((question, index) => ({
        id: question.id,
        order_index: index + 1,
        is_active: question.isActive,
        difficulty_level: question.difficultyLevel,
        points: question.points,
        has_choices: question.hasChoices,
        next_question_id: question.nextQuestionId
      }));

      for (const update of updates) {
        await supabase
          .from('questions')
          .update({ 
            order_index: update.order_index,
            is_active: update.is_active,
            difficulty_level: update.difficulty_level,
            points: update.points,
            has_choices: update.has_choices,
            next_question_id: update.next_question_id
          })
          .eq('id', update.id);
      }
      
      // Force immediate reload of data
      await loadInitialData();
    } catch (error) {
      console.error('Reorder questions error:', error);
    }
  };

  const grantPowerUp = async (teamEmail: string, powerUpId: 'brainBoost' | 'hint' | 'skip', amount: number): Promise<void> => {
    try {
      const team = teams.find(t => t.email === teamEmail);
      if (!team) return;

      const updatedPowerUps = { ...team.powerUps };
      updatedPowerUps[powerUpId] = Math.max(0, updatedPowerUps[powerUpId] + amount);

      const { error } = await supabase
        .from('teams')
        .update({ power_ups: updatedPowerUps })
        .eq('email', teamEmail);

      if (error) throw error;
      
      // Force immediate reload of data
      await loadInitialData();
    } catch (error) {
      console.error('Grant power-up error:', error);
    }
  };

  const updateQuizSettings = async (active: boolean, paused: boolean): Promise<void> => {
    try {
      console.log('Updating quiz settings:', { active, paused, gameSettingsId });
      
      if (gameSettingsId) {
        // Update existing record
        const { error } = await supabase
          .from('game_settings')
          .update({
            quiz_active: active,
            quiz_paused: paused,
            updated_at: new Date().toISOString()
          })
          .eq('id', gameSettingsId);

        if (error) {
          console.error('Error updating game settings:', error);
          throw error;
        }
        console.log('Successfully updated game settings');
      } else {
        // Insert new record if none exists
        const { data, error } = await supabase
          .from('game_settings')
          .insert({
            quiz_active: active,
            quiz_paused: paused
          })
          .select()
          .single();

        if (error) {
          console.error('Error inserting game settings:', error);
          throw error;
        }
        
        if (data) {
          setGameSettingsId(data.id);
          console.log('Successfully created game settings with ID:', data.id);
        }
      }
    } catch (error) {
      console.error('Update quiz settings error:', error);
      throw error;
    }
  };

  const setQuizActiveHandler = async (active: boolean) => {
    console.log('Setting quiz active:', active);
    try {
      // Update local state immediately for responsive UI
      setQuizActive(active);
      
      // Then update database
      await updateQuizSettings(active, quizPaused);
      console.log('Quiz active state updated successfully');
    } catch (error) {
      console.error('Failed to update quiz active state:', error);
      // Revert local state on error
      setQuizActive(!active);
      throw error;
    }
  };

  const setQuizPausedHandler = async (paused: boolean) => {
    console.log('Setting quiz paused:', paused);
    try {
      // Update local state immediately for responsive UI
      setQuizPaused(paused);
      
      // Then update database
      await updateQuizSettings(quizActive, paused);
      console.log('Quiz paused state updated successfully');
    } catch (error) {
      console.error('Failed to update quiz paused state:', error);
      // Revert local state on error
      setQuizPaused(!paused);
      throw error;
    }
  };

  const toggleGameState = (): void => {
    setGameState(prev => {
      switch (prev) {
        case 'waiting':
        case 'paused':
          return 'running';
        case 'running':
          return 'paused';
        default:
          return prev;
      }
    });
  };

  const removeQuestion = (questionId: string): void => {
    // Legacy function - use deleteQuestion instead
    const index = questions.findIndex(q => q.id === questionId);
    if (index !== -1) {
      deleteQuestion(index);
    }
  };

  const value: GameContextType = {
    teams,
    questions,
    gameState,
    quizActive,
    quizPaused,
    totalQuestions,
    loading,
    loadInitialData, // Expose this function for manual refresh
    setQuizActive: setQuizActiveHandler,
    setQuizPaused: setQuizPausedHandler,
    registerTeam,
    loginTeam,
    submitAnswer,
    selectQuestionChoice,
    usePowerUp,
    addQuestion,
    removeQuestion,
    deleteQuestion,
    reorderQuestions,
    grantPowerUp,
    toggleGameState
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};
