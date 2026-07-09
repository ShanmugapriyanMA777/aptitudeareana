'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, RotateCcw, Send, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import type { CompetitionStatus } from '@/lib/supabase/types';

export function CompetitionControls({
  status,
  onStatusChange,
}: {
  status: CompetitionStatus;
  onStatusChange: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  const updateStatus = async (newStatus: CompetitionStatus) => {
    setLoading(newStatus);
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'active' && status === 'idle') {
        updateData.started_at = new Date().toISOString();
      }
      if (newStatus === 'ended') {
        updateData.ended_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('competition_state')
        .update(updateData)
        .eq('id', 1);

      if (error) throw error;

      toast.success(`Competition ${newStatus === 'active' ? 'started' : newStatus === 'paused' ? 'paused' : newStatus === 'ended' ? 'ended' : 'updated'}`);
      onStatusChange();
    } catch (err) {
      console.error('Status update error:', err);
      toast.error('Failed to update competition status.');
    } finally {
      setLoading(null);
    }
  };

  const resetCompetition = async () => {
    setLoading('reset');
    try {
      // Reset all students and responses
      await supabase.from('responses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase
        .from('competition_state')
        .update({
          status: 'idle',
          started_at: null,
          ended_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);

      toast.success('Competition reset. All student data cleared.');
      onStatusChange();
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset competition.');
    } finally {
      setLoading(null);
    }
  };

  const statusColors: Record<CompetitionStatus, string> = {
    idle: 'bg-muted text-muted-foreground',
    waiting: 'bg-accent/15 text-accent border-accent/30',
    active: 'bg-primary/15 text-primary border-primary/30',
    paused: 'bg-chart-3/15 text-chart-3 border-chart-3/30',
    ended: 'bg-destructive/15 text-destructive border-destructive/30',
    results_published: 'bg-primary/15 text-primary border-primary/30',
  };

  return (
    <Card className="glass border-border/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Competition Controls</h3>
        <Badge variant="outline" className={`text-xs ${statusColors[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {status === 'idle' || status === 'waiting' ? (
          <Button
            onClick={() => updateStatus('active')}
            disabled={loading !== null}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start
          </Button>
        ) : status === 'active' ? (
          <Button
            onClick={() => updateStatus('paused')}
            disabled={loading !== null}
            variant="outline"
          >
            {loading === 'paused' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
            Pause
          </Button>
        ) : status === 'paused' ? (
          <>
            <Button
              onClick={() => updateStatus('active')}
              disabled={loading !== null}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Resume
            </Button>
            <Button
              onClick={() => updateStatus('ended')}
              disabled={loading !== null}
              variant="destructive"
            >
              {loading === 'ended' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              End
            </Button>
          </>
        ) : (
          <Button
            onClick={() => updateStatus('active')}
            disabled={loading !== null}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Restart
          </Button>
        )}

        {status === 'active' && (
          <Button
            onClick={() => updateStatus('ended')}
            disabled={loading !== null}
            variant="destructive"
          >
            {loading === 'ended' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            End
          </Button>
        )}

        {status === 'ended' && (
          <Button
            onClick={() => updateStatus('results_published')}
            disabled={loading !== null}
            variant="outline"
          >
            {loading === 'results_published' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publish
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={loading !== null} className="text-destructive hover:text-destructive">
              {loading === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass-strong">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Competition?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all student registrations, responses, and scores. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={resetCompetition}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, Reset Everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
