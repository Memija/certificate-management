const fs = require('fs');
const path = require('path');
const brainDir = 'C:\\Users\\Anel_\\.gemini\\antigravity-ide\\brain';
const convs = fs.readdirSync(brainDir);
for (const c of convs) {
  const p = path.join(brainDir, c, '.system_generated', 'logs', 'transcript.jsonl');
  if (fs.existsSync(p)) {
    try {
      const content = fs.readFileSync(p, 'utf8');
      if (content.includes('certificate-management') && content.includes('index.css')) {
        const stat = fs.statSync(p);
        console.log(`Found in conversation ${c}, modified: ${stat.mtime}`);
      }
    } catch (e) {}
  }
}
