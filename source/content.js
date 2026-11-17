/* =====================================================================
   CONTENT — everything a player will one day hold in their hands.
   Cards, boxes, stickers and envelopes live here, apart from the rules
   engine, so this block doubles as the print list for a physical edition.
   ===================================================================== */
const CONTENT = {
  hands: 12,
  maxStickers: 3,
  colors: {
    red: { name: 'Red', emblem: 'flame' },
    blue: { name: 'Blue', emblem: 'wave' },
    yellow: { name: 'Yellow', emblem: 'sun' },
    green: { name: 'Green', emblem: 'leaf' }
  },
  kinds: {
    num: { name: 'Number', text: 'Match it by color or by number.' },
    dual: { name: 'Dual-Color', text: 'A number card with two colors. You can play it on either color, or on its number. Once it’s played, both colors count: the next player can match either one, or the number.' },
    skip: { name: 'Skip', text: 'The next player loses their turn.' },
    rev: { name: 'Reverse', text: 'Play changes direction. With 2 players it works like a Skip, so you go again.' },
    d2: { name: 'Draw Two', text: 'The next player draws 2 and loses their turn.' },
    wild: { name: 'Wild', text: 'Play it on anything and choose the next color.' },
    w4: { name: 'Wild Draw Four', text: 'Choose the next color. The next player draws 4 and loses their turn.' },
    boom: { name: 'Boomerang', text: 'A Wild that reverses play. If a stack of Draw cards is coming at you, it sends the whole stack back the other way, to the player who hit you.' },
    encore: { name: 'Encore', text: 'Everyone else is skipped. Take another turn.' },
    thief: { name: 'Thief', text: 'Take a random card from any player.' },
    gift: { name: 'Gift', text: 'Give any card from your hand to any player. Give away your last card and you go out.' },
    mirror: { name: 'Mirror', text: 'Play it on its own color or on another Mirror. It copies the card underneath: same number or symbol, and that card’s action happens again.' },
    swap: { name: 'Trade Places', text: 'Trade hands with any player.' },
    all1: { name: 'Everybody Draw', text: 'Everyone else draws 1.' },
    pick2: { name: 'Pick On', text: 'Choose a player. They draw 2.' },
    frank: { name: 'Frankencard', text: 'Two torn halves taped together. It matches either half. When you play it, choose which half counts.' },
    blanken: { name: 'Blankenstein', text: 'Half a blank card someone designed, taped to a torn half. It matches either half. When you play it, choose which half counts.' }
  },
  /* Powers a Blank Card can be given (Box VI). A blank can instead be a number from 0 to 12. Blank cards are never Wild. */
  powers: ['skip', 'rev', 'd2', 'encore', 'thief', 'gift', 'swap', 'all1', 'pick2'],
  botNames: {
    num: ['Lucky', 'Big', 'Mega', 'Jumbo'], skip: ['Nope', 'Not You', 'Hall Pass'], rev: ['U-Turn', 'Backsies', 'Boomerang Jr'],
    d2: ['Double Trouble', 'Two For You', 'Homework'], encore: ['Again!', 'One More', 'Hat Trick'], thief: ['Pickpocket', 'Sticky Fingers', 'Raccoon'],
    gift: ['Hot Potato', 'Present', 'Regift'], swap: ['Switcheroo', 'Body Swap', 'Trade Ya'], all1: ['Rain Cloud', 'Snow Day', 'Group Project'],
    pick2: ['Pick On You', 'Gotcha', 'Tag']
  },
  stickers: {
    sig: { name: 'Signature', short: 'play one more card', text: 'A player’s initials. When you play a card you signed, you get to play one more card right away. If it was a Draw card, the next player still draws after your extra card, and can still stack on it once Stackable Draws is in play.' },
    grudge: { name: 'Grudge', short: 'the named player draws 1', text: 'Has a player’s name on it. Whenever anyone else plays this card, the named player draws 1 card.' },
    plus: { name: 'Plus One', short: 'next player draws 1 extra', text: 'Whoever plays this card makes the next player draw 1 extra card.' },
    mud: { name: 'Mud', short: 'whoever plays it draws 1', text: 'Messy. Whoever plays this card has to draw 1 card right after.' },
    glue: { name: 'Glue', short: 'can’t be your last card', text: 'Sticky. You can’t go out with this card. If it’s the only card left in your hand, you have to draw instead of playing it.' },
    crown: { name: 'Crown', short: 'earn 1 Star when played', text: 'Whoever plays this card earns 1 Star on the spot.' },
    rainbow: { name: 'Rainbow', short: 'matches any color', text: 'This card can be played on any color. It keeps its own number or symbol.' },
    bomb: { name: 'Bomb', short: 'everyone else draws 1', text: 'When this card is played, everyone else draws 1 card.' }
  },
  /* The Legacy Deck: face down at the start, turned over when its trigger happens.
     Cards triggered by something a player does turn over the moment it happens, even mid-hand. */
  legacy: [
    { id: 'L1', title: 'The Council', back: 'Turn this card over when the first hand ends.',
      body: ['Open Box II.', 'The winner of this hand signs the card they went out with. If it came from someone else’s deck, it moves into the winner’s deck.', 'From now on, every hand ends with a Council. The player in last place chooses 2 Boons. With 3 or 4 players, the player just above last chooses 1 Boon. The winner pays 1 Toll.', 'Boons and Tolls change the decks for the rest of the campaign.'] },
    { id: 'L2', title: 'Ripped', back: 'Turn this card over the moment a player has to draw 4 or more cards at once. If no one has by the end of Hand 3, turn it over then.',
      body: ['The player who had to draw tears the card that hit them in half. It’s out of its owner’s deck for good. Both halves go in the Scrap Envelope, with any stickers kept on one of them.', 'If no one drew 4 at once, the player with the fewest Stars tears up a Wild Draw Four from any deck.', 'New rule: Torn Hands. When a hand ends, everyone except the winner tears up the 3 highest-point cards left in their hand. A deck never drops below 15 cards: once a player’s deck is down to 15, their cards are safe.', 'Tear It Up is now a Boon.', 'Add the Tearing Up Cards rule card to the rules.'], rule: 'tearing' },
    { id: 'L3', title: 'Stackable Draws', back: 'Turn this card over the moment a player holds 12 or more cards. If no one has by the end of Hand 4, turn it over then.',
      body: ['New rule: Stackable Draws. When someone plays a Draw card on you, you can block it by playing a Draw card of your own on top.', 'Then the next player has to draw the total of the whole stack, unless they block it too. Whoever finally takes the stack draws every card in it and loses their turn.', 'A Draw Two can go on any Draw Two. It can go on a Wild Draw Four only if it’s the color that was called. A Wild Draw Four can go on any Draw card.', 'Open Box IV. Hand out its 4 Boomerangs one at a time, starting with the player with the fewest Stars. Shuffle yours into your deck.'] },
    { id: 'L4', title: 'Fives and Zeros', back: 'Turn this card over at the start of Hand 5.',
      body: ['New rule: When you play a 5, trade hands with any player.', 'When you play a 0, everyone passes their hand to the next player in the direction of play.', 'If the 5 or 0 is your last card, you go out and nothing moves.', 'Cards still go back to their owners’ decks when the hand ends.'] },
    { id: 'L5', title: 'Clean Hands', back: 'Turn this card over the first time a player wins a hand without drawing a single card. If no one has by the end of Hand 5, turn it over then.',
      body: ['Open Box III.', 'The player who won without drawing puts Crowns on 2 cards in their deck. If no one did, the player with the fewest Stars gets them.', 'Whoever plays a card with a Crown earns 1 Star on the spot.'] },
    { id: 'L13', title: 'Running on Empty', back: 'Turn this card over the moment a player’s deck runs out. If no one’s has by the end of Hand 6, turn it over then.',
      body: ['The player whose deck ran out takes 2 dual-color cards from the Supply and shuffles them into their deck. If no one’s ran out, the player with the smallest deck does.', 'If Box III has been opened, they also put a Crown on a card in their deck.', 'Running out still works the same way: take your own cards out of the middle pile (leave the top card), shuffle them and keep drawing.'] },
    { id: 'L6', title: 'The Turnabout', back: 'Turn this card over when Hand 6 ends.',
      body: ['The campaign is half over. Open Box X.', 'Places are by total Stars. A tie goes to whoever finished lower in Hand 6.'] },
    { id: 'L7', title: 'The Scrapbook', back: 'Turn this card over when the 10th card is torn up. If that hasn’t happened by the end of Hand 7, turn it over then.',
      body: ['Open Box V.', 'The player with the fewest Stars tapes the first Frankencard, half of one torn card joined to half of another, and shuffles it into their deck. If fewer than 2 cards have been torn, they tear up cards from any deck until there are 2.', 'Tape is now a Boon.'] },
    { id: 'L8', title: 'Blank Cards', back: 'Turn this card over at the start of Hand 8.',
      body: ['Open Box VI.', 'Starting with the player with the fewest Stars, everyone designs one new card and shuffles it into their own deck. Your card carries your signature. Blank cards can’t be Wild.', 'Design a Card is now a Boon while blank cards last.'] },
    { id: 'L14', title: 'Blankensteins', back: 'Turn this card over at the start of Hand 9.',
      body: ['New: Blankensteins. Tear a blank card in half and design one half: a color (no Wilds) and a number from 0 to 12 or a power. Tape it to a half from the Scrap Envelope. The half keeps its stickers.', 'Starting with the player with the fewest Stars, everyone makes one and shuffles it into their deck.', 'Blankenstein is now a Boon while blank cards and halves last.'] },
    { id: 'L9', title: 'Wild Things', back: 'Turn this card over the first time a player wins 2 hands in a row. If no one has by the end of Hand 8, turn it over then.',
      body: ['Open Box XI and draft its 8 new cards.', 'Starting with the player with the fewest Stars, take turns choosing one card and shuffling it into your deck until all 8 are gone.'] },
    { id: 'L10', title: 'Bombs Away', back: 'Turn this card over at the start of Hand 10.',
      body: ['Open Box VIII.', 'Starting with the player with the fewest Stars, everyone puts a Bomb on a card in their deck.', 'Bomb is now a Boon.'] },
    { id: 'L11', title: 'Autographs', back: 'Turn this card over at the start of Hand 11.',
      body: ['New rule: If you go out by playing a card you signed, earn 2 extra Stars.', 'Starting with the player with the fewest Stars, everyone signs one more card in their deck.'] },
    { id: 'L12', title: 'The Last Hand', back: 'Turn this card over at the start of Hand 12.',
      body: ['Open Box VII. This is the final hand.'] }
  ],
  boxes: [
    { id: 'I', name: 'Bad Blood', lid: 'Open when a player finishes last 2 hands in a row.',
      body: ['Grudge stickers.', 'That player writes a rival’s name on 2 Grudges and puts them on cards in their own deck. They can name the same rival twice.', 'Whenever anyone else plays a card with a Grudge, the named player draws 1.', 'Grudge is now a Boon, and Marked is now a Toll.'] },
    { id: 'II', name: 'Signatures', lid: 'Do not open until a Legacy card tells you.', card: 'L1',
      body: ['Signature stickers. Write your initials on one when you sign a card. A card holds one signature.', 'When you play a card you signed, you may play one more card right away. A signed Draw card still hits the next player after your extra card.', 'Sign a Card is a Boon.'] },
    { id: 'III', name: 'Crowns', lid: 'Do not open until a Legacy card tells you.', card: 'L5',
      body: ['Crown stickers. There aren’t many, and they only come from a few places: Clean Hands, Running on Empty, the Turnabout, an Avalanche and the Last Hand.', 'Whoever plays a card with a Crown earns 1 Star on the spot, even if it isn’t their signature on it.'] },
    { id: 'IV', name: 'Boomerangs', lid: 'Do not open until a Legacy card tells you.', card: 'L3',
      body: ['4 Boomerang cards, handed out one at a time starting with the player with the fewest Stars.', 'A Boomerang is a Wild that reverses play. If a stack of Draw cards is coming at you, it sends the whole stack back the other way, to the player who hit you.'] },
    { id: 'V', name: 'Tape', lid: 'Do not open until a Legacy card tells you.', card: 'L7',
      body: ['A roll of tape.', 'A Frankencard matches either of its halves. When you play it, choose which half counts: its color, its number or symbol, and its action.', 'A Frankencard keeps the stickers from both halves. Two halves can only be taped together if that leaves no more than 3 stickers and no two of the same kind.', 'Tear up a Frankencard and it comes apart at the tape. Both halves go back in the Scrap Envelope, each with the stickers on it.'] },
    { id: 'VI', name: 'Blank Cards', lid: 'Do not open until a Legacy card tells you.', card: 'L8',
      body: ['12 blank cards and a marker.', 'Pick a color (blank cards can’t be Wild). Then give it a number from 0 to 12 or one of these powers: Skip, Reverse, Draw Two, Encore, Thief, Gift, Trade Places, Everybody Draw or Pick On. Then name it.'] },
    { id: 'VII', name: 'The Last Hand', lid: 'Do not open until a Legacy card tells you.', card: 'L12',
      body: ['Every Star earned in this hand counts double, including Crowns and Autographs.', 'Before the deal, starting with the player with the fewest Stars, everyone puts one sticker of their choice on any card, from any box that has been opened.', 'When the hand ends, the player with the most Stars wins the campaign and signs the inside of this lid.'] },
    { id: 'VIII', name: 'Bombs', lid: 'Do not open until a Legacy card tells you.', card: 'L10',
      body: ['Bomb stickers.', 'When a card with a Bomb is played, everyone else draws 1.'] },
    { id: 'IX', name: 'Rainbow', lid: 'Open the first time a player goes out by playing a Wild.',
      body: ['Rainbow stickers. A Rainbow card can be played on any color and keeps its own number or symbol.', 'The player who went out puts a Rainbow on a card in their deck that isn’t a Wild.', 'Rainbow is now a Boon.'] },
    { id: 'X', name: 'The Turnabout', lid: 'Do not open until a Legacy card tells you.', card: 'L6',
      body: ['First place, The Crown Is Heavy: lose 2 Stars and tear up a card you signed. If you haven’t signed one, lose 1 more Star instead.', 'Second place, Steady: nothing changes. (4 players only.)', 'Second to last, Second Wind: gain 1 Star and sign a card. (3 or 4 players.)', 'Last place, The Underdog: gain 2 Stars, choose 2 Boons, and put a Crown on a card in your deck.'] },
    { id: 'XI', name: 'Wild Things', lid: 'Do not open until a Legacy card tells you.', card: 'L9',
      body: ['8 new cards to draft: Encores in Red and Blue, Thieves in Yellow and Green, Gifts in Red and Green, Mirrors in Blue and Yellow.', 'Encore: everyone else is skipped, take another turn. Thief: take a random card from any player. Gift: give any card from your hand to any player. Mirror: copies the card underneath it.'] },
    { id: 'XII', name: 'Avalanche', lid: 'Open the moment a player draws 8 or more cards in a single turn.',
      body: ['Everyone feels sorry for them.', 'That player chooses 2 Boons right away. If Box III has been opened, they also put a Crown on a card in their deck.'] }
  ],
  /* Everyone starts with this deck: 0 to 5 in every color, plus these (36 cards). */
  starter: { low: 0, high: 5, extras: [
    { c: 'red', k: 'skip' }, { c: 'blue', k: 'rev' }, { c: 'wild', k: 'wild' }, { c: 'wild', k: 'w4' },
    { c: 'red', k: 'd2' }, { c: 'red', k: 'd2' }, { c: 'blue', k: 'd2' }, { c: 'blue', k: 'd2' },
    { c: 'yellow', k: 'd2' }, { c: 'yellow', k: 'd2' }, { c: 'green', k: 'd2' }, { c: 'green', k: 'd2' }] },
  /* Spare cards in the box for Boons. `action`: Skips and Reverses per color. `d2`: Draw Twos per color.
     `dual`: copies of each dual-color card (every pair of colors, numbers 0 to `dualHigh`). There are no spare Wilds. */
  supply: { action: 2, d2: 3, dual: 2, dualHigh: 5 },
  /* Every Boon and every Toll changes a deck for good. `st` names the stickers it uses, so the screen can explain them. */
  boons: [
    { id: 'adddual', name: 'Add Dual-Color Cards', text: 'Take 2 dual-color cards from the Supply and shuffle them into your deck. Each one matches either of its colors.' },
    { id: 'adddraw', name: 'Add a Draw Two', text: 'Take a Draw Two in any color from the Supply and shuffle it into your deck.' },
    { id: 'addaction', name: 'Add an Action', text: 'Take a Skip or a Reverse in any color from the Supply and shuffle it into your deck.' },
    { id: 'sign', name: 'Sign a Card', st: ['sig'], text: 'Put your signature on a card in your deck.' },
    { id: 'plus', name: 'Plus One', st: ['plus'], text: 'Put a Plus One on a card in your deck.' },
    { id: 'smudge', name: 'Smudge', st: ['mud', 'glue'], text: 'Put Mud or Glue on a card in a rival’s deck.' },
    { id: 'mend', name: 'Mend', text: 'Peel one Mud, Glue, Plus One, Bomb or Grudge sticker off a card in your deck.' },
    { id: 'tear', name: 'Tear It Up', text: 'Tear up a card in any deck. Thin out a weak card from your own deck, or rip a good one out of a rival’s. No deck can go below 15 cards.' },
    { id: 'grudge', name: 'Grudge', st: ['grudge'], text: 'Write a rival’s name on a Grudge and put it on a card in your deck.' },
    { id: 'rainbow', name: 'Rainbow', st: ['rainbow'], text: 'Put a Rainbow on a card in your deck that isn’t a Wild.' },
    { id: 'tape', name: 'Tape', text: 'Tape two halves from the Scrap Envelope into a Frankencard and shuffle it into your deck. It matches either half and keeps their stickers.' },
    { id: 'design', name: 'Design a Card', text: 'Turn a blank card into a colored card of your own and shuffle it into your deck. It carries your signature.' },
    { id: 'blanken', name: 'Blankenstein', text: 'Design half of a blank card and tape it to a half from the Scrap Envelope. It keeps that half’s stickers. Shuffle it into your deck.' },
    { id: 'bomb', name: 'Bomb', st: ['bomb'], text: 'Put a Bomb on a card in your deck.' }
  ],
  tolls: [
    { id: 'handover', name: 'Hand Over a Card', text: 'The player in last place takes any card they like from your deck and shuffles it into theirs.' },
    { id: 'muddeck', name: 'Muddy Your Deck', st: ['mud'], text: 'Put Mud on any card in your deck.' },
    { id: 'muddy', name: 'Muddy Your Name', st: ['mud'], text: 'Put Mud on a card you signed.' },
    { id: 'glued', name: 'Glue Your Name', st: ['glue'], text: 'Put Glue on a card you signed.' },
    { id: 'rip', name: 'Rip Your Name', text: 'Tear up a card you signed. It’s out of your deck for good.' },
    { id: 'marked', name: 'Marked', st: ['grudge'], text: 'The player in last place writes your name on a Grudge and puts it on a card in their deck.' },
    { id: 'star', name: 'Pay a Star', text: 'Lose 1 Star. This only comes up when no other Toll is possible.' }
  ],
  newCards: {
    IV: [{ c: 'wild', k: 'boom' }, { c: 'wild', k: 'boom' }, { c: 'wild', k: 'boom' }, { c: 'wild', k: 'boom' }],
    XI: [{ c: 'red', k: 'encore' }, { c: 'blue', k: 'encore' }, { c: 'yellow', k: 'thief' }, { c: 'green', k: 'thief' },
      { c: 'red', k: 'gift' }, { c: 'green', k: 'gift' }, { c: 'blue', k: 'mirror' }, { c: 'yellow', k: 'mirror' }]
  },
  /* Rule cards: reference cards that join the rules when a Legacy card says so. `unlock` is the rule that brings them in.
     A line with `need` only shows once that rule is in play; a line with `unless` only shows before it. */
  ruleCards: {
    tearing: { title: 'Tearing Up Cards', unlock: 'tear', sections: [
      { h: 'When cards get torn', lines: [
        { t: 'Torn Hands: when a hand ends, everyone except the winner tears up the 3 highest-point cards left in their hand. Wilds count 50, action cards 20 and numbers their value.' },
        { t: 'Tear It Up, a Boon: tear up any card in any deck. Thin a weak card out of your own deck, or rip a good one out of a rival’s.' },
        { t: 'Rip Your Name, a Toll: the winner tears up a card they signed.' },
        { t: 'Some Legacy cards and boxes tell a player to tear up a card.' }
      ] },
      { h: 'What happens to a torn card', lines: [
        { t: 'Tear it in half. It’s out of its owner’s deck for good, even if it was in someone else’s hand.' },
        { t: 'Stickers aren’t lost. Tear the card so all its stickers stay on one half.' },
        { t: 'Both halves go in the Scrap Envelope. A dual-color card tears into one half of each color.' },
        { t: 'A Frankencard comes apart at the tape instead. Each half goes back in the Scrap Envelope with the stickers on it.', need: 'tape' },
        { t: 'A Blankenstein comes apart at the tape too. Move all its stickers onto the torn half, which goes back in the Scrap Envelope. The half that was drawn on is thrown away.', need: 'blanken' }
      ] },
      { h: 'Never below 15', lines: [
        { t: 'No deck ever drops below 15 cards. If tearing a card would take its owner’s deck under 15, leave it whole.' },
        { t: 'In Torn Hands, skip that card and tear your next-highest card instead.' }
      ] },
      { h: 'What the halves are for', lines: [
        { t: 'Keep them in the Scrap Envelope, stickers and all. Something in a sealed box will use them.', unless: 'tape' },
        { t: 'Tape two halves from different cards into a Frankencard. It matches either half, and you choose which half counts when you play it.', need: 'tape' },
        { t: 'A Frankencard keeps the stickers from both halves. Two halves can only be taped together if that leaves no more than 3 stickers and no two of the same kind.', need: 'tape' },
        { t: 'Tape a half to a blank card you draw on to make a Blankenstein. It keeps that half’s stickers.', need: 'blanken' }
      ] }
    ] }
  },
  handTear: 3,
  blanks: 12
};
