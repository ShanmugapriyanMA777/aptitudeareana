'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Clock,
  Trophy,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { calculateScore, formatTime } from '@/lib/scoring';
import type { Question, Student, CompetitionState, AnswerOption } from '@/lib/supabase/types';

type Phase = 'loading' | 'waiting' | 'paused' | 'question' | 'submitting' | 'finished';

export default function CompetePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [student, setStudent] = useState<Student | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerOption | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [competitionState, setCompetitionState] = useState<CompetitionState | null>(null);
  const [lastScoreGain, setLastScoreGain] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);

  const questionStartTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredRef = useRef(false);

  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('student_session_token') : null;

  // Load student and questions
  useEffect(() => {
    if (!sessionToken) {
      router.push('/register');
      return;
    }

    (async () => {
      try {
        // Get student
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('session_token', sessionToken)
          .maybeSingle();

        if (studentError || !studentData) {
          toast.error('Session not found. Please register again.');
          router.push('/register');
          return;
        }

        setStudent(studentData);

        if (studentData.status === 'completed') {
          router.push('/results');
          return;
        }

        if (studentData.status === 'disqualified') {
          toast.error('You have been disqualified.');
          router.push('/register');
          return;
        }

        // Get competition state
        const { data: stateData } = await supabase
          .from('competition_state')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        setCompetitionState(stateData);

        // Get enabled questions ordered by order_index
        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .select('*')
          .eq('is_enabled', true)
          .order('order_index', { ascending: true });

        if (questionError) throw questionError;

        if (!questionData || questionData.length === 0) {
          toast.error('No questions available yet. Please wait for the admin to add questions.');
          setPhase('waiting');
          return;
        }

        setQuestions(questionData);

        // Check if competition is active
        if (stateData && stateData.status === 'active') {
          // Check which questions the student has already answered
          const { data: responses } = await supabase
            .from('responses')
            .select('question_id')
            .eq('student_id', studentData.id);

          const answeredIds = new Set(responses?.map((r) => r.question_id) || []);
          const unanswered = questionData.filter((q) => !answeredIds.has(q.id));

          if (unanswered.length === 0) {
            // All answered — go to results
            finishCompetition(studentData.id);
            return;
          }

          // Set up current score from student record
          setScore(studentData.total_score);
          setCorrectCount(studentData.correct_answers);
          setWrongCount(studentData.wrong_answers);
          setAnsweredCount(studentData.questions_answered);
          setTotalTime(studentData.total_time_taken);

          // Find the first unanswered question
          const firstUnansweredIndex = questionData.findIndex((q) => !answeredIds.has(q.id));
          setCurrentIndex(firstUnansweredIndex);
          startQuestion(firstUnansweredIndex, questionData, studentData);
        } else if (stateData && stateData.status === 'paused') {
          setPhase('paused');
        } else {
          setPhase('waiting');
        }
      } catch (err) {
        console.error('Load error:', err);
        toast.error('Failed to load competition data.');
        setPhase('waiting');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  // Realtime subscription for competition state
  useEffect(() => {
    const channel = supabase
      .channel('competition-state-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'competition_state' },
        (payload) => {
          const newState = payload.new as CompetitionState;
          setCompetitionState(newState);

          if (newState.status === 'active' && phase === 'waiting') {
            // Competition started — reload
            window.location.reload();
          } else if (newState.status === 'paused' && phase === 'question') {
            setPhase('paused');
            if (timerRef.current) clearInterval(timerRef.current);
          } else if (newState.status === 'active' && phase === 'paused') {
            // Resume
            setPhase('question');
            startTimer();
          } else if (newState.status === 'ended' || newState.status === 'results_published') {
            if (student) {
              finishCompetition(student.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, student]);

  const startQuestion = (index: number, questions: Question[], studentData: Student) => {
    const q = questions[index];
    if (!q) return;
    setTimeLeft(q.time_limit);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setLastScoreGain(null);
    answeredRef.current = false;
    questionStartTimeRef.current = Date.now();
    setPhase('question');
    startTimer();
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Time's up — auto-submit as unanswered
          if (!answeredRef.current) {
            handleTimeout();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTimeout = () => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    submitAnswer(null);
  };

  const handleSubmit = () => {
    if (answeredRef.current || !selectedAnswer) return;
    answeredRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    submitAnswer(selectedAnswer);
  };

  const submitAnswer = async (answer: AnswerOption | null) => {
    if (!student || !questions[currentIndex]) return;

    setPhase('submitting');
    const q = questions[currentIndex];
    const timeTaken = Math.min(q.time_limit, Math.round((Date.now() - questionStartTimeRef.current) / 1000));
    const isCorrect = answer !== null && answer === q.correct_answer;
    const scoreEarned = calculateScore(isCorrect, timeTaken, q.time_limit, q.base_score);

    setShowFeedback(true);
    setWasCorrect(isCorrect);
    setLastScoreGain(scoreEarned);

    try {
      // Insert response
      const { error: responseError } = await supabase.from('responses').insert({
        student_id: student.id,
        question_id: q.id,
        selected_answer: answer,
        is_correct: isCorrect,
        time_taken: timeTaken,
        score_earned: scoreEarned,
      });

      if (responseError) {
        // If duplicate (already answered), skip
        if (responseError.code === '23505') {
          // Already answered — move on
        } else {
          throw responseError;
        }
      }

      // Update local state
      const newScore = score + scoreEarned;
      const newCorrect = correctCount + (isCorrect ? 1 : 0);
      const newWrong = wrongCount + (isCorrect ? 0 : 1);
      const newAnswered = answeredCount + 1;
      const newTotalTime = totalTime + timeTaken;

      setScore(newScore);
      setCorrectCount(newCorrect);
      setWrongCount(newWrong);
      setAnsweredCount(newAnswered);
      setTotalTime(newTotalTime);

      // Update student record
      const allAnswered = newAnswered >= questions.length;
      const updateData: Partial<Student> = {
        total_score: newScore,
        correct_answers: newCorrect,
        wrong_answers: newWrong,
        questions_answered: newAnswered,
        total_time_taken: newTotalTime,
      };

      if (allAnswered) {
        updateData.status = 'completed';
        updateData.end_time = new Date().toISOString();
      }

      await supabase
        .from('students')
        .update(updateData)
        .eq('id', student.id);

      // Wait for feedback animation, then move to next
      setTimeout(() => {
        if (allAnswered) {
          finishCompetition(student.id);
        } else {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          startQuestion(nextIndex, questions, student);
        }
      }, 1500);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to submit answer. Please try again.');
      setPhase('question');
      startTimer();
    }
  };

  const finishCompetition = async (studentId: string) => {
    try {
      await supabase
        .from('students')
        .update({ status: 'completed', end_time: new Date().toISOString() })
        .eq('id', studentId);
    } catch (err) {
      console.error('Finish error:', err);
    }
    setPhase('finished');
    setTimeout(() => router.push('/results'), 800);
  };

  // Loading phase
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="fixed inset-0 grid-bg opacity-20" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading competition...</p>
        </div>
      </div>
    );
  }

  // Waiting phase
  if (phase === 'waiting') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="fixed inset-0 grid-bg opacity-20" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-pulse-glow" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-md text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/15 border border-primary/30 mx-auto mb-6 animate-float">
            <Clock className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Waiting for Competition to Start</h1>
          <p className="text-muted-foreground mb-2">
            {questions.length > 0
              ? `You're registered and ready. ${questions.length} questions await.`
              : 'The admin hasn\'t added questions yet. Please wait.'}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            The competition will begin automatically when the admin starts it.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Listening for updates...
          </div>
          <Link href="/register" className="block mt-8 text-sm text-muted-foreground hover:text-foreground">
            Back to registration
          </Link>
        </motion.div>
      </div>
    );
  }

  // Paused phase
  if (phase === 'paused') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="fixed inset-0 grid-bg opacity-20" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[120px] animate-pulse-glow" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-md text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/15 border border-accent/30 mx-auto mb-6">
            <Lock className="h-10 w-10 text-accent" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Competition Paused</h1>
          <p className="text-muted-foreground mb-8">
            The admin has paused the competition. It will resume automatically.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-accent">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for resume...
          </div>
        </motion.div>
      </div>
    );
  }

  // Finished phase
  if (phase === 'finished') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="fixed inset-0 grid-bg opacity-20" />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse-glow" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Competition Complete!</h1>
          <p className="text-muted-foreground">Loading your results...</p>
        </motion.div>
      </div>
    );
  }

  // Question phase
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No questions available.</p>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const timeProgress = (timeLeft / currentQuestion.time_limit) * 100;
  const isTimeLow = timeLeft <= 5;
  const options: { key: AnswerOption; text: string }[] = [
    { key: 'A', text: currentQuestion.option_a },
    { key: 'B', text: currentQuestion.option_b },
    { key: 'C', text: currentQuestion.option_c },
    { key: 'D', text: currentQuestion.option_d },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 grid-bg opacity-15" />
      <div className="fixed top-0 left-0 w-[500px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[400px] bg-accent/10 rounded-full blur-[120px]" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-card/30">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold">Aptitude Arena</p>
              <p className="text-xs text-muted-foreground">{student?.full_name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            {/* Score */}
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 md:px-4 py-2">
              <Trophy className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground leading-none">Score</p>
                <AnimatePresence mode="popLayout">
                  <motion.p
                    key={score}
                    initial={{ scale: 1.3, color: 'hsl(var(--primary))' }}
                    animate={{ scale: 1, color: 'hsl(var(--foreground))' }}
                    className="text-lg font-bold leading-tight"
                  >
                    {score}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            {/* Timer */}
            <div className={`flex items-center gap-2 rounded-xl px-3 md:px-4 py-2 border transition-colors ${
              isTimeLow
                ? 'bg-destructive/15 border-destructive/40'
                : 'bg-accent/10 border-accent/20'
            }`}>
              <Clock className={`h-4 w-4 ${isTimeLow ? 'text-destructive' : 'text-accent'}`} />
              <div>
                <p className="text-xs text-muted-foreground leading-none">Time</p>
                <p className={`text-lg font-bold leading-tight tabular-nums ${isTimeLow ? 'text-destructive' : ''}`}>
                  {timeLeft}s
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-5xl mx-auto px-4 md:px-6 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {answeredCount} answered
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </header>

      {/* Question */}
      <main className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            {/* Timer bar */}
            <div className="mb-6">
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-colors ${
                    isTimeLow ? 'bg-destructive' : 'bg-accent'
                  }`}
                  style={{ width: `${timeProgress}%` }}
                  animate={{ width: `${timeProgress}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>
            </div>

            {/* Question card */}
            <Card className="glass-strong border-border/60 p-6 md:p-8 mb-6">
              <div className="flex items-start gap-3 mb-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/20 text-primary font-bold">
                  {currentIndex + 1}
                </div>
                <h2 className="text-xl md:text-2xl font-semibold leading-snug pt-1">
                  {currentQuestion.question_text}
                </h2>
              </div>

              {/* Options */}
              <div className="grid gap-3">
                {options.map((option) => {
                  const isSelected = selectedAnswer === option.key;
                  const showCorrect = showFeedback && option.key === currentQuestion.correct_answer;
                  const showWrong = showFeedback && isSelected && option.key !== currentQuestion.correct_answer;

                  return (
                    <motion.button
                      key={option.key}
                      whileHover={!showFeedback ? { scale: 1.01 } : {}}
                      whileTap={!showFeedback ? { scale: 0.99 } : {}}
                      onClick={() => !showFeedback && setSelectedAnswer(option.key)}
                      disabled={showFeedback}
                      className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                        showCorrect
                          ? 'border-primary bg-primary/15'
                          : showWrong
                          ? 'border-destructive bg-destructive/15'
                          : isSelected
                          ? 'border-accent bg-accent/10'
                          : 'border-border bg-background/40 hover:border-accent/40 hover:bg-accent/5'
                      } ${showFeedback ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-sm transition-colors ${
                        showCorrect
                          ? 'bg-primary text-primary-foreground'
                          : showWrong
                          ? 'bg-destructive text-destructive-foreground'
                          : isSelected
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-secondary text-muted-foreground'
                      }`}>
                        {option.key}
                      </div>
                      <span className="text-sm md:text-base font-medium flex-1">{option.text}</span>
                      {showCorrect && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      {showWrong && <AlertCircle className="h-5 w-5 text-destructive" />}
                    </motion.button>
                  );
                })}
              </div>
            </Card>

            {/* Submit button */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-primary" />
                Faster answers earn bonus points
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!selectedAnswer || phase === 'submitting'}
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-12 group glow-primary"
              >
                {phase === 'submitting' ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Answer
                    <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </div>

            {/* Score feedback */}
            <AnimatePresence>
              {showFeedback && lastScoreGain !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border px-6 py-4 shadow-2xl ${
                    wasCorrect
                      ? 'bg-primary/20 border-primary/40 backdrop-blur-xl'
                      : 'bg-destructive/20 border-destructive/40 backdrop-blur-xl'
                  }`}
                >
                  {wasCorrect ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                      <div>
                        <p className="font-bold text-primary">Correct!</p>
                        <p className="text-sm text-muted-foreground">+{lastScoreGain} points</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-6 w-6 text-destructive" />
                      <div>
                        <p className="font-bold text-destructive">Wrong answer</p>
                        <p className="text-sm text-muted-foreground">+0 points</p>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
