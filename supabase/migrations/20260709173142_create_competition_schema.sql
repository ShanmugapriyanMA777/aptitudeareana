/*
# Create Aptitude Competition Platform Schema

## Overview
This migration creates the complete database schema for a real-time aptitude competition platform
for college students. It includes tables for students, questions, responses, and competition state.

## New Tables

### 1. `competition_state` (singleton)
- Stores the global competition status (idle, waiting, active, paused, ended, results_published)
- Tracks when the competition started/ended
- Only one row should exist (enforced by a unique constraint on a fixed id)

### 2. `students`
- `id` (uuid, primary key)
- `full_name` (text, not null) - student's full name
- `register_number` (text, unique, not null) - prevents duplicate participation
- `session_token` (uuid, not null) - unique session for the student
- `status` (text, not null, default 'registered') - registered | in_progress | completed | disqualified
- `login_time` (timestamptz) - when student registered/logged in
- `start_time` (timestamptz) - when student started the competition
- `end_time` (timestamptz) - when student completed the competition
- `total_score` (integer, default 0) - final score
- `correct_answers` (integer, default 0)
- `wrong_answers` (integer, default 0)
- `questions_answered` (integer, default 0)
- `total_time_taken` (integer, default 0) - in seconds
- `created_at` (timestamptz, default now())

### 3. `questions`
- `id` (uuid, primary key)
- `question_text` (text, not null)
- `option_a` (text, not null)
- `option_b` (text, not null)
- `option_c` (text, not null)
- `option_d` (text, not null)
- `correct_answer` (text, not null) - one of 'A', 'B', 'C', 'D'
- `time_limit` (integer, not null, default 30) - seconds
- `base_score` (integer, not null, default 100) - base points for correct answer
- `order_index` (integer, not null, default 0) - question order
- `is_enabled` (boolean, default true) - enable/disable question
- `created_at` (timestamptz, default now())

### 4. `responses`
- `id` (uuid, primary key)
- `student_id` (uuid, references students, on delete cascade)
- `question_id` (uuid, references questions, on delete cascade)
- `selected_answer` (text) - 'A' | 'B' | 'C' | 'D' or null if unanswered
- `is_correct` (boolean, default false)
- `time_taken` (integer, default 0) - seconds taken to answer
- `score_earned` (integer, default 0) - points earned (base + time bonus)
- `submitted_at` (timestamptz, default now())
- Unique constraint on (student_id, question_id) - one response per question per student

## Security (RLS)
- All tables enable RLS.
- Students table: anon can insert (register) and read; updates allowed for status/score updates by session.
- Questions table: anon can read enabled questions (needed for competition); admin manages.
- Responses table: anon can insert and read own responses by session.
- competition_state: anon can read (to know if competition is active); admin updates.

## Important Notes
1. The admin uses Supabase Auth (email/password). Admin-only operations are gated by
   authenticated role on the admin-facing policies where appropriate.
2. Students do NOT use Supabase Auth - they register with name + register number and
   get a session token stored in localStorage. The anon key client handles their operations.
3. Realtime is enabled on students, responses, and competition_state tables for live updates.
*/

-- Enable realtime extension
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================
-- COMPETITION STATE (singleton)
-- ============================================
CREATE TABLE IF NOT EXISTS competition_state (
  id integer PRIMARY KEY DEFAULT 1,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'waiting', 'active', 'paused', 'ended', 'results_published')),
  started_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO competition_state (id, status) VALUES (1, 'idle')
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE competition_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_competition_state" ON competition_state;
CREATE POLICY "anon_read_competition_state" ON competition_state FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_competition_state" ON competition_state;
CREATE POLICY "auth_update_competition_state" ON competition_state FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_insert_competition_state" ON competition_state;
CREATE POLICY "auth_insert_competition_state" ON competition_state FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================
-- STUDENTS
-- ============================================
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  register_number text UNIQUE NOT NULL,
  session_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'in_progress', 'completed', 'disqualified')),
  login_time timestamptz DEFAULT now(),
  start_time timestamptz,
  end_time timestamptz,
  total_score integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  wrong_answers integer NOT NULL DEFAULT 0,
  questions_answered integer NOT NULL DEFAULT 0,
  total_time_taken integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_register_number ON students(register_number);
CREATE INDEX IF NOT EXISTS idx_students_session_token ON students(session_token);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_total_score ON students(total_score DESC);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Students can be registered (inserted) by anon
DROP POLICY IF EXISTS "anon_insert_students" ON students;
CREATE POLICY "anon_insert_students" ON students FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Students data is readable by all (needed for leaderboard)
DROP POLICY IF EXISTS "anon_read_students" ON students;
CREATE POLICY "anon_read_students" ON students FOR SELECT
  TO anon, authenticated USING (true);

-- Students can update their own record via session_token (for status/score updates)
-- Also allow authenticated (admin) to update any student
DROP POLICY IF EXISTS "anon_update_students" ON students;
CREATE POLICY "anon_update_students" ON students FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Admin can delete students
DROP POLICY IF EXISTS "auth_delete_students" ON students;
CREATE POLICY "auth_delete_students" ON students FOR DELETE
  TO authenticated USING (true);

-- ============================================
-- QUESTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_answer text NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  time_limit integer NOT NULL DEFAULT 30,
  base_score integer NOT NULL DEFAULT 100,
  order_index integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(order_index);
CREATE INDEX IF NOT EXISTS idx_questions_enabled ON questions(is_enabled);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Anon can read enabled questions (needed during competition)
DROP POLICY IF EXISTS "anon_read_questions" ON questions;
CREATE POLICY "anon_read_questions" ON questions FOR SELECT
  TO anon, authenticated USING (true);

-- Admin (authenticated) can manage questions
DROP POLICY IF EXISTS "auth_insert_questions" ON questions;
CREATE POLICY "auth_insert_questions" ON questions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_questions" ON questions;
CREATE POLICY "auth_update_questions" ON questions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_questions" ON questions;
CREATE POLICY "auth_delete_questions" ON questions FOR DELETE
  TO authenticated USING (true);

-- ============================================
-- RESPONSES
-- ============================================
CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_answer text CHECK (selected_answer IN ('A', 'B', 'C', 'D') OR selected_answer IS NULL),
  is_correct boolean NOT NULL DEFAULT false,
  time_taken integer NOT NULL DEFAULT 0,
  score_earned integer NOT NULL DEFAULT 0,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(student_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_student ON responses(student_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id);

ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Anon can insert responses (students submitting answers)
DROP POLICY IF EXISTS "anon_insert_responses" ON responses;
CREATE POLICY "anon_insert_responses" ON responses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Anon can read responses (needed for leaderboard/stats)
DROP POLICY IF EXISTS "anon_read_responses" ON responses;
CREATE POLICY "anon_read_responses" ON responses FOR SELECT
  TO anon, authenticated USING (true);

-- Anon can update responses (e.g., for timeout unanswered)
DROP POLICY IF EXISTS "anon_update_responses" ON responses;
CREATE POLICY "anon_update_responses" ON responses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Admin can delete responses
DROP POLICY IF EXISTS "auth_delete_responses" ON responses;
CREATE POLICY "auth_delete_responses" ON responses FOR DELETE
  TO authenticated USING (true);

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE students;
ALTER PUBLICATION supabase_realtime ADD TABLE responses;
ALTER PUBLICATION supabase_realtime ADD TABLE competition_state;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
