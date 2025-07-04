/*
  # Fix Core Branching Issues

  1. Fix answer verification for choice questions
  2. Fix question creation in admin panel
  3. Fix choice selection display
  4. Ensure proper question IDs for easy/hard questions
*/

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
      -- Regular question progression
      IF v_question_record.next_question_id IS NOT NULL THEN
        v_next_question_id := v_question_record.next_question_id;
      ELSE
        -- Find next question by order (skip choice questions)
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

-- Enhanced select_question_choice function with better logging
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
  RAISE NOTICE 'select_question_choice: team=%, difficulty=%', p_team_name, p_choice_difficulty;
  
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Team not found: %', p_team_name;
    RETURN false;
  END IF;
  
  -- Get the current branch question
  SELECT * INTO v_branch_question
  FROM questions
  WHERE id = v_team_record.current_question_id AND is_branch_point = true;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Branch question not found for team: %', p_team_name;
    RETURN false;
  END IF;
  
  -- Get the appropriate choice question ID based on difficulty
  IF p_choice_difficulty = 'easy' THEN
    v_choice_question_id := v_branch_question.easy_question_id;
  ELSIF p_choice_difficulty = 'hard' THEN
    v_choice_question_id := v_branch_question.hard_question_id;
  ELSE
    RAISE NOTICE 'Invalid difficulty: %', p_choice_difficulty;
    RETURN false;
  END IF;
  
  IF v_choice_question_id IS NULL THEN
    RAISE NOTICE 'Choice question ID is null for difficulty: %', p_choice_difficulty;
    RETURN false;
  END IF;
  
  RAISE NOTICE 'Selected choice question ID: %', v_choice_question_id;
  
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
    current_question = current_question + 1,
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

-- Function to create easy/hard questions when creating a branch question
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
BEGIN
  -- Create easy question
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
  
  -- Create hard question
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
  
  -- Find or create convergence question
  SELECT id INTO v_convergence_question_id
  FROM questions
  WHERE is_active = true 
    AND order_index IS NOT NULL
    AND NOT is_choice_question
    AND NOT is_branch_point
  ORDER BY order_index DESC
  LIMIT 1;
  
  -- If no convergence question exists, create one
  IF v_convergence_question_id IS NULL THEN
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
      1000,
      true
    ) RETURNING id INTO v_convergence_question_id;
  END IF;
  
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_branch_questions(text, text, text, integer, text, text, text, integer, text) TO anon, authenticated;