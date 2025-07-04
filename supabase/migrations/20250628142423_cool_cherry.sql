/*
  # Fix Game Settings RLS Policies

  1. Security Updates
    - Update RLS policies for game_settings table to allow anonymous users to insert/update
    - This is needed for the quiz control functionality to work from the frontend
    
  Note: In production, consider implementing proper authentication and restricting these permissions to admin users only.
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Game settings are publicly readable" ON game_settings;
DROP POLICY IF EXISTS "Game settings can be modified by authenticated users" ON game_settings;

-- Create new policies that allow anonymous users to manage game settings
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