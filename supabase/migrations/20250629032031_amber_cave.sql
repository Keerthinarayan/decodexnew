-- Ensure real-time is enabled for announcements table
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;

-- Create a function to ensure real-time notifications work properly
CREATE OR REPLACE FUNCTION notify_announcement_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the change for debugging
  RAISE LOG 'Announcement change detected: % on table %', TG_OP, TG_TABLE_NAME;
  
  -- For INSERT operations, return NEW
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- For UPDATE operations, return NEW
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  
  -- For DELETE operations, return OLD
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger to ensure real-time notifications
DROP TRIGGER IF EXISTS announcement_change_trigger ON announcements;
CREATE TRIGGER announcement_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION notify_announcement_change();

-- Ensure the announcements table has proper permissions for real-time
GRANT SELECT, INSERT, UPDATE, DELETE ON announcements TO anon, authenticated;

-- Create a function to test real-time functionality
CREATE OR REPLACE FUNCTION test_announcement_broadcast()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_announcement_id uuid;
BEGIN
  INSERT INTO announcements (title, message, type, expires_at, is_active)
  VALUES (
    'Test Announcement',
    'This is a test of the real-time announcement system.',
    'info',
    now() + INTERVAL '30 seconds',
    true
  )
  RETURNING id INTO v_announcement_id;
  
  RETURN v_announcement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION test_announcement_broadcast() TO authenticated;