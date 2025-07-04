/*
  # DecodeX Database Schema

  1. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `email` (text, unique)
      - `score` (integer)
      - `current_question` (integer)
      - `power_ups` (jsonb)
      - `last_answered` (timestamptz)
      - `brain_boost_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `questions`
      - `id` (uuid, primary key)
      - `title` (text)
      - `question` (text)
      - `answer` (text)
      - `hint` (text)
      - `type` (text)
      - `media_url` (text)
      - `points` (integer)
      - `category` (text)
      - `explanation` (text)
      - `is_active` (boolean)
      - `order_index` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `game_settings`
      - `id` (uuid, primary key)
      - `quiz_active` (boolean)
      - `quiz_paused` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public read access
    - Add policies for authenticated write access
*/

-- Create teams table
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  score integer DEFAULT 0,
  current_question integer DEFAULT 0,
  power_ups jsonb DEFAULT '{"doublePoints": 1, "hint": 1, "skip": 1, "brainBoost": 1}'::jsonb,
  last_answered timestamptz,
  brain_boost_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create questions table
CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  hint text,
  type text NOT NULL,
  media_url text,
  points integer DEFAULT 100,
  category text NOT NULL,
  explanation text,
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create game_settings table
CREATE TABLE game_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_active boolean DEFAULT false,
  quiz_paused boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
ALTER TABLE questions ADD CONSTRAINT questions_type_check 
  CHECK (type IN ('text', 'image', 'video', 'audio', 'file'));

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for teams table
CREATE POLICY "Teams are publicly readable"
  ON teams FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Teams can be inserted by anyone"
  ON teams FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Teams can be updated by anyone"
  ON teams FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Create policies for questions table
CREATE POLICY "Questions are publicly readable"
  ON questions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Questions can be modified by authenticated users"
  ON questions FOR ALL
  TO authenticated
  USING (true);

-- Create policies for game_settings table
CREATE POLICY "Game settings are publicly readable"
  ON game_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Game settings can be modified by authenticated users"
  ON game_settings FOR ALL
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX idx_teams_name ON teams(name);
CREATE INDEX idx_teams_email ON teams(email);
CREATE INDEX idx_teams_score ON teams(score DESC);
CREATE INDEX idx_questions_order ON questions(order_index);
CREATE INDEX idx_questions_active ON questions(is_active);

-- Insert default questions
INSERT INTO questions (title, question, answer, hint, type, points, category, is_active, order_index) 
VALUES 
  (
    'First Signal',
    'You receive a mysterious transmission from deep space. The message contains a sequence: 2, 4, 8, 16, ?. What is the next number in this sequence?',
    '32',
    'Each number is double the previous one',
    'text',
    100,
    'Mathematics',
    true,
    1
  ),
  (
    'Ancient Code',
    'An alien artifact displays symbols. If A=1, B=2, C=3... what does "DECODEX" equal when you sum all letter values?',
    '74',
    'D=4, E=5, C=3, O=15, D=4, E=5, X=24',
    'text',
    150,
    'Cryptography',
    true,
    2
  );

-- Insert default game settings
INSERT INTO game_settings (quiz_active, quiz_paused) 
VALUES (false, false);

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_teams_updated_at 
  BEFORE UPDATE ON teams
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at 
  BEFORE UPDATE ON questions
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_settings_updated_at 
  BEFORE UPDATE ON game_settings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();