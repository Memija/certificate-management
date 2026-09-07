const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:\\Users\\Anel_\\.gemini\\antigravity-ide\\brain\\6d299b30-343a-4b6c-a386-eca34b9910dd\\.system_generated\\logs\\transcript_full.jsonl'),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  const obj = JSON.parse(line);
  if (obj.content && obj.content.includes('git diff src/index.css')) {
    console.log(`Found in content at step ${obj.step_index}, type=${obj.type}`);
    fs.writeFileSync(`scratch/step_${obj.step_index}.json`, JSON.stringify(obj, null, 2));
  }
  if (obj.tool_calls) {
    for (const tc of obj.tool_calls) {
      if (tc.args && JSON.stringify(tc.args).includes('git diff src/index.css')) {
        console.log(`Found in tool_call at step ${obj.step_index}, type=${obj.type}`);
        // the output will be in obj.step_index + 1!
        saveNext = obj.step_index + 1;
      }
    }
  }
  if (typeof saveNext !== 'undefined' && obj.step_index === saveNext) {
    console.log(`Saving output step ${obj.step_index}, len=${obj.content ? obj.content.length : 0}`);
    fs.writeFileSync(`scratch/step_${obj.step_index}_diff_output.json`, JSON.stringify(obj, null, 2));
  }
});
