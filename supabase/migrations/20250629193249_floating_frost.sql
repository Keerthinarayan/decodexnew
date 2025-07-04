-- Enhanced branching system with inline questions
-- This migration creates a proper inline branching system where easy/hard questions are stored within the branch point

-- Update the verify_answer function to handle inline branching
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
  v_current_choice_question jsonb := NULL;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  
  -- Get current question
  IF v_team_record.current_question_id IS NOT NULL THEN
    SELECT * INTO v_question_record
    FROM questions
    WHERE id = v_team_record.current_question_id AND is_active = true;
  ELSE
    SELECT * INTO v_question_record
    FROM questions
    WHERE is_active = true
    ORDER BY order_index
    LIMIT 1 OFFSET v_team_record.current_question;
  END IF;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question not found');
  END IF;
  
  -- Check if this is a choice question (from a branch)
  IF v_question_record.is_choice_question THEN
    -- For choice questions, get the answer from branch_choices
    SELECT choice INTO v_current_choice_question
    FROM jsonb_array_elements(v_question_record.branch_choices) AS choice
    WHERE choice->>'difficulty' = v_question_record.difficulty_level;
    
    IF v_current_choice_question IS NOT NULL THEN
      v_correct_answer := LOWER(TRIM(v_current_choice_question->>'answer'));
    ELSE
      v_correct_answer := LOWER(TRIM(v_question_record.answer));
    END IF;
  ELSE
    -- Regular question
    v_correct_answer := LOWER(TRIM(v_question_record.answer));
  END IF;
  
  v_is_correct := LOWER(TRIM(p_answer)) = v_correct_answer;
  
  -- If correct, calculate points and update team
  IF v_is_correct THEN
    -- For choice questions, use the points from the choice
    IF v_question_record.is_choice_question AND v_current_choice_question IS NOT NULL THEN
      v_points_earned := CASE 
        WHEN v_team_record.brain_boost_active THEN (v_current_choice_question->>'points')::integer * 2 
        ELSE (v_current_choice_question->>'points')::integer 
      END;
    ELSE
      v_points_earned := CASE 
        WHEN v_team_record.brain_boost_active THEN v_question_record.points * 2 
        ELSE v_question_record.points 
      END;
    END IF;
    
    -- Check if this is a branch point and prepare choices
    IF v_question_record.is_branch_point AND v_question_record.branch_choices IS NOT NULL THEN
      v_branch_choices := v_question_record.branch_choices;
      -- For branch points, don't advance automatically - wait for choice
      v_next_question_id := v_team_record.current_question_id;
    ELSE
      -- Regular question progression
      IF v_question_record.next_question_id IS NOT NULL THEN
        v_next_question_id := v_question_record.next_question_id;
      ELSE
        -- Find next question by order
        SELECT id INTO v_next_question_id
        FROM questions
        WHERE is_active = true AND order_index > v_question_record.order_index
        ORDER BY order_index
        LIMIT 1;
      END IF;
    END IF;
    
    -- Check if quiz is complete
    v_is_complete := v_next_question_id IS NULL AND NOT v_question_record.is_branch_point;
    
    -- Calculate bonus points for completion
    IF v_is_complete AND v_team_record.completion_time IS NULL THEN
      -- Count how many teams have already completed
      SELECT COUNT(*) + 1 INTO v_completion_rank
      FROM teams
      WHERE completion_time IS NOT NULL;
      
      -- Award bonus points based on completion rank
      v_bonus_points := CASE
        WHEN v_completion_rank = 1 THEN 500  -- First place
        WHEN v_completion_rank = 2 THEN 300  -- Second place
        WHEN v_completion_rank = 3 THEN 200  -- Third place
        WHEN v_completion_rank <= 5 THEN 100 -- Top 5
        ELSE 50  -- Completion bonus
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

-- Function to handle inline choice selection
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
  v_choice_data jsonb;
  v_choice_question_id uuid;
  v_next_question_id uuid := NULL;
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
  WHERE id = v_team_record.current_question_id AND is_branch_point = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Extract the choice data
  SELECT choice INTO v_choice_data
  FROM jsonb_array_elements(v_branch_question.branch_choices) AS choice
  WHERE choice->>'difficulty' = p_choice_difficulty;
  
  IF v_choice_data IS NULL THEN
    RETURN false;
  END IF;
  
  -- Create a temporary choice question
  INSERT INTO questions (
    title, question, answer, hint, type, points, category,
    difficulty_level, is_choice_question, choice_type, order_index, is_active, branch_choices
  ) VALUES (
    'Choice: ' || (v_choice_data->>'title'),
    v_choice_data->>'question',
    v_choice_data->>'answer',
    v_choice_data->>'hint',
    'text',
    (v_choice_data->>'points')::integer,
    v_branch_question.category,
    p_choice_difficulty,
    true,
    'difficulty',
    v_branch_question.order_index + 0.5,
    true,
    jsonb_build_array(v_choice_data)
  ) RETURNING id INTO v_choice_question_id;
  
  -- Find the next question after the branch (convergence point)
  SELECT id INTO v_next_question_id
  FROM questions
  WHERE is_active = true AND order_index > v_branch_question.order_index AND NOT is_choice_question
  ORDER BY order_index
  LIMIT 1;
  
  -- Set the choice question's next question
  UPDATE questions
  SET next_question_id = v_next_question_id
  WHERE id = v_choice_question_id;
  
  -- Update team's path
  v_question_path := v_team_record.question_path || jsonb_build_object(
    'choice_selected', p_choice_difficulty,
    'choice_question_id', v_choice_question_id,
    'branch_question_id', v_branch_question.id,
    'timestamp', now()
  );
  
  UPDATE teams
  SET 
    current_question_id = v_choice_question_id,
    current_question = current_question + 1,
    question_path = v_question_path,
    updated_at = now()
  WHERE name = p_team_name;
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO anon, authenticated;

-- Update existing sample data to use inline branching
UPDATE questions 
SET 
  is_branch_point = true,
  branch_choices = jsonb_build_array(
    jsonb_build_object(
      'id', 'easy_path',
      'title', 'Speed Path',
      'description', 'Quick path with lower points',
      'difficulty', 'easy',
      'points', 100,
      'icon', 'fast-forward',
      'question', 'What is the unit of frequency?',
      'answer', 'Hz',
      'hint', 'Think about cycles per second'
    ),
    jsonb_build_object(
      'id', 'hard_path',
      'title', 'Challenge Path',
      'description', 'Difficult path with higher rewards',
      'difficulty', 'hard',
      'points', 200,
      'icon', 'zap',
      'question', 'Calculate the Discrete Fourier Transform of the sequence [1, 0, 1, 0]. What is the magnitude of the second frequency component?',
      'answer', '2',
      'hint', 'Use the DFT formula and calculate for k=1'
    )
  )
WHERE order_index = 2;

-- Clean up any old choice questions that are no longer needed
DELETE FROM questions WHERE is_choice_question = true AND title LIKE 'Choice:%';

-- Debug output
DO $$
DECLARE
  branch_question RECORD;
BEGIN
  -- Find the branch point
  SELECT * INTO branch_question FROM questions WHERE is_branch_point = true LIMIT 1;
  
  IF FOUND THEN
    RAISE NOTICE 'Branch point: % (ID: %)', branch_question.title, branch_question.id;
    RAISE NOTICE 'Branch choices: %', branch_question.branch_choices;
  ELSE
    RAISE NOTICE 'No branch point found';
  END IF;
END $$;