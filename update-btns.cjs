const fs = require('fs');
let code = fs.readFileSync('c:/Dev/novela/src/pages/NovelApp.jsx', 'utf8');

// Action buttons -> success
code = code.replace(/<PrimaryBtn\s+label=(['\"])(Save changes|Save|Save payment|Save restriction|Save automations|Confirm pickup|Confirm return|Confirm rental|Create job|Log return|Mark cleaned|Mark picked up|\+ Create milestone|Send invite|Add task|Assign item|Add date)\1/g, '<PrimaryBtn label=$1$2$1 colorScheme=\"success\"');

// Info actions -> info
code = code.replace(/<PrimaryBtn\s+label=(['\"])(Reserve dress|Reserve for event|Yes, send to cleaning)\1/g, '<PrimaryBtn label=$1$2$1 colorScheme=\"info\"');

// Overdue logic
code = code.replace(/label=\{over\?\"Log return — OVERDUE\":\"Log return\"\}/g, 'label={over?\"Log return — OVERDUE\":\"Log return\"} colorScheme={over?\"danger\":\"success\"}');

// Expressions
code = code.replace(/(<PrimaryBtn\s+label=\{saving\?['\"][^'\"]+['\"]:['\"])(Add item|Create event & generate contract|Confirm rental|Confirm pickup|Confirm return|Add to inventory|Add client)(['\"])/g, '$1$2$3 colorScheme=\"success\"');
code = code.replace(/(<PrimaryBtn\s+label=\{saving\?['\"][^'\"]+['\"]:['\"])(Reserve dress|Reserving dress)(['\"])/g, '$1$2$3 colorScheme=\"info\"');

// Some new buttons
code = code.replace(/<PrimaryBtn\s+label=\"\+ Add item\"/g, '<PrimaryBtn label=\"+ Add item\" colorScheme=\"success\"');
code = code.replace(/<PrimaryBtn\s+label=\"\+ New client\"/g, '<PrimaryBtn label=\"+ New client\" colorScheme=\"success\"');

fs.writeFileSync('c:/Dev/novela/src/pages/NovelApp.jsx', code);
console.log('Replaced buttons with Semantic colors');
