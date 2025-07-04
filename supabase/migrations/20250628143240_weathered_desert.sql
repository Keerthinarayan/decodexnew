/*
  # Fix Admin Authentication and RLS Policies

  1. Policy Updates
    - Drop and recreate questions table policies to allow authenticated users full access
    - Update admin_users table policies to allow insertions
    - Add missing game_settings policies for authenticated users

  2. Security
    - Maintain RLS protection while allowing admin operations
    - Ensure authenticated users can manage questions and settings
*/

-- Drop all existing policies on questions table
DROP POLICY IF EXISTS "Questions are publicly readable" ON questions;
DROP POLICY IF EXISTS "Questions can be modified by authenticated users" ON questions;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON questions;
DROP POLICY IF EXISTS "Authenticated users can update questions" ON questions;
DROP POLICY IF EXISTS "Authenticated users can delete questions" ON questions;

-- Create new comprehensive policies for questions table
CREATE POLICY "Questions are publicly readable"
  ON questions
  FOR SELECT
  TO anon, authenticated
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

-- Update admin_users table policies
DROP POLICY IF EXISTS "Admin users are readable by authenticated users" ON admin_users;
DROP POLICY IF EXISTS "Admin users can be inserted by authenticated users" ON admin_users;

CREATE POLICY "Admin users are readable by authenticated users"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can be inserted by authenticated users"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure game_settings policies allow admin operations
DROP POLICY IF EXISTS "Authenticated users can delete game settings" ON game_settings;

CREATE POLICY "Authenticated users can delete game settings"
  ON game_settings
  FOR DELETE
  TO authenticated
  USING (true);