'use client';

import { motion } from 'framer-motion';
import { Trophy, Medal, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatTime } from '@/lib/scoring';
import type { Student } from '@/lib/supabase/types';

export function Leaderboard({ students }: { students: Student[] }) {
  const sorted = [...students]
    .filter((s) => s.status !== 'disqualified')
    .sort((a, b) => b.total_score - a.total_score || a.total_time_taken - b.total_time_taken)
    .slice(0, 20);

  const maxScore = sorted.length > 0 ? sorted[0].total_score : 1;

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-4 w-4 text-chart-3" />;
    if (rank === 2) return <Medal className="h-4 w-4 text-muted-foreground" />;
    if (rank === 3) return <Award className="h-4 w-4 text-chart-5" />;
    return <span className="text-sm font-bold text-muted-foreground">{rank}</span>;
  };

  return (
    <Card className="glass border-border/60 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Live Leaderboard</h3>
        <Badge variant="outline" className="ml-auto text-xs">
          {sorted.length} shown
        </Badge>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No students have registered yet.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((student, i) => {
            const rank = i + 1;
            const scorePercent = (student.total_score / maxScore) * 100;
            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${
                  rank <= 3
                    ? 'bg-primary/5 border border-primary/15'
                    : 'hover:bg-muted/30'
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  {getRankIcon(rank)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold truncate">{student.full_name}</p>
                    <span className="text-sm font-bold text-primary shrink-0">{student.total_score}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground shrink-0">{student.register_number}</span>
                    <Progress value={scorePercent} className="h-1 flex-1" />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {student.status === 'completed' ? formatTime(student.total_time_taken) : '—'}
                    </span>
                  </div>
                </div>
                <Badge
                  variant={student.status === 'completed' ? 'default' : 'outline'}
                  className="text-xs shrink-0"
                >
                  {student.status === 'in_progress' ? 'Active' : student.status === 'completed' ? 'Done' : 'Reg'}
                </Badge>
              </motion.div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
