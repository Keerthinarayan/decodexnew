/*
  # Redesign Branching System with Separate Choice Questions

  1. New Structure
    - Create separate `choice_questions` table
    - Main questions flow normally with order_index
    - Choice questions are completely separate
    - After choice question, player returns to next main question

  2. Tables
    - `choice_questions` - separate table for choice questions
    - `questions` - main questions only
    - Simple branching logic

  3. Functions
    - Simplified answer verification
    - Clear choice selection
    - Automatic progression after choice questions
*/

-- Create separate choice_questions table
CREATE TABLE IF NOT EXISTS choice_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  hint text,
  type text NOT NULL DEFAULT 'text',
  media_url text,
  points integer DEFAULT 100,
  category text NOT NULL,
  explanation text,
  difficulty_level text NOT NULL DEFAULT 'easy',
  branch_question_id uuid REFERENCES questions(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
ALTER TABLE choice_questions ADD CONSTRAINT choice_questions_type_check 
  CHECK (type IN ('text', 'image', 'video', 'audio', 'file'));

ALTER TABLE choice_questions ADD CONSTRAINT choice_questions_difficulty_check 
  CHECK (difficulty_level IN ('easy', 'hard'));

-- Enable RLS
ALTER TABLE choice_questions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Choice questions readable by authenticated users only"
  ON choice_questions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Choice questions manageable by authenticated users only"
  ON choice_questions
  FOR ALL
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_choice_questions_branch ON choice_questions(branch_question_id);
CREATE INDEX IF NOT EXISTS idx_choice_questions_difficulty ON choice_questions(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_choice_questions_active ON choice_questions(is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_choice_questions_updated_at 
  BEFORE UPDATE ON choice_questions
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Clean up existing questions table - remove branching complexity
ALTER TABLE questions DROP COLUMN IF EXISTS easy_question_id;
ALTER TABLE questions DROP COLUMN IF EXISTS hard_question_id;
ALTER TABLE questions DROP COLUMN IF EXISTS branch_choices;
ALTER TABLE questions DROP COLUMN IF EXISTS is_choice_question;
ALTER TABLE questions DROP COLUMN IF EXISTS choice_type;

-- Add simple branch indicator
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'has_choices'
  ) THEN
    ALTER TABLE questions ADD COLUMN has_choices boolean DEFAULT false;
  END IF;
END $$;

-- Delete all existing choice questions from main questions table
DELETE FROM questions WHERE title LIKE '%Path:%' OR title LIKE 'Choice:%';

-- Reset teams that might be stuck
UPDATE teams 
SET 
  current_question_id = (
    SELECT id FROM questions 
    WHERE is_active = true AND order_index IS NOT NULL 
    ORDER BY order_index 
    LIMIT 1
  ),
  current_question = 0
WHERE current_question_id NOT IN (
  SELECT id FROM questions WHERE is_active = true AND order_index IS NOT NULL
);

-- Function to create choice questions for a branch question
CREATE OR REPLACE FUNCTION create_choice_questions_for_branch(
  p_branch_question_id uuid,
  p_easy_question text,
  p_easy_answer text,
  p_easy_hint text,
  p_easy_points integer,
  p_hard_question text,
  p_hard_answer text,
  p_hard_hint text,
  p_hard_points integer,
  p_category text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_easy_question_id uuid;
  v_hard_question_id uuid;
BEGIN
  -- Create easy choice question
  INSERT INTO choice_questions (
    title, question, answer, hint, type, points, category,
    difficulty_level, branch_question_id, is_active
  ) VALUES (
    'Easy Path: ' || LEFT(p_easy_question, 30) || '...',
    p_easy_question,
    p_easy_answer,
    p_easy_hint,
    'text',
    p_easy_points,
    p_category,
    'easy',
    p_branch_question_id,
    true
  ) RETURNING id INTO v_easy_question_id;
  
  -- Create hard choice question
  INSERT INTO choice_questions (
    title, question, answer, hint, type, points, category,
    difficulty_level, branch_question_id, is_active
  ) VALUES (
    'Hard Path: ' || LEFT(p_hard_question, 30) || '...',
    p_hard_question,
    p_hard_answer,
    p_hard_hint,
    'text',
    p_hard_points,
    p_category,
    'hard',
    p_branch_question_id,
    true
  ) RETURNING id INTO v_hard_question_id;
  
  -- Mark the main question as having choices
  UPDATE questions 
  SET has_choices = true
  WHERE id = p_branch_question_id;
  
  RETURN jsonb_build_object(
    'easy_question_id', v_easy_question_id,
    'hard_question_id', v_hard_question_id,
    'success', true
  );
END;
$$;

-- Function to get choice questions for a branch
CREATE OR REPLACE FUNCTION get_choice_questions_for_branch(p_branch_question_id uuid)
RETURNS TABLE(
  id uuid,
  title text,
  question text,
  hint text,
  type text,
  media_url text,
  points integer,
  category text,
  difficulty_level text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cq.id,
    cq.title,
    cq.question,
    cq.hint,
    cq.type,
    cq.media_url,
    cq.points,
    cq.category,
    cq.difficulty_level
  FROM choice_questions cq
  WHERE cq.branch_question_id = p_branch_question_id
    AND cq.is_active = true
  ORDER BY cq.difficulty_level;
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
  v_choice_question_record RECORD;
  v_correct_answer text;
  v_is_correct boolean := false;
  v_points_earned integer := 0;
  v_next_question_id uuid := NULL;
  v_is_complete boolean := false;
  v_bonus_points integer := 0;
  v_completion_rank integer := 0;
  v_branch_choices jsonb := NULL;
  v_is_choice_question boolean := false;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  
  -- Check if current question is a choice question
  SELECT * INTO v_choice_question_record
  FROM choice_questions
  WHERE id = v_team_record.current_question_id AND is_active = true;
  
  IF FOUND THEN
    -- This is a choice question
    v_is_choice_question := true;
    v_correct_answer := LOWER(TRIM(v_choice_question_record.answer));
    v_is_correct := LOWER(TRIM(p_answer)) = v_correct_answer;
    
    IF v_is_correct THEN
      v_points_earned := CASE 
        WHEN v_team_record.brain_boost_active THEN v_choice_question_record.points * 2 
        ELSE v_choice_question_record.points 
      END;
      
      -- After choice question, go to next main question
      SELECT id INTO v_next_question_id
      FROM questions
      WHERE is_active = true 
        AND order_index > v_team_record.current_question
        AND order_index IS NOT NULL
      ORDER BY order_index
      LIMIT 1;
    END IF;
  ELSE
    -- This is a main question
    SELECT * INTO v_question_record
    FROM questions
    WHERE id = v_team_record.current_question_id AND is_active = true;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Question not found');
    END IF;
    
    v_correct_answer := LOWER(TRIM(v_question_record.answer));
    v_is_correct := LOWER(TRIM(p_answer)) = v_correct_answer;
    
    IF v_is_correct THEN
      v_points_earned := CASE 
        WHEN v_team_record.brain_boost_active THEN v_question_record.points * 2 
        ELSE v_question_record.points 
      END;
      
      -- Check if this question has choices
      IF v_question_record.has_choices THEN
        -- Build branch choices for display
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', CASE WHEN difficulty_level = 'easy' THEN 'easy_path' ELSE 'hard_path' END,
            'title', CASE WHEN difficulty_level = 'easy' THEN 'Speed Path' ELSE 'Challenge Path' END,
            'description', title,
            'difficulty', difficulty_level,
            'points', points,
            'icon', CASE WHEN difficulty_level = 'easy' THEN 'fast-forward' ELSE 'zap' END,
            'question_id', id
          )
        ) INTO v_branch_choices
        FROM choice_questions
        WHERE branch_question_id = v_question_record.id AND is_active = true;
        
        -- Don't advance automatically - wait for choice
        v_next_question_id := v_team_record.current_question_id;
      ELSE
        -- Regular progression to next main question
        SELECT id INTO v_next_question_id
        FROM questions
        WHERE is_active = true 
          AND order_index > v_question_record.order_index
          AND order_index IS NOT NULL
        ORDER BY order_index
        LIMIT 1;
      END IF;
    END IF;
  END IF;
  
  -- Check if quiz is complete
  v_is_complete := v_next_question_id IS NULL AND NOT COALESCE(v_question_record.has_choices, false);
  
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
  
  -- Update team progress if answer is correct
  IF v_is_correct THEN
    UPDATE teams
    SET 
      score = score + v_points_earned + v_bonus_points,
      current_question = CASE 
        WHEN COALESCE(v_question_record.has_choices, false) THEN current_question
        WHEN v_is_choice_question THEN current_question + 1
        ELSE current_question + 1
      END,
      current_question_id = CASE
        WHEN COALESCE(v_question_record.has_choices, false) THEN current_question_id
        ELSE v_next_question_id
      END,
      last_answered = now(),
      brain_boost_active = false,
      completion_time = CASE WHEN v_is_complete THEN now() ELSE completion_time END,
      bonus_points = bonus_points + v_bonus_points,
      question_path = question_path || jsonb_build_object(
        'question_id', COALESCE(v_question_record.id, v_choice_question_record.id),
        'answer', p_answer,
        'points', v_points_earned,
        'is_choice_question', v_is_choice_question,
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
    'has_choices', COALESCE(v_question_record.has_choices, false) AND v_branch_choices IS NOT NULL,
    'branch_choices', v_branch_choices,
    'is_choice_question', v_is_choice_question
  );
END;
$$;

-- Function to select a choice question
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
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get the current branch question
  SELECT * INTO v_branch_question
  FROM questions
  WHERE id = v_team_record.current_question_id AND has_choices = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get the choice question ID
  SELECT id INTO v_choice_question_id
  FROM choice_questions
  WHERE branch_question_id = v_branch_question.id 
    AND difficulty_level = p_choice_difficulty
    AND is_active = true;
  
  IF v_choice_question_id IS NULL THEN
    RETURN false;
  END IF;
  
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
    question_path = v_question_path,
    updated_at = now()
  WHERE name = p_team_name;
  
  RETURN true;
END;
$$;

-- Enhanced get_next_question_for_team function
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
  v_choice_question RECORD;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check if current question is a choice question
  SELECT * INTO v_choice_question
  FROM choice_questions
  WHERE id = v_team_record.current_question_id AND is_active = true;
  
  IF FOUND THEN
    -- Return choice question
    RETURN QUERY
    SELECT 
      v_choice_question.id,
      v_choice_question.title,
      v_choice_question.question,
      v_choice_question.hint,
      v_choice_question.type,
      v_choice_question.media_url,
      v_choice_question.points,
      v_choice_question.category,
      v_choice_question.is_active,
      false as is_branch_point,
      NULL::jsonb as branch_choices,
      v_choice_question.difficulty_level,
      true as is_choice_question,
      'difficulty' as choice_type;
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
      q.has_choices as is_branch_point,
      NULL::jsonb as branch_choices,
      q.difficulty_level,
      false as is_choice_question,
      NULL::text as choice_type
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
    q.has_choices as is_branch_point,
    NULL::jsonb as branch_choices,
    q.difficulty_level,
    false as is_choice_question,
    NULL::text as choice_type
  FROM questions q
  WHERE q.is_active = true
    AND q.order_index IS NOT NULL
  ORDER BY q.order_index
  LIMIT 1 OFFSET v_team_record.current_question;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_choice_questions_for_branch(uuid, text, text, text, integer, text, text, text, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_choice_questions_for_branch(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO anon, authenticated;

-- Create a view for admin to see all choice questions
CREATE OR REPLACE VIEW admin_choice_questions AS
SELECT 
  cq.id,
  cq.title,
  cq.question,
  cq.answer,
  cq.hint,
  cq.type,
  cq.media_url,
  cq.points,
  cq.category,
  cq.explanation,
  cq.difficulty_level,
  cq.branch_question_id,
  q.title as branch_question_title,
  cq.is_active,
  cq.created_at,
  cq.updated_at
FROM choice_questions cq
LEFT JOIN questions q ON cq.branch_question_id = q.id
ORDER BY q.order_index, cq.difficulty_level;

-- Debug output
DO $$
DECLARE
  q RECORD;
BEGIN
  RAISE NOTICE 'New system structure:';
  RAISE NOTICE 'Main questions:';
  FOR q IN 
    SELECT title, order_index, has_choices 
    FROM questions 
    WHERE is_active = true AND order_index IS NOT NULL
    ORDER BY order_index 
  LOOP
    RAISE NOTICE '  Question: % | Order: % | Has Choices: %', 
      q.title, q.order_index, q.has_choices;
  END LOOP;
  
  RAISE NOTICE 'Choice questions:';
  FOR q IN 
    SELECT title, difficulty_level, branch_question_id 
    FROM choice_questions 
    WHERE is_active = true
    ORDER BY branch_question_id, difficulty_level 
  LOOP
    RAISE NOTICE '  Choice: % | Difficulty: % | Branch ID: %', 
      q.title, q.difficulty_level, q.branch_question_id;
  END LOOP;
END $$;