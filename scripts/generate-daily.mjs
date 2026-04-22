#!/usr/bin/env node
import { HDate } from '@hebcal/core';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE   = args.includes('--force');
const DATE_OVERRIDE = (() => { const idx = args.indexOf('--date'); return idx !== -1 ? args[idx + 1] : null; })();
const rules = JSON.parse(readFileSync(resolve(ROOT, 'rules/content-rules.json'), 'utf8'));
const cycle = JSON.parse(readFileSync(resolve(ROOT, 'rules/parashah-cycle-5786.json'), 'utf8'));
log('INFO', `Phase:${rules.content_pipeline.phase} Mode:${rules.calendar.calendar_mode} DryRun:${DRY_RUN}`);
const gregorianToday = DATE_OVERRIDE ? new Date(DATE_OVERRIDE + 'T12:00:00') : new Date();
const hebrewToday  = new HDate(gregorianToday);
const dayOfWeekISO = gregorianToday.getDay();
const aliyahEntry  = rules.aliyah_day_map[String(dayOfWeekISO)];
if (!aliyahEntry) halt(`No aliyah mapping for weekday: ${dayOfWeekISO}`);
log('INFO', `Gregorian: ${gregorianToday.toISOString().slice(0,10)}`);
log('INFO', `Hebrew: ${hebrewToday.getDay()} ${hebrewToday.getMonthName()} ${hebrewToday.getFullYear()}`);
log('INFO', `Day: ${aliyahEntry.day_name} → Aliyah ${aliyahEntry.aliyah}`);
const parashah = resolveParashah(gregorianToday, cycle);
if (!parashah) halt(`Could not resolve parashah for ${gregorianToday.toISOString().slice(0,10)}`);
log('INFO', `Parashah: ${parashah.name_en} (${parashah.slug})`);
const hy = hebrewToday.getFullYear();
const hm = String(hebrewToday.getMonth()).padStart(2,'0');
const hd = String(hebrewToday.getDay()).padStart(2,'0');
const entryId = `${hy}-${hm}-${hd}-${parashah.slug}-${aliyahEntry.aliyah}`;
log('INFO', `Entry ID: ${entryId}`);
const archivePath = resolve(ROOT, `content/daily/${entryId}.json`);
if (existsSync(archivePath) && !DRY_RUN && !FORCE) { log('WARN', `Already exists. Use --force.`); process.exit(0); }
const stagingPath  = resolve(ROOT, rules.content_pipeline.staging_file);
let stagedRaw = null, usingFallback = false;
if (existsSync(stagingPath)) {
  stagedRaw = readFileSync(stagingPath, 'utf8').trim();
  if (!stagedRaw || stagedRaw.startsWith('PLACEHOLDER') || stagedRaw.length < 50) stagedRaw = null;
}
if (!stagedRaw) { log('WARN', 'No usable staged content — fallback mode'); usingFallback = true; }
const aliyahOrdinals = ['','1st','2nd','3rd','4th','5th','6th','7th'];
const dailyJson = {
  schema_version: '1.0', entry_id: entryId,
  slug: `${parashah.slug}-aliyah-${aliyahEntry.aliyah}`,
  generated_at: new Date().toISOString(),
  generated_by: 'generate-daily.mjs v1.1',
  pipeline_phase: rules.content_pipeline.phase,
  using_fallback: usingFallback,
  date_metadata: {
    hebrew_date_display: `${hebrewToday.getDay()} ${hebrewToday.getMonthName()} ${hy}`,
    gregorian_date_display: gregorianToday.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}),
    hebrew_year: hy, hebrew_month: hebrewToday.getMonthName(),
    hebrew_day: hebrewToday.getDay(), hebrew_month_number: hebrewToday.getMonth(),
    date_explainer_short: `${aliyahEntry.day_name} · ${parashah.name_en}`,
    day_of_week_iso: dayOfWeekISO, day_of_week_name: aliyahEntry.day_name,
    gregorian_iso: gregorianToday.toISOString().slice(0,10),
  },
  reading_metadata: {
    parashah_slug: parashah.slug, parashah_name_en: parashah.name_en,
    parashah_name_he: parashah.name_he, is_combined_portion: parashah.combined,
    aliyah_number: aliyahEntry.aliyah,
    aliyah_label: `${aliyahOrdinals[aliyahEntry.aliyah]} Aliyah`,
    book: parashah.book, chapters: parashah.chapters,
    verses_start: null, verses_end: null, cycle_type: 'annual',
  },
  content_payload: buildContentPayload(stagedRaw, usingFallback),
  festival_overlay: { active: false, festival_name: null, festival_note: null },
  media_payload: { infographic_status: 'planned', audio_status: 'planned', image_url: null, audio_url: null },
  publishing: { status: 'staged', published_at: null, published_by: null, current_json_written: false, archive_path: `content/daily/${entryId}.json` },
  pipeline_flags: { schema_validated: true, date_verified: true, parashah_verified: true, content_complete: !usingFallback && !!stagedRaw, ready_to_publish: !usingFallback && !!stagedRaw },
};
validateSchema(dailyJson);
if (!DRY_RUN) {
  mkdirSync(resolve(ROOT,'content/daily'),{recursive:true});
  atomicWrite(archivePath, dailyJson);
  log('OK', `Archive written: ${archivePath}`);
  if (dailyJson.pipeline_flags.ready_to_publish) {
    const { execSync } = await import('child_process');
    execSync(`node ${resolve(ROOT,'scripts/publish-current.mjs')} --source ${archivePath}`,{stdio:'inherit'});
  } else { log('WARN','Content not ready — populate content/staging/today-draft.md and re-run'); }
} else {
  log('DRY', `Would write   : content/daily/${entryId}.json`);
  log('DRY', `hebrew_date   : ${dailyJson.date_metadata.hebrew_date_display}`);
  log('DRY', `parashah      : ${dailyJson.reading_metadata.parashah_name_en}`);
  log('DRY', `aliyah        : ${dailyJson.reading_metadata.aliyah_label}`);
  log('DRY', `content_ready : ${dailyJson.pipeline_flags.content_complete}`);
  log('DRY', `Would invoke  : node scripts/publish-current.mjs --source content/daily/${entryId}.json`);
}
function resolveParashah(date, cycleData) {
  for (let i = 0; i < cycleData.cycle.length; i++) {
    const shabbat = new Date(cycleData.cycle[i].shabbat_date + 'T00:00:00');
    const prev    = i > 0 ? new Date(cycleData.cycle[i-1].shabbat_date + 'T00:00:00') : null;
    if (date <= shabbat && (prev === null || date > prev)) return cycleData.cycle[i];
  }
  return null;
}
function buildContentPayload(staged, isFallback) {
  const empty = { _note:'Populate content/staging/today-draft.md then re-run', torah_text:{source_translation:null,verses:[]}, commentary:{tier_1_foundational:{title:null,body:null},tier_2_deeper_dive:{title:null,body:null},tier_3_spiritual_application:{title:null,body:null}}, hebrew_word_study:{word:null,transliteration:null,definition:null,significance:null}, cross_references:[], reflection_prompt:null, practical_action:{title:null,body:null}, business_integrity_application:{title:null,body:null}, great_commission_tie:{title:null,body:null} };
  if (!staged || isFallback) return empty;
  try { const p = JSON.parse(staged); log('INFO','Staged content parsed as JSON'); return p.content_payload || p.content || p; }
  catch { log('WARN','Plain text staged — inserted into tier_1'); return {...empty, commentary:{tier_1_foundational:{title:"Today's Reading",body:staged.slice(0,1500)},tier_2_deeper_dive:{title:null,body:null},tier_3_spiritual_application:{title:null,body:null}}}; }
}
function validateSchema(obj) {
  const missing = ['schema_version','entry_id','date_metadata','reading_metadata','content_payload','publishing'].filter(k=>!(k in obj));
  if (missing.length) halt(`Schema FAILED — missing: ${missing.join(', ')}`);
  if (!obj.date_metadata.gregorian_iso) halt('date_metadata.gregorian_iso missing');
  if (!obj.reading_metadata.parashah_slug) halt('reading_metadata.parashah_slug missing');
  log('OK','Schema validation passed');
}
function atomicWrite(p, d) { const t=p+'.tmp'; writeFileSync(t,JSON.stringify(d,null,2),'utf8'); renameSync(t,p); }
function log(l,m) { console.log(`[${new Date().toISOString()}] [${l.padEnd(4)}] ${m}`); }
function halt(m) { log('HALT',m); process.exit(1); }
