import { NextResponse } from 'next/server';
import { adminDb, adminFirestore } from '@/lib/firebase-admin';
import { detectInterestingEvent, generateComment, GameState } from '@/lib/chalkbot';

const COOLDOWN_MS = 60_000; // 1 min between comments per game

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

  // Optionally post to chat if gameId is a real game
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

export async function GET(req: Request) {
  // Auth check for cron
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 });
  }

  try {
    // Fetch live games from ESPN
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      { cache: 'no-store' }
    );
    const data = await res.json();

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const liveGames = (data.events ?? []).filter(
      (e: any) => e.status?.type?.state === 'in'
    );

    const comments: { gameId: string; event: string; comment: string }[] = [];

    for (const game of liveGames) {
      const competition = game.competitions?.[0];
      if (!competition) continue;

      const home = competition.competitors?.find((c: any) => c.homeAway === 'home');
      const away = competition.competitors?.find((c: any) => c.homeAway === 'away');
      if (!home || !away) continue;

      const current: GameState = {
        gameId: game.id,
        homeTeam: home.team?.abbreviation ?? '???',
        awayTeam: away.team?.abbreviation ?? '???',
        homeScore: parseInt(home.score) || 0,
        awayScore: parseInt(away.score) || 0,
        quarter: game.status?.period ?? 1,
        clock: game.status?.displayClock ?? '',
      };

      // Get previous state from Firestore
      const stateRef = adminFirestore.collection('chalkbot_states').doc(game.id);
      const stateDoc = await stateRef.get();
      const previous = stateDoc.exists ? (stateDoc.data() as GameState) : null;

      // Detect interesting event
      const event = detectInterestingEvent(current, previous);

      if (event) {
        // Anti-spam: check cooldown
        const lastCommentAt = previous?.lastCommentAt ?? 0;
        if (Date.now() - lastCommentAt < COOLDOWN_MS) {
          // Save state but skip comment
          await stateRef.set(current);
          continue;
        }

        // Get active bet count for this game
        let activeBetCount = 0;
        try {
          const betsSnap = await adminFirestore
            .collection('bets')
            .where('gameId', '==', game.id)
            .where('status', 'in', ['open', 'matched'])
            .get();
          activeBetCount = betsSnap.size;
        } catch {
          // skip bet context
        }

        // Generate comment
        const comment = await generateComment(event, current, activeBetCount);

        if (comment) {
          // Post to Chalk Talk (Firebase Realtime Database)
          const chatRef = adminDb.ref(`chats/${game.id}`);
          await chatRef.push({
            text: comment,
            uid: 'chalkbot',
            name: 'ChalkBot',
            isBot: true,
            eventType: event,
            timestamp: Date.now(),
          });

          comments.push({ gameId: game.id, event, comment });

          // Save state with lastCommentAt
          await stateRef.set({ ...current, lastCommentAt: Date.now() });
        } else {
          await stateRef.set(current);
        }
      } else {
        // No event — still save current state for next diff
        await stateRef.set(current);
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return NextResponse.json({
      gamesChecked: liveGames.length,
      commentsPosted: comments.length,
      comments,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'ChalkBot failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
