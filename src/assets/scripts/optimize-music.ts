// Music optimizer.
//
// Run: pnpm gen-music:optimize (from repo root). Also run as the first step
// of `pnpm gen-music` (umbrella command).
//
// Reads high-bitrate originals from `public/music/source/*.mp3` and writes
// re-encoded versions to `public/music/`. Settings: 128kbps CBR with EBU
// R128 loudness normalization and leading/trailing silence trim — tuned
// for ambient music where the perceptual difference vs. 256kbps is
// inaudible but the size drops ~50%.
//
// `public/music/source/` is gitignored (originals stay on local disk);
// `public/music/` is what the runtime serves. Incremental by mtime:
// already-optimized files are skipped, so the script is safe to re-run.
//
// The script never deletes output files. If a source is removed, the
// stale output is left in place — clean it up manually.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ffmpegStatic from 'ffmpeg-static';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const SOURCE_DIR = join(REPO_ROOT, 'public/music/source');
const OUTPUT_DIR = join(REPO_ROOT, 'public/music');

const BITRATE = '128k';
const SAMPLE_RATE = '44100';
const CHANNELS = '2';
const FILTER =
  'silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-40dB,' +
  'loudnorm=I=-16:TP=-1.5:LRA=11';

interface TrackResult {
  id: string;
  sourceBytes: number;
  outputBytes: number;
  skipped: boolean;
  error?: string;
}

/** Re-encode one source mp3 to the target spec. Surfaces ffmpeg's last 50 lines of stderr on failure. */
function runFfmpeg(input: string, output: string): void {
  const args = [
    '-i',
    input,
    '-c:a',
    'libmp3lame',
    '-b:a',
    BITRATE,
    '-ar',
    SAMPLE_RATE,
    '-ac',
    CHANNELS,
    '-af',
    FILTER,
    '-id3v2_version',
    '3',
    '-write_xing',
    '1',
    '-y',
    output,
  ];
  try {
    execFileSync(ffmpegStatic ?? '', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    if (err && typeof err === 'object' && 'stderr' in err) {
      const stderr = (err as { stderr?: Buffer }).stderr?.toString();
      if (stderr) {
        const tail = stderr.trim().split('\n').slice(-50).join('\n');
        throw new Error(`ffmpeg failed:\n${tail}`);
      }
    }
    throw err;
  }
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function main(): Promise<void> {
  if (ffmpegStatic === null) {
    console.error('✗ ffmpeg-static did not provide a binary path.');
    process.exit(1);
  }

  if (!existsSync(SOURCE_DIR)) {
    console.error(`✗ Source dir not found: ${SOURCE_DIR}`);
    console.error('  Drop the original high-bitrate mp3s there first.');
    process.exit(1);
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = readdirSync(SOURCE_DIR)
    .filter((f) => !f.startsWith('.') && f.toLowerCase().endsWith('.mp3'))
    .sort();
  if (files.length === 0) {
    console.log('No source mp3s found in public/music/source/ — nothing to do.');
    return;
  }

  const results: TrackResult[] = [];
  for (const file of files) {
    const id = file.replace(/\.mp3$/i, '');
    const sourcePath = join(SOURCE_DIR, file);
    const outputPath = join(OUTPUT_DIR, file);
    const sourceStat = statSync(sourcePath);
    const sourceBytes = sourceStat.size;

    // Incremental: skip when the output already exists and isn't older than the source.
    if (existsSync(outputPath)) {
      const outputStat = statSync(outputPath);
      if (outputStat.mtimeMs >= sourceStat.mtimeMs) {
        results.push({ id, sourceBytes, outputBytes: outputStat.size, skipped: true });
        continue;
      }
    }

    try {
      runFfmpeg(sourcePath, outputPath);
      const outputStat = statSync(outputPath);
      results.push({ id, sourceBytes, outputBytes: outputStat.size, skipped: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id, sourceBytes, outputBytes: 0, skipped: false, error: message });
    }
  }

  for (const r of results) {
    if (r.error) console.log(`  ✗ ${r.id}: ${r.error}`);
    else if (r.skipped) console.log(`  ○ ${r.id} (skipped — up to date)`);
    else {
      const pct = ((1 - r.outputBytes / r.sourceBytes) * 100).toFixed(0);
      console.log(
        `  ✓ ${r.id}: ${formatMB(r.sourceBytes)} → ${formatMB(r.outputBytes)} (-${pct}%)`,
      );
    }
  }

  const optimized = results.filter((r) => !r.skipped && !r.error);
  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => r.error);
  const totalIn = results.reduce((s, r) => s + r.sourceBytes, 0);
  const totalOut = results.reduce((s, r) => s + r.outputBytes, 0);
  const totalSaved = totalIn - totalOut;

  console.log('');
  console.log(
    `Re-encoded: ${optimized.length} • Skipped: ${skipped.length} • Failed: ${failed.length}`,
  );
  console.log(
    `Total: ${formatMB(totalIn)} → ${formatMB(totalOut)} (saved ${formatMB(totalSaved)})`,
  );

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
