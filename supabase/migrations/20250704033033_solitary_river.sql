/*
  # Fix Choice Selection Foreign Key Error and Answer Verification

  1. Problem Fixes
    - Foreign key constraint error when selecting choices
    - Wrong answer detection for correct answers
    - Choice question progression issues

  2. Solutions
    - Don't set current_question_id to choice question IDs (FK violation)
    - Use question_path to track choice question state
    - Fix answer verification with proper trimming and case handling
    - Ensure proper progression after choice completion
*/

-- Drop and recreate the select_question_choice function
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
  v_team_record RECORD;
  v_branch_question RECORD;
  v_choice_question RECORD;
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
  WHERE id = v_team_record.current_question_id 
    AND (is_branch_point = true OR has_choices = true)
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get the choice question
  SELECT * INTO v_choice_question
  FROM choice_questions
  WHERE branch_question_id = v_branch_question.id 
    AND difficulty_level = p_choice_difficulty
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Add choice selection to question path
  v_question_path := COALESCE(v_team_record.question_path, '[]'::jsonb) || jsonb_build_object(
    'action', 'choice_selected',
    'choiceSelected', p_choice_difficulty,
    'choiceQuestionId', v_choice_question.id,
    'branchQuestionId', v_branch_question.id,
    'choiceQuestion', v_choice_question.question,
    'choiceAnswer', v_choice_question.answer,
    'choicePoints', v_choice_question.points,
    'selectedAt', NOW(),
    'answered', false
  );

  -- Update team with choice selection - DON'T change current_question_id to avoid FK violation
  -- Keep current_question_id pointing to the branch question
  UPDATE teams
  SET 
    question_path = v_question_path,
    updated_at = NOW()
  WHERE name = p_team_name;

  RETURN true;
END;
$$;

-- Drop and recreate the get_next_question_for_team function to handle choice state
DROP FUNCTION IF EXISTS get_next_question_for_team(text);

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
  v_team RECORD;
  v_question RECORD;
  v_choices jsonb := '[]'::jsonb;
  v_last_path_entry jsonb;
  v_choice_question_id uuid;
BEGIN
  -- Get team information
  SELECT * INTO v_team
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Check if team has a pending choice question in their path
  IF v_team.question_path IS NOT NULL AND jsonb_array_length(v_team.question_path) > 0 THEN
    v_last_path_entry := v_team.question_path -> -1;
    
    -- If last entry is a choice selection that hasn't been answered
    IF (v_last_path_entry->>'action') = 'choice_selected' 
       AND (v_last_path_entry->>'answered')::boolean = false THEN
      
      -- Return the choice question details from the path
      RETURN QUERY SELECT
        (v_last_path_entry->>'choiceQuestionId')::uuid as id,
        'Choice: ' || (v_last_path_entry->>'choiceSelected') as title,
        v_last_path_entry->>'choiceQuestion' as question,
        ''::text as hint,
        'text'::text as type,
        ''::text as media_url,
        (v_last_path_entry->>'choicePoints')::integer as points,
        'Choice Question'::text as category,
        true as is_active,
        false as is_branch_point,
        '[]'::jsonb as branch_choices,
        v_last_path_entry->>'choiceSelected' as difficulty_level,
        true as is_choice_question,
        'difficulty'::text as choice_type;
      
      RETURN;
    END IF;
  END IF;
  
  -- Get the current main question
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
    
    -- Update team's current_question_id for consistency
    IF v_question IS NOT NULL THEN
      UPDATE teams 
      SET current_question_id = v_question.id
      WHERE name = p_team_name;
    END IF;
  END IF;
  
  -- If still no question found, return empty result
  IF v_question IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if this question has branch choices
  IF v_question.is_branch_point = true OR v_question.has_choices = true THEN
    -- Get branch choices for this question
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', cq.id,
        'title', CASE 
          WHEN cq.difficulty_level = 'easy' THEN 'Speed Path'
          WHEN cq.difficulty_level = 'hard' THEN 'Challenge Path'
          ELSE 'Standard Path'
        END,
        'description', cq.title,
        'difficulty', cq.difficulty_level,
        'points', cq.points,
        'icon', CASE 
          WHEN cq.difficulty_level = 'easy' THEN 'fast-forward'
          WHEN cq.difficulty_level = 'hard' THEN 'zap'
          ELSE 'star'
        END
      )
    ) INTO v_choices
    FROM choice_questions cq
    WHERE cq.branch_question_id = v_question.id
      AND cq.is_active = true;
    
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
    COALESCE(v_question.is_branch_point, false) OR COALESCE(v_question.has_choices, false) as is_branch_point,
    v_choices as branch_choices,
    v_question.difficulty_level,
    false as is_choice_question,
    CASE 
      WHEN COALESCE(v_question.has_choices, false) OR COALESCE(v_question.is_branch_point, false) THEN 'branch'
      ELSE 'normal'
    END as choice_type;
END;
$$;

-- Drop and recreate the verify_answer_with_branching function with better answer verification
DROP FUNCTION IF EXISTS verify_answer_with_branching(text, text);

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
  v_is_correct boolean := false;
  v_points_earned integer := 0;
  v_bonus_points integer := 0;
  v_next_question_id uuid := NULL;
  v_completion_time timestamptz := NULL;
  v_brain_boost_multiplier integer := 1;
  v_question_path jsonb;
  v_path_entry jsonb;
  v_is_choice_question boolean := false;
  v_branch_choices jsonb := NULL;
  v_completion_rank integer := 0;
  v_is_complete boolean := false;
  v_last_path_entry jsonb;
  v_updated_path jsonb;
  v_correct_answer text;
  v_provided_answer text;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Team not found'
    );
  END IF;

  -- Normalize the provided answer (trim whitespace, convert to lowercase)
  v_provided_answer := LOWER(TRIM(p_answer));

  -- Check if we're answering a choice question
  IF v_team_record.question_path IS NOT NULL AND jsonb_array_length(v_team_record.question_path) > 0 THEN
    v_last_path_entry := v_team_record.question_path -> -1;
    
    IF (v_last_path_entry->>'action') = 'choice_selected' 
       AND (v_last_path_entry->>'answered')::boolean = false THEN
      
      v_is_choice_question := true;
      
      -- Get the correct answer from the path entry
      v_correct_answer := LOWER(TRIM(v_last_path_entry->>'choiceAnswer'));
      v_is_correct := v_provided_answer = v_correct_answer;
      
      IF v_is_correct THEN
        v_points_earned := (v_last_path_entry->>'choicePoints')::integer;
        
        -- Apply brain boost if active
        IF v_team_record.brain_boost_active THEN
          v_brain_boost_multiplier := 2;
          v_bonus_points := v_points_earned;
        END IF;
        
        -- Mark choice as answered in path
        v_updated_path := v_team_record.question_path;
        v_updated_path := jsonb_set(
          v_updated_path, 
          array[jsonb_array_length(v_updated_path) - 1, 'answered'], 
          'true'::jsonb
        );
        v_updated_path := jsonb_set(
          v_updated_path, 
          array[jsonb_array_length(v_updated_path) - 1, 'userAnswer'], 
          to_jsonb(p_answer)
        );
        
        -- Find the next main question after the branch question
        SELECT id INTO v_next_question_id
        FROM questions
        WHERE is_active = true
          AND order_index > (
            SELECT order_index 
            FROM questions 
            WHERE id = (v_last_path_entry->>'branchQuestionId')::uuid
          )
          AND order_index IS NOT NULL
        ORDER BY order_index ASC
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  -- If not a choice question, handle as main question
  IF NOT v_is_choice_question THEN
    -- Get current main question
    SELECT * INTO v_question_record
    FROM questions
    WHERE id = v_team_record.current_question_id
      AND is_active = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Question not found or inactive'
      );
    END IF;

    -- Normalize the correct answer (trim whitespace, convert to lowercase)
    v_correct_answer := LOWER(TRIM(v_question_record.answer));
    v_is_correct := v_provided_answer = v_correct_answer;
    
    IF v_is_correct THEN
      v_points_earned := v_question_record.points;
      
      -- Apply brain boost if active
      IF v_team_record.brain_boost_active THEN
        v_brain_boost_multiplier := 2;
        v_bonus_points := v_points_earned;
      END IF;
      
      -- Check if this is a branch point
      IF COALESCE(v_question_record.is_branch_point, false) OR COALESCE(v_question_record.has_choices, false) THEN
        -- Get branch choices for display
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', cq.id,
            'title', CASE 
              WHEN cq.difficulty_level = 'easy' THEN 'Speed Path'
              WHEN cq.difficulty_level = 'hard' THEN 'Challenge Path'
              ELSE 'Standard Path'
            END,
            'description', cq.title,
            'difficulty', cq.difficulty_level,
            'points', cq.points,
            'icon', CASE 
              WHEN cq.difficulty_level = 'easy' THEN 'fast-forward'
              WHEN cq.difficulty_level = 'hard' THEN 'zap'
              ELSE 'star'
            END
          )
        ) INTO v_branch_choices
        FROM choice_questions cq
        WHERE cq.branch_question_id = v_question_record.id
          AND cq.is_active = true;
        
        -- For branch points, don't advance automatically - wait for choice selection
        v_next_question_id := v_team_record.current_question_id;
        
        -- Add main question answer to path
        v_updated_path := COALESCE(v_team_record.question_path, '[]'::jsonb) || jsonb_build_object(
          'action', 'main_question_answered',
          'questionId', v_question_record.id,
          'answer', p_answer,
          'correct', v_is_correct,
          'points', v_points_earned * v_brain_boost_multiplier,
          'timestamp', NOW()
        );
      ELSE
        -- Regular main question - find next question
        SELECT id INTO v_next_question_id
        FROM questions
        WHERE is_active = true
          AND order_index > v_question_record.order_index
          AND order_index IS NOT NULL
        ORDER BY order_index ASC
        LIMIT 1;
        
        -- Add main question answer to path
        v_updated_path := COALESCE(v_team_record.question_path, '[]'::jsonb) || jsonb_build_object(
          'action', 'main_question_answered',
          'questionId', v_question_record.id,
          'answer', p_answer,
          'correct', v_is_correct,
          'points', v_points_earned * v_brain_boost_multiplier,
          'timestamp', NOW()
        );
      END IF;
    END IF;
  END IF;

  -- Check if quiz is complete
  IF v_is_correct AND v_next_question_id IS NULL AND NOT COALESCE(v_question_record.is_branch_point, false) AND NOT COALESCE(v_question_record.has_choices, false) THEN
    v_is_complete := true;
    v_completion_time := NOW();
    
    -- Calculate completion rank and bonus points
    SELECT COUNT(*) + 1 INTO v_completion_rank
    FROM teams WHERE completion_time IS NOT NULL;
    
    v_bonus_points := v_bonus_points + CASE
      WHEN v_completion_rank = 1 THEN 500
      WHEN v_completion_rank = 2 THEN 300
      WHEN v_completion_rank = 3 THEN 200
      WHEN v_completion_rank <= 5 THEN 100
      ELSE 50
    END;
  END IF;

  -- Update team record only if answer is correct
  IF v_is_correct THEN
    UPDATE teams SET
      score = score + (v_points_earned * v_brain_boost_multiplier) + v_bonus_points,
      bonus_points = bonus_points + v_bonus_points,
      current_question = CASE 
        -- Don't increment for branch points (wait for choice selection)
        WHEN COALESCE(v_question_record.is_branch_point, false) OR COALESCE(v_question_record.has_choices, false) THEN current_question
        -- Increment for choice questions and regular questions
        ELSE current_question + 1
      END,
      current_question_id = CASE 
        -- Keep same question ID for branch points (wait for choice selection)
        WHEN COALESCE(v_question_record.is_branch_point, false) OR COALESCE(v_question_record.has_choices, false) THEN current_question_id
        -- Set next question for choice questions and regular questions
        ELSE v_next_question_id
      END,
      last_answered = NOW(),
      brain_boost_active = CASE 
        WHEN v_team_record.brain_boost_active THEN false 
        ELSE brain_boost_active 
      END,
      completion_time = COALESCE(v_completion_time, completion_time),
      question_path = COALESCE(v_updated_path, question_path),
      updated_at = NOW()
    WHERE name = p_team_name;
  END IF;

  -- Return result
  RETURN jsonb_build_object(
    'success', v_is_correct,
    'points_earned', v_points_earned * v_brain_boost_multiplier,
    'bonus_points', v_bonus_points,
    'completion_rank', v_completion_rank,
    'is_complete', v_is_complete,
    'next_question_id', v_next_question_id,
    'has_choices', COALESCE(v_question_record.is_branch_point, false) OR COALESCE(v_question_record.has_choices, false),
    'branch_choices', v_branch_choices,
    'is_choice_question', v_is_choice_question
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO authenticated, anon;