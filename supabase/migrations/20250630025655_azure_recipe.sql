/*
  # Complete Fix for Branching System

  1. Database Fixes
    - Ensure proper branch point setup
    - Fix choice selection function
    - Add proper debugging and error handling
    - Create sample branching data

  2. Function Improvements
    - Enhanced select_question_choice function
    - Better error handling and logging
    - Proper team state management
*/

-- First, let's clean up any existing choice questions
DELETE FROM questions WHERE title LIKE 'Choice:%' AND is_choice_question = true;

-- Enhanced select_question_choice function with comprehensive fixes
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
  v_choice_data jsonb;
  v_choice_question_id uuid;
  v_next_question_id uuid := NULL;
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
  
  RAISE NOTICE 'Team found: %, current_question_id: %, current_question: %', 
    v_team_record.name, v_team_record.current_question_id, v_team_record.current_question;
  
  -- Get the current branch question
  IF v_team_record.current_question_id IS NOT NULL THEN
    SELECT * INTO v_branch_question
    FROM questions
    WHERE id = v_team_record.current_question_id AND is_branch_point = true;
  ELSE
    -- Fallback to order-based lookup
    SELECT * INTO v_branch_question
    FROM questions
    WHERE is_active = true AND is_branch_point = true
    ORDER BY order_index
    LIMIT 1 OFFSET v_team_record.current_question;
  END IF;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Branch question not found for team: %, question_id: %', p_team_name, v_team_record.current_question_id;
    RETURN false;
  END IF;
  
  RAISE NOTICE 'Branch question found: %, choices: %', v_branch_question.title, v_branch_question.branch_choices;
  
  -- Extract the choice data based on difficulty
  SELECT choice INTO v_choice_data
  FROM jsonb_array_elements(v_branch_question.branch_choices) AS choice
  WHERE choice->>'difficulty' = p_choice_difficulty;
  
  IF v_choice_data IS NULL THEN
    RAISE NOTICE 'Choice not found for difficulty: %. Available choices: %', 
      p_choice_difficulty, v_branch_question.branch_choices;
    RETURN false;
  END IF;
  
  RAISE NOTICE 'Choice data found: %', v_choice_data;
  
  -- Create a temporary choice question
  INSERT INTO questions (
    title, question, answer, hint, type, media_url, points, category,
    difficulty_level, is_choice_question, choice_type, order_index, is_active, branch_choices
  ) VALUES (
    'Choice: ' || (v_choice_data->>'title'),
    v_choice_data->>'question',
    v_choice_data->>'answer',
    COALESCE(v_choice_data->>'hint', ''),
    COALESCE(v_choice_data->>'type', 'text'),
    COALESCE(v_choice_data->>'mediaUrl', ''),
    (v_choice_data->>'points')::integer,
    v_branch_question.category,
    p_choice_difficulty,
    true,
    'difficulty',
    v_branch_question.order_index + 0.1,
    true,
    jsonb_build_array(v_choice_data)
  ) RETURNING id INTO v_choice_question_id;
  
  RAISE NOTICE 'Choice question created with ID: %', v_choice_question_id;
  
  -- Find the next question after the branch (convergence point)
  SELECT id INTO v_next_question_id
  FROM questions
  WHERE is_active = true 
    AND order_index > v_branch_question.order_index 
    AND NOT is_choice_question
    AND title NOT LIKE 'Choice:%'
    AND NOT is_branch_point
  ORDER BY order_index
  LIMIT 1;
  
  RAISE NOTICE 'Next question ID found: %', v_next_question_id;
  
  -- Set the choice question's next question
  UPDATE questions
  SET next_question_id = v_next_question_id
  WHERE id = v_choice_question_id;
  
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
  
  RAISE NOTICE 'Team updated successfully. New current_question_id: %', v_choice_question_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in select_question_choice: %', SQLERRM;
    RETURN false;
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
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Team not found in get_next_question_for_team: %', p_team_name;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Getting question for team: %, current_question_id: %, current_question: %', 
    v_team_record.name, v_team_record.current_question_id, v_team_record.current_question;
  
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO anon, authenticated;

-- Ensure we have a proper branch point set up
-- First, let's check if we have the "Ancient Code" question and make it a branch point
UPDATE questions 
SET 
  is_branch_point = true,
  branch_choices = jsonb_build_array(
    jsonb_build_object(
      'id', 'easy_path',
      'title', 'Speed Path',
      'description', 'Quick path with lower points - solve a basic frequency question',
      'difficulty', 'easy',
      'points', 100,
      'icon', 'fast-forward',
      'question', 'What is the unit of frequency?',
      'answer', 'Hz',
      'hint', 'Think about cycles per second',
      'type', 'text',
      'mediaUrl', ''
    ),
    jsonb_build_object(
      'id', 'hard_path',
      'title', 'Challenge Path',
      'description', 'Difficult path with higher rewards - solve an advanced DFT problem',
      'difficulty', 'hard',
      'points', 200,
      'icon', 'zap',
      'question', 'Calculate the Discrete Fourier Transform of the sequence [1, 0, 1, 0]. What is the magnitude of the second frequency component?',
      'answer', '2',
      'hint', 'Use the DFT formula and calculate for k=1',
      'type', 'text',
      'mediaUrl', ''
    )
  )
WHERE title = 'Ancient Code' OR order_index = 2;

-- If no "Ancient Code" question exists, create a branch point
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM questions WHERE is_branch_point = true) THEN
    -- Insert a branch point question
    INSERT INTO questions (
      title, question, answer, hint, type, points, category,
      order_index, is_active, is_branch_point, branch_choices
    ) VALUES (
      'Signal Crossroads',
      'You encounter a mysterious signal pattern: 1, 1, 2, 3, 5, 8, ?. What is the next number in this Fibonacci sequence?',
      '13',
      'Each number is the sum of the two preceding ones',
      'text',
      100,
      'Mathematics',
      2,
      true,
      true,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'easy_path',
          'title', 'Speed Path',
          'description', 'Quick path with lower points - solve a basic frequency question',
          'difficulty', 'easy',
          'points', 100,
          'icon', 'fast-forward',
          'question', 'What is the unit of frequency?',
          'answer', 'Hz',
          'hint', 'Think about cycles per second',
          'type', 'text',
          'mediaUrl', ''
        ),
        jsonb_build_object(
          'id', 'hard_path',
          'title', 'Challenge Path',
          'description', 'Difficult path with higher rewards - solve an advanced DFT problem',
          'difficulty', 'hard',
          'points', 200,
          'icon', 'zap',
          'question', 'Calculate the Discrete Fourier Transform of the sequence [1, 0, 1, 0]. What is the magnitude of the second frequency component?',
          'answer', '2',
          'hint', 'Use the DFT formula and calculate for k=1',
          'type', 'text',
          'mediaUrl', ''
        )
      )
    );
    
    RAISE NOTICE 'Created new branch point question';
  END IF;
END $$;

-- Add a convergence question after the branch paths
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
  3,
  true
) ON CONFLICT DO NOTHING;

-- Debug output to verify setup
DO $$
DECLARE
  branch_question RECORD;
  team_count integer;
BEGIN
  -- Check branch point
  SELECT * INTO branch_question FROM questions WHERE is_branch_point = true LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE 'Branch point found: % (ID: %, Order: %)', 
      branch_question.title, branch_question.id, branch_question.order_index;
    RAISE NOTICE 'Branch choices: %', branch_question.branch_choices;
  ELSE
    RAISE NOTICE 'No branch point found';
  END IF;
  
  -- Check teams
  SELECT COUNT(*) INTO team_count FROM teams;
  RAISE NOTICE 'Total teams in database: %', team_count;
  
  -- Show team states
  FOR branch_question IN SELECT name, current_question, current_question_id FROM teams LOOP
    RAISE NOTICE 'Team: %, current_question: %, current_question_id: %', 
      branch_question.name, branch_question.current_question, branch_question.current_question_id;
  END LOOP;
END $$;