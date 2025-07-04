/*
  # Fix Question Flow and Answer Verification Issues

  1. Database Function Fixes
    - Fix get_next_question_for_team to properly handle new teams
    - Fix verify_answer_with_branching for correct answer verification
    - Fix select_question_choice for proper choice handling
    - Add proper logging and error handling

  2. Team State Fixes
    - Reset teams in bad states
    - Ensure proper question progression
    - Fix foreign key constraint issues
*/

-- Drop and recreate get_next_question_for_team with proper logic
DROP FUNCTION IF EXISTS get_next_question_for_team(text);

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
  v_team record;
  v_last_path_entry jsonb;
  v_choice_question_id uuid;
  v_current_question record;
BEGIN
  -- Get team information
  SELECT t.*
  INTO v_team
  FROM teams t
  WHERE t.name = p_team_name;

  IF v_team.id IS NULL THEN
    RAISE EXCEPTION 'Team not found: %', p_team_name;
  END IF;

  RAISE NOTICE 'Team found: %, current_question: %, current_question_id: %', 
    v_team.name, v_team.current_question, v_team.current_question_id;

  -- Check if we have a question_path with a pending choice question
  IF v_team.question_path IS NOT NULL AND jsonb_array_length(v_team.question_path) > 0 THEN
    v_last_path_entry := v_team.question_path -> -1;
    
    -- If last entry is a choice question that was selected but not answered
    IF (v_last_path_entry->>'question_type') = 'choice' 
       AND (v_last_path_entry->>'answered') IS NULL THEN
      
      v_choice_question_id := (v_last_path_entry->>'question_id')::uuid;
      
      RAISE NOTICE 'Returning pending choice question: %', v_choice_question_id;
      
      -- Return the choice question
      RETURN QUERY
      SELECT 
        cq.id,
        cq.title,
        cq.question,
        cq.hint,
        cq.type,
        cq.media_url,
        cq.points,
        cq.category,
        cq.is_active,
        false as is_branch_point,
        '[]'::jsonb as branch_choices,
        cq.difficulty_level,
        true as is_choice_question,
        'difficulty' as choice_type
      FROM choice_questions cq
      WHERE cq.id = v_choice_question_id
        AND cq.is_active = true;
      
      RETURN;
    END IF;
  END IF;

  -- If team has a current_question_id, use that
  IF v_team.current_question_id IS NOT NULL THEN
    SELECT q.* INTO v_current_question
    FROM questions q
    WHERE q.id = v_team.current_question_id
      AND q.is_active = true;
    
    IF FOUND THEN
      RAISE NOTICE 'Returning current question by ID: %', v_current_question.title;
      
      RETURN QUERY
      SELECT 
        v_current_question.id,
        v_current_question.title,
        v_current_question.question,
        v_current_question.hint,
        v_current_question.type,
        v_current_question.media_url,
        v_current_question.points,
        v_current_question.category,
        v_current_question.is_active,
        COALESCE(v_current_question.has_choices, false) as is_branch_point,
        CASE 
          WHEN COALESCE(v_current_question.has_choices, false) THEN
            (SELECT jsonb_agg(
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
            )
            FROM choice_questions cq 
            WHERE cq.branch_question_id = v_current_question.id 
              AND cq.is_active = true
            )
          ELSE '[]'::jsonb
        END as branch_choices,
        v_current_question.difficulty_level,
        false as is_choice_question,
        NULL as choice_type;
      
      RETURN;
    END IF;
  END IF;

  -- Otherwise, use order-based approach (for new teams or teams without current_question_id)
  SELECT q.* INTO v_current_question
  FROM questions q
  WHERE q.is_active = true
    AND q.order_index IS NOT NULL
  ORDER BY q.order_index
  LIMIT 1 OFFSET v_team.current_question;

  IF FOUND THEN
    RAISE NOTICE 'Returning question by order: % (offset: %)', v_current_question.title, v_team.current_question;
    
    -- Update team's current_question_id for consistency
    UPDATE teams 
    SET current_question_id = v_current_question.id
    WHERE id = v_team.id;
    
    RETURN QUERY
    SELECT 
      v_current_question.id,
      v_current_question.title,
      v_current_question.question,
      v_current_question.hint,
      v_current_question.type,
      v_current_question.media_url,
      v_current_question.points,
      v_current_question.category,
      v_current_question.is_active,
      COALESCE(v_current_question.has_choices, false) as is_branch_point,
      CASE 
        WHEN COALESCE(v_current_question.has_choices, false) THEN
          (SELECT jsonb_agg(
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
          )
          FROM choice_questions cq 
          WHERE cq.branch_question_id = v_current_question.id 
            AND cq.is_active = true
          )
        ELSE '[]'::jsonb
      END as branch_choices,
      v_current_question.difficulty_level,
      false as is_choice_question,
      NULL as choice_type;
  ELSE
    RAISE NOTICE 'No question found for team at position: %', v_team.current_question;
  END IF;

END;
$$;

-- Drop and recreate verify_answer_with_branching with proper answer verification
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
    
    RAISE NOTICE 'Main question - Expected: %, Got: %, Correct: %', 
      v_correct_answer, LOWER(TRIM(p_answer)), v_is_correct;

    IF v_is_correct THEN
      v_points_earned := CASE 
        WHEN v_team.brain_boost_active THEN v_question.points * 2 
        ELSE v_question.points 
      END;

      -- Check if this question has choices
      IF COALESCE(v_question.has_choices, false) THEN
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
  v_is_complete := v_next_question_id IS NULL AND v_is_correct AND NOT COALESCE(v_question.has_choices, false);

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
        WHEN COALESCE(v_question.has_choices, false) THEN current_question
        WHEN v_is_choice_question THEN current_question + 1
        ELSE current_question + 1
      END,
      current_question_id = CASE
        WHEN COALESCE(v_question.has_choices, false) THEN current_question_id
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
    'has_choices', COALESCE(v_question.has_choices, false) AND v_branch_choices IS NOT NULL,
    'branch_choices', v_branch_choices,
    'is_choice_question', v_is_choice_question
  );
END;
$$;

-- Fix the select_question_choice function to properly track choice selection
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
  v_team record;
  v_branch_question record;
  v_choice_question record;
  v_question_path jsonb;
BEGIN
  RAISE NOTICE 'Selecting choice: team=%, difficulty=%', p_team_name, p_choice_difficulty;

  -- Get team information
  SELECT t.* INTO v_team
  FROM teams t
  WHERE t.name = p_team_name;

  IF v_team.id IS NULL THEN
    RAISE EXCEPTION 'Team not found: %', p_team_name;
  END IF;

  -- Get the current branch question
  SELECT q.* INTO v_branch_question
  FROM questions q
  WHERE q.id = v_team.current_question_id 
    AND q.has_choices = true
    AND q.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No branch question found for team';
  END IF;

  -- Get the choice question
  SELECT cq.* INTO v_choice_question
  FROM choice_questions cq
  WHERE cq.branch_question_id = v_branch_question.id 
    AND cq.difficulty_level = p_choice_difficulty
    AND cq.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No choice question found for difficulty: %', p_choice_difficulty;
  END IF;

  -- Add choice selection to question path
  v_question_path := COALESCE(v_team.question_path, '[]'::jsonb) || jsonb_build_object(
    'question_id', v_choice_question.id,
    'question_type', 'choice',
    'difficulty', p_choice_difficulty,
    'branch_question_id', v_branch_question.id,
    'selected_at', now()
  );

  -- Update team with choice selection
  UPDATE teams
  SET 
    question_path = v_question_path,
    updated_at = now()
  WHERE id = v_team.id;

  RAISE NOTICE 'Choice selected successfully: %', v_choice_question.title;

  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_answer_with_branching(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION select_question_choice(text, text) TO anon, authenticated;

-- Ensure we have some basic questions for testing
DO $$
DECLARE
  v_first_question_id uuid;
BEGIN
  -- Make sure we have at least one question with order_index 1
  IF NOT EXISTS (SELECT 1 FROM questions WHERE order_index = 1 AND is_active = true) THEN
    -- Get the first active question and set its order_index to 1
    SELECT id INTO v_first_question_id
    FROM questions 
    WHERE is_active = true 
      AND order_index IS NOT NULL 
    ORDER BY order_index 
    LIMIT 1;
    
    IF v_first_question_id IS NOT NULL THEN
      UPDATE questions 
      SET order_index = 1 
      WHERE id = v_first_question_id;
    END IF;
  END IF;
  
  -- Get the first question ID for team reset
  SELECT id INTO v_first_question_id
  FROM questions 
  WHERE is_active = true AND order_index = 1 
  LIMIT 1;
  
  -- Reset any teams that might be in a bad state
  IF v_first_question_id IS NOT NULL THEN
    UPDATE teams 
    SET 
      current_question = 0,
      current_question_id = v_first_question_id
    WHERE current_question_id IS NULL 
       OR current_question_id NOT IN (
         SELECT id FROM questions WHERE is_active = true
       );
  END IF;
END $$;

-- Debug output
DO $$
DECLARE
  q_count integer;
  t_count integer;
  first_q record;
BEGIN
  SELECT COUNT(*) INTO q_count FROM questions WHERE is_active = true AND order_index IS NOT NULL;
  SELECT COUNT(*) INTO t_count FROM teams;
  
  SELECT * INTO first_q FROM questions WHERE is_active = true ORDER BY order_index LIMIT 1;
  
  RAISE NOTICE 'Active questions with order_index: %', q_count;
  RAISE NOTICE 'Total teams: %', t_count;
  IF first_q.id IS NOT NULL THEN
    RAISE NOTICE 'First question: % (order: %)', first_q.title, first_q.order_index;
  ELSE
    RAISE NOTICE 'No questions found';
  END IF;
END $$;