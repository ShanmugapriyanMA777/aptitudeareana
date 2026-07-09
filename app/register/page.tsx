'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Brain, ArrowLeft, ArrowRight, User, Hash, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !registerNumber.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      // Check if register number already exists
      const { data: existing, error: checkError } = await supabase
        .from('students')
        .select('id, status')
        .eq('register_number', registerNumber.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        if (existing.status === 'disqualified') {
          setError('This register number has been disqualified from the competition.');
          setLoading(false);
          return;
        }
        // Student already registered — resume their session
        localStorage.setItem('student_session_token', '');
        const { data: student } = await supabase
          .from('students')
          .select('session_token, status, full_name')
          .eq('register_number', registerNumber.trim())
          .maybeSingle();

        if (student) {
          localStorage.setItem('student_session_token', student.session_token);
          localStorage.setItem('student_name', student.full_name);
          if (student.status === 'completed') {
            router.push('/results');
          } else {
            router.push('/compete');
          }
          return;
        }
      }

      // Create new student
      const { data, error: insertError } = await supabase
        .from('students')
        .insert({
          full_name: fullName.trim(),
          register_number: registerNumber.trim(),
          status: 'registered',
          login_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('This register number is already registered.');
        } else {
          throw insertError;
        }
        setLoading(false);
        return;
      }

      localStorage.setItem('student_session_token', data.session_token);
      localStorage.setItem('student_id', data.id);
      localStorage.setItem('student_name', data.full_name);

      toast.success('Registration successful! Get ready to compete.');
      router.push('/compete');
    } catch (err) {
      console.error('Registration error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 grid-bg opacity-20" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/15 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Student Registration</h1>
            <p className="text-sm text-muted-foreground">Enter your details to join the competition</p>
          </div>
        </div>

        <Card className="glass-strong border-border/60">
          <CardHeader className="space-y-1 pb-4">
            <h2 className="text-xl font-semibold">Register to Compete</h2>
            <p className="text-sm text-muted-foreground">
              Use your college register number. Duplicate registrations will resume your previous session.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  className="bg-background/50 h-12"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerNumber" className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5" />
                  Register Number
                </Label>
                <Input
                  id="registerNumber"
                  type="text"
                  placeholder="e.g. 21CS001"
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                  disabled={loading}
                  className="bg-background/50 h-12"
                  autoComplete="off"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 glow-primary group"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    Register & Continue
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By registering, you agree to participate fairly in the competition.
        </p>
      </motion.div>
    </div>
  );
}
