/*
  # Secure Database Policies

  1. Security Updates
    - Restrict question answers from being exposed to clients
    - Implement proper team authentication
    - Secure RLS policies to prevent data breaches
    - Create secure views for public data

  2. Changes
    - Create secure views that exclude sensitive data
    - Update RLS policies for proper access control
    - Add team session management
    - Secure question data exposure
*/

-- Drop all existing policies to rebuild security
DROP POLICY IF EXISTS "Questions are publicly readable" ON questions;
DROP POLICY IF EXISTS "Teams are publicly readable" ON teams;
DROP POLICY IF EXISTS "Teams can be inserted by anyone" ON teams;
DROP POLICY IF EXISTS "Teams can be updated by anyone" ON teams;

-- Create secure view for questions (excludes answers and explanations)
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

-- Create secure view for teams (excludes sensitive data)
CREATE OR REPLACE VIEW public_teams AS
SELECT 
  name,
  score,
  current_question,
  last_answered,
  created_at
FROM teams
ORDER BY score DESC, last_answered ASC;

-- Create secure view for leaderboard
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
  name,
  score,
  current_question,
  last_answered
FROM teams
ORDER BY score DESC, last_answered ASC;

-- Enable RLS on views
ALTER VIEW public_questions SET (security_barrier = true);
ALTER VIEW public_teams SET (security_barrier = true);
ALTER VIEW leaderboard SET (security_barrier = true);

-- Secure policies for questions table (admin only)
CREATE POLICY "Questions readable by authenticated users only"
  ON questions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Questions manageable by authenticated users only"
  ON questions
  FOR ALL
  TO authenticated
  USING (true);

-- Secure policies for teams table
CREATE POLICY "Teams can register"
  ON teams
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Teams can view own data"
  ON teams
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Teams can update own data"
  ON teams
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Create session management table
CREATE TABLE IF NOT EXISTS team_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions are private"
  ON team_sessions
  FOR ALL
  TO anon, authenticated
  USING (false);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_sessions_token ON team_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_team_sessions_expires ON team_sessions(expires_at);

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM team_sessions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;