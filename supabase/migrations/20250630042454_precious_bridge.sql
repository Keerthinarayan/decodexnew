/*
  # Fix Branching System Issues

  1. Database Fixes
    - Fix choice questions to have NULL order_index so they don't interfere with main sequence
    - Fix answer verification for choice questions
    - Ensure teams start from order_index 1, not 0
    - Fix team progression after choice questions

  2. Function Updates
    - Update get_next_question_for_team to properly handle order_index
    - Fix verify_answer to handle choice questions correctly
    - Ensure proper progression after choice completion
*/

-- Fix existing choice questions to have NULL order_index
UPDATE questions 
SET order_index = NULL 
WHERE is_choice_question = true;

-- Update the create_branch_questions function to not set order_index for choice questions
CREATE OR REPLACE FUNCTION create_branch_questions(
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
  v_convergence_question_id uuid;
  v_max_order integer;
BEGIN
  -- Get the maximum order_index for convergence question
  SELECT COALESCE(MAX(order_index), 0) + 1 INTO v_max_order
  FROM questions 
  WHERE order_index IS NOT NULL AND is_active = true;
  
  -- Create easy question (NO order_index)
  INSERT INTO questions (
    title, question, answer, hint, type, points, category,
    difficulty_level, is_choice_question, choice_type, is_active
  ) VALUES (
    'Easy Path: ' || LEFT(p_easy_question, 30) || '...',
    p_easy_question,
    p_easy_answer,
    p_easy_hint,
    'text',
    p_easy_points,
    p_category,
    'easy',
    true,
    'difficulty',
    true
  ) RETURNING id INTO v_easy_question_id;
  
  -- Create hard question (NO order_index)
  INSERT INTO questions (
    title, question, answer, hint, type, points, category,
    difficulty_level, is_choice_question, choice_type, is_active
  ) VALUES (
    'Hard Path: ' || LEFT(p_hard_question, 30) || '...',
    p_hard_question,
    p_hard_answer,
    p_hard_hint,
    'text',
    p_hard_points,
    p_category,
    'hard',
    true,
    'difficulty',
    true
  ) RETURNING id INTO v_hard_question_id;
  
  -- Create convergence question with proper order_index
  INSERT INTO questions (
    title, question, answer, hint, type, points, category,
    order_index, is_active
  ) VALUES (
    'Convergence Point',
    'After your chosen path, what is the Nyquist frequency for a signal sampled at 1000 Hz?',
    '500',
    'Nyquist frequency is half the sampling rate',
    'text',
    150,
    'Sampling Theory',
    v_max_order,
    true
  ) RETURNING id INTO v_convergence_question_id;
  
  -- Set both choice questions to point to convergence
  UPDATE questions 
  SET next_question_id = v_convergence_question_id
  WHERE id IN (v_easy_question_id, v_hard_question_id);
  
  RETURN jsonb_build_object(
    'easy_question_id', v_easy_question_id,
    'hard_question_id', v_hard_question_id,
    'convergence_question_id', v_convergence_question_id
  );
END;
$$;

-- Enhanced get_next_question_for_team function to properly handle order_index
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
  
  -- Otherwise, use order-based approach (only questions with order_index)
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
    AND q.order_index IS NOT NULL
  ORDER BY q.order_index
  LIMIT 1 OFFSET v_team_record.current_question;
END;
$$;

-- Enhanced verify_answer function with proper choice question handling
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
  
  -- Get the correct answer - always use the question's answer field
  v_correct_answer := LOWER(TRIM(v_question_record.answer));
  v_is_correct := LOWER(TRIM(p_answer)) = v_correct_answer;
  
  RAISE NOTICE 'Answer check: provided=%, expected=%, correct=%', 
    LOWER(TRIM(p_answer)), v_correct_answer, v_is_correct;
  
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
      -- Regular question progression (including choice questions)
      IF v_question_record.next_question_id IS NOT NULL THEN
        v_next_question_id := v_question_record.next_question_id;
      ELSE
        -- Find next question by order (only questions with order_index)
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
GRANT EXECUTE ON FUNCTION create_branch_questions(text, text, text, integer, text, text, text, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;

-- Reset any teams that might be stuck on choice questions
UPDATE teams 
SET 
  current_question_id = (
    SELECT id FROM questions 
    WHERE is_active = true AND order_index IS NOT NULL 
    ORDER BY order_index 
    LIMIT 1
  ),
  current_question = 0
WHERE current_question_id IN (
  SELECT id FROM questions WHERE is_choice_question = true
);

-- Debug output
DO $$
DECLARE
  q RECORD;
BEGIN
  RAISE NOTICE 'Question structure after fix:';
  FOR q IN 
    SELECT title, order_index, is_branch_point, is_choice_question, difficulty_level 
    FROM questions 
    WHERE is_active = true 
    ORDER BY order_index NULLS LAST, title 
  LOOP
    RAISE NOTICE 'Question: % | Order: % | Branch: % | Choice: % | Difficulty: %', 
      q.title, q.order_index, q.is_branch_point, q.is_choice_question, q.difficulty_level;
  END LOOP;
END $$;