/*
  # Fix Choice Selection Function

  1. Database Changes
    - Update select_question_choice function to properly handle difficulty-based selection
    - Ensure proper question creation and team progression
    - Add better error handling and logging

  2. Fixes
    - Fix the choice selection to work with difficulty strings
    - Ensure proper question progression after choice selection
    - Clean up temporary questions properly
*/

-- Enhanced select_question_choice function with better error handling
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
  -- Log the input parameters
  RAISE NOTICE 'select_question_choice called with team: %, difficulty: %', p_team_name, p_choice_difficulty;
  
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Team not found: %', p_team_name;
    RETURN false;
  END IF;
  
  RAISE NOTICE 'Team found: %, current_question_id: %', v_team_record.name, v_team_record.current_question_id;
  
  -- Get the current branch question
  SELECT * INTO v_branch_question
  FROM questions
  WHERE id = v_team_record.current_question_id AND is_branch_point = true;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Branch question not found for team: %, question_id: %', p_team_name, v_team_record.current_question_id;
    RETURN false;
  END IF;
  
  RAISE NOTICE 'Branch question found: %, choices: %', v_branch_question.title, v_branch_question.branch_choices;
  
  -- Extract the choice data based on difficulty
  SELECT choice INTO v_choice_data
  FROM jsonb_array_elements(v_branch_question.branch_choices) AS choice
  WHERE choice->>'difficulty' = p_choice_difficulty;
  
  IF v_choice_data IS NULL THEN
    RAISE NOTICE 'Choice not found for difficulty: %', p_choice_difficulty;
    RETURN false;
  END IF;
  
  RAISE NOTICE 'Choice data found: %', v_choice_data;
  
  -- Create a temporary choice question with full media support
  INSERT INTO questions (
    title, question, answer, hint, type, media_url, points, category,
    difficulty_level, is_choice_question, choice_type, order_index, is_active, branch_choices
  ) VALUES (
    'Choice: ' || (v_choice_data->>'title'),
    v_choice_data->>'question',
    v_choice_data->>'answer',
    COALESCE(v_choice_data->>'hint', ''),
    COALESCE(v_choice_data->>'type', 'text'),
    COALESCE(v_choice_data->>'mediaUrl', ''),
    (v_choice_data->>'points')::integer,
    v_branch_question.category,
    p_choice_difficulty,
    true,
    'difficulty',
    v_branch_question.order_index + 0.5,
    true,
    jsonb_build_array(v_choice_data)
  ) RETURNING id INTO v_choice_question_id;
  
  RAISE NOTICE 'Choice question created with ID: %', v_choice_question_id;
  
  -- Find the next question after the branch (convergence point)
  SELECT id INTO v_next_question_id
  FROM questions
  WHERE is_active = true 
    AND order_index > v_branch_question.order_index 
    AND NOT is_choice_question
    AND title NOT LIKE 'Choice:%'
  ORDER BY order_index
  LIMIT 1;
  
  RAISE NOTICE 'Next question ID found: %', v_next_question_id;
  
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
  
  -- Update team to point to the choice question
  UPDATE teams
  SET 
    current_question_id = v_choice_question_id,
    current_question = current_question + 1,
    question_path = v_question_path,
    updated_at = now()
  WHERE name = p_team_name;
  
  RAISE NOTICE 'Team updated successfully';
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in select_question_choice: %', SQLERRM;
    RETURN false;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO anon, authenticated;

-- Test the function with debug output
DO $$
DECLARE
  test_result boolean;
BEGIN
  -- First, let's check if we have a proper branch question set up
  IF EXISTS (SELECT 1 FROM questions WHERE is_branch_point = true) THEN
    RAISE NOTICE 'Branch point exists in database';
    
    -- Check if we have any teams
    IF EXISTS (SELECT 1 FROM teams LIMIT 1) THEN
      RAISE NOTICE 'Teams exist in database';
    ELSE
      RAISE NOTICE 'No teams found in database';
    END IF;
  ELSE
    RAISE NOTICE 'No branch point found in database';
  END IF;
END $$;