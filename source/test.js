const fs = require('fs'), vm = require('vm');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/content.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/engine.js', 'utf8') +
  '\nthis.API = { newCampaign, advance, act, botAction, runBotAction, botStep, stepContinue, stepActor, deckIds, CONTENT, faceOf, cardName, boonList, tollList };', ctx);
const A = ctx.API;

function check(S, where) {
  const G = S.game, camp = S.camp;
  if (!G || G.phase === 'over') return;
  const all = [].concat(...G.hands, ...G.decks, G.disc);
  const set = new Set(all);
  if (set.size !== all.length) throw new Error('duplicate card at ' + where);
  const deck = A.deckIds(camp);
  if (deck.length !== all.length) throw new Error('card count ' + all.length + ' vs deck ' + deck.length + ' at ' + where);
  for (const id of deck) if (!set.has(id)) throw new Error('missing ' + id + ' at ' + where);
  for (const id of all) if (camp.cards[id].torn) throw new Error('torn card still on the table at ' + where);
  /* A player's draw pile only ever holds their own cards. */
  G.decks.forEach((d, q) => d.forEach(id => { if (camp.cards[id].own !== q) throw new Error('foreign card in deck ' + q + ' at ' + where); }));
}
const stats = { camps: 0, hands: 0, turned: {}, opened: {}, stalls: 0, actions: 0, maxHand: 0, customs: 0, franks: 0, tears: 0, starsSpread: [] , forgot: 0, boons: {}};
function run(n) {
  const names = ['A', 'B', 'C', 'D'].slice(0, n);
  const S = { camp: A.newCampaign(names, names.map(() => true)), game: null };
  A.advance(S);
  let guard = 0, handActs = 0, lastHand = 0;
  while (S.camp.phase !== 'ended') {
    if (++guard > 400000) throw new Error('campaign guard');
    if (S.camp.phase === 'play') {
      const a = A.botAction(S);
      const ok = A.runBotAction(S, a);
      if (!ok) throw new Error('bot action refused ' + JSON.stringify(a) + ' phase ' + S.game.phase);
      stats.actions++; handActs++;
      if (handActs > 20000) throw new Error('hand too long');
      check(S, 'hand ' + S.camp.hand + ' ' + JSON.stringify(a));
      S.game.hands.forEach(h => { if (h.length > stats.maxHand) stats.maxHand = h.length; });
    } else {
      const actor = A.stepActor(S);
      const st = S.camp.queue[0];
      if (!st) throw new Error('between with empty queue');
      let ok;
      if (actor >= 0) ok = A.botStep(S); else ok = A.stepContinue(S);
      if (!ok) throw new Error('step refused ' + JSON.stringify(st));
      if (S.camp.hand !== lastHand) { lastHand = S.camp.hand; handActs = 0; }
    }
  }
  stats.camps++; stats.hands += S.camp.history.length;
  S.camp.turned.forEach(id => stats.turned[id] = (stats.turned[id] || 0) + 1);
  S.camp.opened.forEach(id => stats.opened[id] = (stats.opened[id] || 0) + 1);
  stats.customs += S.camp.order.filter(i => S.camp.cards[i].k === 'custom').length;
  stats.franks += S.camp.order.filter(i => S.camp.cards[i].k === 'frank').length;
  stats.tears += S.camp.tears;
  stats.starsSpread.push(S.camp.stars.slice());
  stats.size = Math.max(stats.size || 0, JSON.stringify(S).length);
  return S;
}
const t0 = Date.now();
let last;
for (let i = 0; i < 120; i++) last = run(2 + (i % 3));
console.log(JSON.stringify(stats, (k, v) => k === 'starsSpread' ? v.slice(0, 6) : v, 1));
console.log('ms', Date.now() - t0);
console.log(last.camp.log.slice(-25).map(l => l.h + ': ' + l.t).join('\n'));
