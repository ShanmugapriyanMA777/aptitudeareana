'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Brain,
  LogOut,
  LayoutDashboard,
  Users,
  Trophy,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import type { Student, Question, CompetitionState, CompetitionStatus } from '@/lib/supabase/types';
import { StatsCards, createStats } from '@/components/admin/stats-cards';
import { Leaderboard } from '@/components/admin/leaderboard';
import { CompetitionControls } from '@/components/admin/competition-controls';
import { StudentManagement } from '@/components/admin/student-management';
import { QuestionManagement } from '@/components/admin/question-management';
import { ScoreDistributionChart, StatusPieChart } from '@/components/admin/charts';

export default function AdminDashboard() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [competitionState, setCompetitionState] = useState<CompetitionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [studentsRes, questionsRes, stateRes] = await Promise.all([
        supabase.from('students').select('*').order('created_at', { ascending: false }),
        supabase.from('questions').select('*').order('order_index', { ascending: true }),
        supabase.from('competition_state').select('*').eq('id', 1).maybeSingle(),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (questionsRes.error) throw questionsRes.error;

      setStudents(studentsRes.data || []);
      setQuestions(questionsRes.data || []);
      setCompetitionState(stateRes.data);
    } catch (err) {
      console.error('Load error:', err);
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Realtime subscriptions
  useEffect(() => {
    const studentsChannel = supabase
      .channel('admin-students')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => loadData()
      )
      .subscribe();

    const responsesChannel = supabase
      .channel('admin-responses')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'responses' },
        () => loadData()
      )
      .subscribe();

    const stateChannel = supabase
      .channel('admin-state')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'competition_state' },
        (payload) => {
          setCompetitionState(payload.new as CompetitionState);
          loadData();
        }
      )
      .subscribe();

    const questionsChannel = supabase
      .channel('admin-questions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'questions' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
      supabase.removeChannel(responsesChannel);
      supabase.removeChannel(stateChannel);
      supabase.removeChannel(questionsChannel);
    };
  }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin');
  };

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="fixed inset-0 grid-bg opacity-20" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const status: CompetitionStatus = competitionState?.status || 'idle';
  const totalStudents = students.length;
  const onlineStudents = students.filter((s) => {
    if (s.status === 'disqualified') return false;
    const lastActivity = new Date(s.login_time).getTime();
    return Date.now() - lastActivity < 30 * 60 * 1000; // active in last 30 min
  }).length;
  const inProgress = students.filter((s) => s.status === 'in_progress').length;
  const completed = students.filter((s) => s.status === 'completed').length;
  const validStudents = students.filter((s) => s.status !== 'disqualified');
  const avgScore = validStudents.length > 0
    ? validStudents.reduce((sum, s) => sum + s.total_score, 0) / validStudents.length
    : 0;
  const highestScore = validStudents.length > 0
    ? Math.max(...validStudents.map((s) => s.total_score))
    : 0;

  const stats = createStats(totalStudents, onlineStudents, inProgress, completed, avgScore, highestScore, status);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 grid-bg opacity-10" />
      <div className="fixed top-0 left-0 w-[500px] h-[300px] bg-primary/10 rounded-full blur-[120px]" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[300px] bg-accent/10 rounded-full blur-[120px]" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-xl bg-card/30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Aptitude Arena Competition Manager</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={triggerRefresh} className="text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Refresh</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <StatsCards stats={stats} />
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-card/50 border border-border/50">
            <TabsTrigger value="overview" className="gap-1.5">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Students</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-1.5">
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Questions</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <ScoreDistributionChart students={students} />
                <StatusPieChart students={students} />
              </div>
              <div className="space-y-4">
                <CompetitionControls
                  status={status}
                  onStatusChange={triggerRefresh}
                />
                <Leaderboard students={students} />
              </div>
            </div>
          </TabsContent>

          {/* Students tab */}
          <TabsContent value="students" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <StudentManagement
                  students={students}
                  questions={questions}
                  onDataChange={triggerRefresh}
                />
              </div>
              <div>
                <Leaderboard students={students} />
              </div>
            </div>
          </TabsContent>

          {/* Questions tab */}
          <TabsContent value="questions" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <QuestionManagement
                  questions={questions}
                  onDataChange={triggerRefresh}
                />
              </div>
              <div className="space-y-4">
                <CompetitionControls
                  status={status}
                  onStatusChange={triggerRefresh}
                />
                <Card className="glass border-border/60 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Quick Stats</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Questions</span>
                      <span className="font-semibold">{questions.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Enabled</span>
                      <span className="font-semibold text-primary">{questions.filter((q) => q.is_enabled).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Disabled</span>
                      <span className="font-semibold text-muted-foreground">{questions.filter((q) => !q.is_enabled).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Possible Score</span>
                      <span className="font-semibold">{questions.filter((q) => q.is_enabled).reduce((sum, q) => sum + q.base_score, 0)}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t border-border/50 text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            View Student Portal
          </Link>
        </footer>
      </main>
    </div>
  );
}
