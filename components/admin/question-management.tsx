'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, GripVertical, Loader2, Upload, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import type { Question, AnswerOption } from '@/lib/supabase/types';

interface QuestionForm {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: AnswerOption;
  time_limit: number;
  base_score: number;
  is_enabled: boolean;
}

const emptyForm: QuestionForm = {
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: 'A',
  time_limit: 30,
  base_score: 100,
  is_enabled: true,
};

export function QuestionManagement({
  questions,
  onDataChange,
}: {
  questions: Question[];
  onDataChange: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (q: Question) => {
    setEditingId(q.id);
    setForm({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      time_limit: q.time_limit,
      base_score: q.base_score,
      is_enabled: q.is_enabled,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question_text.trim() || !form.option_a.trim() || !form.option_b.trim() || !form.option_c.trim() || !form.option_d.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('questions')
          .update({
            ...form,
            time_limit: Number(form.time_limit),
            base_score: Number(form.base_score),
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Question updated.');
      } else {
        const maxOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.order_index)) : 0;
        const { error } = await supabase.from('questions').insert({
          ...form,
          time_limit: Number(form.time_limit),
          base_score: Number(form.base_score),
          order_index: maxOrder + 1,
        });
        if (error) throw error;
        toast.success('Question added.');
      }
      setDialogOpen(false);
      onDataChange();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id);
      if (error) throw error;
      toast.success('Question deleted.');
      onDataChange();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete question.');
    }
  };

  const toggleEnabled = async (q: Question) => {
    try {
      const { error } = await supabase
        .from('questions')
        .update({ is_enabled: !q.is_enabled })
        .eq('id', q.id);
      if (error) throw error;
      onDataChange();
    } catch (err) {
      console.error('Toggle error:', err);
      toast.error('Failed to toggle question.');
    }
  };

  const moveOrder = async (q: Question, direction: 'up' | 'down') => {
    const sorted = [...questions].sort((a, b) => a.order_index - b.order_index);
    const index = sorted.findIndex((item) => item.id === q.id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;

    const swapQ = sorted[swapIndex];
    try {
      await supabase.from('questions').update({ order_index: swapQ.order_index }).eq('id', q.id);
      await supabase.from('questions').update({ order_index: q.order_index }).eq('id', swapQ.id);
      onDataChange();
    } catch (err) {
      console.error('Reorder error:', err);
      toast.error('Failed to reorder question.');
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error('Please paste questions in the correct format.');
      return;
    }

    setBulkLoading(true);
    try {
      const lines = bulkText.trim().split('\n').filter((l) => l.trim());
      const parsed: QuestionForm[] = [];
      let maxOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.order_index)) : 0;

      for (const line of lines) {
        const parts = line.split('|').map((p) => p.trim());
        if (parts.length < 6) continue;
        const [question_text, option_a, option_b, option_c, option_d, correct_answer] = parts;
        if (!['A', 'B', 'C', 'D'].includes(correct_answer.toUpperCase())) continue;
        parsed.push({
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer: correct_answer.toUpperCase() as AnswerOption,
          time_limit: 30,
          base_score: 100,
          is_enabled: true,
        });
      }

      if (parsed.length === 0) {
        toast.error('No valid questions found. Use format: Question|OptionA|OptionB|OptionC|OptionD|CorrectAnswer');
        setBulkLoading(false);
        return;
      }

      const insertData = parsed.map((q, i) => ({
        ...q,
        order_index: maxOrder + i + 1,
      }));

      const { error } = await supabase.from('questions').insert(insertData);
      if (error) throw error;

      toast.success(`${parsed.length} questions imported.`);
      setBulkOpen(false);
      setBulkText('');
      onDataChange();
    } catch (err) {
      console.error('Bulk import error:', err);
      toast.error('Failed to import questions.');
    } finally {
      setBulkLoading(false);
    }
  };

  const sortedQuestions = [...questions].sort((a, b) => a.order_index - b.order_index);

  return (
    <Card className="glass border-border/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Question Management</h3>
          <Badge variant="outline" className="text-xs">{questions.length} questions</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" />
            Add Question
          </Button>
        </div>
      </div>

      {sortedQuestions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No questions yet. Click "Add Question" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedQuestions.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`rounded-xl border p-4 transition-colors ${
                q.is_enabled ? 'border-border/60 bg-background/30' : 'border-border/40 bg-muted/20 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                  <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-2">{q.question_text}</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <span className={q.correct_answer === 'A' ? 'text-primary font-semibold' : ''}>A. {q.option_a}</span>
                    <span className={q.correct_answer === 'B' ? 'text-primary font-semibold' : ''}>B. {q.option_b}</span>
                    <span className={q.correct_answer === 'C' ? 'text-primary font-semibold' : ''}>C. {q.option_c}</span>
                    <span className={q.correct_answer === 'D' ? 'text-primary font-semibold' : ''}>D. {q.option_d}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Answer: <span className="text-primary font-semibold">{q.correct_answer}</span></span>
                    <span>Time: {q.time_limit}s</span>
                    <span>Base: {q.base_score} pts</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveOrder(q, 'up')} disabled={i === 0}>
                      <Plus className="h-3 w-3 rotate-45" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveOrder(q, 'down')} disabled={i === sortedQuestions.length - 1}>
                      <Plus className="h-3 w-3 rotate-135" />
                    </Button>
                  </div>
                  <Switch checked={q.is_enabled} onCheckedChange={() => toggleEnabled(q)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-strong">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete question?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this question and all associated student responses.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(q.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-strong max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Question' : 'Add Question'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Textarea
                value={form.question_text}
                onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                placeholder="Enter the question..."
                className="bg-background/50"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['A', 'B', 'C', 'D'] as AnswerOption[]).map((opt) => {
                const key = `option_${opt.toLowerCase()}` as keyof QuestionForm;
                return (
                  <div key={opt} className="space-y-1.5">
                    <Label className="text-xs">Option {opt}</Label>
                    <Input
                      value={form[key] as string}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="bg-background/50"
                      placeholder={`Option ${opt} text`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>Correct Answer</Label>
              <div className="grid grid-cols-4 gap-2">
                {(['A', 'B', 'C', 'D'] as AnswerOption[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setForm({ ...form, correct_answer: opt })}
                    className={`h-10 rounded-lg border font-bold text-sm transition-colors ${
                      form.correct_answer === opt
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-background/40 hover:border-primary/30'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Time Limit (seconds)</Label>
                <Input
                  type="number"
                  value={form.time_limit}
                  onChange={(e) => setForm({ ...form, time_limit: Number(e.target.value) })}
                  className="bg-background/50"
                  min={5}
                  max={300}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Base Score</Label>
                <Input
                  type="number"
                  value={form.base_score}
                  onChange={(e) => setForm({ ...form, base_score: Number(e.target.value) })}
                  className="bg-background/50"
                  min={10}
                  max={1000}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_enabled}
                onCheckedChange={(checked) => setForm({ ...form, is_enabled: checked })}
              />
              <Label className="text-sm">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? 'Update' : 'Add'} Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk import dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="glass-strong max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Questions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste questions in the following format (one per line):
            </p>
            <div className="rounded-lg bg-muted/30 p-3 text-xs font-mono text-muted-foreground">
              Question|OptionA|OptionB|OptionC|OptionD|CorrectAnswer
            </div>
            <p className="text-xs text-muted-foreground">Example:</p>
            <div className="rounded-lg bg-muted/30 p-3 text-xs font-mono text-muted-foreground">
              What is 2+2?|3|4|5|6|B
            </div>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Paste questions here..."
              className="bg-background/50 font-mono text-sm"
              rows={8}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkImport} disabled={bulkLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
