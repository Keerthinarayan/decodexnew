/*
  # Fix Ambiguous Column References

  1. Database Changes
    - Fix get_next_question_for_team function to properly qualify column references
    - Ensure all column references are unambiguous
    - Add proper table aliases where needed

  2. Fixes
    - Resolve "column reference 'id' is ambiguous" error
    - Ensure function works with new choice_questions table structure
*/

-- Fix the get_next_question_for_team function with proper column qualification
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
  SELECT t.* INTO v_team_record
  FROM teams t
  WHERE t.name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check if current question is a choice question
  SELECT cq.* INTO v_choice_question
  FROM choice_questions cq
  WHERE cq.id = v_team_record.current_question_id AND cq.is_active = true;
  
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

-- Also fix any other functions that might have similar issues
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
  -- Get team information with proper table alias
  SELECT t.* INTO v_team_record
  FROM teams t
  WHERE t.name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  
  -- Check if current question is a choice question
  SELECT cq.* INTO v_choice_question_record
  FROM choice_questions cq
  WHERE cq.id = v_team_record.current_question_id AND cq.is_active = true;
  
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
      SELECT q.id INTO v_next_question_id
      FROM questions q
      WHERE q.is_active = true 
        AND q.order_index > v_team_record.current_question
        AND q.order_index IS NOT NULL
      ORDER BY q.order_index
      LIMIT 1;
    END IF;
  ELSE
    -- This is a main question
    SELECT q.* INTO v_question_record
    FROM questions q
    WHERE q.id = v_team_record.current_question_id AND q.is_active = true;
    
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
            'id', CASE WHEN cq.difficulty_level = 'easy' THEN 'easy_path' ELSE 'hard_path' END,
            'title', CASE WHEN cq.difficulty_level = 'easy' THEN 'Speed Path' ELSE 'Challenge Path' END,
            'description', cq.title,
            'difficulty', cq.difficulty_level,
            'points', cq.points,
            'icon', CASE WHEN cq.difficulty_level = 'easy' THEN 'fast-forward' ELSE 'zap' END,
            'question_id', cq.id
          )
        ) INTO v_branch_choices
        FROM choice_questions cq
        WHERE cq.branch_question_id = v_question_record.id AND cq.is_active = true;
        
        -- Don't advance automatically - wait for choice
        v_next_question_id := v_team_record.current_question_id;
      ELSE
        -- Regular progression to next main question
        SELECT q.id INTO v_next_question_id
        FROM questions q
        WHERE q.is_active = true 
          AND q.order_index > v_question_record.order_index
          AND q.order_index IS NOT NULL
        ORDER BY q.order_index
        LIMIT 1;
      END IF;
    END IF;
  END IF;
  
  -- Check if quiz is complete
  v_is_complete := v_next_question_id IS NULL AND NOT COALESCE(v_question_record.has_choices, false);
  
  -- Calculate bonus points for completion
  IF v_is_complete AND v_team_record.completion_time IS NULL THEN
    SELECT COUNT(*) + 1 INTO v_completion_rank
    FROM teams t WHERE t.completion_time IS NOT NULL;
    
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
    UPDATE teams t
    SET 
      score = t.score + v_points_earned + v_bonus_points,
      current_question = CASE 
        WHEN COALESCE(v_question_record.has_choices, false) THEN t.current_question
        WHEN v_is_choice_question THEN t.current_question + 1
        ELSE t.current_question + 1
      END,
      current_question_id = CASE
        WHEN COALESCE(v_question_record.has_choices, false) THEN t.current_question_id
        ELSE v_next_question_id
      END,
      last_answered = now(),
      brain_boost_active = false,
      completion_time = CASE WHEN v_is_complete THEN now() ELSE t.completion_time END,
      bonus_points = t.bonus_points + v_bonus_points,
      question_path = t.question_path || jsonb_build_object(
        'question_id', COALESCE(v_question_record.id, v_choice_question_record.id),
        'answer', p_answer,
        'points', v_points_earned,
        'is_choice_question', v_is_choice_question,
        'timestamp', now()
      )
    WHERE t.name = p_team_name;
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

-- Fix select_question_choice function as well
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
  -- Get team information with proper table alias
  SELECT t.* INTO v_team_record
  FROM teams t
  WHERE t.name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get the current branch question with proper table alias
  SELECT q.* INTO v_branch_question
  FROM questions q
  WHERE q.id = v_team_record.current_question_id AND q.has_choices = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get the choice question ID with proper table alias
  SELECT cq.id INTO v_choice_question_id
  FROM choice_questions cq
  WHERE cq.branch_question_id = v_branch_question.id 
    AND cq.difficulty_level = p_choice_difficulty
    AND cq.is_active = true;
  
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
  UPDATE teams t
  SET 
    current_question_id = v_choice_question_id,
    question_path = v_question_path,
    updated_at = now()
  WHERE t.name = p_team_name;
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO anon, authenticated;