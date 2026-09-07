const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:\\Users\\Anel_\\.gemini\\antigravity-ide\\brain\\6d299b30-343a-4b6c-a386-eca34b9910dd\\.system_generated\\logs\\transcript_full.jsonl'),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  const obj = JSON.parse(line);
  if ([245, 246, 247, 248, 249, 250, 266, 267, 268, 269, 270].includes(obj.step_index)) {
    console.log(`step ${obj.step_index}: type=${obj.type}, status=${obj.status}`);
    if (obj.content) console.log(`  content: ${obj.content.substring(0, 150)}... (len: ${obj.content.length})`);
    if (obj.tool_calls) console.log(`  tool_calls:`, JSON.stringify(obj.tool_calls).substring(0, 150));
    if (obj.type === 'RUN_COMMAND' || (obj.content && obj.content.includes('git diff'))) {
      fs.writeFileSync(`scratch/step_${obj.step_index}.json`, JSON.stringify(obj, null, 2));
    }
  }
});
