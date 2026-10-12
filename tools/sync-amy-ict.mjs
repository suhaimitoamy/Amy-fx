import {readFileSync,writeFileSync} from 'node:fs';
const source='supabase/functions/scalper-engine/amy-ict.mjs';
const target='app/src/main/assets/apps/mapping/js/ict-workspace/amy-ict.js';
const content=readFileSync(source,'utf8');
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==content)throw new Error('Shared AMY engine differs; run node tools/sync-amy-ict.mjs');}
else writeFileSync(target,content);
