'use client';

import { Card } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { Student } from '@/lib/supabase/types';

export function ScoreDistributionChart({ students }: { students: Student[] }) {
  const buckets = [
    { range: '0-100', min: 0, max: 100, count: 0 },
    { range: '101-200', min: 101, max: 200, count: 0 },
    { range: '201-400', min: 201, max: 400, count: 0 },
    { range: '401-600', min: 401, max: 600, count: 0 },
    { range: '601+', min: 601, max: Infinity, count: 0 },
  ];

  students.forEach((s) => {
    if (s.status === 'disqualified') return;
    const bucket = buckets.find((b) => s.total_score >= b.min && s.total_score <= b.max);
    if (bucket) bucket.count++;
  });

  return (
    <Card className="glass border-border/60 p-5">
      <h3 className="font-semibold mb-4">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={buckets}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={12} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function StatusPieChart({ students }: { students: Student[] }) {
  const data = [
    { name: 'Registered', value: students.filter((s) => s.status === 'registered').length, color: 'hsl(var(--muted-foreground))' },
    { name: 'In Progress', value: students.filter((s) => s.status === 'in_progress').length, color: 'hsl(var(--accent))' },
    { name: 'Completed', value: students.filter((s) => s.status === 'completed').length, color: 'hsl(var(--primary))' },
    { name: 'Disqualified', value: students.filter((s) => s.status === 'disqualified').length, color: 'hsl(var(--destructive))' },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <Card className="glass border-border/60 p-5">
        <h3 className="font-semibold mb-4">Student Status</h3>
        <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
          No students yet.
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/60 p-5">
      <h3 className="font-semibold mb-4">Student Status</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
