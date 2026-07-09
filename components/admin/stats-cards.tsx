'use client';

import { motion } from 'framer-motion';
import { Users, UserCheck, Trophy, TrendingUp, Activity, Clock, Award, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StatItem {
  icon: typeof Users;
  label: string;
  value: string | number;
  color: string;
  bg: string;
  border: string;
}

export function StatsCards({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Card className="glass border-border/60 p-5 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} ${stat.border} border`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold mb-1">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

export function createStats(
  totalStudents: number,
  onlineStudents: number,
  inProgress: number,
  completed: number,
  avgScore: number,
  highestScore: number,
  status: string
): StatItem[] {
  return [
    {
      icon: Users,
      label: 'Total Registered',
      value: totalStudents,
      color: 'text-primary',
      bg: 'bg-primary/15',
      border: 'border-primary/20',
    },
    {
      icon: Activity,
      label: 'Currently Online',
      value: onlineStudents,
      color: 'text-accent',
      bg: 'bg-accent/15',
      border: 'border-accent/20',
    },
    {
      icon: Zap,
      label: 'Taking Test',
      value: inProgress,
      color: 'text-chart-3',
      bg: 'bg-chart-3/15',
      border: 'border-chart-3/20',
    },
    {
      icon: UserCheck,
      label: 'Completed',
      value: completed,
      color: 'text-primary',
      bg: 'bg-primary/15',
      border: 'border-primary/20',
    },
    {
      icon: TrendingUp,
      label: 'Average Score',
      value: avgScore.toFixed(0),
      color: 'text-accent',
      bg: 'bg-accent/15',
      border: 'border-accent/20',
    },
    {
      icon: Trophy,
      label: 'Highest Score',
      value: highestScore,
      color: 'text-chart-3',
      bg: 'bg-chart-3/15',
      border: 'border-chart-3/20',
    },
    {
      icon: Award,
      label: 'Competition Status',
      value: status.charAt(0).toUpperCase() + status.slice(1),
      color: status === 'active' ? 'text-primary' : 'text-muted-foreground',
      bg: status === 'active' ? 'bg-primary/15' : 'bg-muted',
      border: status === 'active' ? 'border-primary/20' : 'border-border',
    },
    {
      icon: Clock,
      label: 'Completion Rate',
      value: totalStudents > 0 ? `${Math.round((completed / totalStudents) * 100)}%` : '0%',
      color: 'text-accent',
      bg: 'bg-accent/15',
      border: 'border-accent/20',
    },
  ];
}
