/*
  # Create Admin User

  1. Security
    - Creates admin user in Supabase Auth
    - Sets up admin role and permissions
  
  2. Admin Setup
    - Email: admin@decodex.com
    - This user will have admin privileges for the application
*/

-- Note: This migration creates the admin user structure
-- The actual admin user creation should be done through Supabase Dashboard or CLI
-- as it requires authentication system setup

-- Create a simple admin verification table for additional security
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create policy for admin users
CREATE POLICY "Admin users are readable by authenticated users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

-- Insert the admin user record
INSERT INTO admin_users (email, username) 
VALUES ('admin@decodex.com', 'iamspsadmin')
ON CONFLICT (email) DO NOTHING;