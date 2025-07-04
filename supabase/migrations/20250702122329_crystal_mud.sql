/*
  # Fix choice selection foreign key constraint

  1. Database Function Updates
    - Update `select_question_choice` function to properly handle foreign key constraints
    - Ensure `current_question_id` always references valid questions table IDs
    - Use `question_path` to track choice question progress

  2. Changes Made
    - Modified function to set `current_question_id` to next main question or NULL
    - Added proper choice question tracking in `question_path`
    - Maintained compatibility with existing question flow logic
*/

-- Drop and recreate the select_question_choice function with proper constraint handling
DROP FUNCTION IF EXISTS select_question_choice(text, text);

CREATE OR REPLACE FUNCTION select_question_choice(
  p_team_name text,
  p_choice_difficulty text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_id uuid;
  v_current_question_id uuid;
  v_choice_question record;
  v_next_question_id uuid;
  v_question_path jsonb;
BEGIN
  -- Get team information
  SELECT id, current_question_id, question_path
  INTO v_team_id, v_current_question_id, v_question_path
  FROM teams
  WHERE name = p_team_name;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Team not found: %', p_team_name;
  END IF;

  -- Get the choice question based on current branch question and difficulty
  SELECT cq.*
  INTO v_choice_question
  FROM choice_questions cq
  WHERE cq.branch_question_id = v_current_question_id
    AND cq.difficulty_level = p_choice_difficulty
    AND cq.is_active = true
  LIMIT 1;

  IF v_choice_question.id IS NULL THEN
    RAISE EXCEPTION 'No choice question found for difficulty: %', p_choice_difficulty;
  END IF;

  -- Initialize question_path if null
  IF v_question_path IS NULL THEN
    v_question_path := '[]'::jsonb;
  END IF;

  -- Add the choice question to the question path
  v_question_path := v_question_path || jsonb_build_object(
    'question_id', v_choice_question.id,
    'question_type', 'choice',
    'difficulty', p_choice_difficulty,
    'branch_question_id', v_current_question_id,
    'selected_at', now()
  );

  -- Find the next main question in sequence
  -- Look for the next question after the current branch question
  SELECT q.id
  INTO v_next_question_id
  FROM questions q
  WHERE q.order_index > (
    SELECT order_index 
    FROM questions 
    WHERE id = v_current_question_id
  )
    AND q.is_active = true
  ORDER BY q.order_index ASC
  LIMIT 1;

  -- Update team with choice selection
  -- Set current_question_id to next main question (or NULL if no more questions)
  -- This ensures the foreign key constraint is satisfied
  UPDATE teams
  SET 
    question_path = v_question_path,
    current_question_id = v_next_question_id,
    updated_at = now()
  WHERE id = v_team_id;

  RETURN true;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error selecting choice: %', SQLERRM;
END;
$$;

-- Also update the get_next_question_for_team function to handle choice questions properly
DROP FUNCTION IF EXISTS get_next_question_for_team(text);

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
  v_team record;
  v_last_path_entry jsonb;
  v_choice_question_id uuid;
BEGIN
  -- Get team information
  SELECT t.*, 
         CASE 
           WHEN jsonb_array_length(COALESCE(t.question_path, '[]'::jsonb)) > 0 
           THEN (t.question_path -> -1)
           ELSE NULL 
         END as last_path_entry
  INTO v_team
  FROM teams t
  WHERE t.name = p_team_name;

  IF v_team.id IS NULL THEN
    RAISE EXCEPTION 'Team not found: %', p_team_name;
  END IF;

  -- Check if the last entry in question_path is a choice question that hasn't been answered
  IF v_team.last_path_entry IS NOT NULL 
     AND (v_team.last_path_entry->>'question_type') = 'choice' THEN
    
    v_choice_question_id := (v_team.last_path_entry->>'question_id')::uuid;
    
    -- Return the choice question
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
      cq.is_active,
      false as is_branch_point,
      '[]'::jsonb as branch_choices,
      cq.difficulty_level,
      true as is_choice_question,
      cq.difficulty_level as choice_type
    FROM choice_questions cq
    WHERE cq.id = v_choice_question_id
      AND cq.is_active = true;
    
    RETURN;
  END IF;

  -- Otherwise, return the current main question
  IF v_team.current_question_id IS NOT NULL THEN
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
      CASE 
        WHEN q.has_choices THEN
          (SELECT jsonb_agg(
            jsonb_build_object(
              'title', CASE 
                WHEN cq.difficulty_level = 'easy' THEN 'Cautious Approach'
                WHEN cq.difficulty_level = 'hard' THEN 'Bold Investigation'
                ELSE 'Standard Method'
              END,
              'description', CASE 
                WHEN cq.difficulty_level = 'easy' THEN 'Take a careful, methodical approach with lower risk but standard rewards.'
                WHEN cq.difficulty_level = 'hard' THEN 'Pursue a daring investigation with higher risk but greater rewards.'
                ELSE 'Follow standard investigative procedures.'
              END,
              'difficulty', cq.difficulty_level,
              'points', cq.points,
              'icon', CASE 
                WHEN cq.difficulty_level = 'easy' THEN 'clock'
                WHEN cq.difficulty_level = 'hard' THEN 'zap'
                ELSE 'star'
              END
            )
          )
          FROM choice_questions cq 
          WHERE cq.branch_question_id = q.id 
            AND cq.is_active = true
          )
        ELSE '[]'::jsonb
      END as branch_choices,
      q.difficulty_level,
      false as is_choice_question,
      NULL as choice_type
    FROM questions q
    WHERE q.id = v_team.current_question_id
      AND q.is_active = true;
  END IF;

END;
$$;