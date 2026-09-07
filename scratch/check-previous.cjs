const fs = require('fs');
const path = require('path');

const convs = ['9f7e38ed-e4a1-4fe1-959a-bbe59b1806fb', '21bf3e42-b847-4cbb-b8fb-a9ca7314d85b', '01158e2a-25e7-498a-82d7-ec292f1cdcd2'];
for (const c of convs) {
  const p = path.join('C:\\Users\\Anel_\\.gemini\\antigravity-ide\\brain', c, '.system_generated', 'logs', 'transcript_full.jsonl');
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    for (const l of lines) {
      if (!l.trim()) continue;
      const obj = JSON.parse(l);
      if (obj.tool_calls) {
        for (const tc of obj.tool_calls) {
          if (tc.name === 'write_to_file' && tc.args && tc.args.TargetFile && tc.args.TargetFile.includes('index.css')) {
            console.log(`Found write_to_file for index.css in ${c}, step ${obj.step_index}! Code length: ${tc.args.CodeContent.length}`);
            fs.writeFileSync(`scratch/recovered_index_from_${c}.css`, tc.args.CodeContent);
          }
          if (tc.name === 'replace_file_content' && tc.args && tc.args.TargetFile && tc.args.TargetFile.includes('index.css')) {
            console.log(`Found replace_file_content for index.css in ${c}, step ${obj.step_index}`);
          }
        }
      }
    }
  }
}
