/*
  # Fix get_next_question_for_team function

  1. Function Updates
    - Fix the `get_next_question_for_team` function to properly handle cases where no question is found
    - Ensure `v_question` record is always properly initialized before use
    - Add proper error handling for edge cases

  2. Security
    - Maintain existing RLS policies
    - Ensure function works with authenticated users
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_next_question_for_team(text);

-- Create the fixed function
CREATE OR REPLACE FUNCTION get_next_question_for_team(p_team_name text)
RETURNS TABLE (
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
  v_team teams%ROWTYPE;
  v_question questions%ROWTYPE;
  v_choices jsonb := '[]'::jsonb;
  v_choice_record choice_questions%ROWTYPE;
BEGIN
  -- Get team information
  SELECT * INTO v_team
  FROM teams
  WHERE name = p_team_name;
  
  -- If team not found, return empty result
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Initialize v_question to NULL explicitly
  v_question := NULL;
  
  -- Try to get the current question for the team
  IF v_team.current_question_id IS NOT NULL THEN
    SELECT * INTO v_question
    FROM questions q
    WHERE q.id = v_team.current_question_id
      AND q.is_active = true;
  END IF;
  
  -- If no current question found, try to get the next question by order
  IF v_question IS NULL THEN
    SELECT * INTO v_question
    FROM questions q
    WHERE q.is_active = true
      AND q.order_index > COALESCE(v_team.current_question, 0)
    ORDER BY q.order_index ASC
    LIMIT 1;
  END IF;
  
  -- If still no question found, return empty result
  IF v_question IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if this question has branch choices
  IF v_question.is_branch_point = true THEN
    -- Get branch choices for this question
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', cq.id,
        'title', cq.title,
        'description', LEFT(cq.question, 100) || CASE WHEN LENGTH(cq.question) > 100 THEN '...' ELSE '' END,
        'difficulty', cq.difficulty_level,
        'points', cq.points,
        'icon', CASE 
          WHEN cq.difficulty_level = 'easy' THEN 'star'
          WHEN cq.difficulty_level = 'hard' THEN 'zap'
          ELSE 'clock'
        END
      )
    ) INTO v_choices
    FROM choice_questions cq
    WHERE cq.branch_question_id = v_question.id
      AND cq.is_active = true;
    
    -- If no choices found, set to empty array
    IF v_choices IS NULL THEN
      v_choices := '[]'::jsonb;
    END IF;
  END IF;
  
  -- Return the question data
  RETURN QUERY SELECT
    v_question.id,
    v_question.title,
    v_question.question,
    v_question.hint,
    v_question.type,
    v_question.media_url,
    v_question.points,
    v_question.category,
    v_question.is_active,
    v_question.is_branch_point,
    v_choices as branch_choices,
    v_question.difficulty_level,
    v_question.has_choices as is_choice_question,
    CASE 
      WHEN v_question.has_choices THEN 'branch'
      ELSE 'normal'
    END as choice_type;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO anon;