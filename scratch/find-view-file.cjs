const fs = require('fs');
const path = require('path');

const p = path.join('C:\\Users\\Anel_\\.gemini\\antigravity-ide\\brain', '9f7e38ed-e4a1-4fe1-959a-bbe59b1806fb', '.system_generated', 'logs', 'transcript_full.jsonl');
const lines = fs.readFileSync(p, 'utf8').split('\n');

for (const l of lines) {
  if (!l.trim()) continue;
  const obj = JSON.parse(l);
  if (obj.tool_calls) {
    for (const tc of obj.tool_calls) {
      if (tc.name === 'view_file' && tc.args && tc.args.AbsolutePath && tc.args.AbsolutePath.includes('index.css')) {
        console.log(`view_file on index.css at step ${obj.step_index}, lines: ${tc.args.StartLine}-${tc.args.EndLine}`);
      }
    }
  }
}
