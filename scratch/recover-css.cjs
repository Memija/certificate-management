const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('C:\\Users\\Anel_\\.gemini\\antigravity-ide\\brain\\6d299b30-343a-4b6c-a386-eca34b9910dd\\.system_generated\\logs\\transcript_full.jsonl'),
  crlfDelay: Infinity
});

let found = [];
rl.on('line', (line) => {
  if (line.includes('git diff src/index.css') || line.includes('index-Z6Sj00FW.css') || line.includes('Shimmer Skeleton Loaders')) {
    try {
      const obj = JSON.parse(line);
      found.push(obj);
    } catch (e) {}
  }
});

rl.on('close', () => {
  console.log(`Found ${found.length} entries`);
  for (let i = 0; i < found.length; i++) {
    const item = found[i];
    console.log(`Entry ${i}: step_index=${item.step_index}, type=${item.type}, contentLen=${item.content ? item.content.length : 0}`);
    if (item.content && item.content.includes('diff --git')) {
      fs.writeFileSync('scratch/extracted_diff.txt', item.content);
      console.log('Saved diff to scratch/extracted_diff.txt!');
    }
  }
});
