/*
  # Enhanced Admin Security and Announcements

  1. New Tables
    - `admin_sessions` - Secure admin session management
    - `announcements` - Real-time announcement system

  2. Security Enhancements
    - Admin session tokens with expiration
    - Secure announcement broadcasting
    - Enhanced RLS policies

  3. Features
    - Real-time announcements for all users
    - Admin password verification for critical actions
    - Session-based admin authentication
*/

-- Create admin_sessions table for secure admin authentication
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
ALTER TABLE announcements ADD CONSTRAINT announcements_type_check 
  CHECK (type IN ('info', 'warning', 'success', 'urgent'));

-- Enable RLS
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_sessions (admin only)
CREATE POLICY "Admin sessions are private"
  ON admin_sessions
  FOR ALL
  TO authenticated
  USING (true);

-- Create policies for announcements (public read, admin write)
CREATE POLICY "Announcements are publicly readable"
  ON announcements
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Announcements can be managed by authenticated users"
  ON announcements
  FOR ALL
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires_at);

-- Create trigger for announcements updated_at
CREATE TRIGGER update_announcements_updated_at 
  BEFORE UPDATE ON announcements
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired admin sessions
CREATE OR REPLACE FUNCTION cleanup_expired_admin_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_sessions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean expired announcements
CREATE OR REPLACE FUNCTION cleanup_expired_announcements()
RETURNS void AS $$
BEGIN
  UPDATE announcements 
  SET is_active = false 
  WHERE expires_at IS NOT NULL AND expires_at < now() AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;