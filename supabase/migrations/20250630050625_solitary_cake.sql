/*
  # Fix skip_question_with_branching function

  1. Database Function Updates
    - Fix the skip_question_with_branching function to properly handle branching
    - Remove references to non-existent branch_choices field
    - Use proper joins with choice_questions table for branch logic
    - Ensure function returns correct data structure

  2. Function Logic
    - Skip current question and advance to next
    - Handle branching questions by checking choice_questions table
    - Return proper response format expected by frontend
    - Maintain question path tracking
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS skip_question_with_branching(text);

-- Create the corrected skip_question_with_branching function
CREATE OR REPLACE FUNCTION skip_question_with_branching(p_team_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team_record teams%ROWTYPE;
    v_current_question_record questions%ROWTYPE;
    v_next_question_id uuid;
    v_question_path jsonb;
BEGIN
    -- Get team record
    SELECT * INTO v_team_record
    FROM teams
    WHERE name = p_team_name;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found: %', p_team_name;
    END IF;

    -- Get current question if team has a current_question_id
    IF v_team_record.current_question_id IS NOT NULL THEN
        SELECT * INTO v_current_question_record
        FROM questions
        WHERE id = v_team_record.current_question_id
        AND is_active = true;
    ELSE
        -- If no current_question_id, get the first question based on current_question index
        SELECT * INTO v_current_question_record
        FROM questions
        WHERE is_active = true
        ORDER BY order_index
        LIMIT 1 OFFSET v_team_record.current_question;
    END IF;

    -- If no current question found, team might be at the end
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Update question path to include skipped question
    v_question_path := COALESCE(v_team_record.question_path, '[]'::jsonb);
    v_question_path := v_question_path || jsonb_build_object(
        'questionId', v_current_question_record.id,
        'action', 'skipped',
        'timestamp', extract(epoch from now())
    );

    -- Find next question
    IF v_current_question_record.next_question_id IS NOT NULL THEN
        v_next_question_id := v_current_question_record.next_question_id;
    ELSE
        -- Get next question by order_index
        SELECT id INTO v_next_question_id
        FROM questions
        WHERE order_index > v_current_question_record.order_index
        AND is_active = true
        ORDER BY order_index
        LIMIT 1;
    END IF;

    -- Update team record
    UPDATE teams
    SET 
        current_question = current_question + 1,
        current_question_id = v_next_question_id,
        question_path = v_question_path,
        updated_at = now()
    WHERE name = p_team_name;

    RETURN true;
END;
$$;

-- Also fix the get_next_question_for_team function to properly handle branch_choices
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
    difficulty_level text,
    is_choice_question boolean,
    choice_type text,
    branch_choices jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_team_record teams%ROWTYPE;
    v_question_record questions%ROWTYPE;
    v_branch_choices jsonb := '[]'::jsonb;
    v_choice_record record;
BEGIN
    -- Get team record
    SELECT * INTO v_team_record
    FROM teams
    WHERE name = p_team_name;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Team not found: %', p_team_name;
    END IF;

    -- Get current question
    IF v_team_record.current_question_id IS NOT NULL THEN
        SELECT * INTO v_question_record
        FROM questions q
        WHERE q.id = v_team_record.current_question_id
        AND q.is_active = true;
    ELSE
        -- Fallback to order-based selection
        SELECT * INTO v_question_record
        FROM questions q
        WHERE q.is_active = true
        ORDER BY q.order_index
        LIMIT 1 OFFSET v_team_record.current_question;
    END IF;

    -- If no question found, return empty
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- If this question has choices, get them from choice_questions table
    IF v_question_record.has_choices THEN
        FOR v_choice_record IN
            SELECT 
                cq.title,
                cq.difficulty_level as difficulty,
                cq.points,
                CASE 
                    WHEN cq.difficulty_level = 'easy' THEN 'A straightforward investigation path'
                    WHEN cq.difficulty_level = 'hard' THEN 'A challenging investigation requiring expertise'
                    ELSE 'A balanced investigation approach'
                END as description,
                CASE 
                    WHEN cq.difficulty_level = 'easy' THEN 'star'
                    WHEN cq.difficulty_level = 'hard' THEN 'zap'
                    ELSE 'clock'
                END as icon
            FROM choice_questions cq
            WHERE cq.branch_question_id = v_question_record.id
            AND cq.is_active = true
            ORDER BY cq.difficulty_level
        LOOP
            v_branch_choices := v_branch_choices || jsonb_build_object(
                'title', v_choice_record.title,
                'difficulty', v_choice_record.difficulty,
                'points', v_choice_record.points,
                'description', v_choice_record.description,
                'icon', v_choice_record.icon
            );
        END LOOP;
    END IF;

    -- Return the question data
    RETURN QUERY SELECT
        v_question_record.id,
        v_question_record.title,
        v_question_record.question,
        v_question_record.hint,
        v_question_record.type,
        v_question_record.media_url,
        v_question_record.points,
        v_question_record.category,
        v_question_record.is_active,
        v_question_record.has_choices as is_branch_point,
        v_question_record.difficulty_level,
        false as is_choice_question,
        null::text as choice_type,
        v_branch_choices as branch_choices;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION skip_question_with_branching(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_next_question_for_team(text) TO authenticated, anon;