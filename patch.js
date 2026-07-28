const fs = require('fs');
let code = fs.readFileSync('src/store/GameContext.tsx', 'utf8');

code = code.replace(/Excavated Sector/g, 'Cleared Room');

fs.writeFileSync('src/store/GameContext.tsx', code);
