export type CompetitionStatus = 'idle' | 'waiting' | 'active' | 'paused' | 'ended' | 'results_published';

export type StudentStatus = 'registered' | 'in_progress' | 'completed' | 'disqualified';

export type AnswerOption = 'A' | 'B' | 'C' | 'D';

export interface CompetitionState {
  id: number;
  status: CompetitionStatus;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
}

export interface Student {
  id: string;
  full_name: string;
  register_number: string;
  session_token: string;
  status: StudentStatus;
  login_time: string;
  start_time: string | null;
  end_time: string | null;
  total_score: number;
  correct_answers: number;
  wrong_answers: number;
  questions_answered: number;
  total_time_taken: number;
  created_at: string;
}

export interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: AnswerOption;
  time_limit: number;
  base_score: number;
  order_index: number;
  is_enabled: boolean;
  created_at: string;
}

export interface Response {
  id: string;
  student_id: string;
  question_id: string;
  selected_answer: AnswerOption | null;
  is_correct: boolean;
  time_taken: number;
  score_earned: number;
  submitted_at: string;
}

export interface QuestionWithResponse extends Question {
  response?: Response;
}
