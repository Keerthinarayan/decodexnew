-- Fix branching question progression issue

-- Drop the existing function
DROP FUNCTION IF EXISTS verify_answer_with_branching(text, text);

-- Create the fixed verify_answer_with_branching function
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

  -- Check if team has a current question ID
  IF v_team_record.current_question_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No current question assigned'
    );
  END IF;

  -- First try to find the question in the choice_questions table
  SELECT * INTO v_choice_question_record
  FROM choice_questions
  WHERE id = v_team_record.current_question_id
    AND is_active = true;

  IF FOUND THEN
    -- This is a choice question
    v_is_choice_question := true;
    v_is_correct := LOWER(TRIM(v_choice_question_record.answer)) = LOWER(TRIM(p_answer));
    
    IF v_is_correct THEN
      v_points_earned := v_choice_question_record.points;
      
      -- Apply brain boost if active
      IF v_team_record.brain_boost_active THEN
        v_brain_boost_multiplier := 2;
        v_bonus_points := v_choice_question_record.points;
      END IF;
      
      -- After completing a choice question, find the NEXT main question in sequence
      -- Get the branch question's order_index first
      SELECT order_index INTO v_next_question_id
      FROM questions
      WHERE id = v_choice_question_record.branch_question_id;
      
      -- Then find the next main question after the branch question
      SELECT id INTO v_next_question_id
      FROM questions
      WHERE is_active = true
        AND order_index > (
          SELECT order_index 
          FROM questions 
          WHERE id = v_choice_question_record.branch_question_id
        )
        AND order_index IS NOT NULL
      ORDER BY order_index ASC
      LIMIT 1;
    END IF;
  ELSE
    -- Try to find in main questions table
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

    -- This is a main question
    v_is_correct := LOWER(TRIM(v_question_record.answer)) = LOWER(TRIM(p_answer));
    
    IF v_is_correct THEN
      v_points_earned := v_question_record.points;
      
      -- Apply brain boost if active
      IF v_team_record.brain_boost_active THEN
        v_brain_boost_multiplier := 2;
        v_bonus_points := v_question_record.points;
      END IF;
      
      -- Check if this is a branch point
      IF v_question_record.is_branch_point = true OR v_question_record.has_choices = true THEN
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
      ELSE
        -- Regular main question - find next question
        SELECT id INTO v_next_question_id
        FROM questions
        WHERE is_active = true
          AND order_index > v_question_record.order_index
          AND order_index IS NOT NULL
        ORDER BY order_index ASC
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  -- Check if quiz is complete (no next question and not a branch point)
  IF v_is_correct AND v_next_question_id IS NULL AND NOT COALESCE(v_question_record.is_branch_point, false) THEN
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

  -- Create question path entry
  v_path_entry := jsonb_build_object(
    'questionId', v_team_record.current_question_id,
    'answer', p_answer,
    'correct', v_is_correct,
    'points', v_points_earned * v_brain_boost_multiplier,
    'isChoiceQuestion', v_is_choice_question,
    'timestamp', NOW()
  );

  -- Update question path
  v_question_path := COALESCE(v_team_record.question_path, '[]'::jsonb) || v_path_entry;

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
      question_path = v_question_path,
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

-- Also update the select_question_choice function to properly set the choice question
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
    'choiceSelected', p_choice_difficulty,
    'choiceQuestionId', v_choice_question.id,
    'branchQuestionId', v_branch_question.id,
    'selectedAt', NOW()
  );

  -- Update team to point to the choice question
  UPDATE teams
  SET 
    current_question_id = v_choice_question.id,
    question_path = v_question_path,
    updated_at = NOW()
  WHERE name = p_team_name;

  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO authenticated, anon;