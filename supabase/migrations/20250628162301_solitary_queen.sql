/*
  # Add password hash column to teams table

  1. Changes
    - Add `password_hash` column to `teams` table for secure password storage
    - This will store hashed passwords instead of plain text

  2. Security
    - Passwords will be hashed before storage
    - No plain text passwords in database
*/

-- Add password_hash column to teams table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE teams ADD COLUMN password_hash text;
  END IF;
END $$;