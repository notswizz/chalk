import { Bet } from '@/components/betting/BetCard';

export type ChalkCardFormat = 'story' | 'square' | 'landscape';

export const FORMAT_SIZES: Record<ChalkCardFormat, { w: number; h: number }> = {
  story: { w: 720, h: 1280 },
  square: { w: 1080, h: 1080 },
  landscape: { w: 1280, h: 720 },
};

const STAT_LABELS: Record<string, string> = {
  points: 'PTS', rebounds: 'REB', assists: 'AST', threes: '3PM',
};

const WHITE = '#e8e4d9';
const DIM = '#a8a494';
const GHOST = '#6b6860';
const YELLOW = '#f5d960';
const GREEN = '#5de88a';
const RED = '#e85d5d';
const BG_DARK = '#1a2a1a';
const BG_MED = '#243524';

let headerFont = '';
let bodyFont = '';

function ensureFonts() {
  if (typeof document === 'undefined') return;
  if (!headerFont) {
    const val = getComputedStyle(document.documentElement).getPropertyValue('--font-chalk-header').trim();
    headerFont = val || '"Permanent Marker", cursive';
  }
  if (!bodyFont) {
    const val = getComputedStyle(document.documentElement).getPropertyValue('--font-chalk-body').trim();
    bodyFont = val || '"Patrick Hand", cursive';
  }
}

export interface ChalkCardPerspective {
  direction: string;
  stake: number;
  odds: string;
  name: string;
  isWinner: boolean | null;
}

// ── NBA team name → ESPN abbreviation ──
const TEAM_ABBREVS: Record<string, string> = {
  'atlanta hawks': 'atl', 'boston celtics': 'bos', 'brooklyn nets': 'bkn',
  'charlotte hornets': 'cha', 'chicago bulls': 'chi', 'cleveland cavaliers': 'cle',
  'dallas mavericks': 'dal', 'denver nuggets': 'den', 'detroit pistons': 'det',
  'golden state warriors': 'gs', 'houston rockets': 'hou', 'indiana pacers': 'ind',
  'la clippers': 'lac', 'los angeles clippers': 'lac',
  'los angeles lakers': 'lal', 'la lakers': 'lal',
  'memphis grizzlies': 'mem', 'miami heat': 'mia', 'milwaukee bucks': 'mil',
  'minnesota timberwolves': 'min', 'new orleans pelicans': 'no',
  'new york knicks': 'ny', 'oklahoma city thunder': 'okc',
  'orlando magic': 'orl', 'philadelphia 76ers': 'phi', 'phoenix suns': 'phx',
  'portland trail blazers': 'por', 'sacramento kings': 'sac',
  'san antonio spurs': 'sa', 'toronto raptors': 'tor',
  'utah jazz': 'uta', 'washington wizards': 'wsh',
};

function getTeamAbbrev(name: string): string | null {
  return TEAM_ABBREVS[name.toLowerCase().trim()] || null;
}

function parseTeams(gameTitle: string): { away: string | null; home: string | null } {
  // "Dallas Mavericks vs Charlotte Hornets"
  const parts = gameTitle.split(/\s+vs\.?\s+/i);
  if (parts.length !== 2) return { away: null, home: null };
  return { away: getTeamAbbrev(parts[0]), home: getTeamAbbrev(parts[1]) };
}

function getLogoUrl(abbrev: string): string {
  return `https://a.espncdn.com/i/teamlogos/nba/500/${abbrev}.png`;
}

// ── Image loading with cache ──
const imageCache = new Map<string, HTMLImageElement | null>();

function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(url)) return Promise.resolve(imageCache.get(url)!);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(url, img); resolve(img); };
    img.onerror = () => { imageCache.set(url, null); resolve(null); };
    img.src = url;
  });
}

// ── Background texture ──
let bgImage: HTMLImageElement | null = null;

function ensureBgImage(): Promise<HTMLImageElement | null> {
  if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) return Promise.resolve(bgImage);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { bgImage = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = '/chalkboard.jpg';
  });
}

// ── Drawing helpers ──
function chalk(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  opts: {
    font: string; size: number; color: string;
    align?: CanvasTextAlign; glow?: boolean; glowColor?: string;
    opacity?: number; scale?: number; maxWidth?: number;
  }
) {
  if (!text) return;
  ctx.save();
  ctx.globalAlpha = opts.opacity ?? 1;
  if (opts.scale && opts.scale !== 1) {
    ctx.translate(x, y);
    ctx.scale(opts.scale, opts.scale);
    ctx.translate(-x, -y);
  }
  ctx.font = `${opts.size}px ${opts.font}`;
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = 'middle';

  if (opts.glow) {
    ctx.shadowColor = opts.glowColor || opts.color;
    ctx.shadowBlur = opts.size * 0.6;
    ctx.fillStyle = opts.color;
    ctx.fillText(text, x, y, opts.maxWidth);
    ctx.shadowBlur = opts.size * 0.25;
    ctx.fillText(text, x, y, opts.maxWidth);
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = opts.color;
  ctx.fillText(text, x, y, opts.maxWidth);
  ctx.restore();
}

function dashedBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, bw: number, bh: number,
  color: string, lw: number, alpha: number, r: number = 6
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.setLineDash([lw * 3, lw * 2]);
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, r);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function divider(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement | null) {
  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createRadialGradient(w * 0.5, h * 0.32, 0, w * 0.5, h * 0.32, w * 0.8);
  grad.addColorStop(0, BG_MED + '90');
  grad.addColorStop(0.5, BG_MED + '30');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (img && img.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = w / h;
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (ir > cr) { sw = sh * cr; sx = (img.naturalWidth - sw) / 2; }
    else { sh = sw / cr; sy = (img.naturalHeight - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    ctx.restore();
  }

  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.9);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.6, 'rgba(0,0,0,0.08)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

// =========== STATIC DRAW ===========
export async function drawChalkCardStatic(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bet: Bet,
  perspective?: ChalkCardPerspective,
) {
  ensureFonts();

  const s = Math.max(w, h) / 1080;
  const cx = w / 2;
  const isPortrait = h > w;
  const pad = 50 * s;

  // Background
  const bgImg = await ensureBgImage();
  drawBg(ctx, w, h, bgImg);

  // Load team logos
  const teams = parseTeams(bet.gameTitle || '');
  const [awayLogo, homeLogo] = await Promise.all([
    teams.away ? loadImage(getLogoUrl(teams.away)) : Promise.resolve(null),
    teams.home ? loadImage(getLogoUrl(teams.home)) : Promise.resolve(null),
  ]);

  const statLabel = STAT_LABELS[bet.stat] || bet.stat;
  const userDir = perspective?.direction ?? bet.direction;
  const dirColor = userDir === 'over' ? GREEN : RED;
  const pool = bet.creatorStake + bet.takerStake;
  const userStake = perspective?.stake ?? bet.takerStake;
  const takerDecimal = bet.creatorStake / bet.takerStake;
  const odds = perspective?.odds ?? (takerDecimal >= 1 ? `+${Math.round(takerDecimal * 100)}` : `${Math.round(-100 / takerDecimal)}`);

  // ━━ LAYOUT Y positions (1:1 square optimized) ━━
  const logoY = h * 0.075;
  const gameY = h * 0.075;
  const playerY = h * 0.20;
  const propY = h * 0.35;
  const numbersY = h * 0.54;
  const stampY = h * 0.72;
  const footerY = h * 0.90;

  // ══════════════ TEAM LOGOS + GAME TITLE ══════════════
  const logoSize = Math.round(72 * s);
  const hasLogos = awayLogo || homeLogo;

  if (hasLogos) {
    // Draw logos on left and right with "vs" in center
    const logoSpacing = 160 * s;

    if (awayLogo) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(awayLogo, cx - logoSpacing - logoSize / 2, logoY - logoSize / 2 + 4 * s, logoSize, logoSize);
      ctx.restore();
    }

    chalk(ctx, 'vs', cx, logoY + 4 * s, {
      font: bodyFont, size: Math.round(28 * s), color: GHOST,
    });

    if (homeLogo) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(homeLogo, cx + logoSpacing - logoSize / 2, logoY - logoSize / 2 + 4 * s, logoSize, logoSize);
      ctx.restore();
    }
  } else {
    // Fallback: just text
    const gameText = (bet.gameTitle || 'NBA PROP').toUpperCase();
    chalk(ctx, gameText, cx, gameY, {
      font: bodyFont, size: Math.round(32 * s), color: DIM,
    });
  }

  // ══════════════ PLAYER NAME ══════════════
  const playerSize = Math.round(78 * s);
  chalk(ctx, bet.player.toUpperCase(), cx, playerY, {
    font: headerFont, size: playerSize, color: WHITE,
    glow: true, glowColor: WHITE + '60', maxWidth: w - pad * 2,
  });

  // thin divider under player
  divider(ctx, pad + 20 * s, playerY + playerSize * 0.45, w - pad - 20 * s, DIM, 0.35);

  // ══════════════ PROP LINE: "OVER 12.5 PTS" ══════════════
  const dirText = userDir.toUpperCase();
  const targetText = `${bet.target}`;
  const targetSize = Math.round(130 * s);
  const statSize = Math.round(48 * s);
  const badgeFontSize = Math.round(36 * s);

  // Measure to center the whole group
  ctx.font = `${targetSize}px ${headerFont}`;
  const targetW = ctx.measureText(targetText).width;
  ctx.font = `${statSize}px ${headerFont}`;
  const statW = ctx.measureText(statLabel).width;
  ctx.font = `${badgeFontSize}px ${headerFont}`;
  const dirW = ctx.measureText(dirText).width;
  const badgePadX = 24 * s;
  const badgeTotalW = dirW + badgePadX * 2;
  const gap = 20 * s;
  const totalLineW = badgeTotalW + gap + targetW + gap * 0.6 + statW;
  const lineStartX = cx - totalLineW / 2;

  // Direction badge
  const badgeH = 56 * s;
  const badgeX = lineStartX;
  const badgeBoxY = propY - badgeH / 2;

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = dirColor;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeBoxY, badgeTotalW, badgeH, 8 * s);
  ctx.fill();
  ctx.restore();
  dashedBox(ctx, badgeX, badgeBoxY, badgeTotalW, badgeH, dirColor, 2.5 * s, 0.6, 8 * s);

  chalk(ctx, dirText, badgeX + badgeTotalW / 2, propY, {
    font: headerFont, size: badgeFontSize, color: dirColor,
    glow: true, glowColor: dirColor + '50',
  });

  // Target number — BIG
  const numX = badgeX + badgeTotalW + gap + targetW / 2;
  chalk(ctx, targetText, numX, propY, {
    font: headerFont, size: targetSize, color: WHITE,
    glow: true, glowColor: dirColor + '50',
  });

  // Stat label — large and bright
  const statX = numX + targetW / 2 + gap * 0.6 + statW / 2;
  chalk(ctx, statLabel, statX, propY, {
    font: headerFont, size: statSize, color: YELLOW,
    glow: true, glowColor: YELLOW + '30',
  });

  // ══════════════ NUMBERS ROW ══════════════
  divider(ctx, pad, numbersY - 55 * s, w - pad, DIM, 0.4);

  const colW = (w - pad * 2) / 3;
  const items = [
    { label: 'STAKE', value: userStake.toLocaleString(), color: YELLOW },
    { label: 'POT', value: pool.toLocaleString(), color: WHITE },
    { label: 'ODDS', value: odds, color: GREEN },
  ];

  for (let i = 0; i < items.length; i++) {
    const ix = pad + colW * i + colW / 2;

    chalk(ctx, items[i].label, ix, numbersY - 28 * s, {
      font: headerFont, size: Math.round(24 * s), color: DIM,
    });

    chalk(ctx, items[i].value, ix, numbersY + 22 * s, {
      font: headerFont, size: Math.round(52 * s), color: items[i].color,
      glow: true, glowColor: items[i].color + '40',
    });
  }

  divider(ctx, pad, numbersY + 70 * s, w - pad, DIM, 0.4);

  // ══════════════ RESULT STAMP ══════════════
  let stampText: string;
  let stampColor: string;
  if (bet.status === 'settled') {
    const userWon = perspective?.isWinner ?? (bet.result === 'creator_wins');
    if (bet.result === 'push') { stampText = 'PUSH'; stampColor = DIM; }
    else if (userWon) { stampText = 'CASHED'; stampColor = GREEN; }
    else { stampText = 'ERASED'; stampColor = RED; }
  } else if (bet.status === 'matched') { stampText = 'LIVE'; stampColor = YELLOW; }
  else { stampText = 'ON THE BOARD'; stampColor = GREEN; }

  const stampFontSize = Math.round(72 * s);
  ctx.save();
  ctx.font = `${stampFontSize}px ${headerFont}`;
  const stampMetrics = ctx.measureText(stampText);
  const boxW = stampMetrics.width + 80 * s;
  const boxH = 100 * s;

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = stampColor;
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, stampY - boxH / 2, boxW, boxH, 10 * s);
  ctx.fill();

  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = stampColor;
  ctx.lineWidth = 4 * s;
  ctx.setLineDash([14 * s, 8 * s]);
  ctx.beginPath();
  ctx.roundRect(cx - boxW / 2, stampY - boxH / 2, boxW, boxH, 10 * s);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 1;
  ctx.shadowColor = stampColor;
  ctx.shadowBlur = stampFontSize * 0.7;
  ctx.fillStyle = stampColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stampText, cx, stampY);
  ctx.shadowBlur = stampFontSize * 0.25;
  ctx.fillText(stampText, cx, stampY);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Actual value under stamp
  if (bet.actualValue != null) {
    chalk(ctx, `Final: ${bet.actualValue} ${statLabel}`, cx, stampY + 68 * s, {
      font: bodyFont, size: Math.round(32 * s), color: WHITE, opacity: 0.8,
    });
  }

  // ══════════════ CREATOR ══════════════
  const userName = perspective?.name || bet.creatorName || 'Anonymous';
  chalk(ctx, `by ${userName}`, cx, footerY - 30 * s, {
    font: bodyFont, size: Math.round(34 * s), color: DIM,
  });

  // ══════════════ CHALK LOGO ══════════════
  chalk(ctx, 'CHALK', cx, footerY + 30 * s, {
    font: headerFont, size: Math.round(56 * s), color: YELLOW,
    glow: true, glowColor: YELLOW + '60',
  });

  // ══════════════ BORDER FRAME ══════════════
  const inset = 18 * s;
  dashedBox(ctx, inset, inset, w - inset * 2, h - inset * 2, DIM, 2 * s, 0.3, 10 * s);
}
