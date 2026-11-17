#!/bin/sh
# Builds the game into one self-contained page.
#   ../index.html  the standalone site Vercel serves
#   artifact.html  the same game without the document head, for a Claude artifact
set -e
cd "$(dirname "$0")"
{ cat head.html; cat icons.html; echo '<script>'; cat content.js engine.js ui.js; echo '</script>'; } > artifact.html
{ cat standalone.html; cat artifact.html; } > ../index.html
node -e "const s=require('fs').readFileSync('../index.html','utf8');const js=s.slice(s.lastIndexOf('<script>')+8,s.lastIndexOf('</script>'));new Function(js);console.log('syntax ok',s.length)"
