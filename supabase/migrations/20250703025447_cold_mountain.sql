-- Fix verify_answer_with_branching function

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS verify_answer_with_branching(text, text);

-- Create the corrected function
CREATE OR REPLACE FUNCTION verify_answer_with_branching(
  p_team_name text,
  p_answer text
) RETURNS jsonb AS $$
DECLARE
  v_team_record RECORD;
  v_question_record RECORD;
  v_choice_question_record RECORD;
  v_is_correct boolean := false;
  v_points_earned integer := 0;
  v_bonus_points integer := 0;
  v_next_question_id uuid;
  v_completion_time timestamptz;
  v_brain_boost_multiplier integer := 1;
  v_question_path jsonb;
  v_path_entry jsonb;
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

  -- Check if team has a current question ID (could be main question or choice question)
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
    v_is_correct := LOWER(TRIM(v_choice_question_record.answer)) = LOWER(TRIM(p_answer));
    
    IF v_is_correct THEN
      v_points_earned := v_choice_question_record.points;
      
      -- Apply brain boost if active
      IF v_team_record.brain_boost_active THEN
        v_brain_boost_multiplier := 2;
        v_bonus_points := v_choice_question_record.points; -- Double points from brain boost
      END IF;
      
      -- Find the parent branch question to determine next question
      SELECT next_question_id INTO v_next_question_id
      FROM questions
      WHERE id = v_choice_question_record.branch_question_id;
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
        v_bonus_points := v_question_record.points; -- Double points from brain boost
      END IF;
      
      v_next_question_id := v_question_record.next_question_id;
    END IF;
  END IF;

  -- Create question path entry
  v_path_entry := jsonb_build_object(
    'questionId', v_team_record.current_question_id,
    'answer', p_answer,
    'correct', v_is_correct,
    'points', v_points_earned * v_brain_boost_multiplier,
    'timestamp', NOW()
  );

  -- Update question path
  v_question_path := COALESCE(v_team_record.question_path, '[]'::jsonb) || v_path_entry;

  -- Check if this is the last question (no next question)
  IF v_is_correct AND v_next_question_id IS NULL THEN
    v_completion_time := NOW();
  END IF;

  -- Update team record
  UPDATE teams SET
    score = score + (v_points_earned * v_brain_boost_multiplier),
    bonus_points = bonus_points + v_bonus_points,
    current_question = current_question + 1,
    current_question_id = CASE 
      WHEN v_is_correct THEN v_next_question_id
      ELSE current_question_id
    END,
    last_answered = NOW(),
    brain_boost_active = CASE 
      WHEN v_team_record.brain_boost_active THEN false 
      ELSE brain_boost_active 
    END,
    completion_time = CASE 
      WHEN v_completion_time IS NOT NULL THEN v_completion_time
      ELSE completion_time
    END,
    question_path = v_question_path,
    updated_at = NOW()
  WHERE name = p_team_name;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'correct', v_is_correct,
    'points_earned', v_points_earned * v_brain_boost_multiplier,
    'bonus_points', v_bonus_points,
    'brain_boost_used', v_team_record.brain_boost_active,
    'completed', v_completion_time IS NOT NULL,
    'next_question_id', v_next_question_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon;