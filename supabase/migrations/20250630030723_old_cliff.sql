/*
  # Clean Branching System with Dedicated Question IDs

  1. Changes
    - Create dedicated easy and hard questions for branches
    - These questions have IDs but no order_index (so they don't interfere with main flow)
    - Branch points reference these questions directly
    - Simplified choice selection logic

  2. Structure
    - Branch point questions have easy_question_id and hard_question_id
    - Choice questions exist as real questions but are hidden from main flow
    - After completing choice question, teams proceed to next main question
*/

-- Clean up any temporary choice questions
DELETE FROM questions WHERE title LIKE 'Choice:%' AND is_choice_question = true;

-- First, let's create dedicated easy and hard questions for branching
-- These will have IDs but no order_index so they don't interfere with main flow

-- Easy path question
INSERT INTO questions (
  title, question, answer, hint, type, points, category,
  difficulty_level, is_choice_question, choice_type, is_active
) VALUES (
  'Basic Frequency Question',
  'What is the unit of frequency?',
  'Hz',
  'Think about cycles per second',
  'text',
  100,
  'Basic Concepts',
  'easy',
  true,
  'difficulty',
  true
) ON CONFLICT DO NOTHING;

-- Hard path question  
INSERT INTO questions (
  title, question, answer, hint, type, points, category,
  difficulty_level, is_choice_question, choice_type, is_active
) VALUES (
  'Advanced DFT Challenge',
  'Calculate the Discrete Fourier Transform of the sequence [1, 0, 1, 0]. What is the magnitude of the second frequency component?',
  '2',
  'Use the DFT formula and calculate for k=1',
  'text',
  200,
  'Advanced Signal Processing',
  'hard',
  true,
  'difficulty',
  true
) ON CONFLICT DO NOTHING;

-- Convergence question (this has an order_index)
INSERT INTO questions (
  title, question, answer, hint, type, points, category,
  order_index, is_active
) VALUES (
  'Signal Convergence',
  'After your chosen path, what is the Nyquist frequency for a signal sampled at 1000 Hz?',
  '500',
  'Nyquist frequency is half the sampling rate',
  'text',
  150,
  'Sampling Theory',
  10,
  true
) ON CONFLICT DO NOTHING;

-- Set up the branch point to reference the dedicated questions
UPDATE questions 
SET 
  is_branch_point = true,
  easy_question_id = (SELECT id FROM questions WHERE title = 'Basic Frequency Question' LIMIT 1),
  hard_question_id = (SELECT id FROM questions WHERE title = 'Advanced DFT Challenge' LIMIT 1),
  branch_choices = jsonb_build_array(
    jsonb_build_object(
      'id', 'easy_path',
      'title', 'Speed Path',
      'description', 'Quick path with lower points - solve a basic frequency question',
      'difficulty', 'easy',
      'points', 100,
      'icon', 'fast-forward'
    ),
    jsonb_build_object(
      'id', 'hard_path',
      'title', 'Challenge Path',
      'description', 'Difficult path with higher rewards - solve an advanced DFT problem',
      'difficulty', 'hard',
      'points', 200,
      'icon', 'zap'
    )
  )
WHERE title = 'Ancient Code' OR order_index = 2;

-- Set both choice questions to point to the convergence question
UPDATE questions 
SET next_question_id = (SELECT id FROM questions WHERE title = 'Signal Convergence' LIMIT 1)
WHERE title IN ('Basic Frequency Question', 'Advanced DFT Challenge');

-- Simplified select_question_choice function
CREATE OR REPLACE FUNCTION select_question_choice(
  p_team_name text,
  p_choice_difficulty text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_record RECORD;
  v_branch_question RECORD;
  v_choice_question_id uuid;
  v_question_path jsonb;
BEGIN
  -- Log the input parameters
  RAISE NOTICE 'select_question_choice called with team: %, difficulty: %', p_team_name, p_choice_difficulty;
  
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Team not found: %', p_team_name;
    RETURN false;
  END IF;
  
  -- Get the current branch question
  SELECT * INTO v_branch_question
  FROM questions
  WHERE id = v_team_record.current_question_id AND is_branch_point = true;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Branch question not found for team: %', p_team_name;
    RETURN false;
  END IF;
  
  -- Get the appropriate choice question ID based on difficulty
  IF p_choice_difficulty = 'easy' THEN
    v_choice_question_id := v_branch_question.easy_question_id;
  ELSIF p_choice_difficulty = 'hard' THEN
    v_choice_question_id := v_branch_question.hard_question_id;
  ELSE
    RAISE NOTICE 'Invalid difficulty: %', p_choice_difficulty;
    RETURN false;
  END IF;
  
  IF v_choice_question_id IS NULL THEN
    RAISE NOTICE 'Choice question ID is null for difficulty: %', p_choice_difficulty;
    RETURN false;
  END IF;
  
  RAISE NOTICE 'Selected choice question ID: %', v_choice_question_id;
  
  -- Update team's path
  v_question_path := COALESCE(v_team_record.question_path, '[]'::jsonb) || jsonb_build_object(
    'choice_selected', p_choice_difficulty,
    'choice_question_id', v_choice_question_id,
    'branch_question_id', v_branch_question.id,
    'timestamp', now()
  );
  
  -- Update team to point to the choice question
  UPDATE teams
  SET 
    current_question_id = v_choice_question_id,
    current_question = current_question + 1,
    question_path = v_question_path,
    updated_at = now()
  WHERE name = p_team_name;
  
  RAISE NOTICE 'Team updated successfully. New current_question_id: %', v_choice_question_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in select_question_choice: %', SQLERRM;
    RETURN false;
END;
$$;

-- Enhanced verify_answer function for the new system
CREATE OR REPLACE FUNCTION verify_answer_with_branching(
  p_team_name text,
  p_answer text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_record RECORD;
  v_question_record RECORD;
  v_correct_answer text;
  v_is_correct boolean := false;
  v_points_earned integer := 0;
  v_next_question_id uuid := NULL;
  v_is_complete boolean := false;
  v_bonus_points integer := 0;
  v_completion_rank integer := 0;
  v_branch_choices jsonb := NULL;
  v_easy_question RECORD;
  v_hard_question RECORD;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  
  -- Get current question
  SELECT * INTO v_question_record
  FROM questions
  WHERE id = v_team_record.current_question_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question not found');
  END IF;
  
  -- Check if answer is correct (case-insensitive)
  v_correct_answer := LOWER(TRIM(v_question_record.answer));
  v_is_correct := LOWER(TRIM(p_answer)) = v_correct_answer;
  
  -- If correct, calculate points and update team
  IF v_is_correct THEN
    v_points_earned := CASE 
      WHEN v_team_record.brain_boost_active THEN v_question_record.points * 2 
      ELSE v_question_record.points 
    END;
    
    -- Check if this is a branch point and prepare choices
    IF v_question_record.is_branch_point AND v_question_record.easy_question_id IS NOT NULL AND v_question_record.hard_question_id IS NOT NULL THEN
      -- Get easy and hard question details for display
      SELECT title, points, difficulty_level INTO v_easy_question
      FROM questions WHERE id = v_question_record.easy_question_id;
      
      SELECT title, points, difficulty_level INTO v_hard_question
      FROM questions WHERE id = v_question_record.hard_question_id;
      
      -- Build branch choices for display
      v_branch_choices := jsonb_build_array(
        jsonb_build_object(
          'id', 'easy_path',
          'title', 'Speed Path',
          'description', COALESCE(v_easy_question.title, 'Quick path with lower points'),
          'difficulty', 'easy',
          'points', COALESCE(v_easy_question.points, 100),
          'icon', 'fast-forward'
        ),
        jsonb_build_object(
          'id', 'hard_path',
          'title', 'Challenge Path', 
          'description', COALESCE(v_hard_question.title, 'Difficult path with higher points'),
          'difficulty', 'hard',
          'points', COALESCE(v_hard_question.points, 200),
          'icon', 'zap'
        )
      );
      
      -- For branch points, don't advance automatically - wait for choice
      v_next_question_id := v_team_record.current_question_id;
    ELSE
      -- Regular question progression
      IF v_question_record.next_question_id IS NOT NULL THEN
        v_next_question_id := v_question_record.next_question_id;
      ELSE
        -- Find next question by order (skip choice questions)
        SELECT id INTO v_next_question_id
        FROM questions
        WHERE is_active = true 
          AND order_index > COALESCE(v_question_record.order_index, 0)
          AND order_index IS NOT NULL
        ORDER BY order_index
        LIMIT 1;
      END IF;
    END IF;
    
    -- Check if quiz is complete
    v_is_complete := v_next_question_id IS NULL AND NOT v_question_record.is_branch_point;
    
    -- Calculate bonus points for completion
    IF v_is_complete AND v_team_record.completion_time IS NULL THEN
      SELECT COUNT(*) + 1 INTO v_completion_rank
      FROM teams WHERE completion_time IS NOT NULL;
      
      v_bonus_points := CASE
        WHEN v_completion_rank = 1 THEN 500
        WHEN v_completion_rank = 2 THEN 300
        WHEN v_completion_rank = 3 THEN 200
        WHEN v_completion_rank <= 5 THEN 100
        ELSE 50
      END;
    END IF;
    
    -- Update team progress
    UPDATE teams
    SET 
      score = score + v_points_earned + v_bonus_points,
      current_question = CASE 
        WHEN v_question_record.is_branch_point THEN current_question
        ELSE current_question + 1
      END,
      current_question_id = CASE
        WHEN v_question_record.is_branch_point THEN current_question_id
        ELSE v_next_question_id
      END,
      last_answered = now(),
      brain_boost_active = false,
      completion_time = CASE WHEN v_is_complete THEN now() ELSE completion_time END,
      bonus_points = bonus_points + v_bonus_points,
      question_path = question_path || jsonb_build_object(
        'question_id', v_question_record.id,
        'answer', p_answer,
        'points', v_points_earned,
        'timestamp', now()
      )
    WHERE name = p_team_name;
  END IF;
  
  RETURN jsonb_build_object(
    'success', v_is_correct,
    'points_earned', v_points_earned,
    'bonus_points', v_bonus_points,
    'completion_rank', v_completion_rank,
    'is_complete', v_is_complete,
    'next_question_id', v_next_question_id,
    'has_choices', v_question_record.is_branch_point AND v_branch_choices IS NOT NULL,
    'branch_choices', v_branch_choices
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;

-- Debug output to verify the setup
DO $$
DECLARE
  branch_question RECORD;
  easy_question RECORD;
  hard_question RECORD;
  convergence_question RECORD;
BEGIN
  -- Find the branch point
  SELECT * INTO branch_question FROM questions WHERE is_branch_point = true LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE 'Branch point: % (ID: %, Order: %)', 
      branch_question.title, branch_question.id, branch_question.order_index;
    
    -- Get easy question
    SELECT * INTO easy_question FROM questions WHERE id = branch_question.easy_question_id;
    IF FOUND THEN
      RAISE NOTICE 'Easy path: % (ID: %, % points)', 
        easy_question.title, easy_question.id, easy_question.points;
    END IF;
    
    -- Get hard question  
    SELECT * INTO hard_question FROM questions WHERE id = branch_question.hard_question_id;
    IF FOUND THEN
      RAISE NOTICE 'Hard path: % (ID: %, % points)', 
        hard_question.title, hard_question.id, hard_question.points;
    END IF;
    
    -- Check convergence
    SELECT * INTO convergence_question FROM questions WHERE id = easy_question.next_question_id;
    IF FOUND THEN
      RAISE NOTICE 'Convergence question: % (ID: %, Order: %)', 
        convergence_question.title, convergence_question.id, convergence_question.order_index;
    END IF;
  ELSE
    RAISE NOTICE 'No branch point found';
  END IF;
END $$;