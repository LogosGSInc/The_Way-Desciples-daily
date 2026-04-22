import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const sourceIdx = args.indexOf('--source');
if (sourceIdx === -1 || !args[sourceIdx + 1]) { console.log('[HALT] --source <path> required'); process.exit(1); }
const sourcePath = resolve(ROOT, args[sourceIdx + 1]);
const rules = JSON.parse(readFileSync(resolve(ROOT, 'rules/content-rules.json'), 'utf8'));
const TARGET = resolve(ROOT, rules.publishing.current_daily_path);
const TARGET_DIR = TARGET.substring(0, TARGET.lastIndexOf('/'));
if (!existsSync(sourcePath)) { console.log('[HALT] Source not found: ' + sourcePath); process.exit(1); }
const data = JSON.parse(readFileSync(sourcePath, 'utf8'));
if (!data.schema_version) { console.log('[HALT] Missing schema_version'); process.exit(1); }
const enriched = { ...data, publishing: { ...data.publishing, status: 'published', published_at: new Date().toISOString(), published_by: 'publish-current.mjs v1.0', current_json_written: true }};
if (!DRY_RUN) {
  mkdirSync(TARGET_DIR, { recursive: true });
  const tmp = TARGET + '.tmp';
  writeFileSync(tmp, JSON.stringify(enriched, null, 2), 'utf8');
  renameSync(tmp, TARGET);
  console.log('[OK  ] Published -> ' + TARGET);
} else {
  console.log('[DRY ] Would publish -> ' + TARGET);
}
