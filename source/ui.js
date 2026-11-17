/* =====================================================================
   SCREENS
   ===================================================================== */
let S = null;
let dbRef = null, storeKind = 'local', pendingBody = null, writing = false, watching = false, botTimer = null, toastTimer = null;
const LS_KEY = 'last-card-legacy-v1';
const ui = {
  tab: 'legacy', sel: null, shown: -1, sheet: null, play: null, flipped: false, toast: '', confirm: null,
  pick: {}, deckF: 'all', deckSel: null, lastHand: 0,
  /* handedTo: who confirmed they're holding the phone for a between-hands choice. undo: snapshots taken before each Council choice. */
  handedTo: null, undo: [],
  setup: { n: 4, names: ['', '', '', ''], bots: [false, true, true, true] }
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = (id, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + id + '"/></svg>';
const PLACE = ['1st', '2nd', '3rd', '4th'];
const KIND_ICON = { skip: 'i-skip', rev: 'i-rev', boom: 'i-boom', encore: 'i-encore', thief: 'i-thief', gift: 'i-gift', mirror: 'i-mirror', swap: 'i-swap', all1: 'i-all1', pick2: 'i-pick2' };
function initials(p) {
  const names = S.camp.names, name = names[p] || '?';
  const mk = (s, k) => s.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, k).toUpperCase() || s.slice(0, k).toUpperCase();
  let i = mk(name, 2);
  if (name.split(/\s+/).filter(Boolean).length === 1) i = name.slice(0, 2);
  const clash = names.some((o, q) => q !== p && (o.split(/\s+/).filter(Boolean).length === 1 ? o.slice(0, 2) : mk(o, 2)).toUpperCase() === i.toUpperCase());
  if (clash) i = name.replace(/\s+/g, '').slice(0, 3);
  return i.charAt(0).toUpperCase() + i.slice(1);
}

/* ---------- drawing cards ---------- */
function glyph(f, big) {
  const k = actOf(f);
  if (f.k === 'num') return '<span>' + f.n + '</span>';
  if (k === 'd2') return '<span>+2</span>';
  if (f.k === 'w4') return '<span>+4</span>';
  if (f.k === 'wild' || k === 'none') return ico('i-wheel');
  if (KIND_ICON[k]) return ico(KIND_ICON[k]);
  return '<span>?</span>';
}
function stickersHTML(card) {
  const st = card.st || {}, out = [];
  STICKER_KEYS.forEach(s => { if (st[s] != null) out.push(stkHTML(s, st[s])); });
  return out.length ? '<span class="stks">' + out.join('') + '</span>' : '';
}
/* v is the player a Signature or Grudge names; '?' draws a blank one for explanations. */
function stkHTML(s, v) {
  const t = CONTENT.stickers[s].name;
  const who = (s === 'sig' || s === 'grudge') && S && v !== '?' && v != null && S.camp.names[v] ? v : null;
  switch (s) {
    case 'sig': return '<span class="stk sig" title="' + (who != null ? 'Signed by ' + esc(S.camp.names[who]) : t) + '">' + (who != null ? esc(initials(who)) : '?') + '</span>';
    case 'grudge': return '<span class="stk grudge" title="' + (who != null ? 'Grudge against ' + esc(S.camp.names[who]) : t) + '">' + (who != null ? esc(initials(who)) : '?') + '</span>';
    case 'plus': return '<span class="stk plus" title="' + t + '">+1</span>';
    case 'mud': return '<span class="stk mud" title="' + t + '">' + ico('s-mud') + '</span>';
    case 'glue': return '<span class="stk glue" title="' + t + '">' + ico('s-glue') + '</span>';
    case 'crown': return '<span class="stk crown" title="' + t + '">' + ico('s-crown') + '</span>';
    case 'rainbow': return '<span class="stk rainbow" title="' + t + '">' + ico('s-rainbow') + '</span>';
    case 'bomb': return '<span class="stk bomb" title="' + t + '">' + ico('s-bomb') + '</span>';
  }
  return '';
}
/* A sticker with its name and what it does, for option lists and the hand legend. */
function stkExplain(s, v) {
  return '<span class="stkx">' + stkHTML(s, v).replace('class="stk', 'style="--cw:80px" class="stk') + '<span><b>' + CONTENT.stickers[s].name + ':</b> ' + esc(CONTENT.stickers[s].text) + '</span></span>';
}
function faceBody(f) {
  const em = f.c !== 'wild' ? '<span class="em">' + ico('e-' + CONTENT.colors[f.c].emblem) + '</span>' : '';
  if (f.c === 'wild') {
    const k = actOf(f);
    if (f.k === 'wild' || k === 'none') return '<span class="cn tl">' + ico('i-wheel') + '</span><span class="big">' + ico('i-wheel', 'wheelbig') + '</span><span class="cn br">' + ico('i-wheel') + '</span>';
    return '<span class="cn tl">' + glyph(f) + '</span><span class="big">' + ico('i-wheel', 'wheelbig') + '</span><span class="over">' + glyph(f) + '</span><span class="cn br">' + glyph(f) + '</span>';
  }
  return em + '<span class="cn tl">' + glyph(f) + '</span><span class="big">' + glyph(f) + '</span><span class="cn br">' + glyph(f) + '</span>';
}
/* opt.from: whose hand or deck we're looking at. A card that belongs to someone else gets their colored initials in the corner. */
function ownerBadge(card, from) {
  if (from == null || card.own == null || card.own === from || !S) return '';
  return '<span class="ownb" style="--oc:var(--own' + card.own + ')" title="From ' + esc(S.camp.names[card.own]) + '’s deck">' + esc(initials(card.own)) + '</span>';
}
function cardHTML(card, opt) {
  opt = opt || {};
  const style = opt.cw ? ' style="--cw:' + opt.cw + 'px"' : '';
  const label = esc(cardName(card) + (opt.from != null && card.own != null && card.own !== opt.from && S ? ', from ' + S.camp.names[card.own] + '’s deck' : ''));
  const badge = ownerBadge(card, opt.from);
  if (card.k === 'frank') {
    /* A Blankenstein's left half is the hand-drawn blank. */
    const half = (f, side, blank) => '<span class="half ' + side + ' bgs-' + f.c + (blank ? ' blankhalf' : '') + '"><span class="big">' + glyph(f) + '</span></span>';
    return '<span class="card frank s-' + card.h[0].c + (card.torn ? ' torn' : '') + '"' + style + ' role="img" aria-label="' + label + '">' + half(card.h[0], 'l', card.blank) + half(card.h[1], 'r') + '<span class="tapeband"></span>' + stickersHTML(card) + badge + '</span>';
  }
  if (isDual(card)) {
    /* Dual-color: split diagonally, the number in the middle. */
    return '<span class="card dual s-' + card.c + (card.torn ? ' torn' : '') + '"' + style + ' role="img" aria-label="' + label + '"><span class="dualbg" style="--ca:var(--' + card.c + ');--cb:var(--' + card.c2 + ')"></span>' +
      '<span class="cn tl">' + card.n + '</span><span class="big">' + card.n + '</span><span class="cn br">' + card.n + '</span>' + stickersHTML(card) + badge + '</span>';
  }
  const f = faceOf(card);
  const cname = card.k === 'custom' ? '<span class="cname">' + esc(card.nm) + '</span>' : '';
  return '<span class="card s-' + f.c + (card.k === 'custom' ? ' custom' : '') + (card.torn ? ' torn' : '') + '"' + style + ' role="img" aria-label="' + label + '">' + faceBody(f) + cname + stickersHTML(card) + badge + '</span>';
}
/* Each player's deck has its own back color. */
function backHTML(cw, p) {
  const st = (cw ? '--cw:' + cw + 'px;' : '') + (p != null ? '--back:var(--own' + p + ');--back-2:color-mix(in srgb,var(--own' + p + ') 70%,#fff);' : '');
  return '<span class="card back"' + (st ? ' style="' + st + '"' : '') + ' role="img" aria-label="' + (p != null && S ? esc(S.camp.names[p]) + '’s deck' : 'Card back') + '"><span class="lc">LC</span><span class="bars"><i style="background:var(--red)"></i><i style="background:var(--blue)"></i><i style="background:var(--yellow)"></i><i style="background:var(--green)"></i></span></span>';
}
function previewCard(d) {
  const props = { k: 'custom', c: d.c, eff: d.c === 'wild' ? (d.eff === 'num' ? 'none' : d.eff) : d.eff, nm: d.nm || 'Your card', st: { sig: d.p } };
  if (props.eff === 'num') props.n = d.n;
  return cardHTML(props, { cw: 110 });
}
function describeCard(card) {
  const lines = [];
  facesOf(card).forEach((f, i) => {
    const k = actOf(f);
    let t;
    if (f.k === 'num') t = 'A ' + colorName(f.c) + ' ' + f.n + '. ' + CONTENT.kinds.num.text;
    else if (f.k === 'cwild') t = 'A Wild. Choose the next color' + (k !== 'none' ? ', then: ' + CONTENT.kinds[k].text : '.');
    else t = CONTENT.kinds[f.k].text;
    if (card.k === 'frank') t = (i ? 'Right half: ' : (card.blank ? 'Left half (drawn on a blank): ' : 'Left half: ')) + faceName(f) + '. ' + t;
    if (isDual(card) && i) return;
    lines.push(t);
  });
  if (card.k === 'frank') lines.unshift(card.blank ? CONTENT.kinds.blanken.text : CONTENT.kinds.frank.text);
  if (isDual(card)) return [CONTENT.kinds.dual.text];
  return lines;
}
function stickerLines(card) {
  return STICKER_KEYS.filter(s => card.st[s] != null).map(s => {
    let t = CONTENT.stickers[s].text;
    if (s === 'sig') t = 'Signed by ' + S.camp.names[card.st.sig] + '. When ' + S.camp.names[card.st.sig] + ' plays it, they may play one more card right away.';
    if (s === 'grudge') t = 'Grudge against ' + S.camp.names[card.st.grudge] + '. Whenever anyone else plays it, ' + S.camp.names[card.st.grudge] + ' draws 1.';
    return '<div class="stkline">' + stkHTML(s, card.st[s]).replace('class="stk', 'style="--cw:66px" class="stk') + '<span>' + esc(t) + '</span></div>';
  }).join('');
}
function cardMeta(card) {
  const bits = [];
  if (card.own != null) bits.push((card.torn ? 'Was in ' : 'In ') + S.camp.names[card.own] + '’s deck.');
  if (card.k === 'custom') bits.push('Designed by ' + S.camp.names[card.by] + ' before Hand ' + card.born + '.');
  else if (card.k === 'frank') bits.push('Taped by ' + S.camp.names[card.by] + ' before Hand ' + card.born + '.');
  else if (card.born) bits.push('Added before Hand ' + card.born + '.');
  if (card.torn) bits.push('Torn up in Hand ' + card.torn + '.');
  return bits.join(' ');
}
function sortHand(ids) {
  const ord = { red: 0, blue: 1, yellow: 2, green: 3, wild: 4 };
  const kord = k => ['num', 'skip', 'rev', 'd2', 'encore', 'thief', 'gift', 'mirror', 'swap', 'all1', 'pick2', 'wild', 'cwild', 'boom', 'w4'].indexOf(k);
  return ids.slice().sort((a, b) => {
    const fa = faceOf(C(S, a)), fb = faceOf(C(S, b));
    return ord[fa.c] - ord[fb.c] || kord(fa.k) - kord(fb.k) || (fa.n || 0) - (fb.n || 0) || (a < b ? -1 : 1);
  });
}

/* ---------- saving ---------- */
function loadLocal() { try { const raw = localStorage.getItem(LS_KEY); if (!raw) return null; const d = JSON.parse(raw); return d && d.state ? d : null; } catch (e) { return null; } }
function persist() {
  if (!S) return;
  const savedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify({ savedAt, state: S })); } catch (e) {}
  if (dbRef) dbSave();
}
/* One write at a time; the newest body wins, so a restart marker can never be overwritten by an older save still in flight. */
function dbWrite(body) { pendingBody = body; if (!writing) flushWrites(); }
async function flushWrites() {
  writing = true;
  while (pendingBody && dbRef) {
    const b = pendingBody; pendingBody = null;
    try { await dbRef.set(b); }
    catch (e) { if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted' || e.code === 'permission_denied')) { dbRef = null; storeKind = 'local'; renderSoft(); } }
  }
  writing = false;
}
function dbSave() { if (S && dbRef) dbWrite({ v: 1, savedAt: Date.now(), state: JSON.parse(JSON.stringify(S)) }); }
const started = st => (st && st.camp && st.camp.started) || 0;
/* A restart leaves { ended: <start time of the campaign it ended>, state: null }. Any device still holding that campaign, or an older one, drops it. */
const endedBy = (d, st) => !!(d && !d.state && d.ended != null && st && started(st) <= d.ended);
function watchDb(ref) {
  if (watching || !ref.onSnapshot) return;
  watching = true;
  try {
    ref.onSnapshot(snap => {
      if (!snap.exists || !S) return;
      if (endedBy(snap.data(), S)) dropCampaign('The campaign was restarted.');
    }, () => { watching = false; });
  } catch (e) { watching = false; }
}
async function initDb() {
  let dbase = null;
  try { dbase = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { dbase = null; }
  if (!dbase) { storeKind = 'local'; renderSoft(); return; }
  try {
    const ref = dbase.doc('campaign/main');
    const snap = await ref.get();
    dbRef = ref; storeKind = 'db';
    const local = loadLocal();
    const d = snap.exists ? snap.data() : null;
    if (d && d.state && !isCurrent(d.state)) {
      /* An old shared-deck campaign: end it everywhere. */
      if (!S) { S = d.state; dropCampaign('The game now gives everyone their own deck, so the campaign starts fresh.'); }
      dbWrite({ v: 1, reset: Date.now(), ended: started(d.state), state: null });
      if (S) dbSave();
      renderSoft(); watchDb(ref); return;
    }
    if (d && d.state) {
      const takeDb = !S || started(d.state) > started(S) || (started(d.state) === started(S) && (d.savedAt || 0) >= (local ? local.savedAt || 0 : 0));
      if (takeDb) { S = JSON.parse(JSON.stringify(d.state)); try { localStorage.setItem(LS_KEY, JSON.stringify({ savedAt: d.savedAt || Date.now(), state: S })); } catch (e) {} render(); watchDb(ref); return; }
    } else if (endedBy(d, S)) { dropCampaign('The campaign was restarted.'); watchDb(ref); return; }
    if (S) dbSave();
    renderSoft();
    watchDb(ref);
  } catch (e) { dbRef = null; storeKind = 'local'; renderSoft(); }
}
function afterChange() { persist(); render(); }
function toast(t) {
  ui.toast = t; renderToast();
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast = ''; renderToast(); }, 2600);
}
function renderToast() { document.getElementById('toast-root').innerHTML = ui.toast ? '<div class="toast" role="status">' + esc(ui.toast) + '</div>' : ''; }

/* ---------- top of the page ---------- */
function topHTML() {
  const camp = S.camp, h = camp.hand;
  let pips = '';
  for (let i = 1; i <= CONTENT.hands; i++) pips += '<i class="' + (i < h || camp.phase === 'ended' ? 'done' : i === h ? 'now' : '') + '"></i>';
  const label = camp.phase === 'ended' ? 'Campaign over' : 'Hand <b>' + Math.max(1, h) + '</b> of ' + CONTENT.hands;
  return '<header class="top"><div class="wordmark">Last Card <span class="tag">Legacy</span></div><div class="handtag"><span>' + label + '</span><span class="track" aria-hidden="true">' + pips + '</span></div></header>';
}
function playersHTML() {
  const camp = S.camp, G = S.game, n = camp.n;
  const playing = camp.phase === 'play' && G && G.phase !== 'over';
  return '<section class="players n' + n + '" style="--pn:' + n + '" aria-label="Players">' + [...Array(n).keys()].map(p => {
    const turn = playing && G.turn === p;
    const inPlay = G && camp.phase === 'play' && G.decks;
    const cards = inPlay ? G.hands[p].length : null;
    const deck = inPlay ? G.decks[p].length : deckSize(camp, p);
    const last = playing && cards === 1;
    /* Tapping a player opens a choice of person or computer for that seat, even mid-hand. */
    const bot = !!camp.bots[p];
    return '<button class="pchip' + (turn ? ' turn' : '') + (bot ? ' bot' : '') + '" style="--oc:var(--own' + p + ')" data-act="seat" data-id="' + p + '" aria-label="' + esc(camp.names[p]) + ', played by ' + (bot ? 'the computer' : 'a person') + '. Change who plays ' + esc(camp.names[p]) + '.">' + (last ? '<span class="lastflag">Last card</span>' : '') +
      '<span class="pn"><span class="initial" style="background:var(--own' + p + ')">' + esc(initials(p)) + '</span><span class="pname">' + esc(camp.names[p]) + '</span>' + (bot ? '<span class="seatic" title="Played by the computer">' + ico('i-bot') + '</span>' : '') + '</span>' +
      '<span class="who">' + (bot ? 'Computer' : 'Person') + (turn ? ' · playing' : '') + '</span>' +
      '<span class="nums"><span title="Stars"><span class="star">' + ico('i-star') + '</span> <b>' + camp.stars[p] + '</b></span>' +
      (cards != null ? '<span title="Cards in hand">' + ico('i-hand') + ' <b>' + cards + '</b></span>' : '') +
      '<span title="' + (inPlay ? 'Cards left in their deck' : 'Cards in their deck') + '">' + ico('i-deck') + ' <b>' + deck + '</b></span></span></button>';
  }).join('') + '</section>';
}

/* ---------- whose hand is on screen ---------- */
function handOwner() {
  const G = S.game, hs = humans(S);
  if (!G || S.camp.phase !== 'play' || G.phase === 'over' || !hs.length) return -1;
  if (hs.length === 1) return hs[0];
  if (!isBot(S, G.turn)) return ui.shown === G.turn ? G.turn : -2;
  return -1;
}

/* ---------- the table ---------- */
function tableHTML() {
  const G = S.game, camp = S.camp, p = G.turn, owner = handOwner();
  const myTurn = owner >= 0 && owner === p;
  const dirIcon = G.dir === 1 ? 'i-cw' : 'i-ccw';
  const topCard = C(S, G.topId);
  const topView = viewOfTop();
  const under = G.disc.length > 1 ? '<span style="position:absolute;left:-10px;top:6px;transform:rotate(-8deg);opacity:.55">' + cardHTML(C(S, G.disc[G.disc.length - 2])) + '</span>' : '';
  const canDraw = myTurn && G.phase === 'turn';
  let h = '<section class="felt" aria-label="Table"><div class="piles">' +
    '<button class="pile' + (canDraw ? ' drawable' : '') + '" data-act="draw"' + (canDraw ? '' : ' disabled') + ' aria-label="Draw a card from ' + (owner === p ? 'your' : esc(nm(S, p)) + '’s') + ' deck"><span class="pilestack drawc">' + backHTML(null, p) + '</span><span>' + (owner === p ? 'Your deck' : esc(nm(S, p)) + '’s deck') + ' · ' + G.decks[p].length + '</span></button>' +
    '<div class="pile"><span class="pilestack topc" style="position:relative">' + under + topView + '</span><span>Middle pile</span></div>' +
    '<div class="state"><div class="colorchip">' + liveColors(G).map(c => '<i style="background:var(--' + c + ')"></i>').join('') + liveColors(G).map(colorName).join(' / ') + '</div>' +
    '<div class="dirchip">' + ico(dirIcon) + (G.dir === 1 ? 'Clockwise' : 'Counter&shy;clockwise') + '</div>' +
    (G.pending ? '<div class="pendchip">+' + G.pending + ' to draw</div>' : '') + '</div></div>';
  h += '<ul class="feed" aria-live="polite">' + G.feed.slice(-3).map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></section>';
  h += undoHTML(true);
  const ow = owesCall(S);
  if (ow >= 0 && !isBot(S, ow)) {
    const before = ow === p ? 'before you play again' : isBot(S, p) ? 'before ' + esc(nm(S, p)) + ' plays' : 'before ' + esc(nm(S, p)) + ' opens their hand';
    h += '<div class="latecall" role="status"><span><b>' + esc(nm(S, ow)) + '</b> has one card left. Call it ' + before + '.</span><button class="btn call" data-act="latecall" data-id="' + ow + '">Last card!</button></div>';
  }
  h += statusHTML(owner);
  if (owner >= 0) h += handBoxHTML(owner);
  else if (owner === -2) h += '<div class="handbox"><p>Pass the device to <b>' + esc(nm(S, p)) + '</b>.</p><div class="actions"><button class="btn primary" data-act="reveal">I’m ' + esc(nm(S, p)) + ', show my hand</button></div></div>';
  return h;
}
function viewOfTop() {
  const G = S.game, card = C(S, G.topId);
  if (card.k === 'frank' || G.top.m) return faceCardFrom(G.top, card.st);
  return cardHTML(card);
}
/* Draws the face that counts on top of the pile (a Mirror shows what it copied, a Frankencard the half that was played). */
function faceCardFrom(f, st, cw) {
  let props;
  if (f.k === 'cwild') props = { k: 'custom', c: 'wild', eff: f.eff, nm: f.nm || 'Wild', st: st || {} };
  else if (f.nm) props = f.k === 'num' ? { k: 'custom', c: f.c, eff: 'num', n: f.n, nm: f.nm, st: st || {} } : { k: 'custom', c: f.c, eff: f.k, nm: f.nm, st: st || {} };
  else props = { k: f.k, c: f.c, n: f.n, st: st || {} };
  let html = cardHTML(props, cw ? { cw } : {});
  if (f.m) html = '<span style="position:relative;display:inline-block">' + html + '<span class="stk" style="position:absolute;left:-6px;bottom:-6px;--cw:84px" title="Mirror">' + ico('i-mirror') + '</span></span>';
  return html;
}
function matchText() {
  const G = S.game, t = G.top;
  const sym = t.k === 'num' ? 'a ' + t.n : t.c === 'wild' ? null : 'a ' + CONTENT.kinds[t.k].name;
  const cols = liveColors(G).map(colorName);
  return (cols.length > 1 ? cols.join(', ') : cols[0]) + (sym ? ' or ' + sym : '');
}
/* The card you just drew, shown right under the table with its own buttons. */
function drewHTML() {
  const G = S.game, p = G.turn, id = G.drawnCard, card = C(S, id), hand = G.hands[p];
  const ok = playableFaces(S, p, id).length > 0;
  const call = ok && hand.length >= 2 && hand.length <= 3 ? (G.called[p] ? '<button class="btn called" disabled>Last card called</button>' : '<button class="btn call" data-act="call">Last card!</button>') : '';
  const acts = ok
    ? '<button class="btn primary" data-act="playdrawn">Play it</button>' + call + '<button class="btn" data-act="pass">Keep it and end my turn</button>'
    : '<button class="btn primary" data-act="pass">End my turn</button>';
  return '<div class="drew' + (ok ? '' : ' dead') + '" id="drew">' + cardHTML(card, { cw: 76 }) + '<div class="drewtext"><span class="eyebrow">You drew</span><h2>' + esc(cardName(card)) + '</h2>' +
    '<p>' + (ok ? 'It can go on the pile, so you can play it right now or keep it.' : 'It doesn’t match ' + esc(matchText()) + ', so it goes in your hand and your turn is over.') + '</p>' +
    '<div class="actions">' + acts + '</div></div></div>';
}
function statusHTML(owner) {
  const G = S.game, p = G.turn, name = esc(nm(S, p));
  if (owner === p && !isBot(S, p) && G.phase === 'drawn') return drewHTML();
  let title, sub = '';
  if (isBot(S, p)) { title = name + ' is playing'; sub = humans(S).length ? 'The computer is taking its turn.' : 'Every seat is played by the computer. Change seats in the Story tab.'; }
  else if (owner === -2) { title = name + '’s turn'; sub = 'Hands stay hidden until the right player is holding the device.'; }
  else if (owner !== p) { title = name + '’s turn'; }
  else {
    switch (G.phase) {
      case 'facing': title = 'A stack of ' + G.pending + ' is coming at you'; sub = 'Block it by playing a Draw card of your own on top, and the next player gets the whole stack. Or take all ' + G.pending + ' cards.'; break;
      case 'combo': title = 'You played your own signature'; sub = 'You may play one more card right away, or finish your turn.' +
        (G.pending ? ' Either way, ' + esc(nm(S, nextP(G, p, 1 + G.skip))) + ' still has to draw ' + G.pending + (S.camp.rules.stack ? ', unless they stack a Draw card on it' : '') + '. A Skip or Reverse as your extra card changes who that is.' : ''); break;
      default: title = 'Your turn, ' + name; sub = 'Play a card that matches ' + matchText() + ', or draw.';
    }
  }
  return '<div class="status"><h2>' + title + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>';
}
function handBoxHTML(owner) {
  const G = S.game, p = G.turn, myTurn = owner === p, hand = G.hands[owner];
  const ids = sortHand(hand);
  const playable = myTurn ? new Set(playableIds(S, owner)) : new Set();
  let h = '<section class="handbox" aria-label="Your hand"><div class="status"><h2 style="font-size:18px">' + esc(nm(S, owner)) + '’s hand · ' + hand.length + ' card' + (hand.length === 1 ? '' : 's') + '</h2></div><div class="hand">';
  ids.forEach(id => {
    const cls = (ui.sel === id ? ' sel' : '') + (myTurn && !playable.has(id) ? ' dim' : '') + (G.phase === 'drawn' && G.drawnCard === id && myTurn ? ' new' : '');
    h += '<button class="cardbtn' + cls + '" data-act="card" data-id="' + id + '" aria-label="' + esc(cardName(C(S, id))) + (playable.has(id) ? ', playable' : '') + '">' + cardHTML(C(S, id), { from: owner }) + '</button>';
  });
  h += '</div>';
  const kinds = STICKER_KEYS.filter(s => hand.some(id => C(S, id).st[s] != null));
  if (kinds.length) {
    h += '<div class="legend"><span class="eyebrow">Stickers in your hand</span>' + kinds.map(s => {
      const holder = hand.find(id => C(S, id).st[s] != null);
      return stkExplain(s, C(S, holder).st[s]);
    }).join('') + '</div>';
  }
  const acts = [];
  if (myTurn) {
    if (G.phase === 'turn') acts.push('<button class="btn" data-act="draw">Draw a card</button>');
    if (G.phase === 'combo') acts.push('<button class="btn" data-act="pass">Finish turn</button>');
    if (G.phase === 'facing') acts.push('<button class="btn" data-act="take">Take ' + G.pending + ' cards</button>');
    if (G.phase !== 'drawn' && hand.length >= 2 && hand.length <= 3) acts.push(G.called[p] ? '<button class="btn called" disabled>Last card called</button>' : '<button class="btn call" data-act="call">Last card!</button>');
    if (G.phase === 'turn' && G.first[p] && G.redo[p]) acts.push('<button class="btn ghost" data-act="redo">Use Second Chance</button>');
  }
  if (acts.length) h += '<div class="actions">' + acts.join('') + '</div>';
  if (ui.sel && hand.indexOf(ui.sel) >= 0) {
    const card = C(S, ui.sel), canPlay = playable.has(ui.sel);
    let why = '';
    if (!myTurn) why = 'It isn’t your turn.';
    else if (!canPlay) {
      if (card.st.glue && hand.length === 1) why = 'Glue: this card can’t be your last card.';
      else if (G.phase === 'facing') why = 'Only a Draw card or a Boomerang can block the stack.';
      else if (G.phase === 'drawn') why = 'You can only play the card you just drew.';
      else why = 'It doesn’t match ' + matchText() + '.';
    }
    h += '<div class="inspect">' + cardHTML(card, { cw: 64, from: owner }) + '<div><h4>' + esc(cardName(card)) + '</h4>' + describeCard(card).map(t => '<p>' + esc(t) + '</p>').join('') + stickerLines(card) +
      (cardMeta(card) ? '<p>' + esc(cardMeta(card)) + '</p>' : '') +
      '<div class="actions">' + (canPlay ? '<button class="btn primary" data-act="playsel">Play it</button>' : '<span class="savenote">' + esc(why) + '</span>') + '</div></div></div>';
  }
  return h + '</section>';
}

/* ---------- playing a card ---------- */
function startPlay(id) {
  const G = S.game, p = G.turn;
  const fs = playableFaces(S, p, id);
  if (!fs.length) return;
  ui.play = { id, fi: fs.length === 1 ? fs[0] : null, ch: {} };
  continuePlay();
}
function continuePlay() {
  const P = ui.play, G = S.game, p = G.turn;
  if (!P) return;
  if (P.fi == null) { ui.sheet = { k: 'half' }; return render(); }
  const need = playNeeds(S, p, P.id, P.fi);
  if (need.color && !P.ch.color) { ui.sheet = { k: 'color' }; return render(); }
  if (need.gift && P.ch.gift == null && G.hands[p].length > 1) { ui.sheet = { k: 'gift' }; return render(); }
  if (need.target && P.ch.target == null) { ui.sheet = { k: 'target', list: need.target }; return render(); }
  ui.sheet = null; ui.play = null; ui.sel = null;
  lockUndo();
  act(S, { t: 'play', p, id: P.id, fi: P.fi, ch: P.ch });
  afterChange();
}
function effectiveAct() {
  const P = ui.play, G = S.game, card = C(S, P.id), f0 = facesOf(card)[P.fi];
  return actOf(f0.k === 'mirror' ? mirrorCopy(G, f0) : f0);
}
/* A rule card, showing only the lines for rules that are in play (so it never spoils a sealed box). */
function ruleCardHTML(id) {
  const R = S.camp.rules, card = CONTENT.ruleCards[id];
  const show = l => (!l.need || R[l.need]) && (!l.unless || !R[l.unless]);
  return '<div class="lcard face rulecard"><span class="no">Rule card</span><h3>' + esc(card.title) + '</h3>' + card.sections.map(sec => {
    const ls = sec.lines.filter(show);
    return ls.length ? '<h4>' + esc(sec.h) + '</h4><ul>' + ls.map(l => '<li>' + esc(l.t) + '</li>').join('') + '</ul>' : '';
  }).join('') + '</div>';
}
function seatSheetHTML(q) {
  const name = esc(nm(S, q)), bot = !!S.camp.bots[q];
  const opt = (isBot, title, text) => '<button class="opt" data-act="setseat" data-id="' + q + ':' + (isBot ? 1 : 0) + '" aria-pressed="' + (bot === isBot) + '"><b>' + title + (bot === isBot ? ' · now' : '') + '</b><span>' + text + '</span></button>';
  return '<div class="veil" role="dialog" aria-modal="true" aria-label="Who plays ' + name + '"><div class="sheet"><h3>Who plays ' + name + '?</h3>' +
    '<p>You can switch at any time, even in the middle of a hand. The change takes effect right away.</p><div class="opts">' +
    opt(false, 'A person', name + ' plays on this device. With more than one person at the table, ' + name + '’s hand stays hidden until the phone is passed to them.') +
    opt(true, 'The computer', 'The computer plays ' + name + '’s cards and makes ' + name + '’s Council choices until you switch back.') +
    '</div><div class="actions"><button class="btn ghost" data-act="sheetcancel">Cancel</button></div></div></div>';
}
function sheetHTML() {
  const G = S.game, sh = ui.sheet;
  if (!sh) return '';
  if (sh.k === 'seat') return seatSheetHTML(sh.p);
  if (sh.k === 'rulecard') return '<div class="veil" role="dialog" aria-modal="true" aria-label="' + esc(CONTENT.ruleCards[sh.id].title) + '"><div class="sheet">' + ruleCardHTML(sh.id) + '<div class="actions"><button class="btn primary" data-act="sheetcancel">Close</button></div></div></div>';
  const P = ui.play, p = G ? G.turn : -1;
  let inner = '';
  if (sh.k === 'half') {
    const card = C(S, P.id), fs = playableFaces(S, p, P.id), faces = facesOf(card);
    inner = '<h3>Which half counts?</h3><p>Its color, number or symbol, and action are the ones that count this time.</p><div class="centeract">' +
      fs.map(fi => { const f = faces[fi]; return '<button class="btn" data-act="half" data-id="' + fi + '" style="display:flex;gap:8px;align-items:center">' + faceCardFrom(f, {}, 48) + esc(faceName(f)) + '</button>'; }).join('') + '</div>';
  } else if (sh.k === 'color') {
    inner = '<h3>Choose the next color</h3><div class="colorgrid">' + COLORS.map(c => {
      const cnt = G.hands[p].filter(x => x !== P.id && facesOf(C(S, x)).some(f => f.c === c || f.c2 === c)).length;
      return '<button class="colorbtn c-' + c + '" style="background:var(--' + c + ')" data-act="color" data-id="' + c + '">' + ico('e-' + CONTENT.colors[c].emblem) + colorName(c) + ' <small>(' + cnt + ' in hand)</small></button>';
    }).join('') + '</div>';
  } else if (sh.k === 'gift') {
    const rest = sortHand(G.hands[p].filter(x => x !== P.id));
    inner = '<h3>Which card do you give away?</h3><div class="giftgrid">' + rest.map(id => '<button class="cardbtn" data-act="giftc" data-id="' + id + '" aria-label="' + esc(cardName(C(S, id))) + '">' + cardHTML(C(S, id), { cw: 56 }) + '</button>').join('') + '</div>';
  } else if (sh.k === 'target') {
    const a = effectiveAct();
    const q = a === 'thief' ? 'Steal a card from whom?' : a === 'gift' ? 'Give it to whom?' : a === 'pick2' ? 'Who draws 2?' : 'Trade hands with whom?';
    inner = '<h3>' + q + '</h3><div class="opts">' + sh.list.map(t => '<button class="opt" data-act="target" data-id="' + t + '"><b>' + esc(nm(S, t)) + '</b><span>' + G.hands[t].length + ' card' + (G.hands[t].length === 1 ? '' : 's') + ' · ' + S.camp.stars[t] + ' Stars</span></button>').join('') + '</div>';
  }
  return '<div class="veil" role="dialog" aria-modal="true"><div class="sheet">' + inner + '<div class="actions"><button class="btn ghost" data-act="sheetcancel">Cancel</button></div></div></div>';
}

/* ---------- between hands ---------- */
const WHY = {
  boon: 'The Council · Boon', toll: 'The Council · Toll', council: 'The Council', L1: 'The Council', L2: 'Ripped', L11: 'Autographs',
  I: 'Box I · Bad Blood', III: 'Box III · Crowns', V: 'Box V · Tape', VI: 'Box VI · Blank Cards', VII: 'Box VII · The Last Hand',
  VIII: 'Box VIII · Bombs', IX: 'Box IX · Rainbow', X: 'Box X · The Turnabout', XI: 'Box XI · Wild Things', XII: 'Box XII · Avalanche',
  L13: 'Running on Empty', L14: 'Blankensteins'
};
/* The small label above each between-hands screen, e.g. "The Council · Boon 1 of 2: Sign a Card". */
function whyLabel(st) {
  const base = w => w === 'council' ? 'The Council' : WHY[w] || 'Between hands';
  if (st.t === 'boons') {
    const total = st.total != null ? st.total : st.n + (st.picked || []).length;
    return base(st.why) + (total > 1 ? ' · Boon ' + ((st.picked || []).length + 1) + ' of ' + total : ' · Boon');
  }
  if (st.t === 'toll') return 'The Council · Toll';
  if (st.bn) return base(st.bwhy) + ' · Boon ' + (st.bt > 1 ? st.bn + ' of ' + st.bt : '') + ': ' + st.bname;
  if (st.tname) return 'The Council · ' + nm(S, st.payer) + '’s Toll: ' + st.tname;
  if (st.k === 'draft') return (WHY[st.why] || 'Draft') + ' · Draft pick ' + st.no + ' of ' + st.of;
  return WHY[st.why] || 'Between hands';
}
function betweenHTML() {
  const camp = S.camp, st = camp.queue[0];
  if (!st) return '<div class="panel"><p>Shuffling…</p></div>';
  const actor = stepActor(S);
  if (actor < 0) ui.handedTo = null;
  if (actor >= 0 && isBot(S, actor)) return '<div class="panel"><span class="eyebrow">' + esc(whyLabel(st)) + '</span><h2>' + esc(nm(S, actor)) + ' is choosing…</h2><p class="lede">' + esc(taskTitle(st)) + '</p></div>' + undoHTML(false);
  /* With more than one person at the table, each choice waits until its owner says they're holding the phone. */
  if (actor >= 0 && humans(S).length > 1 && ui.handedTo !== actor) return passHTML(st, actor) + undoHTML(false);
  let body;
  switch (st.t) {
    case 'results': body = resultsHTML(st.rec); break;
    case 'card': body = legacyRevealHTML(st); break;
    case 'box': body = boxRevealHTML(st); break;
    case 'boons': body = boonsHTML(st); break;
    case 'toll': body = tollHTML(st); break;
    case 'task': body = taskHTML(st); break;
    case 'final': body = finalHTML(true); break;
    default: body = '<div class="panel"><p>One moment…</p></div>';
  }
  return body + undoHTML(false);
}
function passHTML(st, actor) {
  const name = esc(nm(S, actor));
  let what;
  if (st.t === 'toll') what = name + ' won, and pays a Toll.';
  else if (st.t === 'boons') { const total = st.total != null ? st.total : st.n + (st.picked || []).length, left = st.n; what = name + ' chooses ' + (left < total ? 'one more Boon' : total === 1 ? 'a Boon' : total + ' Boons') + '.'; }
  else what = name + ': ' + esc(taskTitle(st)) + '.';
  return '<div class="panel passphone"><span class="eyebrow">' + esc(whyLabel(st)) + '</span><h2>Pass the phone to ' + name + '</h2><p class="lede">' + what + ' Only ' + name + ' should choose this.</p>' +
    '<div class="actions"><button class="btn primary" data-act="handed" data-id="' + actor + '">I’m ' + name + '</button></div></div>';
}
/* Takes back the last Council choice. It stays available into the next hand until a person plays or draws. */
function undoHTML(inPlay) {
  const u = ui.undo[ui.undo.length - 1];
  if (!u) return '';
  return '<div class="undo-row"><button class="btn ghost" data-act="undo">' + ico('i-ccw') + ' ' + (inPlay ? 'Undo the last Council choice (' + esc(u.label) + ')' : 'Undo ' + esc(u.label)) + '</button></div>';
}
function pushUndo(label) { ui.undo.push({ s: JSON.stringify(S), label }); if (ui.undo.length > 40) ui.undo.shift(); }
const lockUndo = () => { ui.undo = []; };
function resultsHTML(rec) {
  const camp = S.camp, G = S.game;
  const winner = rec.order[0];
  let h = '<div class="panel"><span class="eyebrow">Hand ' + rec.h + ' is over</span><h2>' + esc(nm(S, winner)) + ' wins the hand</h2>';
  h += '<p class="lede">' + (rec.last ? 'Went out with ' + esc(cardName(C(S, rec.last))) + '.' : 'Nobody could play and the cards ran out, so the hand ended on points.') + (rec.mult > 1 ? ' Stars count double this hand.' : '') + '</p><div class="results">';
  rec.order.forEach((p, i) => {
    const left = G && G.hands[p] ? sortHand(G.hands[p]) : [];
    const extra = [];
    if (rec.crowns[p]) extra.push('+' + rec.crowns[p] + ' from Crowns during the hand');
    if (i === 0 && rec.auto) extra.push('includes +' + rec.auto + ' for going out on their own signature');
    /* Torn Hands: the torn cards are shown first, torn, then the rest of what was left. */
    const torn = (rec.torn && rec.torn[p]) || [];
    const kept = left.filter(id => torn.indexOf(id) < 0);
    h += '<div class="rrow"><span class="place">' + PLACE[i] + '</span><span class="rn">' + esc(nm(S, p)) + '</span><span class="rgain">+' + rec.gain[p] + ' ' + ico('i-star') + '</span>' +
      '<span class="rsub">' + (i === 0 ? 'Out of cards' : left.length + ' card' + (left.length === 1 ? '' : 's') + ' left, ' + rec.pts[p] + ' point' + (rec.pts[p] === 1 ? '' : 's')) + (extra.length ? ' · ' + extra.join(', ') : '') + '</span>' +
      (torn.length ? '<span class="rsub tornline">Tore up ' + torn.length + ': ' + esc(torn.map(id => cardName(C(S, id))).join(', ')) + '</span>' : '') +
      (left.length ? '<span class="left">' + torn.concat(kept).slice(0, 24).map(id => cardHTML(C(S, id), { cw: 32 })).join('') + (left.length > 24 ? '<span class="savenote">+' + (left.length - 24) + '</span>' : '') + '</span>' : '') + '</div>';
  });
  if (camp.rules.handTear && rec.torn && !Object.keys(rec.torn).length && rec.order.length > 1) h += '<p class="savenote">No cards were torn: every losing player’s deck is already down to ' + MIN_DECK + '.</p>';
  h += '</div><div class="standings"><span>Total Stars:</span>' + rankByStars(camp).map(p => '<span><b>' + esc(nm(S, p)) + '</b> ' + camp.stars[p] + '</span>').join('') + '</div>';
  const more = camp.queue.slice(1).filter(x => x.t === 'card' || x.t === 'box').length;
  const anyTorn = rec.torn && Object.keys(rec.torn).length;
  h += '<div class="actions"><button class="btn primary" data-act="cont">' + (more ? 'Continue: something is changing' : camp.rules.council ? 'Continue to the Council' : 'Continue') + '</button>' +
    (anyTorn ? '<button class="btn" data-act="rulecard" data-id="tearing">How tearing works</button>' : '') + '</div></div>';
  return h;
}
function legacyNo(id) { return CONTENT.legacy.findIndex(x => x.id === id) + 1; }
function ctxLine(st) {
  const c = st.ctx || {}, who = c.p != null ? nm(S, c.p) : null;
  switch (st.id) {
    case 'L1': return c.card ? who + ' went out with ' + cardName(C(S, c.card)) + '.' : '';
    case 'L2': return c.card ? who + ' had to draw 4 or more cards because of ' + cardName(C(S, c.card)) + ' from ' + nm(S, C(S, c.card).own) + '’s deck.' : 'No one drew 4 at once. ' + nm(S, lowestPlayer(S.camp)) + ' has the fewest Stars.';
    case 'L3': return who ? who + ' was holding 12 cards.' : 'No one has held 12 cards yet. The rule arrives anyway.';
    case 'L5': return who ? who + ' won without drawing a single card.' : 'No one has won without drawing. ' + nm(S, lowestPlayer(S.camp)) + ' has the fewest Stars.';
    case 'L9': return who ? who + ' won two hands in a row.' : '';
    case 'I': return who + ' finished last two hands in a row.';
    case 'IX': return who + ' went out by playing a Wild.';
    case 'XII': return who + ' drew 8 or more cards in a single turn.';
    case 'III': return who + ' places the Crowns.';
    case 'V': return nm(S, lowestPlayer(S.camp)) + ' has the fewest Stars and tapes the first Frankencard.';
    case 'XI': return nm(S, lowestPlayer(S.camp)) + ' has the fewest Stars and picks first.';
    case 'IV': { const o = fewestFirst(S.camp); return 'The Boomerangs go to ' + CONTENT.newCards.IV.map((x, i) => nm(S, o[i % S.camp.n])).join(', ') + '.'; }
    case 'L13': return who ? who + '’s deck just ran out.' : 'No one’s deck has run out. ' + nm(S, [...Array(S.camp.n).keys()].sort((a, b) => deckSize(S.camp, a) - deckSize(S.camp, b) || S.camp.stars[a] - S.camp.stars[b])[0]) + ' has the smallest deck.';  }
  return '';
}
function legacyRevealHTML(st) {
  const L = CONTENT.legacy.find(x => x.id === st.id), no = legacyNo(st.id), ctx = ctxLine(st);
  let h = '<div class="panel"><span class="eyebrow">The Legacy Deck' + (st.mid ? ' · Hand ' + S.camp.hand + ' is paused' : '') + '</span>';
  if (!ui.flipped) {
    h += '<div class="lcard back"><span class="no">Legacy card ' + no + ' of ' + CONTENT.legacy.length + '</span><span class="trig">' + esc(L.back) + '</span><span class="lg">Last Card</span></div>' +
      '<div class="centeract"><button class="btn primary" data-act="flip">Turn it over</button></div>';
  } else {
    h += '<div class="lcard face"><span class="no">Legacy card ' + no + '</span><h3>' + esc(L.title) + '</h3>' + L.body.map(t => '<p>' + esc(t) + '</p>').join('') + (ctx ? '<p class="ctx">' + esc(ctx) + '</p>' : '') + '</div>' +
      '<div class="centeract"><button class="btn primary" data-act="cont">Do it</button>' + (L.rule ? '<button class="btn" data-act="rulecard" data-id="' + L.rule + '">Read the ' + esc(CONTENT.ruleCards[L.rule].title) + ' rule card</button>' : '') + '</div>';
  }
  return h + '</div>';
}
function boxRevealHTML(st) {
  const B = CONTENT.boxes.find(x => x.id === st.id), ctx = ctxLine(st);
  let h = '<div class="panel"><span class="eyebrow">A sealed box' + (st.mid || (S.game && S.game.phase !== 'over' && S.camp.phase === 'between') ? ' · Hand ' + S.camp.hand + ' is paused' : '') + '</span>';
  if (!ui.flipped) {
    const lid = B.card ? 'A Legacy card says to open it now.' : B.lid;
    h += '<div class="crate"><span class="no">Box ' + B.id + '</span><h3>' + esc(B.name) + '</h3><p class="lidtext">' + esc(lid) + '</p></div><div class="centeract"><button class="btn primary" data-act="flip">Open the box</button></div>';
  } else {
    let body = B.body.map(t => '<p>' + esc(t) + '</p>').join('');
    if (st.id === 'X') body = turnaboutHTML();
    if (st.id === 'IV' || st.id === 'XI') body += '<div class="chips" style="--cw:46px;gap:6px">' + CONTENT.newCards[st.id].map(c => cardHTML(Object.assign({ st: {} }, c), { cw: 46 })).join('') + '</div>';
    h += '<div class="crate open"><span class="no">Box ' + B.id + ' · opened</span><h3>' + esc(B.name) + '</h3>' + body + (ctx ? '<p class="ctx" style="background:rgba(90,62,208,.12);border-radius:8px;padding:8px 10px;font-weight:700">' + esc(ctx) + '</p>' : '') + '</div><div class="centeract"><button class="btn primary" data-act="cont">' + (st.id === 'X' ? 'Turn the tables' : 'Continue') + '</button></div>';
  }
  return h + '</div>';
}
function turnaboutHTML() {
  const camp = S.camp, r = rankByStars(camp), n = camp.n, rows = [];
  const signed = q => deckIds(camp).some(i => camp.cards[i].st.sig === q);
  r.forEach((p, i) => {
    let t;
    if (i === 0) t = 'The Crown Is Heavy: ' + (signed(p) ? 'loses 2 Stars and tears up a card they signed.' : 'loses 3 Stars (no signed card to tear).');
    else if (i === n - 1) t = 'The Underdog: gains 2 Stars and chooses 2 Boons.';
    else if (i === n - 2) t = 'Second Wind: gains 1 Star and signs a card.';
    else t = 'Steady: nothing changes.';
    rows.push('<p><b>' + PLACE[i] + ' · ' + esc(nm(S, p)) + '</b> (' + camp.stars[p] + ' Stars). ' + esc(t) + '</p>');
  });
  return rows.join('');
}
/* One choice in a Boon or Toll list, with every sticker it uses explained underneath. who(s) says whose name a Signature or Grudge would carry. */
function optHTML(act, o, who) {
  return '<button class="opt" data-act="' + act + '" data-id="' + o.id + '"><b>' + esc(o.name) + '</b><span>' + esc(o.text) + '</span>' +
    (o.st || []).map(s => stkExplain(s, who(s))).join('') + '</button>';
}
const ORD = ['first', 'second', 'third', 'fourth'];
function boonsHTML(st) {
  const p = st.p, list = boonList(S, p), picked = st.picked || [];
  const total = st.total != null ? st.total : st.n + picked.length;
  const title = total === 1 ? 'chooses a Boon' : picked.length ? 'chooses a ' + ORD[picked.length] + ' Boon' : 'chooses ' + total + ' Boons';
  const lead = st.why === 'council'
    ? (S.camp.lastRanks[S.camp.n - 1] === p ? 'Last place in Hand ' + S.camp.hand + ' gets ' + (total === 1 ? 'a Boon' : total + ' Boons') + '.' : 'Second to last in Hand ' + S.camp.hand + ' gets 1 Boon.')
    : st.why === 'X' ? 'The Underdog gets a lift.' : 'After an avalanche like that, everyone feels sorry for you.';
  const done = picked.length ? '<p class="picked">' + picked.map((b, i) => ico('i-star') + ' ' + ORD[i].charAt(0).toUpperCase() + ORD[i].slice(1) + ' Boon: <b>' + esc(b) + '</b>').join('<br>') + '</p>' : '';
  return '<div class="panel"><span class="eyebrow">' + esc(whyLabel(st)) + '</span><h2>' + esc(nm(S, p)) + ' ' + title + '</h2><p class="lede">' + esc(lead) + ' Every Boon changes the deck for good.</p>' + done +
    '<div class="opts">' + list.map(b => optHTML('boon', b, s => s === 'sig' ? p : '?')).join('') + '</div></div>';
}
function tollHTML(st) {
  const p = st.p, list = tollList(S, p), last = S.camp.lastRanks[S.camp.n - 1];
  const lastLine = last != null && last !== p ? ' ' + nm(S, last) + ' is in last place.' : '';
  return '<div class="panel"><span class="eyebrow">' + esc(whyLabel(st)) + '</span><h2>' + esc(nm(S, p)) + ' won, and pays a Toll</h2><p class="lede">Winning has a price. Every Toll changes the deck for good.' + esc(lastLine) + '</p>' +
    '<div class="opts">' + list.map(t => optHTML('toll', t, s => s === 'grudge' ? p : t.id === 'muddy' || t.id === 'glued' ? p : last)).join('') + '</div></div>';
}
function taskTitle(st) {
  const sn = st.s ? CONTENT.stickers[st.s].name : '';
  switch (st.t) {
    case 'boons': return 'Choosing ' + st.n + ' Boon' + (st.n === 1 ? '' : 's') + '.';
    case 'toll': return 'Choosing a Toll.';
  }
  switch (st.k) {
    case 'sign': return st.card ? 'Sign the card you went out with' : st.filter === 'new' ? 'Sign one of the new cards' : 'Sign a card';
    case 'sticker': return st.filter === 'own' ? 'Put ' + sn + ' on a card you signed' : 'Put ' + (st.s === 'mud' || st.s === 'glue' ? '' : 'a ') + sn + ' on a card in your deck';
    case 'smudge': return 'Smudge a rival’s card with Mud or Glue';
    case 'mend': return 'Peel a sticker off a card';
    case 'tear': return st.card ? 'Tear up the card that hit you' : st.filter === 'w4' ? 'Tear up a Wild Draw Four' : st.filter === 'own' ? 'Tear up a card you signed' : 'Tear up a card';
    case 'grudge': return st.target != null ? 'Write ' + nm(S, st.target) + '’s name on a Grudge' : 'Put a Grudge on a card';
    case 'anySticker': return 'Put one sticker on any card';
    case 'tape': return 'Tape a Frankencard';
    case 'design': return 'Design a card';
    case 'supply': return st.kind === 'dual' ? 'Add a dual-color card to your deck' + (st.of ? ' (' + st.no + ' of ' + st.of + ')' : '') : st.kind === 'd2' ? 'Add a Draw Two to your deck' : 'Add a Skip or Reverse to your deck';
    case 'blanken': return 'Make a Blankenstein';
    case 'handover': return 'Take a card from ' + nm(S, st.victim) + '’s deck';
    case 'draft': return 'Draft a new card (pick ' + st.no + ' of ' + st.of + ')';
  }
  return '';
}
function taskHelp(st) {
  switch (st.k) {
    case 'sign': return 'Choose a card in your deck. ' + CONTENT.stickers.sig.text;
    case 'supply': return st.kind === 'dual' ? 'Choose a dual-color card from the Supply. ' + CONTENT.kinds.dual.text + ' It goes into your deck for the rest of the campaign.' : 'Choose a card from the Supply. It goes into your deck for the rest of the campaign.';
    case 'blanken': return CONTENT.kinds.blanken.text + ' ' + S.camp.blanks + ' blank card' + (S.camp.blanks === 1 ? ' is' : 's are') + ' left in Box VI.';
    case 'handover': return nm(S, st.victim) + ' won, and pays this Toll. Choose any card in their deck. It moves into yours for the rest of the campaign.';
    case 'draft': return 'Choose one of the new cards for your deck. Then the next player picks.';
    case 'sticker': return (st.filter === 'own' ? 'Choose a card you signed. ' : 'Choose a card in your deck. ') + CONTENT.stickers[st.s].name + ': ' + CONTENT.stickers[st.s].text;
    case 'smudge': return 'Choose a card in a rival’s deck. Mud: ' + CONTENT.stickers.mud.text + ' Glue: ' + CONTENT.stickers.glue.text;
    case 'mend': return 'Choose a card in your deck. Mud, Glue, Plus One, Bomb and Grudge stickers can be peeled off.';
    case 'tear': return st.card ? 'It’s torn out of ' + nm(S, C(S, st.card).own) + '’s deck for good. Its halves go in the Scrap Envelope.' : 'Choose a card in any deck. A torn card is gone for good, and its halves go in the Scrap Envelope.' + (st.why === 'boon' ? ' No deck can go below ' + MIN_DECK + ' cards.' : '');
    case 'grudge': return 'Choose a card in your deck. ' + CONTENT.stickers.grudge.text;
    case 'anySticker': return 'Pick a sticker from any opened box, then a card.';
    case 'tape': return 'Pick one half, then a half from a different torn card. The new card matches either half.';
    case 'design': return 'Choose a color or Wild, then a number or a power, and give it a name. It carries your signature.';
  }
  return '';
}
function taskHTML(st) {
  const p = st.p;
  let h = '<div class="panel"><span class="eyebrow">' + esc(whyLabel(st)) + '</span><h2>' + esc(nm(S, p)) + ': ' + esc(taskTitle(st)) + '</h2><p class="lede">' + esc(taskHelp(st)) + '</p>';
  if ((st.k === 'sign' || st.k === 'tear') && st.card) {
    const card = C(S, st.card);
    h += '<div class="pickinfo">' + cardHTML(card, { cw: 72 }) + '<div><h4>' + esc(cardName(card)) + '</h4><p>' + (st.k === 'sign' ? 'Put ' + esc(nm(S, p)) + '’s signature on this card.' : esc(nm(S, p)) + ' tears it in half.') + '</p></div></div>' +
      '<div class="actions"><button class="btn primary" data-act="taskgo">' + (st.k === 'sign' ? 'Sign it' : 'Tear it up') + '</button></div></div>';
    return h;
  }
  if (st.k === 'tape') return h + tapeHTML(st) + '</div>';
  if (st.k === 'design') return h + designHTML(st) + '</div>';
  if (st.k === 'blanken') return h + blankenHTML(st) + '</div>';
  if (st.k === 'supply') return h + supplyHTML(st) + '</div>';
  const pk = ui.pick;
  let s = null;
  if (st.k === 'smudge') {
    s = pk.s || 'mud';
    h += '<div class="chips">' + ['mud', 'glue'].map(x => '<button class="chip" data-act="pks" data-id="' + x + '" aria-pressed="' + (s === x) + '">' + stkHTML(x).replace('class="stk', 'style="--cw:66px" class="stk') + ' ' + CONTENT.stickers[x].name + '</button>').join('') + '</div>';
  }
  if (st.k === 'anySticker') {
    s = pk.s || null;
    h += '<div class="chips">' + anyStickerKinds(S).map(x => '<button class="chip" data-act="pks" data-id="' + x + '" aria-pressed="' + (s === x) + '">' + stkHTML(x, x === 'grudge' ? others(S, p)[0] : p).replace('class="stk', 'style="--cw:66px" class="stk') + ' ' + CONTENT.stickers[x].name + '</button>').join('') + '</div>';
    if (s) h += '<p class="savenote">' + esc(CONTENT.stickers[s].text) + '</p>';
  }
  const needRival = (st.k === 'grudge' && st.target == null) || (st.k === 'anySticker' && s === 'grudge');
  if (needRival) {
    h += '<div class="field-row"><label>Whose name goes on the Grudge?</label><div class="chips">' + others(S, p).map(q => '<button class="chip" data-act="pkrival" data-id="' + q + '" aria-pressed="' + (pk.target === q) + '">' + esc(nm(S, q)) + ' · ' + S.camp.stars[q] + ' Stars</button>').join('') + '</div></div>';
  }
  if (st.k === 'anySticker' && !s) return h + '<div class="actions"><button class="btn ghost" data-act="taskskip">Skip</button></div></div>';
  const list = taskCards(S, st, s);
  if (!list.length) return h + '<p>No card has room for that.</p><div class="actions"><button class="btn" data-act="taskskip">Skip it</button></div></div>';
  h += pickerHTML(list, p);
  if (pk.card && list.indexOf(pk.card) >= 0) {
    const card = C(S, pk.card);
    let mendChips = '';
    if (st.k === 'mend') {
      const rem = removable(card); const ms = pk.ms && rem.indexOf(pk.ms) >= 0 ? pk.ms : rem[0]; pk.ms = ms;
      mendChips = '<div class="chips">' + rem.map(x => '<button class="chip" data-act="pkms" data-id="' + x + '" aria-pressed="' + (ms === x) + '">' + CONTENT.stickers[x].name + (x === 'grudge' ? ' (' + esc(nm(S, card.st.grudge)) + ')' : '') + '</button>').join('') + '</div>';
    }
    const verb = taskVerb(st, s, card);
    const ready = !needRival || pk.target != null;
    h += '<div class="pickinfo">' + cardHTML(card, { cw: 64, from: p }) + '<div><h4>' + esc(cardName(card)) + '</h4>' + (card.own != null ? '<p><b>' + esc(card.own === p ? 'In your deck.' : 'In ' + nm(S, card.own) + '’s deck.') + '</b></p>' : '') + describeCard(card).map(t => '<p>' + esc(t) + '</p>').join('') + stickerLines(card) + mendChips +
      '<div class="actions" style="margin-top:8px"><button class="btn primary" data-act="taskgo"' + (ready ? '' : ' disabled') + '>' + esc(verb) + '</button></div>' + (ready ? '' : '<p>Choose a name first.</p>') + '</div></div>';
  } else {
    h += '<p class="savenote">Tap a card to choose it. ' + list.length + ' card' + (list.length === 1 ? '' : 's') + ' to choose from.</p>';
  }
  return h + '</div>';
}
function taskVerb(st, s, card) {
  const short = card.k === 'frank' ? 'the Frankencard' : cardName(card);
  switch (st.k) {
    case 'sign': return 'Sign ' + short;
    case 'sticker': return 'Put the ' + CONTENT.stickers[st.s].name + ' on ' + short;
    case 'smudge': return 'Put ' + CONTENT.stickers[s].name + ' on ' + short;
    case 'mend': return 'Peel it off';
    case 'tear': return 'Tear up ' + short;
    case 'grudge': return 'Put the Grudge on ' + short;
    case 'anySticker': return 'Put the ' + CONTENT.stickers[s].name + ' on ' + short;
    case 'handover': return 'Take ' + short + ' into your deck';
    case 'draft': return 'Take ' + short + ' into your deck';
  }
  return 'Done';
}
/* p: whose task it is. When the choices span several decks, there's a chip for each deck and cards from other decks show their owner. */
function pickerHTML(list, p) {
  const f = ui.pick.f || 'all';
  const owners = [...new Set(list.map(id => C(S, id).own).filter(o => o != null))].sort();
  const filters = [['all', 'All']];
  if (owners.length > 1) owners.forEach(o => filters.push(['o' + o, o === p ? 'Your deck' : nm(S, o) + '’s deck']));
  filters.push(['red', 'Red'], ['blue', 'Blue'], ['yellow', 'Yellow'], ['green', 'Green'], ['wild', 'Wild'], ['st', 'Stickered']);
  const shown = list.filter(id => {
    const card = C(S, id);
    if (f === 'all') return true;
    if (f === 'st') return stickerCount(card) > 0;
    if (f.charAt(0) === 'o') return card.own === +f.slice(1);
    return facesOf(card).some(x => x.c === f || x.c2 === f);
  });
  const pool = shown.length ? shown : list;
  return '<div class="chips">' + filters.map(([k, l]) => '<button class="chip" data-act="pkf" data-id="' + k + '" aria-pressed="' + (f === k) + '">' + (COLORS.indexOf(k) >= 0 ? '<i class="dotc" style="background:var(--' + k + ')"></i>' : k.charAt(0) === 'o' ? '<i class="dotc" style="background:var(--own' + k.slice(1) + ')"></i>' : '') + esc(l) + '</button>').join('') + '</div>' +
    '<div class="picker">' + sortHand(pool).map(id => '<button class="cardbtn' + (ui.pick.card === id ? ' sel' : '') + '" data-act="pk" data-id="' + id + '" aria-label="' + esc(cardName(C(S, id))) + '">' + cardHTML(C(S, id), { cw: 46, from: p }) + '</button>').join('') + '</div>';
}
/* Add a Wild / Add an Action: choose a card from the Supply. */
function supplyHTML(st) {
  const keys = supplyList(S.camp, st.kind), pk = ui.pick;
  const mk = k => Object.assign({ st: {} }, supplyCard(k));
  let h = '<div class="picker">' + keys.map(k => '<button class="cardbtn supc' + (pk.key === k ? ' sel' : '') + '" data-act="pkkey" data-id="' + k + '" aria-label="' + esc(cardName(mk(k))) + ', ' + S.camp.supply[k] + ' left">' + cardHTML(mk(k), { cw: 46 }) + '<span class="supn">' + S.camp.supply[k] + ' left</span></button>').join('') + '</div>';
  if (pk.key && keys.indexOf(pk.key) >= 0) {
    const card = mk(pk.key);
    h += '<div class="pickinfo">' + cardHTML(card, { cw: 64 }) + '<div><h4>' + esc(cardName(card)) + '</h4>' + describeCard(card).map(t => '<p>' + esc(t) + '</p>').join('') +
      '<div class="actions" style="margin-top:8px"><button class="btn primary" data-act="taskgo">Shuffle it into your deck</button></div></div></div>';
  } else h += '<p class="savenote">Tap a card to choose it.</p>';
  return h;
}
/* The stickers riding on a torn half. */
function halfStk(x) {
  const st = halfSt(x), ks = STICKER_KEYS.filter(s => st[s] != null);
  return ks.length ? '<span class="hstk" aria-label="Stickers: ' + esc(stickerNames(st)) + '">' + ks.map(s => stkHTML(s, st[s])).join('') + '</span>' : '';
}
function tapeHTML(st) {
  const camp = S.camp, pk = ui.pick, hs = camp.halves.filter(h => !h.used);
  const a = hs.find(h => h.id === pk.ha), b = hs.find(h => h.id === pk.hb);
  let clash = false;
  const list = (which, other) => '<div class="halves">' + hs.map(h => {
    const dis = other && !tapeOK(h, other);
    if (dis && h.from !== other.from) clash = true;
    const pressed = (which === 'ha' ? pk.ha : pk.hb) === h.id;
    return '<button class="halfbtn" data-act="' + which + '" data-id="' + h.id + '" aria-pressed="' + pressed + '"' + (dis ? ' disabled' : '') + '><span class="sw bgs-' + h.f.c + '"></span><span>' + esc(h.name) + ' · ' + (h.side === 'L' ? 'left' : 'right') + ' half</span>' + halfStk(h) + '</button>';
  }).join('') + '</div>';
  let h = '<div class="field-row"><label>First half</label>' + list('ha', b) + '</div><div class="field-row"><label>Second half (from a different card)</label>' + list('hb', a) + '</div>';
  if (clash) h += '<p class="savenote">Some halves are grayed out because their stickers clash. A card can’t have two of the same sticker or more than ' + CONTENT.maxStickers + '.</p>';
  if (a && b) {
    const fr = { k: 'frank', c: a.f.c, h: [a.f, b.f], st: Object.assign({}, halfSt(a), halfSt(b)) };
    h += '<div class="pickinfo">' + cardHTML(fr, { cw: 72 }) + '<div><h4>' + esc(cardName(fr)) + '</h4><p>' + esc(CONTENT.kinds.frank.text) + '</p><div class="actions" style="margin-top:8px"><button class="btn primary" data-act="taskgo">Tape them together</button></div></div></div>';
  }
  return h;
}
/* Color, number-or-power and name: shared by Design a Card and a Blankenstein's drawn half. Blank cards are never Wild. */
function designControls(d) {
  if (d.c === 'wild' || COLORS.indexOf(d.c) < 0) d.c = 'blue';
  if (d.eff === 'none') d.eff = 'num';
  let h = '<div class="field-row"><label>Color</label><div class="chips">' + COLORS.map(c => '<button class="chip" data-act="dc" data-id="' + c + '" aria-pressed="' + (d.c === c) + '"><i class="dotc" style="background:var(--' + c + ')"></i>' + colorName(c) + '</button>').join('') + '</div><p class="savenote">Blank cards can’t be Wild.</p></div>';
  const opts = [['num', 'A number']].concat(CONTENT.powers.map(k => [k, CONTENT.kinds[k].name]));
  h += '<div class="field-row"><label>What it does</label><div class="chips">' + opts.map(([k, l]) => '<button class="chip" data-act="de" data-id="' + k + '" aria-pressed="' + (d.eff === k) + '">' + esc(l) + '</button>').join('') + '</div>' +
    '<p class="savenote">' + esc(d.eff === 'num' ? 'A number card. It matches its color, or the same number. Numbers 6 to 12 only exist on cards you make.' : CONTENT.kinds[d.eff].text) + '</p></div>';
  if (d.eff === 'num') h += '<div class="field-row"><label>Number</label><div class="stepper"><button class="btn" data-act="dn" data-id="-1" aria-label="Lower">−</button><b>' + d.n + '</b><button class="btn" data-act="dn" data-id="1" aria-label="Higher">+</button></div></div>';
  h += '<div class="field-row"><label for="dname">Name</label><input id="dname" class="textin" maxlength="18" placeholder="Give it a name" value="' + esc(d.nm) + '" autocomplete="off"></div>';
  return h;
}
function designHTML(st) {
  const pk = ui.pick;
  if (!pk.design) pk.design = { c: 'blue', eff: 'swap', n: 11, nm: '' };
  const d = pk.design; d.p = st.p;
  let h = '<div class="builder"><div style="display:flex;flex-direction:column;gap:12px;min-width:0">' + designControls(d);
  h += '<div class="actions"><button class="btn primary" data-act="taskgo">Shuffle it into your deck</button></div>';
  h += '</div><div class="preview" id="dpreview">' + designPreview() + '</div></div>';
  return h;
}
/* The Blankenstein the player is building: their drawn half on the left, the torn half they picked on the right. */
function blankenCard() {
  const d = ui.pick.design, half = S.camp.halves.find(x => x.id === ui.pick.half);
  const face = d.eff === 'num' ? { c: d.c, k: 'num', n: d.n } : { c: d.c, k: d.eff };
  if (d.nm) face.nm = d.nm;
  return { k: 'frank', blank: true, c: d.c, h: [face, half ? half.f : { c: 'wild', k: 'num', n: '?' }], st: Object.assign({}, halfSt(half)) };
}
function designPreview() {
  const st = S.camp.queue[0];
  return st && st.k === 'blanken' ? cardHTML(blankenCard(), { cw: 110 }) : previewCard(ui.pick.design);
}
function blankenHTML(st) {
  const pk = ui.pick;
  if (!pk.design) pk.design = { c: 'red', eff: 'num', n: 7, nm: '' };
  const d = pk.design; d.p = st.p;
  const hs = S.camp.halves.filter(x => !x.used);
  let h = '<div class="field-row"><label>Torn half to tape on (the right side)</label><div class="halves">' + hs.map(x => '<button class="halfbtn" data-act="bh" data-id="' + x.id + '" aria-pressed="' + (pk.half === x.id) + '"><span class="sw bgs-' + x.f.c + '"></span><span>' + esc(faceName(x.f)) + (x.name !== faceName(x.f) ? ' · from ' + esc(x.name) : '') + ' · ' + (x.side === 'L' ? 'left' : 'right') + ' half</span>' + halfStk(x) + '</button>').join('') + '</div></div>';
  h += '<div class="builder"><div style="display:flex;flex-direction:column;gap:12px;min-width:0"><h4 style="margin:0">Your half (the left side)</h4>' + designControls(d) +
    '<div class="actions"><button class="btn primary" data-act="taskgo"' + (pk.half ? '' : ' disabled') + '>Tape it and shuffle it into your deck</button></div>' + (pk.half ? '' : '<p class="savenote">Pick a torn half first.</p>') +
    '</div><div class="preview" id="dpreview">' + designPreview() + '</div></div>';
  return h;
}
function finalHTML(pending) {
  const camp = S.camp, r = rankByStars(camp), top = camp.stars[r[0]];
  const champs = r.filter(p => camp.stars[p] === top);
  let h = '<div class="panel champ">' + ico('s-crown', 'crownbig') + '<span class="eyebrow">The campaign is over</span><h2>' + champs.map(p => esc(nm(S, p))).join(' and ') + (champs.length > 1 ? ' share the win' : ' wins the campaign') + '</h2>' +
    '<p class="lede">The champion signs the inside of Box VII’s lid. The deck keeps every sticker, tear and new card.</p><div class="results" style="width:100%;max-width:480px">';
  r.forEach((p, i) => { h += '<div class="rrow"><span class="place">' + PLACE[i] + '</span><span class="rn">' + esc(nm(S, p)) + '</span><span class="rgain">' + camp.stars[p] + ' ' + ico('i-star') + '</span><span class="rsub">' + camp.wins[p] + ' hand' + (camp.wins[p] === 1 ? '' : 's') + ' won</span></div>'; });
  h += '</div><div class="actions">' + (pending ? '<button class="btn primary" data-act="cont">Finish the campaign</button>' : '<button class="btn" data-act="newcamp">Start a new campaign</button>') + '</div></div>';
  return h;
}

/* ---------- the shelf ---------- */
function sideHTML() {
  const tabs = [['legacy', 'Legacy'], ['deck', 'Deck'], ['rules', 'Rules'], ['story', 'Story']];
  let body = '';
  if (ui.tab === 'legacy') body = legacyTab();
  else if (ui.tab === 'deck') body = deckTab();
  else if (ui.tab === 'rules') body = rulesTab();
  else body = storyTab();
  return '<aside class="side"><div class="tabs" role="tablist">' + tabs.map(([id, l]) => '<button class="tab" role="tab" data-act="tab" data-id="' + id + '" aria-selected="' + (ui.tab === id) + '">' + l + '</button>').join('') + '</div><div class="shelf">' + body + '</div></aside>';
}
function legacyTab() {
  const camp = S.camp;
  const down = CONTENT.legacy.filter(L => camp.turned.indexOf(L.id) < 0);
  const up = CONTENT.legacy.filter(L => camp.turned.indexOf(L.id) >= 0);
  let h = '<div><h3>The Legacy Deck</h3><p class="sub">' + down.length + ' card' + (down.length === 1 ? '' : 's') + ' still face down. Everyone can read the backs.</p></div>';
  if (down.length) h += '<div class="backs">' + down.map(L => '<div class="minil"><b>Card ' + legacyNo(L.id) + '</b>' + esc(L.back) + '</div>').join('') + '</div>';
  if (up.length) h += '<div style="display:flex;flex-direction:column;gap:6px">' + up.map(L => '<details class="rc"><summary>' + esc(L.title) + '<small>Card ' + legacyNo(L.id) + '</small></summary>' + L.body.map(t => '<p>' + esc(t) + '</p>').join('') + '</details>').join('') + '</div>';
  h += '<div><h3>Sealed Boxes</h3><p class="sub">' + camp.opened.length + ' of ' + CONTENT.boxes.length + ' opened.</p></div><div class="boxes">' + CONTENT.boxes.map(B => {
    const open = camp.opened.indexOf(B.id) >= 0;
    if (!open) return '<div class="box sealed"><span class="bno">Box ' + B.id + '</span><b>' + esc(B.name) + '</b><span>' + esc(B.lid) + '</span></div>';
    return '<details class="box opened"><summary style="cursor:pointer;list-style:none"><span class="bno">Box ' + B.id + ' · opened</span><br><b>' + esc(B.name) + '</b></summary>' + B.body.map(t => '<p style="margin-top:4px">' + esc(t) + '</p>').join('') + '</details>';
  }).join('') + '</div>';
  return h;
}
function deckTab() {
  const camp = S.camp, ids = deckIds(camp), torn = camp.order.filter(i => camp.cards[i].torn), n = camp.n;
  if (ui.deckF === 'all' || !ui.deckF) ui.deckF = 'o' + (humans(S)[0] != null ? humans(S)[0] : 0);
  const f = ui.deckF;
  let pool;
  if (f === 'torn') pool = torn;
  else if (f === 'st') pool = ids.filter(i => stickerCount(camp.cards[i]));
  else pool = ownDeck(camp, +f.slice(1));
  const ledger = list => '<div class="ledger">' + list.map(id => '<button class="cardbtn' + (ui.deckSel === id ? ' sel' : '') + '" data-act="deckcard" data-id="' + id + '" aria-label="' + esc(cardName(camp.cards[id])) + '">' + cardHTML(camp.cards[id], { cw: 42, from: f.charAt(0) === 'o' ? +f.slice(1) : -1 }) + '</button>').join('') + '</div>';
  const wilds = q => ownDeck(camp, q).filter(i => facesOf(camp.cards[i]).some(isWildF)).length;
  let h = '<div><h3>The Decks</h3><p class="sub">Everyone draws from their own deck. Every card remembers what happened to it.</p></div>' +
    '<div class="decknums">' + [...Array(n).keys()].map(q => '<div style="border-top:4px solid var(--own' + q + ')"><b>' + deckSize(camp, q) + '</b><span>' + esc(nm(S, q)) + '’s deck · ' + wilds(q) + ' Wild' + (wilds(q) === 1 ? '' : 's') + '</span></div>').join('') +
    '<div><b>' + torn.length + '</b><span>torn up</span></div></div>';
  h += '<div class="chips">' + [...Array(n).keys()].map(q => ['o' + q, nm(S, q)]).concat([['st', 'Stickered'], ['torn', 'Torn up']]).map(([k, l]) => '<button class="chip" data-act="deckf" data-id="' + k + '" aria-pressed="' + (f === k) + '">' + (k.charAt(0) === 'o' ? '<i class="dotc" style="background:var(--own' + k.slice(1) + ')"></i>' : '') + esc(l) + '</button>').join('') + '</div>';
  if (!pool.length) h += '<p class="sub">' + (f === 'torn' ? 'Nothing has been torn up yet.' : 'No cards like that yet.') + '</p>';
  else h += ledger(f === 'torn' ? pool : sortHand(pool));
  const sup = camp.supply || {}, count = kind => Object.keys(sup).filter(k => supplyKind(k) === kind).reduce((s, k) => s + sup[k], 0);
  h += '<p class="sub">The Supply holds ' + count('dual') + ' dual-color cards, ' + count('d2') + ' Draw Twos and ' + count('action') + ' Skips and Reverses for the Add Boons. There are no spare Wilds.</p>';
  if (ui.deckSel && camp.cards[ui.deckSel]) {
    const card = camp.cards[ui.deckSel];
    h += '<div class="pickinfo">' + cardHTML(card, { cw: 64 }) + '<div><h4>' + esc(cardName(card)) + '</h4>' + describeCard(card).map(t => '<p>' + esc(t) + '</p>').join('') + stickerLines(card) + (cardMeta(card) ? '<p>' + esc(cardMeta(card)) + '</p>' : '') + '</div></div>';
  }
  const hs = camp.halves;
  if (hs.length) h += '<div><h3 style="font-size:18px">The Scrap Envelope</h3><p class="sub">' + hs.filter(x => !x.used).length + ' loose halves' + (camp.rules.tape ? ', ready for tape.' : '. Something in a sealed box may use them.') + '</p></div><div class="halves">' + hs.map(x => '<div class="halfbtn" style="cursor:default' + (x.used ? ';opacity:.45' : '') + '"><span class="sw bgs-' + x.f.c + '"></span><span>' + esc(x.name) + ' · ' + (x.side === 'L' ? 'left' : 'right') + (x.used ? ' (taped)' : '') + '</span>' + (x.used ? '' : halfStk(x)) + '</div>').join('') + '</div>';
  if (camp.rules.design) h += '<p class="sub">' + camp.blanks + ' blank card' + (camp.blanks === 1 ? '' : 's') + ' left in Box VI.</p>';
  return h;
}
function rulesTab() {
  const R = S.camp.rules;
  let h = '<div><h3>How a hand works</h3></div><ul class="rules">' +
    '<li>Everyone has their own deck. Shuffle it and draw 7. Everyone plays onto one shared pile in the middle.</li>' +
    '<li>On your turn, play a card that matches the top card’s color, number or symbol, or play a Wild.</li>' +
    '<li>Can’t or don’t want to play? Draw a card from your own deck. If you can play it, you may play it right away.</li>' +
    '<li>Skip, Reverse and Draw Two do what they say. A Wild lets you choose the color. A Wild Draw Four also makes the next player draw 4 from their deck and lose their turn.</li>' +
    '<li>If your deck runs out, take your own cards out of the middle pile (leave the top card), shuffle them, and keep drawing.</li>' +
    '<li>When the hand ends, everyone takes back their own cards, even ones that ended up in someone else’s hand.</li>' +
    '<li>When you go down to one card, tap <b>Last card!</b>. You can tap it before you play, or right after, until the next player starts their turn. When you pass the phone, that means before they open their hand. Forget, and you draw 2.</li>' +
    '<li>The first player with no cards wins the hand. Everyone else is ranked by the points left in their hand: numbers count their value, action cards 20, Wilds 50.</li>' +
    '<li>Stars: ' + (S.camp.n === 4 ? '3 for 1st, 2 for 2nd, 1 for 3rd' : S.camp.n === 3 ? '3 for 1st, 1 for 2nd' : '3 for the winner') + '. After ' + CONTENT.hands + ' hands, the most Stars wins the campaign.</li>' +
    '<li>The player with the fewest Stars goes first in each hand.</li></ul>';
  const now = [];
  if (R.council) now.push('The Council: after every hand, last place chooses 2 Boons' + (S.camp.n >= 3 ? ', the player above last chooses 1' : '') + ', and the winner pays a Toll.');
  if (R.sign) now.push('Signatures: play a card you signed and you may play one more card right away.');
  if (R.tear) now.push('Tear It Up is a Boon.');
  if (R.handTear) now.push('Torn Hands: when a hand ends, everyone except the winner tears up the ' + CONTENT.handTear + ' highest-point cards left in their hand. A deck never drops below ' + MIN_DECK + ' cards.');
  if (R.stack) now.push('Stackable Draws: when someone plays a Draw card on you, block it by playing a Draw card of your own on top. The next player then draws the total of the whole stack, unless they block it too.');
  if (R.sign) now.push('Signed Draw cards: when you play a Draw card you signed, you still get your extra card. The next player draws after that' + (R.stack ? ', and can still stack on it' : '') + '. If your extra card is a Skip or Reverse, the draw goes to whoever is next after it.');
  if (R.blanken) now.push('Blankensteins: half a blank card you design, taped to a torn half. Blankenstein is a Boon while blank cards and halves last.');
  if (R.sevenZero) now.push('Fives and Zeros: a 5 trades hands with any player. A 0 passes every hand along. Cards still go back to their owners when the hand ends.');
  if (R.crown) now.push('Crowns: play a Crown card and earn 1 Star on the spot.');
  if (R.tape) now.push('Tape is a Boon. Frankencards match either half.');
  if (R.design) now.push('Design a Card is a Boon while blank cards last.');
  if (R.autograph) now.push('Autographs: go out on a card you signed and earn 2 extra Stars.');
  if (R.final) now.push('The Last Hand: every Star counts double.');
  const cards = Object.keys(CONTENT.ruleCards).filter(k => R[CONTENT.ruleCards[k].unlock]);
  if (cards.length) h += '<div><h3>Rule cards</h3><p class="sub">Reference cards that joined the rules during the campaign.</p></div>' + cards.map(ruleCardHTML).join('');
  h += '<div><h3>Rules in play now</h3><p class="sub">These came from the Legacy Deck and the boxes.</p></div>' + (now.length ? '<ul class="rules">' + now.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '<p class="sub">None yet. The first one arrives when the first hand ends.</p>');
  const known = ['plus', 'mud', 'glue'];
  if (R.sign) known.unshift('sig');
  if (R.grudge) known.push('grudge');
  if (R.crown) known.push('crown');
  if (R.rainbow) known.push('rainbow');
  if (R.bomb) known.push('bomb');
  h += '<div><h3>Stickers</h3></div><div class="gloss">' + known.map(s => '<div>' + stkHTML(s, s === 'sig' || s === 'grudge' ? 0 : 1).replace('class="stk', 'style="--cw:88px" class="stk') + '<span><b>' + CONTENT.stickers[s].name + '.</b> ' + esc(CONTENT.stickers[s].text) + '</span></div>').join('') + '</div>' +
    '<p class="sub">A card holds up to ' + CONTENT.maxStickers + ' stickers, and only one of each kind.</p>';
  const kinds = {};
  deckIds(S.camp).forEach(i => facesOf(C(S, i)).forEach(f => { const k = actOf(f); if (['boom', 'encore', 'thief', 'gift', 'mirror', 'swap', 'all1', 'pick2'].indexOf(k) >= 0) kinds[k] = 1; }));
  if (S.camp.order.some(i => C(S, i).k === 'frank' && !C(S, i).blank && !C(S, i).torn)) kinds.frank = 1;
  if (S.camp.order.some(i => C(S, i).k === 'frank' && C(S, i).blank && !C(S, i).torn)) kinds.blanken = 1;
  if (deckIds(S.camp).some(i => isDual(C(S, i)))) kinds.dual = 1;
  const ks = Object.keys(kinds);
  if (ks.length) h += '<div><h3>New kinds of card</h3></div><ul class="rules">' + ks.map(k => '<li><b>' + CONTENT.kinds[k].name + '.</b> ' + esc(CONTENT.kinds[k].text) + '</li>').join('') + '</ul>';
  return h;
}
function storyTab() {
  const camp = S.camp;
  let h = '<div><h3>Standings</h3></div>';
  if (camp.history.length) {
    h += '<div class="histwrap"><table class="hist"><thead><tr><th>Player</th>' + camp.history.map(r => '<th>' + r.h + '</th>').join('') + '<th>Stars</th></tr></thead><tbody>' +
      rankByStars(camp).map(p => '<tr><td>' + esc(nm(S, p)) + '</td>' + camp.history.map(r => '<td>' + (r.order[0] === p ? '<b>' + r.gain[p] + '</b>' : r.gain[p]) + '</td>').join('') + '<td><b>' + camp.stars[p] + '</b></td></tr>').join('') + '</tbody></table></div>' +
      '<p class="sub">Stars from each hand’s finish. Crowns, Tolls and the Turnabout change the total too.</p>';
  } else h += '<p class="sub">No hands finished yet.</p>';
  h += '<div><h3>The story so far</h3></div>';
  const byHand = {};
  camp.log.forEach(l => { (byHand[l.h] = byHand[l.h] || []).push(l); });
  const hs = Object.keys(byHand).map(Number).sort((a, b) => b - a);
  h += hs.length ? '<div class="log">' + hs.map(k => '<div><h4>' + (k ? 'Hand ' + k : 'Before the first hand') + '</h4><ul>' + byHand[k].slice().reverse().map(l => '<li class="k-' + l.k + '">' + esc(l.t) + '</li>').join('') + '</ul></div>').join('') + '</div>' : '<p class="sub">Nothing has happened yet.</p>';
  h += '<div><h3>Seats</h3><p class="sub">Switch any seat between a person and the computer at any time, even mid-hand. You can also tap a player’s box at the top of the screen.</p></div><div>' + camp.names.map((n, p) => '<div class="seatrow"><span><b>' + esc(n) + '</b></span><button class="chip" data-act="bot" data-id="' + p + '" aria-pressed="' + !!camp.bots[p] + '">' + (camp.bots[p] ? 'Computer' : 'Person') + '</button></div>').join('') + '</div>';
  h += '<p class="savenote">' + (storeKind === 'db' ? 'The campaign saves to this page, so it picks up where you left off on any device you open it on.' : 'The campaign saves in this browser.') + '</p>';
  h += ui.confirm ? confirmHTML() : '<div class="actions"><button class="btn danger" data-act="reset">Start over</button></div>';
  return h;
}
function confirmHTML() { return '<div class="confirm"><span>' + esc(ui.confirm.text) + '</span><button class="btn danger" data-act="confirmyes">' + esc(ui.confirm.yes) + '</button><button class="btn" data-act="confirmno">Cancel</button></div>'; }

/* ---------- setup ---------- */
function setupHTML() {
  const su = ui.setup;
  const fan = [{ c: 'red', k: 'num', n: 7, st: {} }, { c: 'blue', k: 'skip', st: { crown: 1 } }, { c: 'wild', k: 'w4', st: {} }, { c: 'yellow', k: 'num', n: 3, st: { mud: 1 } }, { k: 'frank', c: 'green', h: [{ c: 'green', k: 'num', n: 5 }, { c: 'red', k: 'd2' }], st: {} }];
  let h = '<div class="shell">' + '<header class="top"><div class="wordmark">Last Card <span class="tag">Legacy</span></div></header><div class="setup">' +
    '<div class="hero-fan" aria-hidden="true">' + fan.map(c => cardHTML(c, { cw: 64 }).replace('class="card', 'style="transform:rotate(' + (fan.indexOf(c) * 5 - 10) + 'deg)" class="card')).join('') + '</div>' +
    '<p class="lede">A shedding card game that remembers. Everyone builds their own deck and plays onto one shared pile. Over ' + CONTENT.hands + ' hands, players sign cards, stick stickers on them, tear them in half, tape the halves together and invent new ones. Fourteen Legacy cards and twelve sealed boxes wait for the right moment.</p>' +
    '<div class="field-row"><label>Players</label><div class="chips">' + [2, 3, 4].map(n => '<button class="chip" data-act="setn" data-id="' + n + '" aria-pressed="' + (su.n === n) + '">' + n + ' players</button>').join('') + '</div></div>' +
    '<div class="seats">';
  for (let p = 0; p < su.n; p++) {
    h += '<div class="seat"><label for="seat' + p + '">Seat ' + (p + 1) + '</label><input id="seat' + p + '" class="textin" data-seat="' + p + '" maxlength="16" placeholder="' + (su.bots[p] ? 'Computer ' + (p + 1) : 'Name') + '" value="' + esc(su.names[p]) + '" autocomplete="off">' +
      '<div class="chips"><button class="chip" data-act="setbot" data-id="' + p + '" aria-pressed="' + !su.bots[p] + '">Person</button><button class="chip" data-act="setbot" data-id="' + p + '" aria-pressed="' + !!su.bots[p] + '">Computer</button></div></div>';
  }
  h += '</div><p class="savenote">With more than one person at the table, hands stay hidden until you pass the device. You can switch any seat later.</p>' +
    '<div class="actions"><button class="btn primary" data-act="start">Shuffle up and deal</button></div></div></div>';
  return h;
}

/* ---------- render ---------- */
function render() {
  try { renderInner(); }
  catch (e) {
    document.getElementById('app').innerHTML = '<div class="shell"><header class="top"><div class="wordmark">Last Card <span class="tag">Legacy</span></div></header><div class="panel"><h2>Something went wrong drawing the game</h2><p>Your campaign is saved. Send this message to Claude so it can be fixed:</p><pre style="white-space:pre-wrap;font-size:13px">' + esc(String(e && e.stack || e)).slice(0, 1400) + '</pre></div></div>';
  }
}
function renderInner() {
  const app = document.getElementById('app');
  if (!S) { app.innerHTML = setupHTML(); document.getElementById('sheet-root').innerHTML = ''; return; }
  const camp = S.camp;
  if (camp.phase === 'play' && S.game && camp.hand !== ui.lastHand) { ui.lastHand = camp.hand; ui.shown = -1; ui.sel = null; }
  /* Coming back from a mid-hand Legacy card: whoever held the phone for it shouldn't see the next hand by accident. */
  if (camp.phase === 'play' && ui.lastPhase === 'between' && S.game && S.game.phase !== 'over' && humans(S).length > 1) { ui.shown = -1; ui.sel = null; }
  ui.lastPhase = camp.phase;
  if (camp.phase !== 'between') ui.flipped = ui.flipped && false;
  let field;
  if (camp.phase === 'ended') field = finalHTML(false);
  else if (camp.phase === 'between') field = betweenHTML();
  else field = tableHTML();
  app.innerHTML = '<div class="shell">' + topHTML() + playersHTML() + '<main class="table"><section class="field">' + field + '</section>' + sideHTML() + '</main></div>';
  document.getElementById('sheet-root').innerHTML = sheetHTML();
  const drew = document.getElementById('drew');
  if (drew && ui.drewFor !== S.game.drawnCard) {
    ui.drewFor = S.game.drawnCard;
    const r = drew.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      drew.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
    }
  }
  scheduleBots();
}
function renderSoft() { render(); }

/* ---------- computers ---------- */
function scheduleBots() {
  clearTimeout(botTimer); botTimer = null;
  if (!S || ui.sheet) return;
  const camp = S.camp, allBots = !humans(S).length;
  if (camp.phase === 'play') {
    const G = S.game;
    const ow = owesCall(S), waitForCall = ow >= 0 && !isBot(S, ow);
    if (G && G.phase !== 'over' && isBot(S, G.turn)) botTimer = setTimeout(botTick, waitForCall ? 2600 : allBots ? 450 : 850);
  } else if (camp.phase === 'between') {
    const a = stepActor(S);
    if (a >= 0 && isBot(S, a)) botTimer = setTimeout(stepTick, 900);
    else if (a < 0 && allBots) botTimer = setTimeout(stepTick, 1800);
  }
}
function botTick() {
  botTimer = null;
  if (!S || S.camp.phase !== 'play') return;
  const G = S.game; if (!G || G.phase === 'over' || !isBot(S, G.turn)) return;
  const a = botAction(S);
  runBotAction(S, a);
  afterChange();
}
function stepTick() {
  botTimer = null;
  if (!S || S.camp.phase !== 'between') return;
  const a = stepActor(S);
  if (a >= 0 && isBot(S, a)) botStep(S);
  else if (a < 0 && !humans(S).length) { if (!ui.flipped && (S.camp.queue[0].t === 'card' || S.camp.queue[0].t === 'box')) { ui.flipped = true; render(); return; } ui.flipped = false; stepContinue(S); }
  else return;
  ui.pick = {};
  afterChange();
}

/* ---------- input ---------- */
function newGameFromSetup() {
  const su = ui.setup, names = [], bots = [];
  for (let p = 0; p < su.n; p++) { names.push((su.names[p] || '').trim() || (su.bots[p] ? 'Computer ' + (p + 1) : 'Player ' + (p + 1))); bots.push(!!su.bots[p]); }
  S = { camp: newCampaign(names, bots), game: null };
  advance(S);
  ui.lastHand = 0; ui.tab = 'legacy';
  afterChange();
}
const H = {
  setn: el => { ui.setup.n = +el.dataset.id; render(); },
  setbot: el => { const p = +el.dataset.id; ui.setup.bots[p] = el.textContent === 'Computer'; render(); },
  start: () => newGameFromSetup(),
  tab: el => { ui.tab = el.dataset.id; ui.confirm = null; render(); },
  card: el => {
    const id = el.dataset.id, G = S.game;
    if (ui.sel === id && G && handOwner() === G.turn && playableFaces(S, G.turn, id).length) { startPlay(id); return; }
    ui.sel = ui.sel === id ? null : id; render();
  },
  playsel: () => { if (ui.sel) startPlay(ui.sel); },
  playdrawn: () => { const G = S.game; if (!G || G.phase !== 'drawn' || handOwner() !== G.turn) return; ui.sel = null; startPlay(G.drawnCard); },
  draw: () => { const G = S.game; if (!G || handOwner() !== G.turn) return; ui.sel = null; lockUndo(); act(S, { t: 'draw', p: G.turn }); afterChange(); },
  pass: () => { const G = S.game; if (handOwner() !== G.turn) return; ui.sel = null; lockUndo(); act(S, { t: 'pass', p: G.turn }); afterChange(); },
  take: () => { const G = S.game; if (handOwner() !== G.turn) return; ui.sel = null; lockUndo(); act(S, { t: 'take', p: G.turn }); afterChange(); },
  call: () => { const G = S.game; lockUndo(); act(S, { t: 'call', p: G.turn }); toast('Last card!'); afterChange(); },
  redo: () => { const G = S.game; ui.sel = null; lockUndo(); act(S, { t: 'redo', p: G.turn }); toast('A fresh hand.'); afterChange(); },
  handed: el => { ui.handedTo = +el.dataset.id; ui.pick = {}; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  undo: () => {
    const u = ui.undo.pop(); if (!u) return;
    S = JSON.parse(u.s);
    ui.pick = {}; ui.flipped = false; ui.sheet = null; ui.play = null; ui.sel = null; ui.shown = -1; ui.lastHand = 0; ui.handedTo = null;
    toast('Undone: ' + u.label);
    afterChange();
  },
  reveal: () => { settleCall(S); checkMid(S); ui.shown = S.game.turn; ui.sel = null; afterChange(); },
  latecall: el => { lockUndo(); act(S, { t: 'call', p: +el.dataset.id }); toast('Last card!'); afterChange(); },
  half: el => { ui.play.fi = +el.dataset.id; ui.sheet = null; continuePlay(); },
  color: el => { ui.play.ch.color = el.dataset.id; ui.sheet = null; continuePlay(); },
  giftc: el => { ui.play.ch.gift = el.dataset.id; ui.sheet = null; continuePlay(); },
  target: el => { ui.play.ch.target = +el.dataset.id; ui.sheet = null; continuePlay(); },
  sheetcancel: () => { ui.sheet = null; ui.play = null; render(); },
  flip: () => { ui.flipped = true; render(); },
  cont: () => { ui.flipped = false; ui.pick = {}; stepContinue(S); afterChange(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  boon: el => {
    const st = S.camp.queue[0], B = CONTENT.boons.find(b => b.id === el.dataset.id);
    pushUndo(nm(S, st.p) + '’s Boon: ' + B.name);
    ui.pick = {};
    if (!chooseBoon(S, el.dataset.id)) ui.undo.pop();
    afterChange();
  },
  toll: el => {
    const st = S.camp.queue[0], T = CONTENT.tolls.find(t => t.id === el.dataset.id);
    pushUndo(nm(S, st.p) + '’s Toll: ' + T.name);
    ui.pick = {};
    if (!chooseToll(S, el.dataset.id)) ui.undo.pop();
    afterChange();
  },
  pk: el => { ui.pick.card = el.dataset.id; ui.pick.ms = null; render(); },
  pkkey: el => { ui.pick.key = el.dataset.id; render(); },
  pkf: el => { ui.pick.f = el.dataset.id; render(); },
  pks: el => { ui.pick.s = el.dataset.id; ui.pick.card = null; render(); },
  pkms: el => { ui.pick.ms = el.dataset.id; render(); },
  pkrival: el => { ui.pick.target = +el.dataset.id; render(); },
  ha: el => { ui.pick.ha = el.dataset.id; render(); },
  hb: el => { ui.pick.hb = el.dataset.id; render(); },
  bh: el => { ui.pick.half = el.dataset.id; render(); },
  dc: el => { const d = ui.pick.design; d.c = el.dataset.id; if (d.c === 'wild' && d.eff === 'num') d.eff = 'none'; if (d.c !== 'wild' && d.eff === 'none') d.eff = 'num'; render(); },
  de: el => { ui.pick.design.eff = el.dataset.id; render(); },
  dn: el => { const d = ui.pick.design; d.n = Math.max(0, Math.min(12, d.n + (+el.dataset.id))); render(); },
  taskgo: () => {
    const st = S.camp.queue[0], pk = ui.pick; if (!st) return;
    const sel = { card: pk.card, s: st.k === 'mend' ? pk.ms : (pk.s || (st.k === 'smudge' ? 'mud' : null)), target: pk.target };
    if (st.k === 'tape') sel.halves = [pk.ha, pk.hb];
    if (st.k === 'supply') sel.key = pk.key;
    if (st.k === 'design') { const d = pk.design; const inp = document.getElementById('dname'); if (inp) d.nm = inp.value; sel.design = { c: d.c, eff: d.eff, n: d.n, nm: d.nm || defaultName(d) }; }
    if (st.k === 'blanken') { const d = pk.design; const inp = document.getElementById('dname'); if (inp) d.nm = inp.value; sel.design = { c: d.c, eff: d.eff, n: d.n, nm: d.nm }; sel.half = pk.half; }
    pushUndo(nm(S, st.p) + ': ' + taskTitle(st));
    if (doTask(S, sel)) { ui.pick = {}; afterChange(); }
    else { ui.undo.pop(); toast('That choice doesn’t fit. Pick again.'); }
  },
  taskskip: () => { const st = S.camp.queue[0]; pushUndo(nm(S, st.p) + ' skipping: ' + taskTitle(st)); ui.pick = {}; skipTask(S); afterChange(); },
  deckf: el => { ui.deckF = el.dataset.id; ui.deckSel = null; render(); },
  deckcard: el => { ui.deckSel = ui.deckSel === el.dataset.id ? null : el.dataset.id; render(); },
  bot: el => { const p = +el.dataset.id; setSeat(p, !S.camp.bots[p]); },
  seat: el => { ui.sheet = { k: 'seat', p: +el.dataset.id }; ui.play = null; render(); },
  rulecard: el => { ui.sheet = { k: 'rulecard', id: el.dataset.id }; ui.play = null; render(); },
  setseat: el => { const [p, b] = el.dataset.id.split(':').map(Number); setSeat(p, b === 1); },
  reset: () => { ui.confirm = { text: 'Erase the whole campaign? Every sticker, tear and new card goes back in the box.', yes: 'Erase it', fn: wipe }; render(); },
  newcamp: () => { ui.confirm = { text: 'Start a fresh campaign with a brand-new deck?', yes: 'Start over', fn: wipe }; ui.tab = 'story'; render(); },
  confirmyes: () => { const f = ui.confirm && ui.confirm.fn; ui.confirm = null; if (f) f(); else render(); },
  confirmno: () => { ui.confirm = null; render(); }
};
/* Switch a seat between a person and the computer. Works mid-hand and between hands; the computer picks up wherever that seat is. */
function setSeat(p, bot) {
  const camp = S.camp;
  ui.sheet = null; ui.play = null; ui.sel = null;
  if (!!camp.bots[p] === bot) { render(); return; }
  if (bot && humans(S).length === 1) { toast('At least one seat has to be a person.'); render(); return; }
  camp.bots[p] = bot;
  if (bot && ui.handedTo === p) ui.handedTo = null;
  toast(nm(S, p) + (bot ? ' is now played by the computer.' : ' is back in human hands.'));
  afterChange();
}
function defaultName(d) { const list = CONTENT.botNames[d.eff] || ['Mystery']; return d.eff === 'num' ? list[0] + ' ' + d.n : list[0]; }
/* Clears the campaign on this device and goes back to the setup screen, keeping the old seats filled in. */
function dropCampaign(msg) {
  if (S) {
    const allPeople = !S.camp.bots.some(Boolean);
    ui.setup.n = S.camp.n;
    ui.setup.bots = S.camp.bots.concat([!allPeople, !allPeople, !allPeople, !allPeople]).slice(0, 4);
    ui.setup.names = S.camp.names.concat(['', '', '', '']).slice(0, 4).map((n, i) => ui.setup.bots[i] && /^Computer \d$/.test(n) ? '' : n);
  }
  S = null; ui.sel = null; ui.pick = {}; ui.flipped = false; ui.sheet = null; ui.play = null; ui.confirm = null; ui.undo = []; ui.handedTo = null;
  try { localStorage.removeItem(LS_KEY); } catch (e) {}
  render();
  if (msg) toast(msg);
}
function wipe() {
  const ended = S ? started(S) : Date.now();
  dropCampaign();
  if (dbRef) dbWrite({ v: 1, reset: Date.now(), ended, state: null });
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const f = H[el.dataset.act];
  if (f) { e.preventDefault(); f(el); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset && t.dataset.seat != null) ui.setup.names[+t.dataset.seat] = t.value;
  if (t.id === 'dname' && ui.pick.design) {
    ui.pick.design.nm = t.value;
    const pv = document.getElementById('dpreview'); if (pv) pv.innerHTML = designPreview();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && ui.sheet) { ui.sheet = null; ui.play = null; render(); }
});

/* ---------- boot ---------- */
const isCurrent = st => !!(st && st.camp && st.camp.v === CAMPAIGN_VERSION);
function boot(hot) {
  if (hot && hot.S) S = hot.S;
  else { const d = loadLocal(); if (d) S = d.state; }
  /* A campaign from the shared-deck version can't continue: go back to setup with the same players filled in. */
  if (S && !isCurrent(S)) { dropCampaign(); toast('The game now gives everyone their own deck, so the campaign starts fresh.'); }
  render();
  initDb();
}
if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ S }));
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot);
else boot(window.claude && window.claude.hot ? window.claude.hot.data : {});
