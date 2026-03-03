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
const STAT_FULL: Record<string, string> = {
  points: 'POINTS', rebounds: 'REBOUNDS', assists: 'ASSISTS', threes: 'THREE-POINTERS',
};

const WHITE = '#e8e4d9';
const DIM = '#a8a494';
const GHOST = '#6b6860';
const YELLOW = '#f5d960';
const GREEN = '#5de88a';
const RED = '#e85d5d';
const BG_DARK = '#1a2a1a';
const BG_MED = '#243524';

// --- Fonts from CSS vars ---
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

// --- Easing ---
function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }
function easeOutBack(t: number): number { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function easeInOut(t: number): number { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function spring(t: number): number { return 1 - Math.exp(-8 * t) * Math.cos(12 * t); }
function elasticOut(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}

// --- Background ---
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

function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, img: HTMLImageElement | null) {
  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, w, h);

  // Spotlight gradient
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, w * 0.7);
  grad.addColorStop(0, BG_MED + '60');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (img && img.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.4;
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = w / h;
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (ir > cr) { sw = sh * cr; sx = (img.naturalWidth - sw) / 2; }
    else { sh = sw / cr; sy = (img.naturalHeight - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    ctx.restore();
  }

  // Vignette
  ctx.save();
  ctx.globalAlpha = alpha;
  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.5, 'rgba(0,0,0,0.12)');
  vig.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// --- Chalk text ---
function chalk(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  opts: {
    font: string; size: number; color: string;
    align?: CanvasTextAlign; glow?: boolean; glowColor?: string;
    opacity?: number; writeIn?: number; scale?: number;
  }
) {
  const displayText = opts.writeIn != null
    ? text.slice(0, Math.ceil(text.length * Math.min(1, opts.writeIn)))
    : text;
  if (!displayText) return;

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
    ctx.shadowBlur = opts.size * 0.5;
    ctx.fillStyle = opts.color;
    ctx.fillText(displayText, x, y);
    ctx.shadowBlur = opts.size * 0.2;
    ctx.fillText(displayText, x, y);
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = opts.color;
  ctx.globalAlpha = (opts.opacity ?? 1) * 0.95;
  ctx.fillText(displayText, x, y);
  ctx.restore();
}

// --- Dashed box ---
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

// --- Chalk divider ---
function divider(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// --- Particles ---
interface Particle { x: number; y: number; r: number; a: number; vx: number; vy: number; color: string; life: number; }
let particles: Particle[] = [];

function spawnBurst(cx: number, cy: number, count: number, color: string, spread: number, speed: number = 5) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 0.5 + Math.random() * speed;
    particles.push({
      x: cx + (Math.random() - 0.5) * spread * 0.3,
      y: cy + (Math.random() - 0.5) * spread * 0.2,
      r: 2 + Math.random() * 6,
      a: 0.6 + Math.random() * 0.4,
      vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 1.5,
      color, life: 1,
    });
  }
}

function tickParticles(ctx: CanvasRenderingContext2D, dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.93; p.vy *= 0.93;
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    const a = p.a * Math.min(1, p.life * 2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * Math.min(1, p.life * 1.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export interface ChalkCardPerspective {
  direction: string;
  stake: number;
  odds: string;
  name: string;
  isWinner: boolean | null; // null = not settled
}

// =========== MAIN DRAW ===========
export async function drawChalkCardFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bet: Bet,
  progress: number,
  perspective?: ChalkCardPerspective,
) {
  ensureFonts();

  const s = Math.max(w, h) / 1080; // scale off the LARGER dimension so everything is big
  const cx = w / 2;
  const cy = h / 2;
  const isPortrait = h > w;
  const pad = 60 * s;

  // Phase helper
  const t = (start: number, end: number) =>
    Math.max(0, Math.min(1, (progress - start) / (end - start)));

  if (progress < 0.01) particles = [];

  // ========== BACKGROUND ==========
  const bgAlpha = easeOut(t(0, 0.06));
  const bgImg = await ensureBgImage();
  drawBg(ctx, w, h, bgAlpha, bgImg);

  // Noise
  if (bgAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = 0.025;
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 * s, 2 * s);
    }
    ctx.restore();
  }

  const statLabel = STAT_LABELS[bet.stat] || bet.stat;
  const statFull = STAT_FULL[bet.stat] || bet.stat.toUpperCase();
  const userDir = perspective?.direction ?? bet.direction;
  const dirColor = userDir === 'over' ? GREEN : RED;
  const pool = bet.creatorStake + bet.takerStake;
  const userStake = perspective?.stake ?? bet.takerStake;
  const takerDecimal = bet.creatorStake / bet.takerStake;
  const odds = perspective?.odds ?? (takerDecimal >= 1 ? `+${Math.round(takerDecimal * 100)}` : `${Math.round(-100 / takerDecimal)}`);

  // Layout Y positions — fill the screen
  const topY = isPortrait ? h * 0.10 : h * 0.08;
  const playerY = isPortrait ? h * 0.22 : h * 0.22;
  const propY = isPortrait ? h * 0.34 : h * 0.38;
  const numbersY = isPortrait ? h * 0.50 : h * 0.58;
  const stampY = isPortrait ? h * 0.68 : h * 0.76;
  const footerY = isPortrait ? h * 0.88 : h * 0.90;

  // ========== 0.04–0.15: GAME TITLE ==========
  const titleP = t(0.04, 0.15);
  if (titleP > 0) {
    const gameText = (bet.gameTitle || 'NBA PROP').toUpperCase();
    chalk(ctx, gameText, cx, topY, {
      font: bodyFont, size: Math.round(28 * s), color: GHOST,
      writeIn: easeOut(titleP), opacity: easeOut(titleP),
    });
    const la = easeOut(t(0.10, 0.15));
    if (la > 0) divider(ctx, cx - 120 * s, topY + 30 * s, cx + 120 * s, GHOST, la * 0.5);
  }

  // ========== 0.10–0.28: PLAYER NAME — huge, slides up, elastic ==========
  const playerP = t(0.10, 0.28);
  if (playerP > 0) {
    const ep = elasticOut(playerP);
    const slideY = playerY + (1 - ep) * 60 * s;
    const playerSize = Math.round(isPortrait ? 72 * s : 80 * s);

    chalk(ctx, bet.player.toUpperCase(), cx, slideY, {
      font: headerFont, size: playerSize, color: WHITE,
      glow: true, glowColor: WHITE + '50',
      opacity: Math.min(1, playerP * 3), scale: 0.7 + ep * 0.3,
    });
  }

  // ========== 0.22–0.40: PROP LINE — direction badge + giant number + stat ==========
  const propP = t(0.22, 0.40);
  if (propP > 0) {
    const ep = easeOutBack(propP);
    const op = Math.min(1, propP * 3);

    // Direction badge — big, colored
    const dirText = userDir.toUpperCase();
    const badgeW = 140 * s;
    const badgeH = 52 * s;
    const badgeCx = cx;
    const badgeTop = propY - 55 * s;

    ctx.save();
    ctx.globalAlpha = op * 0.15;
    ctx.fillStyle = dirColor;
    ctx.beginPath();
    ctx.roundRect(badgeCx - badgeW / 2, badgeTop, badgeW, badgeH, 6 * s);
    ctx.fill();
    ctx.restore();
    dashedBox(ctx, badgeCx - badgeW / 2, badgeTop, badgeW, badgeH, dirColor, 2 * s, op * 0.5, 6 * s);

    chalk(ctx, dirText, badgeCx, badgeTop + badgeH / 2, {
      font: headerFont, size: Math.round(28 * s), color: dirColor,
      opacity: op, glow: true, glowColor: dirColor + '40',
    });

    // Giant target number
    const targetSize = Math.round(isPortrait ? 120 * s : 110 * s);
    chalk(ctx, `${bet.target}`, cx, propY + 30 * s, {
      font: headerFont, size: targetSize, color: WHITE,
      glow: true, glowColor: dirColor + '40',
      opacity: op, scale: 0.5 + ep * 0.5,
    });

    // Stat label underneath the number
    chalk(ctx, statFull, cx, propY + 30 * s + targetSize * 0.45, {
      font: bodyFont, size: Math.round(26 * s), color: DIM,
      opacity: op * 0.8,
    });
  }

  // ========== 0.38–0.55: NUMBERS — stake / pot / odds with labels ==========
  const numP = t(0.38, 0.55);
  if (numP > 0) {
    // Top divider
    const d1a = easeOut(t(0.38, 0.42));
    divider(ctx, pad, numbersY - 50 * s, w - pad, GHOST, d1a * 0.4);

    const colW = (w - pad * 2) / 3;
    const items = [
      { label: 'YOUR STAKE', sublabel: 'coins to risk', value: `${userStake}`, color: YELLOW, unit: '' },
      { label: 'TOTAL POT', sublabel: 'winner takes all', value: `${pool}`, color: WHITE, unit: '' },
      { label: 'YOUR ODDS', sublabel: 'payout multiplier', value: odds, color: GREEN, unit: '' },
    ];

    for (let i = 0; i < items.length; i++) {
      const stagger = t(0.38 + i * 0.04, 0.52 + i * 0.02);
      if (stagger <= 0) continue;
      const ep = easeOutBack(stagger);
      const op = Math.min(1, stagger * 3);
      const ix = pad + colW * i + colW / 2;
      const slideY = numbersY + (1 - ep) * 30 * s;

      // Label above
      chalk(ctx, items[i].label, ix, slideY - 25 * s, {
        font: headerFont, size: Math.round(14 * s), color: GHOST,
        opacity: op * 0.7,
      });

      // Big value
      chalk(ctx, items[i].value, ix, slideY + 15 * s, {
        font: headerFont, size: Math.round(56 * s), color: items[i].color,
        glow: true, glowColor: items[i].color + '30',
        opacity: op, scale: 0.6 + ep * 0.4,
      });

      // Sublabel underneath
      chalk(ctx, items[i].sublabel, ix, slideY + 50 * s, {
        font: bodyFont, size: Math.round(14 * s), color: GHOST,
        opacity: op * 0.5,
      });
    }

    // Bottom divider
    const d2a = easeOut(t(0.50, 0.55));
    divider(ctx, pad, numbersY + 75 * s, w - pad, GHOST, d2a * 0.4);
  }

  // ========== 0.52–0.72: STAMP — result with massive spring + dust explosion ==========
  const stampP = t(0.52, 0.72);
  if (stampP > 0) {
    let stampText: string;
    let stampColor: string;
    if (bet.status === 'settled') {
      const userWon = perspective?.isWinner ?? (bet.result === 'creator_wins');
      if (bet.result === 'push') { stampText = 'PUSH'; stampColor = DIM; }
      else if (userWon) { stampText = 'CASHED'; stampColor = GREEN; }
      else { stampText = 'ERASED'; stampColor = RED; }
    } else if (bet.status === 'matched') { stampText = 'LIVE'; stampColor = YELLOW; }
    else { stampText = 'ON THE BOARD'; stampColor = GREEN; }

    const sp = spring(stampP);
    const scl = 2.5 - sp * 1.5; // 2.5x → 1x
    const rot = (1 - sp) * 0.25;

    // Spawn dust burst at impact
    if (stampP > 0.01 && stampP < 0.06 && particles.length === 0) {
      spawnBurst(cx, stampY, 40, stampColor, 200 * s, 6);
      spawnBurst(cx, stampY, 20, WHITE, 100 * s, 4);
    }

    ctx.save();
    ctx.translate(cx, stampY);
    ctx.rotate(rot);
    ctx.scale(scl, scl);

    const stampSize = Math.round(isPortrait ? 80 * s : 72 * s);
    ctx.font = `${stampSize}px ${headerFont}`;
    const metrics = ctx.measureText(stampText);
    const boxW = metrics.width + 70 * s;
    const boxH = 110 * s;

    // Glow bg
    ctx.globalAlpha = Math.min(1, sp) * 0.15;
    ctx.fillStyle = stampColor;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 8 * s);
    ctx.fill();

    // Border
    ctx.globalAlpha = Math.min(1, sp) * 0.6;
    ctx.strokeStyle = stampColor;
    ctx.lineWidth = 4 * s;
    ctx.setLineDash([12 * s, 8 * s]);
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 8 * s);
    ctx.stroke();
    ctx.setLineDash([]);

    // Text with double glow
    ctx.globalAlpha = Math.min(1, sp);
    ctx.shadowColor = stampColor;
    ctx.shadowBlur = stampSize * 0.8;
    ctx.fillStyle = stampColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stampText, 0, 0);
    ctx.shadowBlur = stampSize * 0.3;
    ctx.fillText(stampText, 0, 0);
    ctx.shadowBlur = 0;

    ctx.restore();

    // Tick particles
    if (particles.length > 0) {
      tickParticles(ctx, 0.02);
    }

    // "Actual: X PTS" under stamp
    if (bet.actualValue != null) {
      const avP = t(0.65, 0.72);
      if (avP > 0) {
        chalk(ctx, `Final: ${bet.actualValue} ${statLabel}`, cx, stampY + 70 * s, {
          font: bodyFont, size: Math.round(28 * s), color: DIM,
          opacity: easeOut(avP),
        });
      }
    }
  }

  // ========== 0.70–0.85: CREATOR ==========
  const creatorP = t(0.70, 0.85);
  if (creatorP > 0) {
    const userName = perspective?.name || bet.creatorName || 'Anonymous';
    chalk(ctx, `by ${userName}`, cx, footerY - 40 * s, {
      font: bodyFont, size: Math.round(28 * s), color: DIM,
      opacity: easeOut(creatorP), writeIn: easeOut(creatorP),
    });
  }

  // ========== 0.80–1.00: CHALK WATERMARK — glows in ==========
  const wmP = t(0.80, 1.0);
  if (wmP > 0) {
    const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.03; // subtle breathe
    chalk(ctx, 'CHALK', cx, footerY + 20 * s, {
      font: headerFont, size: Math.round(42 * s), color: YELLOW,
      glow: true, glowColor: YELLOW + '50',
      opacity: easeOut(wmP) * 0.8, scale: pulse,
    });
  }

  // ========== Border frame around entire card ==========
  const borderP = t(0.06, 0.20);
  if (borderP > 0) {
    const inset = 20 * s;
    dashedBox(ctx, inset, inset, w - inset * 2, h - inset * 2, GHOST, 1.5 * s, easeOut(borderP) * 0.2, 8 * s);
  }
}
