const fs = require('fs');
let code = fs.readFileSync('c:/Dev/novela/src/pages/NovelApp.jsx', 'utf8');

// Action buttons -> danger
code = code.replace(/<GhostBtn\s+label=(['\"])(Archive|Cancel)\1/g, '<GhostBtn label=$1$2$1 colorScheme=\"danger\"');

fs.writeFileSync('c:/Dev/novela/src/pages/NovelApp.jsx', code);
console.log('Replaced Ghost buttons with Semantic colors');
