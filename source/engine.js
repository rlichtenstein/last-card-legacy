/* =====================================================================
   ENGINE — the rules of the hand, the stickers, and the campaign between
   hands. No drawing code lives here, so it can be tested on its own.
   ===================================================================== */
const COLORS = ['red', 'blue', 'yellow', 'green'];
const STICKER_KEYS = ['sig', 'grudge', 'plus', 'mud', 'glue', 'crown', 'rainbow', 'bomb'];
const REMOVABLE = ['mud', 'glue', 'plus', 'bomb', 'grudge'];
const rnd = n => Math.floor(Math.random() * n);
const pickOne = a => a[rnd(a.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

const C = (S, id) => S.camp.cards[id];
const nm = (S, p) => S.camp.names[p];
/* Every card belongs to one player's deck (card.own). Cards still in a sealed box or the Supply have no owner yet. */
const CAMPAIGN_VERSION = 2;
const MIN_DECK = 15;
const SWAP_NUM = 5, PASS_NUM = 0;   /* Fives and Zeros */
const deckIds = camp => camp.order.filter(id => !camp.cards[id].torn && camp.cards[id].own != null);
const ownDeck = (camp, p) => deckIds(camp).filter(id => camp.cards[id].own === p);
const deckSize = (camp, p) => ownDeck(camp, p).length;
/* A card can be torn only if its owner's deck stays at MIN_DECK or above. */
const tearable = (camp, id) => camp.cards[id].own != null && deckSize(camp, camp.cards[id].own) > MIN_DECK;
const colorName = c => c === 'wild' ? 'Wild' : CONTENT.colors[c].name;

/* ---------- faces ---------- */
function faceOf(card) {
  if (card.k === 'frank') return card.h[0];
  if (card.k === 'custom') {
    if (card.c === 'wild') return { c: 'wild', k: 'cwild', eff: card.eff || 'none', nm: card.nm };
    if (card.eff === 'num') return { c: card.c, k: 'num', n: card.n, nm: card.nm };
    return { c: card.c, k: card.eff, nm: card.nm };
  }
  const f = { c: card.c, k: card.k };
  if (card.k === 'num') { f.n = card.n; if (card.c2) f.c2 = card.c2; }
  return f;
}
/* A Frankencard or Blankenstein has two halves the player picks between. A dual-color card is one face with two colors (c and c2): both always count. */
const isDual = card => card.k === 'num' && !!card.c2;
const facesOf = card => card.k === 'frank' ? card.h : [faceOf(card)];
const symOf = f => f.k === 'num' ? 'n' + f.n : f.k;
const isWildF = f => f.c === 'wild';
function drawAmt(f) { if (!f) return 0; if (f.k === 'd2') return 2; if (f.k === 'w4') return 4; if (f.k === 'cwild' && f.eff === 'd2') return 2; return 0; }
const actOf = f => f.k === 'cwild' ? f.eff : f.k;
function faceName(f) {
  if (f.nm) return '“' + f.nm + '”';
  const col = f.c === 'wild' ? '' : colorName(f.c) + (f.c2 ? '/' + colorName(f.c2) : '') + ' ';
  if (f.k === 'num') return col + f.n;
  return (col + CONTENT.kinds[f.k].name).trim();
}
function cardName(card) {
  if (card.k === 'frank') return faceName(card.h[0]) + ' + ' + faceName(card.h[1]);
  if (card.k === 'custom') return '“' + card.nm + '” (' + colorName(card.c) + ')';
  if (isDual(card)) return colorName(card.c) + '/' + colorName(card.c2) + ' ' + card.n;
  return faceName(faceOf(card));
}
const facePts = f => f.c === 'wild' ? 50 : f.k === 'num' ? f.n : 20;
const cardPts = card => Math.max.apply(null, facesOf(card).map(facePts));
const stickerCount = card => Object.keys(card.st).length;
function canSticker(card, s) {
  if (card.torn) return false;
  if (card.st[s] != null) return false;
  if (stickerCount(card) >= CONTENT.maxStickers) return false;
  if (s === 'rainbow' && facesOf(card).some(isWildF)) return false;
  return true;
}
const removable = card => REMOVABLE.filter(s => card.st[s] != null);
/* A torn card's stickers stay on one of its halves. Two halves can be taped together only if the
   result still follows the sticker rule: no more than maxStickers, and no two of the same kind. */
const halfSt = h => (h && h.st) || {};
function tapeOK(a, b) {
  if (!a || !b || a === b || a.from === b.from) return false;
  const ka = Object.keys(halfSt(a)), kb = Object.keys(halfSt(b));
  return !ka.some(k => kb.indexOf(k) >= 0) && ka.length + kb.length <= CONTENT.maxStickers;
}
function tapePairs(camp, first) {
  const hs = camp.halves.filter(h => !h.used), out = [];
  for (let i = 0; i < hs.length; i++) for (let j = i + 1; j < hs.length; j++) if (tapeOK(hs[i], hs[j])) { out.push([hs[i], hs[j]]); if (first) return out; }
  return out;
}
const canTape = camp => tapePairs(camp, true).length > 0;
function stickerNames(st) {
  const ns = Object.keys(st).map(s => CONTENT.stickers[s] ? CONTENT.stickers[s].name : s);
  return ns.length < 2 ? ns.join('') : ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1];
}

/* ---------- campaign setup ---------- */
function addCard(camp, props) {
  const id = 'k' + (++camp.nextId);
  camp.cards[id] = Object.assign({ id, st: {} }, props);
  if (!camp.cards[id].st) camp.cards[id].st = {};
  camp.order.push(id);
  return id;
}
function newSupply() {
  const s = {}, U = CONTENT.supply;
  ['skip', 'rev'].forEach(k => COLORS.forEach(c => { s[k + '-' + c] = U.action; }));
  COLORS.forEach(c => { s['d2-' + c] = U.d2; });
  /* Dual-color cards: every pair of colors, numbers 0 to dualHigh. */
  COLORS.forEach((a, i) => COLORS.slice(i + 1).forEach(b => { for (let x = 0; x <= U.dualHigh; x++) s['dual-' + a + '-' + b + '-' + x] = U.dual; }));
  return s;
}
function newCampaign(names, bots) {
  const n = names.length;
  const camp = {
    v: CAMPAIGN_VERSION, n, names: names.slice(), bots: bots.slice(), hand: 0,
    stars: Array(n).fill(0), wins: Array(n).fill(0),
    cards: {}, order: [], halves: [], blanks: 0, supply: newSupply(),
    turned: [], opened: [], queued: {}, rules: {},
    perks: names.map(() => ({ deal: 0, redo: false })),
    queue: [{ t: 'next' }], phase: 'between',
    lastRanks: [], lastWinner: -1, lastLoser: -1, history: [], log: [], nextId: 0, tears: 0, started: Date.now()
  };
  /* Everyone starts with the same deck. */
  for (let p = 0; p < n; p++) {
    for (const c of COLORS) for (let x = CONTENT.starter.low; x <= CONTENT.starter.high; x++) addCard(camp, { c, k: 'num', n: x, own: p });
    CONTENT.starter.extras.forEach(e => addCard(camp, Object.assign({ own: p }, e)));
  }
  return camp;
}
function clog(S, text, kind) {
  const camp = S.camp;
  camp.log.push({ h: camp.hand, t: text, k: kind || '' });
  if (camp.log.length > 500) camp.log.splice(0, camp.log.length - 500);
}
function feed(S, text) {
  const G = S.game; if (!G) return;
  G.feed.push(text);
  if (G.feed.length > 8) G.feed.splice(0, G.feed.length - 8);
}
/* Best first. Ties go to whoever finished higher in the last hand. */
function rankByStars(camp) {
  const idx = p => { const i = camp.lastRanks.indexOf(p); return i < 0 ? p : i; };
  return [...Array(camp.n).keys()].sort((a, b) => camp.stars[b] - camp.stars[a] || idx(a) - idx(b));
}
const fewestFirst = camp => rankByStars(camp).reverse();
const lowestPlayer = camp => fewestFirst(camp)[0];
function addStars(S, p, d, why) {
  const camp = S.camp;
  const before = camp.stars[p];
  camp.stars[p] = Math.max(0, before + d);
  return camp.stars[p] - before;
}

/* ---------- the hand ---------- */
const nextP = (G, p, k) => { const n = G.hands.length; return (((p + G.dir * k) % n) + n) % n; };

/* Your own cards sitting under the top card of the middle pile. */
const reclaimable = (S, p) => S.game.disc.slice(0, -1).filter(id => C(S, id).own === p);
const canDraw = (S, p) => S.game.decks[p].length > 0 || reclaimable(S, p).length > 0;
/* Draw from your own deck. If it runs out, pull your own cards out of the middle pile and shuffle them. */
function drawCards(S, p, k) {
  const G = S.game; let got = 0;
  for (let i = 0; i < k; i++) {
    if (!G.decks[p].length) {
      if (G.ev.ranOut == null) G.ev.ranOut = p;
      const mine = reclaimable(S, p);
      if (!mine.length) break;
      const top = G.disc[G.disc.length - 1];
      G.disc = G.disc.filter(id => id === top || mine.indexOf(id) < 0);
      G.decks[p] = shuffle(mine);
      feed(S, nm(S, p) + ' ran out of cards and shuffled their own cards from the pile into a new deck.');
    }
    G.hands[p].push(G.decks[p].pop()); got++;
  }
  G.drawn[p] += got;
  if (p === G.turn) G.turnDraw += got;
  noteHands(S);
  return got;
}
function noteHands(S) {
  const G = S.game;
  if (G.ev.held12 == null) { const q = G.hands.findIndex(h => h.length >= 12); if (q >= 0) G.ev.held12 = q; }
}
/* The colors in play: one, or two right after a dual-color card. */
const liveColors = G => G.color2 ? [G.color, G.color2] : [G.color];
function canFace(S, card, f) {
  const G = S.game, rb = !!card.st.rainbow, cols = liveColors(G);
  /* A dual-color card matches if either of its colors is in play. */
  const colorHit = rb || cols.indexOf(f.c) >= 0 || (!!f.c2 && cols.indexOf(f.c2) >= 0);
  if (G.facing) {
    if (f.k === 'boom') return true;
    if (f.k === 'mirror') return colorHit && drawAmt(G.top) > 0;
    if (!drawAmt(f)) return false;
    if (f.c === 'wild') return true;
    return colorHit || (drawAmt(G.top) === 2 && G.top.c !== 'wild');
  }
  if (f.c === 'wild') return true;
  if (f.k === 'mirror') return colorHit || !!G.top.m;
  return colorHit || symOf(f) === symOf(G.top);
}
function playableFaces(S, p, id) {
  const G = S.game, card = C(S, id);
  if (!G || G.phase === 'over') return [];
  if (G.phase === 'drawn' && G.drawnCard !== id) return [];
  if (card.st.glue && G.hands[p].length === 1) return [];
  const out = [];
  facesOf(card).forEach((f, i) => { if (canFace(S, card, f)) out.push(i); });
  return out;
}
function playableIds(S, p) { return S.game.hands[p].filter(id => playableFaces(S, p, id).length); }
function mirrorCopy(G, f0) {
  const t = G.top;
  const r = Object.assign({}, t, { c: t.c === 'wild' ? 'wild' : f0.c, m: true });
  delete r.c2;
  return r;
}
/* What a player must decide before a card resolves. */
function playNeeds(S, p, id, fi) {
  const G = S.game, card = C(S, id), f0 = facesOf(card)[fi];
  const f = f0.k === 'mirror' ? mirrorCopy(G, f0) : f0;
  const a = actOf(f), going = G.hands[p].length === 1, rivals = others(S, p);
  const need = {};
  if (f.c === 'wild') need.color = true;
  if (a === 'pick2') need.target = rivals;
  if (!going) {
    if (a === 'thief') { const t = rivals.filter(q => G.hands[q].length > 0); if (t.length) need.target = t; }
    if (a === 'swap' || (a === 'num' && f.n === SWAP_NUM && S.camp.rules.sevenZero)) need.target = rivals;
    if (a === 'gift') { need.gift = true; need.target = rivals; }
  }
  return need;
}
const others = (S, p) => [...Array(S.camp.n).keys()].filter(q => q !== p);

function startTurn(S, q) {
  const G = S.game;
  G.turn = q; G.phase = 'turn'; G.called[q] = false; G.turnDraw = 0; G.drawnCard = null; G.lastPlayLeftOne = false; G.facing = false;
  if (G.soft) { const k = G.soft; G.soft = 0; const got = drawCards(S, q, k); feed(S, nm(S, q) + ' drew ' + got + ' from a Plus One.'); }
  if (G.pending) {
    G.facing = true;
    if (S.camp.rules.stack && playableIds(S, q).length) { G.phase = 'facing'; return; }
    takePile(S, q);
  }
}
function takePile(S, q) {
  const G = S.game, amt = G.pending;
  G.pending = 0; G.facing = false;
  const got = drawCards(S, q, amt);
  feed(S, nm(S, q) + ' drew ' + got + ' and lost their turn.');
  if (amt >= 4 && G.ev.drew4 == null) G.ev.drew4 = { p: q, id: G.topId };
  if (G.turnDraw >= 8 && G.ev.aval == null) G.ev.aval = q;
  const r = nextP(G, q, 1); G.skip = 0;
  startTurn(S, r);
}
function endTurn(S, p) {
  const G = S.game;
  if (G.hands[p].length === 1 && !G.called[p] && G.lastPlayLeftOne) { settleCall(S); G.owe = p; }
  if (G.turnDraw >= 8 && G.ev.aval == null) G.ev.aval = p;
  G.idle = G.lastPlays === G.plays ? (G.idle || 0) + 1 : 0; G.lastPlays = G.plays;
  if (G.idle >= G.hands.length * 3 && !G.hands.some((h, q) => canDraw(S, q))) { stallEnd(S); return; }
  const q = nextP(G, p, 1 + G.skip); G.skip = 0;
  startTurn(S, q);
}
/* Nobody can play and there is nothing left to draw: the hand ends on points. */
function stallEnd(S) {
  const G = S.game;
  const pts = G.hands.map(h => h.reduce((s, i) => s + cardPts(C(S, i)), 0));
  const w = [...Array(G.hands.length).keys()].sort((a, b) => pts[a] - pts[b] || G.hands[a].length - G.hands[b].length)[0];
  feed(S, 'Nobody can play and nobody has cards left to draw. The hand ends on points.');
  finishHand(S, w, null, null);
}

/* Someone who went down to one card without calling can still call until the next player starts their turn
   (in a pass-the-phone game, until that player opens their hand). After that it costs 2 cards. */
function owesCall(S) {
  const G = S.game;
  return G && G.owe != null && !G.called[G.owe] && G.hands[G.owe].length === 1 ? G.owe : -1;
}
function settleCall(S) {
  const G = S.game, q = owesCall(S);
  if (!G) return;
  G.owe = null;
  if (q < 0) return;
  drawCards(S, q, 2);
  feed(S, nm(S, q) + ' forgot to call Last Card and drew 2.');
  G.forgot = (G.forgot || 0) + 1;
}

/* Every player action goes through here, so Legacy cards triggered by what just happened turn over right away. */
function act(S, a) {
  const ok = actInner(S, a);
  if (ok) checkMid(S);
  return ok;
}
/* Legacy cards and boxes triggered mid-hand: the hand pauses, the card is turned over and carried out, then play resumes. */
function checkMid(S) {
  const camp = S.camp, G = S.game;
  if (!G || G.phase === 'over' || camp.phase !== 'play') return;
  const want = id => camp.turned.indexOf(id) < 0 && !camp.queued[id];
  const steps = [];
  const card = (id, ctx) => { camp.queued[id] = 1; steps.push({ t: 'card', id, ctx, mid: true }); };
  if (want('L2') && G.ev.drew4) card('L2', { p: G.ev.drew4.p, card: G.ev.drew4.id });
  if (want('L3') && G.ev.held12 != null) card('L3', { p: G.ev.held12 });
  if (want('L13') && G.ev.ranOut != null) card('L13', { p: G.ev.ranOut });
  if (camp.opened.indexOf('XII') < 0 && !camp.queued.BXII && G.ev.aval != null) { camp.queued.BXII = 1; steps.push({ t: 'box', id: 'XII', ctx: { p: G.ev.aval }, mid: true }); }
  if (!steps.length) return;
  camp.queue = steps.concat(camp.queue);
  camp.phase = 'between';
  advance(S);
}
/* After anything that adds, tears or moves cards mid-hand, put every card back where it belongs:
   torn cards leave the table, new cards go into their owner's draw pile, and a draw pile only holds its owner's cards. */
function syncGame(S) {
  const G = S.game, camp = S.camp;
  if (!G || G.phase === 'over' || !G.decks) return;
  const torn = id => camp.cards[id].torn;
  G.hands = G.hands.map(h => h.filter(id => !torn(id)));
  G.decks = G.decks.map(d => d.filter(id => !torn(id)));
  G.disc = G.disc.filter(id => !torn(id));
  const tuck = (q, id) => { const d = G.decks[q]; d.splice(rnd(d.length + 1), 0, id); };
  G.decks.forEach((d, q) => d.slice().forEach(id => { const o = camp.cards[id].own; if (o !== q) { d.splice(d.indexOf(id), 1); tuck(o, id); } }));
  const where = new Set([].concat(...G.hands, ...G.decks, G.disc));
  deckIds(camp).forEach(id => { if (!where.has(id)) tuck(camp.cards[id].own, id); });
}
function actInner(S, a) {
  const G = S.game;
  if (!G || G.phase === 'over' || S.camp.phase !== 'play') return false;
  if (a.t === 'call' && owesCall(S) === a.p) { G.called[a.p] = true; G.owe = null; feed(S, nm(S, a.p) + ' called Last Card just in time.'); return true; }
  if (a.p !== G.turn) return false;
  const p = a.p;
  if (a.t !== 'call') settleCall(S);
  switch (a.t) {
    case 'call': G.called[p] = true; return true;
    case 'play': return doPlay(S, p, a.id, a.fi || 0, a.ch || {});
    case 'draw': {
      if (G.phase !== 'turn') return false;
      G.first[p] = false;
      const got = drawCards(S, p, 1);
      if (!got) { feed(S, nm(S, p) + ' has no cards left to draw.'); endTurn(S, p); return true; }
      const id = G.hands[p][G.hands[p].length - 1];
      feed(S, nm(S, p) + ' drew a card.');
      /* A person always gets to see what they drew; a computer that can't play it moves on. */
      if (playableFaces(S, p, id).length || !isBot(S, p)) { G.phase = 'drawn'; G.drawnCard = id; }
      else endTurn(S, p);
      return true;
    }
    case 'pass': {
      if (G.phase !== 'drawn' && G.phase !== 'combo') return false;
      endTurn(S, p); return true;
    }
    case 'take': {
      if (G.phase !== 'facing') return false;
      takePile(S, p); return true;
    }
    case 'redo': {
      if (G.phase !== 'turn' || !G.first[p] || !G.redo[p]) return false;
      const h = G.hands[p], k = h.length;
      G.decks[p] = shuffle(G.decks[p].concat(h)); G.hands[p] = [];
      for (let i = 0; i < k; i++) G.hands[p].push(G.decks[p].pop());
      G.redo[p] = false;
      feed(S, nm(S, p) + ' used a Second Chance and took a new hand.');
      return true;
    }
  }
  return false;
}

function doPlay(S, p, id, fi, ch) {
  const G = S.game, camp = S.camp, card = C(S, id), hand = G.hands[p];
  const ix = hand.indexOf(id);
  if (ix < 0) return false;
  if (['turn', 'drawn', 'combo', 'facing'].indexOf(G.phase) < 0) return false;
  if (playableFaces(S, p, id).indexOf(fi) < 0) return false;
  const need = playNeeds(S, p, id, fi);
  const f0 = facesOf(card)[fi];
  const f = f0.k === 'mirror' ? mirrorCopy(G, f0) : Object.assign({}, f0);
  if (f0.k !== 'mirror') delete f.m;
  if (need.target && need.target.indexOf(ch.target) < 0) ch.target = need.target[0];
  hand.splice(ix, 1); G.disc.push(id);
  G.facing = false; G.drawnCard = null; G.first[p] = false; G.plays++;
  G.lastPlayLeftOne = hand.length === 1;
  const going = hand.length === 0;
  G.top = f; G.topId = id; G.topFace = fi;
  G.color = f.c === 'wild' ? (COLORS.indexOf(ch.color) >= 0 ? ch.color : COLORS[0]) : f.c;
  G.color2 = f.c2 || null;
  const n = camp.n, mult = camp.rules.final ? 2 : 1;
  let line = nm(S, p) + ' played ' + (card.k === 'frank' ? faceName(f0) + ' (Frankencard)' : cardName(card));
  if (f0.k === 'mirror') line += ', copying ' + faceName(Object.assign({}, f, { c: f.c === 'wild' ? 'wild' : f0.c, m: false, nm: f.nm }));
  if (f.c === 'wild') line += ' and chose ' + colorName(G.color);
  feed(S, line + '.');
  const a = actOf(f);
  const runAction = (k) => {
    switch (k) {
      case 'num':
        if (camp.rules.sevenZero && !going) {
          if (f.n === SWAP_NUM) swapHands(S, p, ch.target);
          else if (f.n === PASS_NUM) rotateHands(S);
        }
        break;
      case 'skip': G.skip += 1; break;
      case 'rev': G.dir *= -1; if (n === 2) G.skip += 1; break;
      case 'd2': G.pending += 2; break;
      case 'w4': G.pending += 4; break;
      case 'boom': G.dir *= -1; if (!G.pending && n === 2) G.skip += 1; break;
      case 'encore': G.again = true; break;
      case 'thief':
        if (!going && ch.target != null && G.hands[ch.target].length) {
          const h = G.hands[ch.target], j = rnd(h.length); hand.push(h.splice(j, 1)[0]);
          feed(S, nm(S, p) + ' stole a card from ' + nm(S, ch.target) + '.'); noteHands(S);
        }
        break;
      case 'gift':
        if (!going && ch.target != null) {
          let g = ch.gift; if (hand.indexOf(g) < 0) g = hand[0];
          if (g) { hand.splice(hand.indexOf(g), 1); G.hands[ch.target].push(g); feed(S, nm(S, p) + ' gave a card to ' + nm(S, ch.target) + '.'); noteHands(S); }
        }
        break;
      case 'swap': if (!going) swapHands(S, p, ch.target); break;
      case 'all1': others(S, p).forEach(q => drawCards(S, q, 1)); feed(S, 'Everyone else drew 1.'); break;
      case 'pick2': if (ch.target != null) { drawCards(S, ch.target, 2); feed(S, nm(S, ch.target) + ' drew 2.'); } break;
    }
  };
  runAction(a);
  const st = card.st;
  if (st.plus) { if (drawAmt(f)) G.pending += 1; else G.soft += 1; }
  if (st.bomb) { others(S, p).forEach(q => drawCards(S, q, 1)); feed(S, 'Bomb! Everyone else drew 1.'); }
  if (st.grudge != null && st.grudge !== p) { drawCards(S, st.grudge, 1); feed(S, 'A Grudge made ' + nm(S, st.grudge) + ' draw 1.'); }
  if (st.crown) { const got = addStars(S, p, mult); G.crowns[p] += got; feed(S, nm(S, p) + ' earned ' + got + ' Star' + (got === 1 ? '' : 's') + ' from a Crown.'); clog(S, nm(S, p) + ' played a Crown card and earned ' + got + ' Star' + (got === 1 ? '' : 's') + '.'); }
  if (st.mud) { drawCards(S, p, 1); feed(S, nm(S, p) + ' got Mud on their hands and drew 1.'); }
  if (hand.length === 0) { finishHand(S, p, id, f); return true; }
  if (G.again) {
    G.again = false;
    if (G.pending || G.soft) { const q = nextP(G, p, 1), amt = G.pending + G.soft; G.pending = 0; G.soft = 0; drawCards(S, q, amt); feed(S, nm(S, q) + ' drew ' + amt + '.'); if (amt >= 4 && G.ev.drew4 == null) G.ev.drew4 = { p: q, id }; }
    G.skip = 0; G.phase = 'turn'; G.called[p] = G.called[p] && hand.length <= 2;
    feed(S, nm(S, p) + ' goes again.');
    return true;
  }
  if (st.sig === p) { G.phase = 'combo'; return true; }
  endTurn(S, p);
  return true;
}
function swapHands(S, p, q) {
  const G = S.game; if (q == null || q === p) return;
  const t = G.hands[p]; G.hands[p] = G.hands[q]; G.hands[q] = t;
  feed(S, nm(S, p) + ' traded hands with ' + nm(S, q) + '.'); noteHands(S);
}
function rotateHands(S) {
  const G = S.game, n = G.hands.length, old = G.hands.slice();
  for (let i = 0; i < n; i++) G.hands[nextP(G, i, 1)] = old[i];
  feed(S, 'Everyone passed their hand to the next player.'); noteHands(S);
}

function finishHand(S, p, id, f) {
  const G = S.game, camp = S.camp, n = camp.n, mult = camp.rules.final ? 2 : 1;
  G.phase = 'over'; G.winner = p; G.lastCard = id;
  const stalled = id == null;
  if (G.pending || G.soft) {
    const q = nextP(G, p, 1 + G.skip), amt = G.pending + G.soft; G.pending = 0; G.soft = 0;
    const got = drawCards(S, q, amt); feed(S, nm(S, q) + ' drew ' + got + ' as the hand ended.');
    if (amt >= 4 && G.ev.drew4 == null) G.ev.drew4 = { p: q, id };
  }
  const pts = G.hands.map(h => h.reduce((s, i) => s + cardPts(C(S, i)), 0));
  const rest = others(S, p).sort((a, b) => pts[a] - pts[b] || G.hands[a].length - G.hands[b].length || a - b);
  const order = [p].concat(rest);
  const table = n === 4 ? [3, 2, 1, 0] : n === 3 ? [3, 1, 0] : [3, 0];
  const gain = Array(n).fill(0);
  order.forEach((q, i) => { gain[q] = table[i] * mult; });
  let auto = 0;
  if (!stalled && camp.rules.autograph && C(S, id).st.sig === p) { auto = 2 * mult; gain[p] += auto; }
  gain.forEach((g, q) => { camp.stars[q] += g; });
  camp.wins[p]++;
  const rec = { h: camp.hand, order, pts, gain, crowns: G.crowns.slice(), auto, last: id, face: f, mult };
  camp.history.push(rec);
  const streak2 = camp.lastWinner === p; camp.lastWinner = p;
  const loser = order[n - 1]; const last2 = camp.lastLoser === loser; camp.lastLoser = loser;
  camp.lastRanks = order;
  clog(S, stalled ? nm(S, p) + ' won Hand ' + camp.hand + ' on points when the cards ran out.' : nm(S, p) + ' won Hand ' + camp.hand + ', going out with ' + cardName(C(S, id)) + '.', 'win');
  /* Torn Hands: everyone but the winner tears up their highest-point leftover cards. A deck never drops below MIN_DECK. */
  rec.torn = {};
  if (camp.rules.handTear) {
    rest.forEach(q => {
      const byPts = G.hands[q].slice().sort((a, b) => cardPts(C(S, b)) - cardPts(C(S, a)) || (a < b ? -1 : 1));
      const torn = [];
      for (const cid of byPts) {
        if (torn.length >= CONTENT.handTear) break;
        if (deckSize(camp, C(S, cid).own) <= MIN_DECK) continue;
        tearCard(S, cid, q, true); torn.push(cid);
      }
      if (torn.length) { rec.torn[q] = torn; clog(S, 'Torn Hands: ' + nm(S, q) + ' tore up ' + torn.map(x => cardName(C(S, x))).join(', ') + '.', 'tear'); }
    });
  }
  const q = [{ t: 'results', rec }];
  endTriggers(S, { streak2, last2: last2 ? loser : -1, noDraw: !stalled && G.drawn[p] === 0 ? p : -1, wildOut: !stalled && isWildF(f) ? p : -1 }, q);
  if (camp.hand >= CONTENT.hands) q.push({ t: 'final' });
  else { q.push({ t: 'council' }); q.push({ t: 'next' }); }
  camp.queue = q; camp.phase = 'between';
}

/* ---------- triggers ---------- */
function endTriggers(S, ev, q) {
  const camp = S.camp, G = S.game, h = camp.hand;
  const want = id => camp.turned.indexOf(id) < 0 && !camp.queued[id];
  const add = (id, ctx) => { camp.queued[id] = 1; q.push({ t: 'card', id, ctx: ctx || {} }); };
  if (want('L1')) add('L1', { p: G.winner, card: G.lastCard });
  if (want('L2') && (G.ev.drew4 || h >= 3)) add('L2', G.ev.drew4 ? { p: G.ev.drew4.p, card: G.ev.drew4.id } : {});
  if (want('L3') && (G.ev.held12 != null || h >= 4)) add('L3', G.ev.held12 != null ? { p: G.ev.held12 } : {});
  if (want('L5') && (ev.noDraw >= 0 || h >= 5)) add('L5', ev.noDraw >= 0 ? { p: ev.noDraw } : {});
  if (want('L13') && (G.ev.ranOut != null || h >= 6)) add('L13', G.ev.ranOut != null ? { p: G.ev.ranOut } : {});
  if (want('L6') && h >= 6) add('L6', {});
  if (want('L7') && h >= 7) add('L7', {});
  if (want('L9') && (ev.streak2 || h >= 8)) add('L9', ev.streak2 ? { p: G.winner } : {});
  const wantB = id => camp.opened.indexOf(id) < 0 && !camp.queued['B' + id];
  const addB = (id, ctx) => { camp.queued['B' + id] = 1; q.push({ t: 'box', id, ctx }); };
  if (wantB('I') && ev.last2 >= 0) addB('I', { p: ev.last2 });
  if (wantB('IX') && ev.wildOut >= 0) addB('IX', { p: ev.wildOut });
  if (wantB('XII') && G.ev.aval != null) addB('XII', { p: G.ev.aval });
}
function stepNext(S) {
  const camp = S.camp;
  camp.hand++;
  const steps = [];
  const want = id => camp.turned.indexOf(id) < 0 && !camp.queued[id];
  const add = id => { camp.queued[id] = 1; steps.push({ t: 'card', id, ctx: {} }); };
  if (want('L7') && camp.tears >= 10) add('L7');
  if (want('L4') && camp.hand >= 5) add('L4');
  if (want('L8') && camp.hand >= 8) add('L8');
  if (want('L14') && camp.hand >= 9 && camp.turned.indexOf('L8') >= 0) add('L14');
  if (want('L10') && camp.hand >= 10) add('L10');
  if (want('L11') && camp.hand >= 11) add('L11');
  if (want('L12') && camp.hand >= 12) add('L12');
  steps.push({ t: 'deal' });
  camp.queue.splice(0, 1, ...steps);
}
function stepCouncil(S) {
  const camp = S.camp;
  if (!camp.rules.council) { camp.queue.shift(); return; }
  const o = camp.lastRanks, n = camp.n, ins = [];
  ins.push({ t: 'boons', p: o[n - 1], n: 2, why: 'council' });
  if (n >= 3) ins.push({ t: 'boons', p: o[n - 2], n: 1, why: 'council' });
  ins.push({ t: 'toll', p: o[0] });
  camp.queue.splice(0, 1, ...ins);
}
function stepDeal(S) {
  const camp = S.camp, n = camp.n;
  /* Every card goes back to its owner: each player shuffles their own deck and draws 7 from it. */
  const G = {
    hands: [...Array(n)].map(() => []), decks: [...Array(n).keys()].map(q => shuffle(ownDeck(camp, q))), disc: [], dir: 1,
    pending: 0, soft: 0, skip: 0, facing: false, again: false,
    called: Array(n).fill(false), drawn: Array(n).fill(0), first: Array(n).fill(true),
    redo: camp.perks.map(x => !!x.redo), crowns: Array(n).fill(0), ev: {}, feed: [], turnDraw: 0, plays: 0, forgot: 0,
    dealt: camp.perks.map(x => Math.max(3, Math.min(12, 7 + (x.deal || 0))))
  };
  S.game = G;
  camp.perks = camp.perks.map(() => ({ deal: 0, redo: false }));
  for (let q = 0; q < n; q++) for (let r = 0; r < G.dealt[q] && G.decks[q].length; r++) G.hands[q].push(G.decks[q].pop());
  /* The first player turns over number cards from the top of their deck until one starts the middle pile. */
  const first = camp.hand === 1 ? rnd(n) : lowestPlayer(camp);
  const fd = G.decks[first];
  let i = fd.length - 1;
  while (i >= 0 && C(S, fd[i]).k !== 'num') i--;
  if (i < 0) i = fd.length - 1;
  const sid = fd.splice(i, 1)[0];
  G.disc.push(sid); G.top = faceOf(C(S, sid)); G.topId = sid; G.topFace = 0;
  G.color = G.top.c === 'wild' ? pickOne(COLORS) : G.top.c;
  G.color2 = G.top.c2 || null;
  camp.queue.shift();
  camp.phase = 'play';
  feed(S, 'Hand ' + camp.hand + ' is dealt. ' + nm(S, first) + ' goes first.');
  noteHands(S);
  startTurn(S, first);
}
/* Runs every step that needs no one's input. */
function advance(S) {
  const camp = S.camp;
  syncGame(S);
  for (let guard = 0; guard < 50; guard++) {
    const st = camp.queue[0];
    /* A mid-hand Legacy card is done: back to the hand that was paused. */
    if (!st) { if (camp.phase === 'between' && S.game && S.game.phase !== 'over') { syncGame(S); camp.phase = 'play'; } return; }
    if (st.t === 'next') stepNext(S);
    else if (st.t === 'council') stepCouncil(S);
    else if (st.t === 'deal') { stepDeal(S); return; }
    else if (st.t === 'task' && taskAuto(S, st)) continue;
    else if (st.t === 'boons' && !boonList(S, st.p).length) camp.queue.shift();
    else return;
  }
}

/* ---------- legacy cards and boxes ---------- */
function applyCard(S, st) {
  const camp = S.camp, id = st.id, ctx = st.ctx || {}, ins = [], low = lowestPlayer(camp);
  camp.turned.push(id); delete camp.queued[id];
  const L = CONTENT.legacy.find(x => x.id === id);
  clog(S, 'Legacy card turned over: ' + L.title + '.', 'legacy');
  const box = (b, c) => { camp.queued['B' + b] = 1; ins.push({ t: 'box', id: b, ctx: c || {} }); };
  switch (id) {
    case 'L1':
      camp.rules.council = true; box('II');
      if (ctx.card && !C(S, ctx.card).torn) ins.push({ t: 'task', p: ctx.p, k: 'sign', card: ctx.card, why: 'L1' });
      break;
    case 'L2':
      camp.rules.tear = true; camp.rules.handTear = true;
      if (ctx.card && C(S, ctx.card) && !C(S, ctx.card).torn && tearable(camp, ctx.card)) ins.push({ t: 'task', p: ctx.p, k: 'tear', card: ctx.card, why: 'L2' });
      else ins.push({ t: 'task', p: low, k: 'tear', filter: 'w4', why: 'L2' });
      break;
    case 'L3': box('IV'); break;
    case 'L4': camp.rules.sevenZero = true; break;
    case 'L5': box('III', { p: ctx.p != null ? ctx.p : low }); break;
    case 'L6': box('X'); break;
    case 'L7': box('V'); break;
    case 'L8': box('VI'); break;
    case 'L9': box('XI'); break;
    case 'L10': box('VIII'); break;
    case 'L11': camp.rules.autograph = true; fewestFirst(camp).forEach(p => ins.push({ t: 'task', p, k: 'sign', why: 'L11' })); break;
    case 'L12': box('VII'); break;
    case 'L13': {
      /* Running on Empty: whoever ran out (or has the smallest deck) gets 2 dual-color cards, and a Crown once Crowns exist. */
      const q = ctx.p != null ? ctx.p : [...Array(camp.n).keys()].sort((a, b) => deckSize(camp, a) - deckSize(camp, b) || camp.stars[a] - camp.stars[b])[0];
      st.ctx = Object.assign({}, ctx, { who: q });
      ins.push({ t: 'task', p: q, k: 'supply', kind: 'dual', no: 1, of: 2, why: 'L13' }, { t: 'task', p: q, k: 'supply', kind: 'dual', no: 2, of: 2, why: 'L13' });
      if (camp.rules.crown) ins.push({ t: 'task', p: q, k: 'sticker', s: 'crown', why: 'L13' });
      break;
    }
    case 'L14': camp.rules.blanken = true; fewestFirst(camp).forEach(p => ins.push({ t: 'task', p, k: 'blanken', why: 'L14' })); break;
  }
  camp.queue.splice(0, 1, ...ins);
}
function sourcesWithHalves(camp) {
  const s = {}; camp.halves.forEach(h => { if (!h.used) s[h.from] = 1; }); return Object.keys(s).length;
}
function openBox(S, st) {
  const camp = S.camp, id = st.id, ctx = st.ctx || {}, ins = [];
  camp.opened.push(id); delete camp.queued['B' + id];
  const B = CONTENT.boxes.find(x => x.id === id);
  clog(S, 'Box ' + id + ' opened: ' + B.name + '.', 'box');
  switch (id) {
    case 'I': camp.rules.grudge = true; ins.push({ t: 'task', p: ctx.p, k: 'grudge', why: 'I' }, { t: 'task', p: ctx.p, k: 'grudge', why: 'I' }); break;
    case 'II': camp.rules.sign = true; break;
    case 'III': camp.rules.crown = true; ins.push({ t: 'task', p: ctx.p, k: 'sticker', s: 'crown', why: 'III' }, { t: 'task', p: ctx.p, k: 'sticker', s: 'crown', why: 'III' }); break;
    case 'IV': {
      /* Hand the Boomerangs out one at a time, fewest Stars first. */
      camp.rules.stack = true;
      const order = fewestFirst(camp);
      CONTENT.newCards.IV.forEach((c, i) => {
        const q = order[i % camp.n];
        addCard(camp, Object.assign({ born: camp.hand + 1, own: q }, c));
      });
      st.ctx = Object.assign({}, ctx, { order });
      clog(S, 'The Boomerangs were handed out: ' + CONTENT.newCards.IV.map((c, i) => nm(S, order[i % camp.n])).join(', ') + '.', 'box');
      break;
    }
    case 'V': {
      camp.rules.tape = true;
      const low = lowestPlayer(camp);
      /* A fresh tear always leaves one plain half, so one more tear fixes halves whose stickers clash. */
      for (let k = Math.min(sourcesWithHalves(camp), canTape(camp) ? 2 : 1); k < 2; k++) ins.push({ t: 'task', p: low, k: 'tear', why: 'V' });
      ins.push({ t: 'task', p: low, k: 'tape', why: 'V' });
      break;
    }
    case 'VI': camp.rules.design = true; camp.blanks = CONTENT.blanks; fewestFirst(camp).forEach(p => ins.push({ t: 'task', p, k: 'design', why: 'VI' })); break;
    case 'VII': camp.rules.final = true; fewestFirst(camp).forEach(p => ins.push({ t: 'task', p, k: 'anySticker', why: 'VII' })); break;
    case 'VIII': camp.rules.bomb = true; fewestFirst(camp).forEach(p => ins.push({ t: 'task', p, k: 'sticker', s: 'bomb', why: 'VIII' })); break;
    case 'IX': camp.rules.rainbow = true; ins.push({ t: 'task', p: ctx.p, k: 'sticker', s: 'rainbow', why: 'IX' }); break;
    case 'X': {
      const r = rankByStars(camp), n = camp.n, first = r[0], last = r[n - 1];
      st.ctx = Object.assign({}, ctx, { r, before: camp.stars.slice() });
      addStars(S, first, -2);
      if (deckIds(camp).some(i => camp.cards[i].st.sig === first && tearable(camp, i))) ins.push({ t: 'task', p: first, k: 'tear', filter: 'own', why: 'X' });
      else addStars(S, first, -1);
      if (n >= 3) { const sw = r[n - 2]; addStars(S, sw, 1); ins.push({ t: 'task', p: sw, k: 'sign', why: 'X' }); }
      addStars(S, last, 2);
      ins.push({ t: 'boons', p: last, n: 2, why: 'X' });
      if (camp.rules.crown) ins.push({ t: 'task', p: last, k: 'sticker', s: 'crown', why: 'X' });
      clog(S, 'The Turnabout: ' + nm(S, first) + ' lost Stars and ' + nm(S, last) + ' gained 2.', 'box');
      break;
    }
    case 'XI': {
      /* A draft: fewest Stars picks first, and picks go around until all 8 cards are taken. */
      const pool = CONTENT.newCards.XI.map(c => addCard(camp, Object.assign({ born: camp.hand + 1, own: null }, c)));
      const order = fewestFirst(camp);
      pool.forEach((x, i) => ins.push({ t: 'task', p: order[i % camp.n], k: 'draft', pool, no: i + 1, of: pool.length, why: 'XI' }));
      break;
    }
    case 'XII':
      ins.push({ t: 'boons', p: ctx.p, n: 2, why: 'XII' });
      if (camp.rules.crown) ins.push({ t: 'task', p: ctx.p, k: 'sticker', s: 'crown', why: 'XII' });
      break;
  }
  camp.queue.splice(0, 1, ...ins);
}

/* ---------- the Supply ---------- */
/* Spare cards in the box that the Add Boons take from.
   Keys: 'skip-red', 'rev-blue' (kind 'action'), 'd2-green' (kind 'd2'), 'dual-red-blue-3' (kind 'dual'). There are no spare Wilds. */
const supplyKind = key => key.indexOf('dual-') === 0 ? 'dual' : key.indexOf('d2-') === 0 ? 'd2' : (key.indexOf('skip-') === 0 || key.indexOf('rev-') === 0) ? 'action' : 'other';
function supplyList(camp, kind) {
  const sup = camp.supply || {};
  return Object.keys(sup).filter(k => sup[k] > 0 && supplyKind(k) === kind);
}
function supplyCard(key) {
  const parts = key.split('-');
  if (parts[0] === 'dual') return { k: 'num', c: parts[1], c2: parts[2], n: +parts[3] };
  if (key === 'wild' || key === 'w4') return { c: 'wild', k: key };
  return { c: parts[1], k: parts[0] };
}

/* ---------- boons and tolls ---------- */
function boonList(S, p) {
  const camp = S.camp, R = camp.rules, ids = deckIds(camp), c = i => camp.cards[i];
  const mine = ids.filter(i => c(i).own === p), theirs = ids.filter(i => c(i).own !== p);
  return CONTENT.boons.filter(b => {
    switch (b.id) {
      case 'adddual': return supplyList(camp, 'dual').length > 0;
      case 'adddraw': return supplyList(camp, 'd2').length > 0;
      case 'addaction': return supplyList(camp, 'action').length > 0;
      case 'blanken': return !!R.blanken && camp.blanks > 0 && camp.halves.some(h => !h.used);
      case 'sign': return R.sign && mine.some(i => canSticker(c(i), 'sig'));
      case 'plus': return mine.some(i => canSticker(c(i), 'plus'));
      case 'smudge': return theirs.some(i => canSticker(c(i), 'mud') || canSticker(c(i), 'glue'));
      case 'mend': return mine.some(i => removable(c(i)).length);
      case 'tear': return !!R.tear && ids.some(i => deckSize(camp, c(i).own) > MIN_DECK);
      case 'grudge': return !!R.grudge && mine.some(i => canSticker(c(i), 'grudge'));
      case 'rainbow': return !!R.rainbow && mine.some(i => canSticker(c(i), 'rainbow'));
      case 'tape': return !!R.tape && canTape(camp);
      case 'design': return !!R.design && camp.blanks > 0;
      case 'bomb': return !!R.bomb && mine.some(i => canSticker(c(i), 'bomb'));
    }
    return false;
  });
}
/* Every Toll changes a deck. Pay a Star is offered only when none of them is possible. */
function tollList(S, p) {
  const camp = S.camp, R = camp.rules, ids = deckIds(camp), c = i => camp.cards[i];
  const signed = ids.filter(i => c(i).st.sig === p);
  const last = camp.lastRanks[camp.n - 1], rival = last != null && last !== p;
  const list = CONTENT.tolls.filter(t => {
    switch (t.id) {
      case 'handover': return rival && deckSize(camp, p) > MIN_DECK;
      case 'muddeck': return ids.some(i => c(i).own === p && canSticker(c(i), 'mud'));
      case 'muddy': return signed.some(i => canSticker(c(i), 'mud'));
      case 'glued': return signed.some(i => canSticker(c(i), 'glue'));
      case 'rip': return !!R.tear && signed.some(i => tearable(camp, i));
      case 'marked': return !!R.grudge && rival && ids.some(i => c(i).own === last && canSticker(c(i), 'grudge'));
    }
    return false;
  });
  return list.length ? list : CONTENT.tolls.filter(t => t.id === 'star');
}
function chooseBoon(S, bid) {
  const camp = S.camp, st = camp.queue[0];
  if (!st || st.t !== 'boons') return false;
  const p = st.p, ins = [];
  if (!boonList(S, p).some(b => b.id === bid)) return false;
  const B = CONTENT.boons.find(b => b.id === bid);
  switch (bid) {
    case 'adddual': ins.push({ t: 'task', p, k: 'supply', kind: 'dual', no: 1, of: 2, why: 'boon' }, { t: 'task', p, k: 'supply', kind: 'dual', no: 2, of: 2, why: 'boon' }); break;
    case 'adddraw': ins.push({ t: 'task', p, k: 'supply', kind: 'd2', why: 'boon' }); break;
    case 'addaction': ins.push({ t: 'task', p, k: 'supply', kind: 'action', why: 'boon' }); break;
    case 'blanken': ins.push({ t: 'task', p, k: 'blanken', why: 'boon' }); break;
    case 'sign': ins.push({ t: 'task', p, k: 'sign', why: 'boon' }); break;
    case 'plus': ins.push({ t: 'task', p, k: 'sticker', s: 'plus', why: 'boon' }); break;
    case 'smudge': ins.push({ t: 'task', p, k: 'smudge', why: 'boon' }); break;
    case 'mend': ins.push({ t: 'task', p, k: 'mend', why: 'boon' }); break;
    case 'tear': ins.push({ t: 'task', p, k: 'tear', why: 'boon' }); break;
    case 'grudge': ins.push({ t: 'task', p, k: 'grudge', why: 'boon' }); break;
    case 'rainbow': ins.push({ t: 'task', p, k: 'sticker', s: 'rainbow', why: 'boon' }); break;
    case 'tape': ins.push({ t: 'task', p, k: 'tape', why: 'boon' }); break;
    case 'design': ins.push({ t: 'task', p, k: 'design', why: 'boon' }); break;
    case 'bomb': ins.push({ t: 'task', p, k: 'sticker', s: 'bomb', why: 'boon' }); break;
  }
  /* Label the follow-up so the screen can say "Boon 1 of 2: Sign a Card". */
  if (st.total == null) st.total = st.n + (st.picked || []).length;
  const no = (st.picked || []).length + 1;
  ins.forEach(t => { t.bn = no; t.bt = st.total; t.bname = B.name; t.bwhy = st.why; });
  st.n -= 1; st.picked = (st.picked || []).concat(B.name);
  clog(S, nm(S, p) + ' chose a Boon: ' + B.name + '.', 'council');
  if (st.n <= 0) camp.queue.splice(0, 1, ...ins);
  else camp.queue.splice(0, 0, ...ins);
  advance(S);
  return true;
}
function chooseToll(S, tid) {
  const camp = S.camp, st = camp.queue[0];
  if (!st || st.t !== 'toll') return false;
  const p = st.p, ins = [];
  if (!tollList(S, p).some(t => t.id === tid)) return false;
  const last = camp.lastRanks[camp.n - 1];
  const T = CONTENT.tolls.find(t => t.id === tid);
  clog(S, nm(S, p) + ' won Hand ' + camp.hand + ' and paid a Toll: ' + T.name + '.', 'council');
  switch (tid) {
    case 'star': addStars(S, p, -1); break;
    case 'muddeck': ins.push({ t: 'task', p, k: 'sticker', s: 'mud', why: 'toll' }); break;
    case 'muddy': ins.push({ t: 'task', p, k: 'sticker', s: 'mud', filter: 'own', why: 'toll' }); break;
    case 'glued': ins.push({ t: 'task', p, k: 'sticker', s: 'glue', filter: 'own', why: 'toll' }); break;
    case 'handover': ins.push({ t: 'task', p: last, k: 'handover', victim: p, why: 'toll' }); break;
    case 'rip': ins.push({ t: 'task', p, k: 'tear', filter: 'own', why: 'toll' }); break;
    case 'marked': ins.push({ t: 'task', p: last, k: 'grudge', target: p, why: 'toll' }); break;
  }
  ins.forEach(t => { t.tname = T.name; t.payer = p; });
  camp.queue.splice(0, 1, ...ins);
  advance(S);
  return true;
}

/* ---------- tasks ---------- */
function anyStickerKinds(S) {
  const R = S.camp.rules, out = ['plus', 'mud', 'glue'];
  if (R.crown) out.push('crown');
  if (R.rainbow) out.push('rainbow');
  if (R.bomb) out.push('bomb');
  if (R.grudge) out.push('grudge');
  return out;
}
/* The cards a task may touch, and so which decks it reaches. `s` is the sticker chosen for smudge, mend or anySticker.
   Good stickers go in your own deck, Mud and Glue from a Smudge go in a rival's, and tearing reaches any deck. */
function taskCards(S, st, s) {
  const camp = S.camp, p = st.p, c = i => camp.cards[i];
  /* In the middle of a hand, cards someone is holding are off limits: only draw piles and the middle pile can be touched. */
  const G = S.game, inHand = G && G.phase !== 'over' && G.decks ? new Set([].concat(...G.hands)) : null;
  const ids = deckIds(camp).filter(i => !inHand || !inHand.has(i));
  const mine = i => c(i).own === p;
  switch (st.k) {
    case 'sign': return ids.filter(i => mine(i) && canSticker(c(i), 'sig'));
    case 'sticker': {
      if (st.filter === 'own') {
        const r = ids.filter(i => c(i).st.sig === p && canSticker(c(i), st.s));
        return r.length ? r : ids.filter(i => mine(i) && canSticker(c(i), st.s));
      }
      return ids.filter(i => mine(i) && canSticker(c(i), st.s));
    }
    case 'smudge': return ids.filter(i => !mine(i) && canSticker(c(i), s || 'mud'));
    case 'mend': return ids.filter(i => mine(i) && (s ? c(i).st[s] != null : removable(c(i)).length));
    case 'tear': {
      /* No tear ever takes a deck below MIN_DECK. */
      const ok = ids.filter(i => tearable(camp, i));
      if (st.card) return tearable(camp, st.card) && !c(st.card).torn ? [st.card] : [];
      if (st.filter === 'w4') { const r = ok.filter(i => c(i).k === 'w4'); return r.length ? r : ok; }
      if (st.filter === 'own') { const r = ok.filter(i => c(i).st.sig === p); return r.length ? r : ok.filter(mine); }
      return ok;
    }
    case 'grudge': return ids.filter(i => mine(i) && canSticker(c(i), 'grudge'));
    case 'anySticker': return ids.filter(i => canSticker(c(i), s || 'plus'));
    case 'handover': return ids.filter(i => c(i).own === st.victim);
    case 'draft': return st.pool.filter(i => c(i).own == null && !c(i).torn);
  }
  return [];
}
function taskAuto(S, st) {
  const camp = S.camp;
  if (st.k === 'tape' && !canTape(camp)) { camp.queue.shift(); return true; }
  if (st.k === 'design' && camp.blanks <= 0) { camp.queue.shift(); return true; }
  if (st.k === 'supply' && !supplyList(camp, st.kind).length) { camp.queue.shift(); return true; }
  if (st.k === 'blanken' && (camp.blanks <= 0 || !camp.halves.some(h => !h.used))) { camp.queue.shift(); return true; }
  if (['tape', 'design', 'anySticker', 'smudge', 'supply', 'blanken'].indexOf(st.k) < 0 && !taskCards(S, st).length) { camp.queue.shift(); return true; }
  return false;
}
/* sel: { card, s, target, halves: [idA, idB], design: { c, eff, n, nm } } */
function doTask(S, sel) {
  const camp = S.camp, st = camp.queue[0];
  if (!st || st.t !== 'task') return false;
  sel = sel || {};
  const p = st.p, card = sel.card ? camp.cards[sel.card] : null;
  const okCard = (s) => card && taskCards(S, st, s).indexOf(card.id) >= 0;
  switch (st.k) {
    case 'sign': {
      const id = st.card && !camp.cards[st.card].torn ? st.card : (okCard() ? card.id : null);
      if (!id) return false;
      const k = camp.cards[id], from = k.own;
      k.st.sig = p;
      /* A card you sign from someone else's deck (the one you went out with) moves into yours. */
      if (from !== p) { k.own = p; clog(S, nm(S, p) + ' signed ' + cardName(k) + ' and took it from ' + nm(S, from) + '’s deck into their own.', 'sticker'); }
      else clog(S, nm(S, p) + ' signed ' + cardName(k) + '.', 'sticker');
      break;
    }
    case 'handover': {
      if (!okCard()) return false;
      card.own = p;
      clog(S, nm(S, p) + ' took ' + cardName(card) + ' from ' + nm(S, st.victim) + '’s deck into their own.', 'deck');
      break;
    }
    case 'draft': {
      if (!okCard()) return false;
      card.own = p;
      clog(S, nm(S, p) + ' drafted ' + cardName(card) + '.', 'deck');
      break;
    }
    case 'supply': {
      if (supplyList(camp, st.kind).indexOf(sel.key) < 0) return false;
      camp.supply[sel.key] -= 1;
      const id = addCard(camp, Object.assign(supplyCard(sel.key), { own: p, born: camp.hand + 1 }));
      clog(S, nm(S, p) + ' added ' + cardName(camp.cards[id]) + ' to their deck.', 'deck');
      break;
    }
    case 'sticker': if (!okCard()) return false; card.st[st.s] = 1; clog(S, nm(S, p) + ' put ' + stickerArticle(st.s) + ' on ' + cardName(card) + '.', 'sticker'); break;
    case 'smudge': if (['mud', 'glue'].indexOf(sel.s) < 0 || !okCard(sel.s)) return false; card.st[sel.s] = 1; clog(S, nm(S, p) + ' smudged ' + cardName(card) + ' with ' + CONTENT.stickers[sel.s].name + '.', 'sticker'); break;
    case 'mend': if (!card || REMOVABLE.indexOf(sel.s) < 0 || card.st[sel.s] == null) return false; delete card.st[sel.s]; clog(S, nm(S, p) + ' peeled ' + stickerArticle(sel.s) + ' off ' + cardName(card) + '.', 'sticker'); break;
    case 'tear': {
      const id = st.card && !camp.cards[st.card].torn ? st.card : (okCard() ? card.id : null);
      if (!id) return false;
      tearCard(S, id, p); break;
    }
    case 'grudge': {
      const target = st.target != null ? st.target : sel.target;
      if (target == null || target === p || !okCard()) return false;
      card.st.grudge = target; clog(S, nm(S, p) + ' put a Grudge naming ' + nm(S, target) + ' on ' + cardName(card) + '.', 'sticker'); break;
    }
    case 'anySticker': {
      if (anyStickerKinds(S).indexOf(sel.s) < 0 || !okCard(sel.s)) return false;
      if (sel.s === 'grudge') { if (sel.target == null || sel.target === p) return false; card.st.grudge = sel.target; }
      else card.st[sel.s] = 1;
      clog(S, nm(S, p) + ' put ' + stickerArticle(sel.s) + ' on ' + cardName(card) + '.', 'sticker'); break;
    }
    case 'tape': {
      const hs = (sel.halves || []).map(h => camp.halves.find(x => x.id === h && !x.used));
      if (hs.length !== 2 || !hs[0] || !hs[1] || hs[0].from === hs[1].from) return false;
      if (!tapeOK(hs[0], hs[1])) return false;
      /* The Frankencard keeps the stickers on both halves, and remembers which half each one is on. */
      const st = {}, sts = {};
      hs.forEach((h, i) => Object.keys(halfSt(h)).forEach(s => { st[s] = h.st[s]; sts[s] = i; }));
      const id = addCard(camp, { k: 'frank', c: hs[0].f.c, h: [hs[0].f, hs[1].f], hs: [hs[0].id, hs[1].id], st, sts, by: p, own: p, born: camp.hand + 1 });
      hs[0].used = hs[1].used = true;
      clog(S, nm(S, p) + ' taped a Frankencard: ' + cardName(camp.cards[id]) + '.' + (Object.keys(st).length ? ' It keeps the ' + stickerNames(st) + ' from its halves.' : ''), 'tape');
      break;
    }
    case 'blanken': {
      /* Half a blank card, designed here, taped to a torn half from the Scrap Envelope. */
      const d = sel.design, h = camp.halves.find(x => x.id === sel.half && !x.used);
      if (!d || !h || camp.blanks <= 0 || COLORS.indexOf(d.c) < 0) return false;
      let face;
      if (d.eff === 'num') face = { c: d.c, k: 'num', n: Math.max(0, Math.min(12, Math.round(+d.n || 0))) };
      else if (CONTENT.powers.indexOf(d.eff) >= 0) face = { c: d.c, k: d.eff };
      else return false;
      const label = String(d.nm || '').replace(/[<>]/g, '').trim().slice(0, 18);
      if (label) face.nm = label;
      h.used = true; camp.blanks -= 1;
      const st = Object.assign({}, halfSt(h)), sts = {};
      Object.keys(st).forEach(s => { sts[s] = 1; });
      const id = addCard(camp, { k: 'frank', blank: true, c: d.c, h: [face, h.f], hs: [null, h.id], st, sts, by: p, own: p, born: camp.hand + 1 });
      clog(S, nm(S, p) + ' made a Blankenstein: ' + cardName(camp.cards[id]) + '.' + (Object.keys(st).length ? ' It keeps the ' + stickerNames(st) + ' from the torn half.' : ''), 'tape');
      break;
    }
    case 'design': {
      /* Blank cards are always a color, never Wild. */
      const d = sel.design; if (!d || camp.blanks <= 0) return false;
      const c = COLORS.indexOf(d.c) >= 0 ? d.c : null; if (!c) return false;
      let eff = d.eff, n = null;
      if (eff === 'num') { n = Math.max(0, Math.min(12, Math.round(+d.n || 0))); }
      else if (CONTENT.powers.indexOf(eff) < 0) return false;
      const name = String(d.nm || '').replace(/[<>]/g, '').trim().slice(0, 18) || 'Mystery';
      const props = { k: 'custom', c, eff, nm: name, by: p, own: p, born: camp.hand + 1, st: { sig: p } };
      if (n != null) props.n = n;
      const id = addCard(camp, props);
      camp.blanks -= 1;
      clog(S, nm(S, p) + ' designed a new card: ' + cardName(camp.cards[id]) + '.', 'design');
      break;
    }
    default: return false;
  }
  camp.queue.shift();
  advance(S);
  return true;
}
function skipTask(S) {
  const camp = S.camp, st = camp.queue[0];
  if (!st || (st.t !== 'task' && st.t !== 'boons')) return false;
  camp.queue.shift(); advance(S); return true;
}
function stickerArticle(s) { const n = CONTENT.stickers[s].name; return (s === 'mud' || s === 'glue' ? '' : 'a ') + n; }
/* quiet: the caller writes its own story line (Torn Hands tears several cards at once). */
function tearCard(S, id, p, quiet) {
  const camp = S.camp, card = camp.cards[id];
  card.torn = camp.hand || 1; camp.tears++;
  const has = Object.keys(card.st).length > 0;
  if (card.k === 'frank') {
    /* Comes apart at the tape. A Blankenstein's designed half is just scrap; the torn half goes back in the envelope.
       Each half keeps the stickers on it. A sticker added after taping sits on the first half, or on a Blankenstein's torn half. */
    const hs = (card.hs || []).map(hid => hid ? camp.halves.find(x => x.id === hid) : null);
    hs.forEach(h => { if (h) { h.used = false; h.st = {}; } });
    Object.keys(card.st).forEach(s => {
      let side = card.sts && card.sts[s] != null ? card.sts[s] : (card.blank ? 1 : 0);
      if (!hs[side]) side = 1 - side;
      if (hs[side]) hs[side].st[s] = card.st[s];
    });
    if (!quiet) clog(S, nm(S, p) + ' tore up ' + cardName(card) + '. It came apart at the tape' + (has ? ', and its stickers stayed on its halves.' : '.'), 'tear');
  } else {
    /* A dual-color card tears into one half of each color. Every sticker stays on the first half. */
    const fs = isDual(card) ? [{ c: card.c, k: 'num', n: card.n }, { c: card.c2, k: 'num', n: card.n }] : facesOf(card), name = cardName(card);
    ['L', 'R'].forEach((side, i) => camp.halves.push({ id: 'h' + (++camp.nextId), from: id, side, f: fs[Math.min(i, fs.length - 1)], name, used: false, st: i ? {} : Object.assign({}, card.st) }));
    if (!quiet) clog(S, nm(S, p) + ' tore up ' + name + '.' + (has ? ' Its ' + stickerNames(card.st) + ' stayed on one half.' : ''), 'tear');
  }
}
function stepContinue(S) {
  const camp = S.camp, st = camp.queue[0];
  if (!st) return false;
  if (st.t === 'results') camp.queue.shift();
  else if (st.t === 'card') { applyCard(S, st); }
  else if (st.t === 'box') { openBox(S, st); }
  else if (st.t === 'final') { camp.queue.shift(); camp.phase = 'ended'; clog(S, 'The campaign is over. ' + rankByStars(camp).map(p => nm(S, p) + ' ' + camp.stars[p]).join(', ') + '.', 'win'); return true; }
  else return false;
  advance(S);
  return true;
}
/* Who has to act on the current step: a player index, or -1 for "anyone at the table". */
function stepActor(S) {
  const st = S.camp.queue[0];
  if (!st) return -1;
  if (st.t === 'task' || st.t === 'boons' || st.t === 'toll') return st.p;
  return -1;
}

/* ---------- computer players ---------- */
function handColors(S, ids) {
  const cnt = { red: 0, blue: 0, yellow: 0, green: 0 };
  ids.forEach(i => facesOf(C(S, i)).forEach(f => { if (cnt[f.c] != null) cnt[f.c]++; if (f.c2 && cnt[f.c2] != null) cnt[f.c2]++; }));
  return cnt;
}
function bestColor(S, ids) {
  const cnt = handColors(S, ids); let best = pickOne(COLORS), m = -1;
  COLORS.forEach(c => { if (cnt[c] > m) { m = cnt[c]; best = c; } });
  return best;
}
function botChoices(S, p, id, fi) {
  const G = S.game, need = playNeeds(S, p, id, fi), rest = G.hands[p].filter(x => x !== id), ch = {};
  if (need.color) ch.color = bestColor(S, rest);
  if (need.target) {
    const t = need.target.slice().sort((a, b) => G.hands[a].length - G.hands[b].length || S.camp.stars[b] - S.camp.stars[a]);
    ch.target = t[0];
  }
  if (need.gift) {
    const g = rest.filter(x => !facesOf(C(S, x)).some(isWildF)).sort((a, b) => cardPts(C(S, b)) - cardPts(C(S, a)));
    ch.gift = g[0] || rest[0];
  }
  return ch;
}
function scorePlay(S, p, id, fi) {
  const G = S.game, card = C(S, id), f0 = facesOf(card)[fi], hand = G.hands[p];
  const f = f0.k === 'mirror' ? mirrorCopy(G, f0) : f0;
  const a = actOf(f), nextHand = G.hands[nextP(G, p, 1)].length, cnt = handColors(S, hand);
  let s = Math.random() * 3;
  if (f.c === 'wild') s += hand.length <= 2 ? 6 : -28;
  else s += (cnt[f.c] || 0) * 2;
  if (drawAmt(f) || a === 'skip' || a === 'encore' || a === 'pick2') s += nextHand <= 3 ? 24 : -4;
  if (a === 'num') s += f.n * 0.6;
  if (a === 'swap' || (a === 'num' && f.n === SWAP_NUM && S.camp.rules.sevenZero)) {
    const mn = Math.min.apply(null, others(S, p).map(q => G.hands[q].length));
    s += mn < hand.length - 2 ? 22 : -22;
  }
  if (a === 'thief') s += 6;
  if (card.st.sig === p) s += 8;
  if (card.st.crown) s += 15;
  if (card.st.mud) s -= 6;
  if (card.st.bomb) s += 4;
  if (card.st.grudge != null) s += card.st.grudge === p ? -2 : 5;
  return s;
}
function botAction(S) {
  const G = S.game, p = G.turn, hand = G.hands[p];
  const best = () => {
    let top = null;
    hand.forEach(id => playableFaces(S, p, id).forEach(fi => {
      const sc = scorePlay(S, p, id, fi);
      if (!top || sc > top.s) top = { id, fi, s: sc };
    }));
    return top;
  };
  if (G.phase === 'turn' && G.first[p] && G.redo[p]) {
    const pts = hand.reduce((s, i) => s + cardPts(C(S, i)), 0);
    if (pts >= 110) return { t: 'redo', p };
  }
  if (G.phase === 'drawn') {
    const fi = playableFaces(S, p, G.drawnCard)[0];
    if (fi == null) return { t: 'pass', p };
    return { t: 'play', p, id: G.drawnCard, fi, ch: botChoices(S, p, G.drawnCard, fi), call: hand.length <= 2 };
  }
  const b = best();
  if (G.phase === 'facing') return b ? { t: 'play', p, id: b.id, fi: b.fi, ch: botChoices(S, p, b.id, b.fi) } : { t: 'take', p };
  if (G.phase === 'combo') return b ? { t: 'play', p, id: b.id, fi: b.fi, ch: botChoices(S, p, b.id, b.fi), call: hand.length <= 3 } : { t: 'pass', p };
  if (!b) return { t: 'draw', p };
  return { t: 'play', p, id: b.id, fi: b.fi, ch: botChoices(S, p, b.id, b.fi), call: hand.length <= 3 };
}
function runBotAction(S, a) {
  const G = S.game;
  if (a.call && !G.called[a.p] && Math.random() < 0.9) G.called[a.p] = true;
  return act(S, a);
}
const BOON_WEIGHT = { adddual: 3, adddraw: 3, addaction: 2, sign: 5, plus: 2, smudge: 3, mend: 1, tear: 2, grudge: 3, rainbow: 2, tape: 2, design: 5, blanken: 4, bomb: 2 };
/* Computers restock harder as their deck gets thin. */
const boonWeight = (S, p, id) => id === 'adddual' ? (deckSize(S.camp, p) < 24 ? 10 : deckSize(S.camp, p) < 30 ? 5 : BOON_WEIGHT.adddual) : (BOON_WEIGHT[id] || 1);
const goodCard = card => facesOf(card).some(f => f.c === 'wild' || f.k !== 'num');
function botStep(S) {
  const camp = S.camp, st = camp.queue[0], p = st.p;
  const ids = deckIds(camp), c = i => camp.cards[i];
  const leader = others(S, p).sort((a, b) => camp.stars[b] - camp.stars[a])[0];
  if (st.t === 'boons') {
    const list = boonList(S, p); let tot = 0; list.forEach(b => { tot += boonWeight(S, p, b.id); });
    let r = Math.random() * tot, pickB = list[0];
    for (const b of list) { r -= boonWeight(S, p, b.id); if (r <= 0) { pickB = b; break; } }
    return chooseBoon(S, pickB.id);
  }
  if (st.t === 'toll') {
    const list = tollList(S, p).map(t => t.id), soft = list.filter(x => x !== 'rip' && x !== 'star');
    return chooseToll(S, soft.length ? pickOne(soft) : list[0]);
  }
  if (st.t !== 'task') return stepContinue(S);
  const prefer = (list, fn) => { const good = list.filter(fn); return pickOne(good.length ? good : list); };
  switch (st.k) {
    case 'handover': return doTask(S, { card: prefer(taskCards(S, st), i => goodCard(c(i))) });
    case 'draft': return doTask(S, { card: prefer(taskCards(S, st), i => ['thief', 'encore'].indexOf(c(i).k) >= 0) });
    case 'supply': {
      return doTask(S, { key: pickOne(supplyList(camp, st.kind)) });
    }
    case 'sign': {
      if (st.card) return doTask(S, {});
      const list = taskCards(S, st);
      return doTask(S, { card: prefer(list, i => facesOf(c(i)).some(isWildF) || c(i).k !== 'num') });
    }
    case 'sticker': {
      const list = taskCards(S, st);
      const fn = st.s === 'crown' || st.s === 'rainbow' ? (i => c(i).st.sig === p) : (i => c(i).st.sig != null && c(i).st.sig !== p);
      return doTask(S, { card: prefer(list, fn) });
    }
    case 'smudge': {
      const s = Math.random() < 0.5 ? 'mud' : 'glue', list = taskCards(S, st, s);
      return doTask(S, { card: prefer(list, i => c(i).own === leader && goodCard(c(i))), s });
    }
    case 'mend': {
      const list = taskCards(S, st);
      const id = prefer(list, i => c(i).st.sig === p && (c(i).st.mud || c(i).st.glue) || c(i).st.grudge === p);
      const rem = removable(c(id));
      const s = rem.find(x => x === 'mud' || x === 'glue') || (c(id).st.grudge === p ? 'grudge' : rem[0]);
      return doTask(S, { card: id, s });
    }
    case 'tear': {
      if (st.card) return doTask(S, {});
      const list = taskCards(S, st);
      if (st.filter === 'own') return doTask(S, { card: list.slice().sort((a, b) => cardPts(c(a)) - cardPts(c(b)))[0] });
      /* Either rip a good card out of the leader's deck or thin a weak card out of your own. */
      const rip = Math.random() < 0.5;
      return doTask(S, { card: prefer(list, i => rip ? c(i).own === leader && goodCard(c(i)) : c(i).own === p && !goodCard(c(i)) && c(i).st.sig == null) });
    }
    case 'grudge': {
      const target = st.target != null ? st.target : leader;
      return doTask(S, { card: pickOne(taskCards(S, st)), target });
    }
    case 'anySticker': {
      const kinds = anyStickerKinds(S), s = kinds.indexOf('crown') >= 0 ? 'crown' : kinds.indexOf('bomb') >= 0 ? 'bomb' : 'plus';
      const list = taskCards(S, st, s);
      if (!list.length) return skipTask(S);
      return doTask(S, { card: prefer(list, i => c(i).st.sig === p), s, target: leader });
    }
    case 'tape': {
      /* Computers like pairs that bring along their own Signature or a Crown. */
      const pairs = tapePairs(camp); if (!pairs.length) return skipTask(S);
      const good = pr => pr.some(h => halfSt(h).sig === p || halfSt(h).crown);
      const pr = Math.random() < 0.7 && pairs.some(good) ? pickOne(pairs.filter(good)) : pickOne(pairs);
      return doTask(S, { halves: [pr[0].id, pr[1].id] });
    }
    case 'design': case 'blanken': {
      const cc = pickOne(COLORS);
      const eff = Math.random() < 0.3 ? 'num' : pickOne(CONTENT.powers);
      const n = eff === 'num' ? 10 + rnd(3) : null;
      const names = CONTENT.botNames[eff] || ['Mystery'];
      const nmx = eff === 'num' ? pickOne(names) + ' ' + n : pickOne(names);
      if (st.k === 'design') return doTask(S, { design: { c: cc, eff, n, nm: nmx } });
      const hs = camp.halves.filter(h => !h.used);
      return doTask(S, { half: pickOne(hs).id, design: { c: cc, eff, n, nm: Math.random() < 0.5 ? nmx : '' } });
    }
  }
  return skipTask(S);
}
const isBot = (S, p) => !!S.camp.bots[p];
const humans = S => S.camp.bots.map((b, i) => b ? -1 : i).filter(i => i >= 0);
