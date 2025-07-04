/*
  # Fix Branching System Migration

  1. Changes
    - Update questions table to support proper branching with easy/hard question references
    - Create functions to handle branch point logic correctly
    - Update existing sample data to demonstrate proper branching

  2. New Structure
    - Branch points reference actual easy/hard questions by ID
    - After answering a branch point correctly, players choose between easy/hard paths
    - Both paths converge to the next sequential question
*/

-- Add columns for easy and hard question references
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'easy_question_id'
  ) THEN
    ALTER TABLE questions ADD COLUMN easy_question_id uuid REFERENCES questions(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'hard_question_id'
  ) THEN
    ALTER TABLE questions ADD COLUMN hard_question_id uuid REFERENCES questions(id);
  END IF;
END $$;

-- Create indexes for the new foreign keys
CREATE INDEX IF NOT EXISTS idx_questions_easy_question ON questions(easy_question_id);
CREATE INDEX IF NOT EXISTS idx_questions_hard_question ON questions(hard_question_id);

-- Enhanced function to verify answers with proper branching
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
  IF v_team_record.current_question_id IS NOT NULL THEN
    SELECT * INTO v_question_record
    FROM questions
    WHERE id = v_team_record.current_question_id AND is_active = true;
  ELSE
    SELECT * INTO v_question_record
    FROM questions
    WHERE is_active = true
    ORDER BY order_index
    LIMIT 1 OFFSET v_team_record.current_question;
  END IF;
  
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
      -- Get easy and hard question details
      SELECT title, points, difficulty_level INTO v_easy_question
      FROM questions WHERE id = v_question_record.easy_question_id;
      
      SELECT title, points, difficulty_level INTO v_hard_question
      FROM questions WHERE id = v_question_record.hard_question_id;
      
      -- Build branch choices
      v_branch_choices := jsonb_build_array(
        jsonb_build_object(
          'id', 'easy_path',
          'title', 'Speed Path',
          'description', COALESCE(v_easy_question.title, 'Quick path with lower points'),
          'difficulty', COALESCE(v_easy_question.difficulty_level, 'easy'),
          'points', COALESCE(v_easy_question.points, 100),
          'icon', 'fast-forward',
          'question_id', v_question_record.easy_question_id
        ),
        jsonb_build_object(
          'id', 'hard_path',
          'title', 'Challenge Path', 
          'description', COALESCE(v_hard_question.title, 'Difficult path with higher points'),
          'difficulty', COALESCE(v_hard_question.difficulty_level, 'hard'),
          'points', COALESCE(v_hard_question.points, 200),
          'icon', 'zap',
          'question_id', v_question_record.hard_question_id
        )
      );
      
      -- For branch points, don't advance automatically - wait for choice
      v_next_question_id := v_team_record.current_question_id;
    ELSE
      -- Regular question progression
      IF v_question_record.next_question_id IS NOT NULL THEN
        v_next_question_id := v_question_record.next_question_id;
      ELSE
        -- Find next question by order
        SELECT id INTO v_next_question_id
        FROM questions
        WHERE is_active = true AND order_index > v_question_record.order_index
        ORDER BY order_index
        LIMIT 1;
      END IF;
    END IF;
    
    -- Check if quiz is complete
    v_is_complete := v_next_question_id IS NULL AND NOT v_question_record.is_branch_point;
    
    -- Calculate bonus points for completion
    IF v_is_complete AND v_team_record.completion_time IS NULL THEN
      -- Count how many teams have already completed
      SELECT COUNT(*) + 1 INTO v_completion_rank
      FROM teams
      WHERE completion_time IS NOT NULL;
      
      -- Award bonus points based on completion rank
      v_bonus_points := CASE
        WHEN v_completion_rank = 1 THEN 500  -- First place
        WHEN v_completion_rank = 2 THEN 300  -- Second place
        WHEN v_completion_rank = 3 THEN 200  -- Third place
        WHEN v_completion_rank <= 5 THEN 100 -- Top 5
        ELSE 50  -- Completion bonus
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

-- Enhanced function to handle question choice selection
CREATE OR REPLACE FUNCTION select_question_choice(
  p_team_name text,
  p_choice_question_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_record RECORD;
  v_choice_question RECORD;
  v_next_question_id uuid := NULL;
  v_question_path jsonb;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get the chosen question
  SELECT * INTO v_choice_question
  FROM questions
  WHERE id = p_choice_question_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Find the next question after the choice (convergence point)
  IF v_choice_question.next_question_id IS NOT NULL THEN
    v_next_question_id := v_choice_question.next_question_id;
  ELSE
    -- Find next question by order
    SELECT id INTO v_next_question_id
    FROM questions
    WHERE is_active = true AND order_index > v_choice_question.order_index
    ORDER BY order_index
    LIMIT 1;
  END IF;
  
  -- Update team's path
  v_question_path := v_team_record.question_path || jsonb_build_object(
    'choice_question_id', p_choice_question_id,
    'choice_type', 'branch_selection',
    'timestamp', now()
  );
  
  UPDATE teams
  SET 
    current_question_id = p_choice_question_id,
    current_question = current_question + 1,
    question_path = v_question_path,
    updated_at = now()
  WHERE name = p_team_name;
  
  RETURN true;
END;
$$;

-- Clean up existing sample data and create proper branching example
DELETE FROM questions WHERE title IN ('Advanced Signal Processing', 'Quick Signal Check', 'Signal Convergence');

-- Insert proper branching questions
INSERT INTO questions (
  title, question, answer, hint, type, points, category, 
  difficulty_level, order_index, is_active
) VALUES 
-- Easy path question
(
  'Basic Frequency Question',
  'What is the unit of frequency?',
  'Hz',
  'Think about cycles per second',
  'text',
  100,
  'Basic Concepts',
  'easy',
  10,
  true
),
-- Hard path question  
(
  'Advanced DFT Challenge',
  'Calculate the Discrete Fourier Transform of the sequence [1, 0, 1, 0]. What is the magnitude of the second frequency component?',
  '2',
  'Use the DFT formula and calculate for k=1',
  'text',
  200,
  'Advanced Signal Processing',
  'hard',
  11,
  true
),
-- Convergence question
(
  'Nyquist Theorem',
  'What is the Nyquist frequency for a signal sampled at 1000 Hz?',
  '500',
  'Nyquist frequency is half the sampling rate',
  'text',
  150,
  'Sampling Theory',
  'normal',
  12,
  true
);

-- Set up the branch point (assuming question with order_index 2 exists)
UPDATE questions 
SET 
  is_branch_point = true,
  easy_question_id = (SELECT id FROM questions WHERE title = 'Basic Frequency Question' LIMIT 1),
  hard_question_id = (SELECT id FROM questions WHERE title = 'Advanced DFT Challenge' LIMIT 1)
WHERE order_index = 2;

-- Set both choice questions to point to the convergence question
UPDATE questions 
SET next_question_id = (SELECT id FROM questions WHERE title = 'Nyquist Theorem' LIMIT 1)
WHERE title IN ('Basic Frequency Question', 'Advanced DFT Challenge');

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION select_question_choice(text, uuid) TO anon, authenticated;

-- Debug output
DO $$
DECLARE
  branch_question RECORD;
  easy_question RECORD;
  hard_question RECORD;
BEGIN
  -- Find the branch point
  SELECT * INTO branch_question FROM questions WHERE is_branch_point = true LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE 'Branch point: % (ID: %)', branch_question.title, branch_question.id;
    
    -- Get easy question
    SELECT * INTO easy_question FROM questions WHERE id = branch_question.easy_question_id;
    IF FOUND THEN
      RAISE NOTICE 'Easy path: % (% points)', easy_question.title, easy_question.points;
    END IF;
    
    -- Get hard question  
    SELECT * INTO hard_question FROM questions WHERE id = branch_question.hard_question_id;
    IF FOUND THEN
      RAISE NOTICE 'Hard path: % (% points)', hard_question.title, hard_question.points;
    END IF;
  ELSE
    RAISE NOTICE 'No branch point found';
  END IF;
END $$;