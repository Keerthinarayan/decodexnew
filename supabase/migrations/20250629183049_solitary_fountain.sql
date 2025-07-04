-- Fix the branch choices data structure and ensure proper question linking

-- Update the sample branch question with proper choice structure
UPDATE questions 
SET 
  is_branch_point = true,
  branch_choices = jsonb_build_array(
    jsonb_build_object(
      'id', 'hard_path',
      'title', 'Challenge Path',
      'description', 'Take on a difficult 200-point question for higher rewards',
      'difficulty', 'hard',
      'points', 200,
      'icon', 'zap'
    ),
    jsonb_build_object(
      'id', 'easy_path', 
      'title', 'Speed Path',
      'description', 'Quick 100-point question to reach the end faster',
      'difficulty', 'easy',
      'points', 100,
      'icon', 'fast-forward'
    )
  )
WHERE title = 'Ancient Code' OR order_index = 2;

-- Ensure the choice questions exist and are properly configured
UPDATE questions 
SET 
  is_choice_question = true,
  choice_type = 'difficulty',
  difficulty_level = 'hard'
WHERE title = 'Advanced Signal Processing';

UPDATE questions 
SET 
  is_choice_question = true,
  choice_type = 'difficulty',
  difficulty_level = 'easy'
WHERE title = 'Quick Signal Check';

-- Make sure both choice questions point to the convergence question
UPDATE questions 
SET next_question_id = (
  SELECT id FROM questions WHERE title = 'Signal Convergence' LIMIT 1
)
WHERE title IN ('Advanced Signal Processing', 'Quick Signal Check');

-- Debug: Show current question structure
DO $$
DECLARE
  q RECORD;
BEGIN
  FOR q IN SELECT title, order_index, is_branch_point, branch_choices, is_choice_question, choice_type, difficulty_level FROM questions ORDER BY order_index LOOP
    RAISE NOTICE 'Question: % (order: %) - Branch: %, Choice: %, Type: %, Difficulty: %', 
      q.title, q.order_index, q.is_branch_point, q.is_choice_question, q.choice_type, q.difficulty_level;
    
    IF q.branch_choices IS NOT NULL THEN
      RAISE NOTICE 'Branch choices: %', q.branch_choices;
    END IF;
  END LOOP;
END $$;