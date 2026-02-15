-- Drop and recreate the verify_answer_with_branching function with improved answer verification
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

  -- Normalize the provided answer (remove extra spaces, convert to lowercase, remove special chars)
  v_provided_answer := LOWER(TRIM(REGEXP_REPLACE(p_answer, '\s+', ' ', 'g')));

  -- Check if we're answering a choice question
  IF v_team_record.question_path IS NOT NULL AND jsonb_array_length(v_team_record.question_path) > 0 THEN
    v_last_path_entry := v_team_record.question_path -> -1;
    
    IF (v_last_path_entry->>'action') = 'choice_selected' 
       AND (v_last_path_entry->>'answered')::boolean = false THEN
      
      v_is_choice_question := true;
      
      -- Get the correct answer from the path entry and normalize it
      v_correct_answer := LOWER(TRIM(REGEXP_REPLACE(v_last_path_entry->>'choiceAnswer', '\s+', ' ', 'g')));
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

    -- Normalize the correct answer (remove extra spaces, convert to lowercase, remove special chars)
    v_correct_answer := LOWER(TRIM(REGEXP_REPLACE(v_question_record.answer, '\s+', ' ', 'g')));
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
    ELSE
      -- Even for wrong answers, add debug info to path
      v_updated_path := COALESCE(v_team_record.question_path, '[]'::jsonb) || jsonb_build_object(
        'action', 'main_question_attempted',
        'questionId', v_question_record.id,
        'answer', p_answer,
        'correct', false,
        'timestamp', NOW()
      );
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
  ELSE
    -- For wrong answers, still update the question_path for debugging
    UPDATE teams SET
      question_path = COALESCE(v_updated_path, question_path),
      updated_at = NOW()
    WHERE name = p_team_name;
  END IF;

  -- Return result with debug info
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
      'error', SQLERRM,
      'debug', jsonb_build_object(
        'provided_answer', v_provided_answer,
        'correct_answer', v_correct_answer,
        'original_provided', p_answer
      )
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO authenticated, anon;