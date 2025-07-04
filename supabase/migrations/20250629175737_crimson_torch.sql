/*
  # Branching Quiz System Migration

  1. Database Changes
    - Add branching fields to questions table
    - Add completion tracking for bonus points
    - Create question paths and choices
    - Add admin controls for branching

  2. New Features
    - Question branching with difficulty choices
    - Bonus points for faster completion
    - Admin control over question paths
    - Dynamic question routing
*/

-- Add branching fields to questions table
DO $$
BEGIN
  -- Add branching control fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'is_branch_point'
  ) THEN
    ALTER TABLE questions ADD COLUMN is_branch_point boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'branch_choices'
  ) THEN
    ALTER TABLE questions ADD COLUMN branch_choices jsonb DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'difficulty_level'
  ) THEN
    ALTER TABLE questions ADD COLUMN difficulty_level text DEFAULT 'normal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'next_question_id'
  ) THEN
    ALTER TABLE questions ADD COLUMN next_question_id uuid REFERENCES questions(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'is_choice_question'
  ) THEN
    ALTER TABLE questions ADD COLUMN is_choice_question boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'choice_type'
  ) THEN
    ALTER TABLE questions ADD COLUMN choice_type text DEFAULT NULL;
  END IF;
END $$;

-- Add completion tracking fields to teams table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'completion_time'
  ) THEN
    ALTER TABLE teams ADD COLUMN completion_time timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'question_path'
  ) THEN
    ALTER TABLE teams ADD COLUMN question_path jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'bonus_points'
  ) THEN
    ALTER TABLE teams ADD COLUMN bonus_points integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'current_question_id'
  ) THEN
    ALTER TABLE teams ADD COLUMN current_question_id uuid REFERENCES questions(id);
  END IF;
END $$;

-- Add constraints for difficulty levels
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_difficulty_check;
ALTER TABLE questions ADD CONSTRAINT questions_difficulty_check 
  CHECK (difficulty_level IN ('easy', 'normal', 'hard', 'expert'));

-- Add constraints for choice types
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_choice_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_choice_type_check 
  CHECK (choice_type IN ('difficulty', 'speed', 'topic') OR choice_type IS NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_branch_point ON questions(is_branch_point);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_questions_choice ON questions(is_choice_question);
CREATE INDEX IF NOT EXISTS idx_teams_completion ON teams(completion_time);
CREATE INDEX IF NOT EXISTS idx_teams_current_question ON teams(current_question_id);

-- Function to get next question for team with branching logic
CREATE OR REPLACE FUNCTION get_next_question_for_team(p_team_name text)
RETURNS TABLE(
  id uuid,
  title text,
  question text,
  hint text,
  type text,
  media_url text,
  points integer,
  category text,
  is_active boolean,
  is_branch_point boolean,
  branch_choices jsonb,
  difficulty_level text,
  is_choice_question boolean,
  choice_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_record RECORD;
  v_question_record RECORD;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- If team has a specific current question ID, use that
  IF v_team_record.current_question_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      q.id,
      q.title,
      q.question,
      q.hint,
      q.type,
      q.media_url,
      q.points,
      q.category,
      q.is_active,
      q.is_branch_point,
      q.branch_choices,
      q.difficulty_level,
      q.is_choice_question,
      q.choice_type
    FROM questions q
    WHERE q.id = v_team_record.current_question_id
      AND q.is_active = true;
    RETURN;
  END IF;
  
  -- Otherwise, use order-based approach
  RETURN QUERY
  SELECT 
    q.id,
    q.title,
    q.question,
    q.hint,
    q.type,
    q.media_url,
    q.points,
    q.category,
    q.is_active,
    q.is_branch_point,
    q.branch_choices,
    q.difficulty_level,
    q.is_choice_question,
    q.choice_type
  FROM questions q
  WHERE q.is_active = true
  ORDER BY q.order_index
  LIMIT 1 OFFSET v_team_record.current_question;
END;
$$;

-- Function to handle question choice selection
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
  v_question_path jsonb;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update team's current question and path
  v_question_path := v_team_record.question_path || jsonb_build_object('question_id', p_choice_question_id, 'timestamp', now());
  
  UPDATE teams
  SET 
    current_question_id = p_choice_question_id,
    question_path = v_question_path,
    updated_at = now()
  WHERE name = p_team_name;
  
  RETURN true;
END;
$$;

-- Enhanced verify_answer function with branching support
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
    
    -- Determine next question
    IF v_question_record.next_question_id IS NOT NULL THEN
      v_next_question_id := v_question_record.next_question_id;
    ELSE
      -- Check if this is the last question
      SELECT id INTO v_next_question_id
      FROM questions
      WHERE is_active = true AND order_index > v_question_record.order_index
      ORDER BY order_index
      LIMIT 1;
    END IF;
    
    -- Check if quiz is complete
    v_is_complete := v_next_question_id IS NULL;
    
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
        WHEN v_next_question_id IS NULL THEN current_question + 1
        ELSE current_question + 1
      END,
      current_question_id = v_next_question_id,
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
    'has_choices', v_question_record.is_branch_point,
    'branch_choices', v_question_record.branch_choices
  );
END;
$$;

-- Function to skip question with branching support
CREATE OR REPLACE FUNCTION skip_question_with_branching(p_team_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_record RECORD;
  v_question_record RECORD;
  v_next_question_id uuid := NULL;
  v_is_complete boolean := false;
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
  
  -- Determine next question
  IF v_question_record.next_question_id IS NOT NULL THEN
    v_next_question_id := v_question_record.next_question_id;
  ELSE
    SELECT id INTO v_next_question_id
    FROM questions
    WHERE is_active = true AND order_index > v_question_record.order_index
    ORDER BY order_index
    LIMIT 1;
  END IF;
  
  v_is_complete := v_next_question_id IS NULL;
  
  -- Update team to skip current question
  UPDATE teams
  SET 
    current_question = current_question + 1,
    current_question_id = v_next_question_id,
    last_answered = now(),
    question_path = question_path || jsonb_build_object(
      'question_id', v_question_record.id,
      'skipped', true,
      'timestamp', now()
    )
  WHERE name = p_team_name;
  
  RETURN jsonb_build_object(
    'success', true,
    'is_complete', v_is_complete,
    'next_question_id', v_next_question_id,
    'has_choices', v_question_record.is_branch_point,
    'branch_choices', v_question_record.branch_choices
  );
END;
$$;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION select_question_choice(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION skip_question_with_branching(text) TO anon, authenticated;

-- Update existing questions to set up a sample branching scenario
-- Question 3 becomes a branch point
UPDATE questions 
SET 
  is_branch_point = true,
  branch_choices = jsonb_build_array(
    jsonb_build_object(
      'id', 'hard_path',
      'title', 'Challenge Path',
      'description', 'Take on a difficult 200-point question',
      'difficulty', 'hard',
      'points', 200,
      'icon', 'zap'
    ),
    jsonb_build_object(
      'id', 'easy_path', 
      'title', 'Speed Path',
      'description', 'Quick 100-point question to reach the end faster',
      'difficulty', 'easy',
      'points', 100,
      'icon', 'fast-forward'
    )
  )
WHERE order_index = 3;

-- Insert sample branching questions
INSERT INTO questions (
  title, question, answer, hint, type, points, category, 
  difficulty_level, is_choice_question, choice_type, order_index, is_active
) VALUES 
(
  'Advanced Signal Processing',
  'Calculate the Discrete Fourier Transform of the sequence [1, 0, 1, 0]. What is the magnitude of the second frequency component?',
  '2',
  'Use the DFT formula and calculate for k=1',
  'text',
  200,
  'Advanced Signal Processing',
  'hard',
  true,
  'difficulty',
  4,
  true
),
(
  'Quick Signal Check',
  'What is the unit of frequency?',
  'Hz',
  'Think about cycles per second',
  'text', 
  100,
  'Basic Concepts',
  'easy',
  true,
  'speed',
  5,
  true
);

-- Both choice questions lead to question 6 (create a convergence point)
INSERT INTO questions (
  title, question, answer, hint, type, points, category,
  difficulty_level, order_index, is_active
) VALUES
(
  'Signal Convergence',
  'After your chosen path, you arrive at the final challenge. What is the Nyquist frequency for a signal sampled at 1000 Hz?',
  '500',
  'Nyquist frequency is half the sampling rate',
  'text',
  150,
  'Sampling Theory',
  'normal',
  6,
  true
);

-- Set up the next_question_id relationships
UPDATE questions 
SET next_question_id = (SELECT id FROM questions WHERE order_index = 6 LIMIT 1)
WHERE order_index IN (4, 5);