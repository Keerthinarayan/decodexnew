/*
  # Fix Game Settings Auto-Pause Issue

  1. Database Changes
    - Ensure game_settings table has proper default values
    - Fix any data inconsistencies
    - Add better error handling for missing settings

  2. Security
    - Maintain proper RLS policies
    - Ensure settings are properly initialized
*/

-- Ensure game_settings table exists and has proper structure
CREATE TABLE IF NOT EXISTS game_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_active boolean DEFAULT false,
  quiz_paused boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE game_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Game settings are publicly readable" ON game_settings;
DROP POLICY IF EXISTS "Game settings can be inserted by anyone" ON game_settings;
DROP POLICY IF EXISTS "Game settings can be updated by anyone" ON game_settings;
DROP POLICY IF EXISTS "Authenticated users can delete game settings" ON game_settings;

-- Create proper policies
CREATE POLICY "Game settings are publicly readable"
  ON game_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Game settings can be inserted by anyone"
  ON game_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Game settings can be updated by anyone"
  ON game_settings
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete game settings"
  ON game_settings
  FOR DELETE
  TO authenticated
  USING (true);

-- Ensure there's always at least one game settings record
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM game_settings LIMIT 1) THEN
    INSERT INTO game_settings (quiz_active, quiz_paused) 
    VALUES (false, false);
  END IF;
END $$;

-- Clean up any duplicate or invalid game settings
DELETE FROM game_settings 
WHERE id NOT IN (
  SELECT id FROM game_settings 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Ensure the remaining record has valid values
UPDATE game_settings 
SET 
  quiz_active = COALESCE(quiz_active, false),
  quiz_paused = COALESCE(quiz_paused, false),
  updated_at = now()
WHERE quiz_active IS NULL OR quiz_paused IS NULL;

-- Create or replace the trigger for updating timestamps
DROP TRIGGER IF EXISTS update_game_settings_updated_at ON game_settings;
CREATE TRIGGER update_game_settings_updated_at 
  BEFORE UPDATE ON game_settings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create game settings
CREATE OR REPLACE FUNCTION get_or_create_game_settings()
RETURNS TABLE(
  id uuid,
  quiz_active boolean,
  quiz_paused boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
BEGIN
  -- Try to get existing settings
  SELECT * INTO v_settings FROM game_settings ORDER BY created_at DESC LIMIT 1;
  
  -- If no settings exist, create default ones
  IF NOT FOUND THEN
    INSERT INTO game_settings (quiz_active, quiz_paused)
    VALUES (false, false)
    RETURNING * INTO v_settings;
  END IF;
  
  -- Return the settings
  RETURN QUERY
  SELECT 
    v_settings.id,
    v_settings.quiz_active,
    v_settings.quiz_paused,
    v_settings.created_at,
    v_settings.updated_at;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_or_create_game_settings() TO anon, authenticated;

-- Add some debugging info
DO $$
DECLARE
  settings_count integer;
  current_settings RECORD;
BEGIN
  SELECT COUNT(*) INTO settings_count FROM game_settings;
  RAISE NOTICE 'Game settings count: %', settings_count;
  
  IF settings_count > 0 THEN
    SELECT * INTO current_settings FROM game_settings ORDER BY created_at DESC LIMIT 1;
    RAISE NOTICE 'Current settings - Active: %, Paused: %', current_settings.quiz_active, current_settings.quiz_paused;
  END IF;
END $$;