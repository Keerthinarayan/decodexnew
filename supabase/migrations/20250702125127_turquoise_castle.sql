-- Fix the verify_answer_with_branching function to handle data types correctly
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
  v_team record;
  v_question record;
  v_choice_question record;
  v_correct_answer text;
  v_is_correct boolean := false;
  v_points_earned integer := 0;
  v_next_question_id uuid := NULL;
  v_is_complete boolean := false;
  v_bonus_points integer := 0;
  v_completion_rank integer := 0;
  v_branch_choices jsonb := NULL;
  v_is_choice_question boolean := false;
  v_last_path_entry jsonb;
  v_updated_path jsonb;
  v_has_choices boolean := false;
BEGIN
  -- Get team information
  SELECT t.* INTO v_team
  FROM teams t
  WHERE t.name = p_team_name;

  IF v_team.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  RAISE NOTICE 'Verifying answer for team: %, answer: %', p_team_name, p_answer;

  -- Check if we're answering a choice question
  IF v_team.question_path IS NOT NULL AND jsonb_array_length(v_team.question_path) > 0 THEN
    v_last_path_entry := v_team.question_path -> -1;
    
    IF (v_last_path_entry->>'question_type') = 'choice' 
       AND (v_last_path_entry->>'answered') IS NULL THEN
      
      v_is_choice_question := true;
      
      -- Get the choice question
      SELECT cq.* INTO v_choice_question
      FROM choice_questions cq
      WHERE cq.id = (v_last_path_entry->>'question_id')::uuid
        AND cq.is_active = true;
      
      IF FOUND THEN
        v_correct_answer := LOWER(TRIM(v_choice_question.answer));
        v_is_correct := LOWER(TRIM(p_answer)) = v_correct_answer;
        
        RAISE NOTICE 'Choice question - Expected: %, Got: %, Correct: %', 
          v_correct_answer, LOWER(TRIM(p_answer)), v_is_correct;
        
        IF v_is_correct THEN
          v_points_earned := CASE 
            WHEN v_team.brain_boost_active THEN v_choice_question.points * 2 
            ELSE v_choice_question.points 
          END;
          
          -- Mark choice question as answered in path
          v_updated_path := v_team.question_path;
          v_updated_path := jsonb_set(
            v_updated_path, 
            array[jsonb_array_length(v_updated_path) - 1, 'answered'], 
            'true'::jsonb
          );
          v_updated_path := jsonb_set(
            v_updated_path, 
            array[jsonb_array_length(v_updated_path) - 1, 'answer'], 
            to_jsonb(p_answer)
          );
          v_updated_path := jsonb_set(
            v_updated_path, 
            array[jsonb_array_length(v_updated_path) - 1, 'points_earned'], 
            to_jsonb(v_points_earned)
          );
          
          -- Find next main question
          SELECT q.id INTO v_next_question_id
          FROM questions q
          WHERE q.is_active = true 
            AND q.order_index > v_team.current_question
            AND q.order_index IS NOT NULL
          ORDER BY q.order_index
          LIMIT 1;
        END IF;
      END IF;
    END IF;
  END IF;

  -- If not a choice question, handle as main question
  IF NOT v_is_choice_question THEN
    -- Get current main question
    SELECT q.* INTO v_question
    FROM questions q
    WHERE q.id = v_team.current_question_id
      AND q.is_active = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Question not found');
    END IF;

    v_correct_answer := LOWER(TRIM(v_question.answer));
    v_is_correct := LOWER(TRIM(p_answer)) = v_correct_answer;
    v_has_choices := COALESCE(v_question.has_choices, false);
    
    RAISE NOTICE 'Main question - Expected: %, Got: %, Correct: %', 
      v_correct_answer, LOWER(TRIM(p_answer)), v_is_correct;

    IF v_is_correct THEN
      v_points_earned := CASE 
        WHEN v_team.brain_boost_active THEN v_question.points * 2 
        ELSE v_question.points 
      END;

      -- Check if this question has choices
      IF v_has_choices THEN
        -- Build branch choices for display
        SELECT jsonb_agg(
          jsonb_build_object(
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
        WHERE cq.branch_question_id = v_question.id 
          AND cq.is_active = true;

        -- Don't advance automatically - wait for choice
        v_next_question_id := v_team.current_question_id;
      ELSE
        -- Regular progression to next main question
        SELECT q.id INTO v_next_question_id
        FROM questions q
        WHERE q.is_active = true 
          AND q.order_index > v_question.order_index
          AND q.order_index IS NOT NULL
        ORDER BY q.order_index
        LIMIT 1;
      END IF;

      -- Update question path for main question
      v_updated_path := COALESCE(v_team.question_path, '[]'::jsonb) || jsonb_build_object(
        'question_id', v_question.id,
        'question_type', 'main',
        'answer', p_answer,
        'points_earned', v_points_earned,
        'answered_at', now()
      );
    END IF;
  END IF;

  -- Check if quiz is complete
  v_is_complete := v_next_question_id IS NULL AND v_is_correct AND NOT v_has_choices;

  -- Calculate bonus points for completion
  IF v_is_complete AND v_team.completion_time IS NULL THEN
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
        WHEN v_has_choices THEN current_question
        WHEN v_is_choice_question THEN current_question + 1
        ELSE current_question + 1
      END,
      current_question_id = CASE
        WHEN v_has_choices THEN current_question_id
        ELSE v_next_question_id
      END,
      last_answered = now(),
      brain_boost_active = false,
      completion_time = CASE WHEN v_is_complete THEN now() ELSE completion_time END,
      bonus_points = bonus_points + v_bonus_points,
      question_path = COALESCE(v_updated_path, question_path)
    WHERE id = v_team.id;
  END IF;

  RETURN jsonb_build_object(
    'success', v_is_correct,
    'points_earned', v_points_earned,
    'bonus_points', v_bonus_points,
    'completion_rank', v_completion_rank,
    'is_complete', v_is_complete,
    'next_question_id', v_next_question_id,
    'has_choices', v_has_choices AND v_branch_choices IS NOT NULL,
    'branch_choices', v_branch_choices,
    'is_choice_question', v_is_choice_question
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;