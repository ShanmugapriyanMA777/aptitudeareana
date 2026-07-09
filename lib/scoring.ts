export function calculateScore(
  isCorrect: boolean,
  timeTaken: number,
  timeLimit: number,
  baseScore: number
): number {
  if (!isCorrect) return 0;
  const remainingFraction = Math.max(0, 1 - timeTaken / timeLimit);
  const bonus = Math.round(baseScore * 0.5 * remainingFraction);
  return baseScore + bonus;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
