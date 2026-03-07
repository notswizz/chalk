import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminFirestore } from '@/lib/firebase-admin';
import { detectInterestingEvent, generateComment, GameState } from '@/lib/chalkbot';

const COOLDOWN_MS = 60_000; // 1 min between comments per game

/* eslint-disable @typescript-eslint/no-explicit-any */
async function processGame(game: any): Promise<{ gameId: string; event: string; comment: string } | null> {
  const competition = game.competitions?.[0];
  if (!competition) return null;

  const home = competition.competitors?.find((c: any) => c.homeAway === 'home');
  const away = competition.competitors?.find((c: any) => c.homeAway === 'away');
  if (!home || !away) return null;

  const current: GameState = {
    gameId: game.id,
    homeTeam: home.team?.abbreviation ?? '???',
    awayTeam: away.team?.abbreviation ?? '???',
    homeScore: parseInt(home.score) || 0,
    awayScore: parseInt(away.score) || 0,
    quarter: game.status?.period ?? 1,
    clock: game.status?.displayClock ?? '',
  };

  const stateRef = adminFirestore.collection('chalkbot_states').doc(game.id);
  const stateDoc = await stateRef.get();
  const previous = stateDoc.exists ? (stateDoc.data() as GameState) : null;

  const event = detectInterestingEvent(current, previous);

  if (!event) {
    await stateRef.set(current);
    return null;
  }

  // Anti-spam: check cooldown
  const lastCommentAt = previous?.lastCommentAt ?? 0;
  if (Date.now() - lastCommentAt < COOLDOWN_MS) {
    await stateRef.set(current);
    return null;
  }

  // Get active bet count
  let activeBetCount = 0;
  try {
    const betsSnap = await adminFirestore
      .collection('bets')
      .where('gameId', '==', game.id)
      .where('status', 'in', ['open', 'matched'])
      .get();
    activeBetCount = betsSnap.size;
  } catch { /* skip */ }

  const comment = await generateComment(event, current, activeBetCount);

  if (comment) {
    const chatRef = adminDb.ref(`chats/${game.id}`);
    await chatRef.push({
      text: comment,
      uid: 'chalkbot',
      name: 'ChalkBot',
      isBot: true,
      eventType: event,
      timestamp: Date.now(),
    });
    await stateRef.set({ ...current, lastCommentAt: Date.now() });
    return { gameId: game.id, event, comment };
  }

  await stateRef.set(current);
  return null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// GET /api/chalkbot?gameId=XXX — triggered by viewers or cron
export async function GET(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 });
  }

  try {
    const targetGameId = req.nextUrl.searchParams.get('gameId');

    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      { cache: 'no-store' }
    );
    const data = await res.json();

    /* eslint-disable @typescript-eslint/no-explicit-any */
    let games = (data.events ?? []).filter(
      (e: any) => e.status?.type?.state === 'in'
    );

    // If gameId specified, only process that game
    if (targetGameId) {
      games = games.filter((e: any) => e.id === targetGameId);
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const comments: { gameId: string; event: string; comment: string }[] = [];

    for (const game of games) {
      const result = await processGame(game);
      if (result) comments.push(result);
    }

    return NextResponse.json({
      gamesChecked: games.length,
      commentsPosted: comments.length,
      comments,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'ChalkBot failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/chalkbot — test with fake game data
export async function POST(req: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 });
  }

  const body = await req.json();
  const event = body.event || 'lead_change';
  const game: GameState = {
    gameId: body.gameId || 'test',
    homeTeam: body.homeTeam || 'BOS',
    awayTeam: body.awayTeam || 'LAL',
    homeScore: body.homeScore ?? 97,
    awayScore: body.awayScore ?? 98,
    quarter: body.quarter ?? 4,
    clock: body.clock || '2:31',
  };

  const comment = await generateComment(event, game, body.activeBetCount ?? 0);

  if (body.postToChat && comment) {
    const chatRef = adminDb.ref(`chats/${game.gameId}`);
    await chatRef.push({
      text: comment,
      uid: 'chalkbot',
      name: 'ChalkBot',
      isBot: true,
      eventType: event,
      timestamp: Date.now(),
    });
  }

  return NextResponse.json({ event, game, comment });
}
