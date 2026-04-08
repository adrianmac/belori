const fs = require('fs');
let code = fs.readFileSync('c:/Dev/novela/src/pages/NovelApp.jsx', 'utf8');

code = code.replace(/' colorScheme="success"\}/g, "'} colorScheme=\"success\"");
code = code.replace(/' colorScheme="info"\}/g, "'} colorScheme=\"info\"");

fs.writeFileSync('c:/Dev/novela/src/pages/NovelApp.jsx', code);
console.log('Fixed syntax errors');
