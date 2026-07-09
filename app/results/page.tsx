'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Trophy,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Award,
  Brain,
  ArrowLeft,
  Loader2,
  Home,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase/client';
import { formatTime } from '@/lib/scoring';
import type { Student } from '@/lib/supabase/types';

export default function ResultsPage() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('student_session_token') : null;
    if (!sessionToken) {
      router.push('/register');
      return;
    }

    (async () => {
      try {
        const { data: studentData, error } = await supabase
          .from('students')
          .select('*')
          .eq('session_token', sessionToken)
          .maybeSingle();

        if (error || !studentData) {
          router.push('/register');
          return;
        }

        setStudent(studentData);

        // Calculate rank
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .gt('total_score', studentData.total_score)
          .neq('status', 'disqualified');

        const { count: total } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'disqualified');

        setRank((count || 0) + 1);
        setTotalStudents(total || 0);
      } catch (err) {
        console.error('Results error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="fixed inset-0 grid-bg opacity-20" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No results found.</p>
      </div>
    );
  }

  const accuracy = student.questions_answered > 0
    ? Math.round((student.correct_answers / student.questions_answered) * 100)
    : 0;

  const stats = [
    {
      icon: Trophy,
      label: 'Total Score',
      value: student.total_score,
      color: 'text-primary',
      bg: 'bg-primary/15',
      border: 'border-primary/20',
    },
    {
      icon: CheckCircle2,
      label: 'Correct',
      value: student.correct_answers,
      color: 'text-primary',
      bg: 'bg-primary/15',
      border: 'border-primary/20',
    },
    {
      icon: XCircle,
      label: 'Wrong',
      value: student.wrong_answers,
      color: 'text-destructive',
      bg: 'bg-destructive/15',
      border: 'border-destructive/20',
    },
    {
      icon: Target,
      label: 'Accuracy',
      value: `${accuracy}%`,
      color: 'text-accent',
      bg: 'bg-accent/15',
      border: 'border-accent/20',
    },
    {
      icon: Clock,
      label: 'Time Taken',
      value: formatTime(student.total_time_taken),
      color: 'text-accent',
      bg: 'bg-accent/15',
      border: 'border-accent/20',
    },
    {
      icon: Award,
      label: 'Rank',
      value: rank ? `#${rank}` : '—',
      color: 'text-primary',
      bg: 'bg-primary/15',
      border: 'border-primary/20',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 grid-bg opacity-20" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/15 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px]" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12 md:py-16">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Hero result */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, delay: 0.2, type: 'spring' }}
            className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/15 border border-primary/30 mx-auto mb-6 glow-primary"
          >
            <Trophy className="h-12 w-12 text-primary" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl font-bold mb-3"
          >
            Competition Complete!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-muted-foreground"
          >
            Great job, <span className="text-foreground font-semibold">{student.full_name}</span>! Here's your performance breakdown.
          </motion.p>
        </motion.div>

        {/* Score highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-strong rounded-3xl p-8 mb-8 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          <div className="relative z-10">
            <p className="text-sm text-muted-foreground mb-2">Your Final Score</p>
            <motion.p
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: 'spring' }}
              className="text-6xl md:text-7xl font-bold text-gradient-primary"
            >
              {student.total_score}
            </motion.p>
            {rank && totalStudents > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                Ranked <span className="text-primary font-bold">#{rank}</span> out of {totalStudents} participants
              </p>
            )}
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              whileHover={{ y: -3 }}
            >
              <Card className={`glass border-border/60 p-5 h-full`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} ${stat.border} border mb-3`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold mb-1">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Accuracy bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="glass rounded-2xl p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Accuracy Breakdown</span>
            </div>
            <span className="text-sm text-muted-foreground">{accuracy}%</span>
          </div>
          <Progress value={accuracy} className="h-3" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{student.correct_answers} correct</span>
            <span>{student.wrong_answers} wrong</span>
          </div>
        </motion.div>

        {/* Completion message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="glass rounded-2xl p-6 mb-8 text-center"
        >
          <Brain className="h-8 w-8 text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {accuracy >= 80
              ? 'Outstanding performance! You\'re an aptitude champion.'
              : accuracy >= 60
              ? 'Great work! You have solid aptitude skills.'
              : accuracy >= 40
              ? 'Good effort! Keep practicing to improve your score.'
              : 'Every expert was once a beginner. Keep going!'}
          </p>
        </motion.div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="flex-1 sm:flex-initial">
            <Button variant="outline" size="lg" className="w-full h-12 border-border">
              <Home className="mr-2 h-5 w-5" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
