# Last Card Legacy

A legacy campaign version of the classic match-the-color, match-the-number card game, for 2 to 4 players on one phone (any seat can be a computer).

Over a 12-hand campaign the game changes for good: each player builds their own deck, cards get signed, stickered and torn up, torn halves get taped into Frankencards, sealed boxes open, and new rules join the game as Legacy cards are turned over. Progress saves in the browser, so a campaign can be picked up later on the same device.

## Play

Open `index.html`. The whole game is that one self-contained page, with no build step and nothing to install.

## Source

`source/` holds the parts the page is built from:

- `content.js` – every card, Legacy card, sealed box, Boon, Toll and rule card
- `engine.js` – the rules, the campaign and the computer players
- `ui.js` – the screens
- `head.html`, `icons.html` – styles and icons
- `standalone.html` – the document head for the website
- `build.sh` – rebuilds `index.html` from the parts
- `test.js` – plays 120 computer-only campaigns and checks that no card is lost or duplicated

```sh
cd source
./build.sh     # rebuild index.html
node test.js   # run the bot campaigns
```
