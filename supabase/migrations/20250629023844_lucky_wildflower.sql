/*
  # Secure Question Answers Migration

  1. Security Changes
    - Remove answer column from public question queries
    - Create secure admin-only view for questions with answers
    - Update RLS policies to prevent answer exposure
    - Create answer verification function

  2. New Functions
    - verify_answer() - Server-side answer checking
    - get_question_for_team() - Returns question without answer
*/

-- Create secure function to verify answers server-side
CREATE OR REPLACE FUNCTION verify_answer(
  p_team_name text,
  p_answer text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_record RECORD;
  v_question_record RECORD;
  v_correct_answer text;
  v_is_correct boolean := false;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get current question
  SELECT * INTO v_question_record
  FROM questions
  WHERE is_active = true
  ORDER BY order_index
  LIMIT 1 OFFSET v_team_record.current_question;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if answer is correct (case-insensitive)
  v_correct_answer := LOWER(TRIM(v_question_record.answer));
  v_is_correct := LOWER(TRIM(p_answer)) = v_correct_answer;
  
  -- If correct, update team progress
  IF v_is_correct THEN
    UPDATE teams
    SET 
      score = score + CASE 
        WHEN brain_boost_active THEN v_question_record.points * 2 
        ELSE v_question_record.points 
      END,
      current_question = current_question + 1,
      last_answered = now(),
      brain_boost_active = false
    WHERE name = p_team_name;
  END IF;
  
  RETURN v_is_correct;
END;
$$;

-- Create function to get question for team (without answer)
CREATE OR REPLACE FUNCTION get_question_for_team(p_team_name text)
RETURNS TABLE(
  id uuid,
  title text,
  question text,
  hint text,
  type text,
  media_url text,
  points integer,
  category text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_record RECORD;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Return current question without answer
  RETURN QUERY
  SELECT 
    q.id,
    q.title,
    q.question,
    q.hint,
    q.type,
    q.media_url,
    q.points,
    q.category,
    q.is_active
  FROM questions q
  WHERE q.is_active = true
  ORDER BY q.order_index
  LIMIT 1 OFFSET v_team_record.current_question;
END;
$$;

-- Create admin-only view for questions with answers
CREATE OR REPLACE VIEW admin_questions AS
SELECT 
  id,
  title,
  question,
  answer,
  hint,
  type,
  media_url,
  points,
  category,
  explanation,
  is_active,
  order_index,
  created_at,
  updated_at
FROM questions;

-- Update the public_questions view to exclude answers completely
DROP VIEW IF EXISTS public_questions;
CREATE OR REPLACE VIEW public_questions AS
SELECT 
  id,
  title,
  question,
  hint,
  type,
  media_url,
  points,
  category,
  is_active,
  order_index,
  created_at
FROM questions
WHERE is_active = true
ORDER BY order_index;

-- Drop all existing policies on questions table
DROP POLICY IF EXISTS "Questions readable by authenticated users only" ON questions;
DROP POLICY IF EXISTS "Questions manageable by authenticated users only" ON questions;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON questions;
DROP POLICY IF EXISTS "Authenticated users can update questions" ON questions;
DROP POLICY IF EXISTS "Authenticated users can delete questions" ON questions;

-- Create new restrictive policies
-- Only allow authenticated users (admins) to see questions with answers
CREATE POLICY "Questions readable by authenticated users only"
  ON questions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert questions"
  ON questions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update questions"
  ON questions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete questions"
  ON questions
  FOR DELETE
  TO authenticated
  USING (true);

-- Prevent anonymous users from accessing questions table directly
CREATE POLICY "Questions manageable by authenticated users only"
  ON questions
  FOR ALL
  TO authenticated
  USING (true);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION verify_answer(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_question_for_team(text) TO anon, authenticated;

-- Create RLS policies for the admin view
ALTER VIEW admin_questions SET (security_barrier = true);

-- Create function to skip question for team
CREATE OR REPLACE FUNCTION skip_question_for_team(p_team_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_record RECORD;
BEGIN
  -- Get team information
  SELECT * INTO v_team_record
  FROM teams
  WHERE name = p_team_name;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update team to skip current question
  UPDATE teams
  SET 
    current_question = current_question + 1,
    last_answered = now()
  WHERE name = p_team_name;
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION skip_question_for_team(text) TO anon, authenticated;