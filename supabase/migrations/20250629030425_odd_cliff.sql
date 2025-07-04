/*
  # Announcement System Migration

  1. Tables
    - `announcements` table already exists from previous migration
    - Add any missing indexes or constraints

  2. Security
    - Ensure proper RLS policies for announcements
    - Allow public read access for active announcements
    - Restrict write access to authenticated users only

  3. Functions
    - Add cleanup function for expired announcements
    - Add function to broadcast announcements
*/

-- Ensure announcements table exists with all required columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcements') THEN
    CREATE TABLE announcements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      message text NOT NULL,
      type text NOT NULL DEFAULT 'info',
      is_active boolean DEFAULT true,
      expires_at timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;

-- Add type constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'announcements_type_check'
  ) THEN
    ALTER TABLE announcements ADD CONSTRAINT announcements_type_check 
      CHECK (type IN ('info', 'warning', 'success', 'urgent'));
  END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Announcements are publicly readable" ON announcements;
DROP POLICY IF EXISTS "Announcements can be managed by authenticated users" ON announcements;

-- Create policies for announcements
CREATE POLICY "Announcements are publicly readable"
  ON announcements
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Announcements can be managed by authenticated users"
  ON announcements
  FOR ALL
  TO authenticated
  USING (true);

-- Create indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);

-- Create or replace the cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_announcements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deactivate expired announcements
  UPDATE announcements 
  SET is_active = false, updated_at = now()
  WHERE expires_at IS NOT NULL 
    AND expires_at < now() 
    AND is_active = true;
    
  -- Optionally delete very old announcements (older than 30 days)
  DELETE FROM announcements 
  WHERE created_at < now() - INTERVAL '30 days'
    AND is_active = false;
END;
$$;

-- Create function to broadcast announcement (for future use)
CREATE OR REPLACE FUNCTION broadcast_announcement(
  p_title text,
  p_message text,
  p_type text DEFAULT 'info',
  p_duration_seconds integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_announcement_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Calculate expiration time
  v_expires_at := now() + (p_duration_seconds || ' seconds')::interval;
  
  -- Insert announcement
  INSERT INTO announcements (title, message, type, expires_at, is_active)
  VALUES (p_title, p_message, p_type, v_expires_at, true)
  RETURNING id INTO v_announcement_id;
  
  RETURN v_announcement_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_expired_announcements() TO authenticated;
GRANT EXECUTE ON FUNCTION broadcast_announcement(text, text, text, integer) TO authenticated;

-- Create trigger for updated_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_announcements_updated_at'
  ) THEN
    CREATE TRIGGER update_announcements_updated_at 
      BEFORE UPDATE ON announcements
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;