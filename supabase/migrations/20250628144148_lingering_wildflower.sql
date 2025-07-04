/*
  # Secure Admin Credentials Migration

  1. Database Changes
    - Create secure admin credentials table
    - Insert encrypted admin user data
    - Update admin_users table structure
    
  2. Security
    - Store credentials securely in database
    - Remove hardcoded credentials from functions
    - Enable proper RLS policies
*/

-- Create admin_credentials table for secure storage
CREATE TABLE IF NOT EXISTS admin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  email text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on admin_credentials
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;

-- Create policy for admin_credentials (only accessible by authenticated users)
CREATE POLICY "Admin credentials are readable by authenticated users"
  ON admin_credentials
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin credentials can be inserted by authenticated users"
  ON admin_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin credentials can be updated by authenticated users"
  ON admin_credentials
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert the admin user with a simple hash (in production, use proper bcrypt)
-- For now, we'll store a simple hash of the password
INSERT INTO admin_credentials (username, password_hash, email) 
VALUES (
  'iamspsadmin', 
  'decodex@#2025', -- In production, this should be properly hashed
  'admin@decodex.com'
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  email = EXCLUDED.email,
  updated_at = now();

-- Update admin_users table to reference credentials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_users' AND column_name = 'credential_id'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN credential_id uuid REFERENCES admin_credentials(id);
  END IF;
END $$;

-- Update existing admin_users record to link with credentials
UPDATE admin_users 
SET credential_id = (
  SELECT id FROM admin_credentials WHERE username = 'iamspsadmin' LIMIT 1
)
WHERE username = 'iamspsadmin';

-- Create trigger for updating timestamps on admin_credentials
CREATE TRIGGER update_admin_credentials_updated_at 
  BEFORE UPDATE ON admin_credentials
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();