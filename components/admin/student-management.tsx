'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Download, Trash2, Ban, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { formatTime } from '@/lib/scoring';
import type { Student, Response, Question } from '@/lib/supabase/types';

const PAGE_SIZE = 10;

export function StudentManagement({
  students,
  questions,
  onDataChange,
}: {
  students: Student[];
  questions: Question[];
  onDataChange: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentResponses, setStudentResponses] = useState<Response[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.register_number.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const exportCSV = () => {
    const headers = ['Name', 'Register Number', 'Status', 'Score', 'Correct', 'Wrong', 'Answered', 'Time Taken', 'Login Time'];
    const rows = filtered.map((s) => [
      s.full_name,
      s.register_number,
      s.status,
      s.total_score,
      s.correct_answers,
      s.wrong_answers,
      s.questions_answered,
      formatTime(s.total_time_taken),
      new Date(s.login_time).toLocaleString(),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competition-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Results exported to CSV.');
  };

  const disqualifyStudent = async (student: Student) => {
    try {
      const { error } = await supabase
        .from('students')
        .update({ status: 'disqualified' })
        .eq('id', student.id);
      if (error) throw error;
      toast.success(`${student.full_name} has been disqualified.`);
      onDataChange();
    } catch (err) {
      console.error('Disqualify error:', err);
      toast.error('Failed to disqualify student.');
    }
  };

  const deleteStudent = async (student: Student) => {
    try {
      const { error } = await supabase.from('students').delete().eq('id', student.id);
      if (error) throw error;
      toast.success(`${student.full_name} has been removed.`);
      onDataChange();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete student.');
    }
  };

  const viewStudent = async (student: Student) => {
    setSelectedStudent(student);
    setLoadingResponses(true);
    try {
      const { data, error } = await supabase
        .from('responses')
        .select('*')
        .eq('student_id', student.id)
        .order('submitted_at', { ascending: true });
      if (error) throw error;
      setStudentResponses(data || []);
    } catch (err) {
      console.error('Response load error:', err);
    } finally {
      setLoadingResponses(false);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      registered: 'bg-muted text-muted-foreground',
      in_progress: 'bg-accent/15 text-accent border-accent/30',
      completed: 'bg-primary/15 text-primary border-primary/30',
      disqualified: 'bg-destructive/15 text-destructive border-destructive/30',
    };
    const labels: Record<string, string> = {
      registered: 'Registered',
      in_progress: 'In Progress',
      completed: 'Completed',
      disqualified: 'Disqualified',
    };
    return (
      <Badge variant="outline" className={`text-xs ${styles[status] || ''}`}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <Card className="glass border-border/60 p-5">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold">Student Management</h3>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or reg number..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9 bg-background/50"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-40 bg-background/50">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="registered">Registered</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="disqualified">Disqualified</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportCSV} variant="outline" size="icon" className="shrink-0">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No students found.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Reg No</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Score</TableHead>
                  <TableHead className="text-xs text-right">Correct</TableHead>
                  <TableHead className="text-xs text-right">Time</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((student, i) => (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-border/50"
                  >
                    <TableCell className="font-medium text-sm">{student.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{student.register_number}</TableCell>
                    <TableCell>{statusBadge(student.status)}</TableCell>
                    <TableCell className="text-right font-bold text-sm text-primary">{student.total_score}</TableCell>
                    <TableCell className="text-right text-sm">{student.correct_answers}/{student.questions_answered}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {student.total_time_taken > 0 ? formatTime(student.total_time_taken) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => viewStudent(student)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {student.status !== 'disqualified' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-chart-3"
                            onClick={() => disqualifyStudent(student)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="glass-strong">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete student?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete {student.full_name} and all their responses. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteStudent(student)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Student detail dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="glass-strong max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedStudent?.full_name}
              {selectedStudent && statusBadge(selectedStudent.status)}
            </DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Register No</p>
                  <p className="text-sm font-semibold">{selectedStudent.register_number}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Total Score</p>
                  <p className="text-sm font-bold text-primary">{selectedStudent.total_score}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Accuracy</p>
                  <p className="text-sm font-semibold">
                    {selectedStudent.questions_answered > 0
                      ? Math.round((selectedStudent.correct_answers / selectedStudent.questions_answered) * 100)
                      : 0}
                    %
                  </p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Time Taken</p>
                  <p className="text-sm font-semibold">{formatTime(selectedStudent.total_time_taken)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Question Responses</h4>
                {loadingResponses ? (
                  <p className="text-sm text-muted-foreground">Loading responses...</p>
                ) : studentResponses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No responses yet.</p>
                ) : (
                  <div className="space-y-2">
                    {studentResponses.map((resp, i) => {
                      const question = questions.find((q) => q.id === resp.question_id);
                      return (
                        <div
                          key={resp.id}
                          className={`rounded-lg p-3 border text-sm ${
                            resp.is_correct
                              ? 'bg-primary/5 border-primary/20'
                              : 'bg-destructive/5 border-destructive/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium">
                              Q{i + 1}. {question?.question_text?.slice(0, 60) || 'Question'}...
                            </span>
                            <Badge variant={resp.is_correct ? 'default' : 'destructive'} className="text-xs shrink-0">
                              {resp.is_correct ? `+${resp.score_earned}` : '0 pts'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Selected: {resp.selected_answer || 'No answer'} | Correct: {question?.correct_answer || '?'} | Time: {resp.time_taken}s
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
