import Groq from 'groq-sdk';

let _groq: Groq | null = null;
function groq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
  return _groq;
}

export interface GameState {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  quarter: number;
  clock: string;
  lastCommentAt?: number;
}

/**
 * Detect if something interesting happened between two game states.
 * Returns null if nothing worth commenting on.
 */
export function detectInterestingEvent(current: GameState, previous: GameState | null): string | null {
  if (!previous) return null;

  const scoreDiff = (current.homeScore + current.awayScore) - (previous.homeScore + previous.awayScore);
  const leadBefore = previous.homeScore - previous.awayScore;
  const leadNow = current.homeScore - current.awayScore;
  const leadChanged = (leadBefore > 0 && leadNow < 0) || (leadBefore < 0 && leadNow > 0);
  const margin = Math.abs(current.homeScore - current.awayScore);

  // Lead change
  if (leadChanged) return 'lead_change';

  // Big run (8+ points scored since last check)
  if (scoreDiff >= 8) return 'big_run';

  // Game tied
  if (current.homeScore === current.awayScore && previous.homeScore !== previous.awayScore) return 'tied';

  // Blowout developing (20+ point lead)
  if (margin >= 20 && Math.abs(previous.homeScore - previous.awayScore) < 20) return 'blowout';

  // Clutch time (4th quarter, under 3 min, within 5 points)
  if (current.quarter === 4 && margin <= 5 && current.clock) {
    const mins = parseFloat(current.clock.split(':')[0]);
    if (mins < 3) return 'clutch_time';
  }

  // Quarter end
  if (current.quarter > previous.quarter) return 'quarter_end';

  // Overtime
  if (current.quarter > 4 && previous.quarter === 4) return 'overtime';

  // High scoring game (both teams over 100 before 4th quarter ends)
  if (
    current.homeScore >= 100 && current.awayScore >= 100 &&
    current.quarter <= 4 &&
    (previous.homeScore < 100 || previous.awayScore < 100)
  ) return 'high_scoring';

  return null;
}

/**
 * Generate a hype comment using Groq (llama-3.3-70b).
 */
export async function generateComment(
  event: string,
  game: GameState,
  activeBetCount: number
): Promise<string> {
  const betContext = activeBetCount > 0
    ? `There are ${activeBetCount} active props on the board for this game. Reference them naturally if relevant.`
    : '';

  const response = await groq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are ChalkBot, the AI commentator for Chalk — a live sports streaming + betting platform with a chalkboard aesthetic.

Your job: drop ONE short, hype comment when something interesting happens in a game. You're like the witty friend in the group chat who only speaks when it's worth it.

Rules:
- ONE sentence, maybe two. Never more. Keep it under 150 characters when possible.
- Sound like a real sports fan, not a robot. Use slang naturally.
- Reference bets/props on the board when relevant (but don't force it)
- Be funny when appropriate. Roast when deserved. Hype when earned.
- No emoji spam. One emoji max per message, and only if it fits.
- Never say "folks" or "ladies and gentlemen" or any corny announcer stuff
- You're in a chat room, not a broadcast booth
- Mention Chalk subtly once in a while ("this is why you watch on Chalk" type stuff, but sparingly — maybe 1 in 10 messages)
- Don't be repetitive. Vary your style.
- Output ONLY the comment text. No quotes, no labels, no prefixes.

${betContext}`,
      },
      {
        role: 'user',
        content: `Event: ${event}
Game: ${game.awayTeam} ${game.awayScore} @ ${game.homeTeam} ${game.homeScore}
Quarter: Q${game.quarter} | Clock: ${game.clock}
Generate one comment.`,
      },
    ],
    max_tokens: 100,
    temperature: 0.9,
  });

  return (response.choices[0]?.message?.content || '').trim();
}
