// Catalog generator + texture processor.
//
// Run: pnpm gen-cat (from repo root)
//
// Reads SVGs/JPGs/PNGs from `public/pieces/textures/<category>/`. Groups
// files sharing `<metadata><piece id="..." visualState="..."/></metadata>`
// into a single `Piece` with multiple `VisualState`s. Files without that
// metadata become single-state Pieces (visualState id = "default").

import {
  existsSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import imageSize from "image-size";
import sharp from "sharp";
import { optimize as svgoOptimize } from "svgo";
import type { Piece, PieceCategory, VisualState } from "@/lib/shared/types";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const TEXTURES_DIR = join(REPO_ROOT, "public/pieces/textures");
const CATALOG_PATH = join(REPO_ROOT, "src/assets/catalog.ts");
const MAX_SIZE = 128;

const VALID_CATEGORIES = [
  "floor",
  "wall",
  "water",
  "lava",
  "decoration",
  "door",
  "other",
] as const;

const IMAGE_EXTS = ["svg", "png", "jpg", "jpeg", "webp"] as const;
type ImageExt = (typeof IMAGE_EXTS)[number];

function isImageExt(s: string): s is ImageExt {
  return (IMAGE_EXTS as readonly string[]).includes(s);
}

function prettifyBasename(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isValidCategory(c: string): c is PieceCategory {
  return (VALID_CATEGORIES as readonly string[]).includes(c);
}

function readSvgDimensions(file: string): { width: number; height: number } {
  const raw = readFileSync(file, "utf-8");
  const viewBox = raw.match(/viewBox=["']([^"']+)["']/);
  if (viewBox) {
    const parts = viewBox[1]!.trim().split(/\s+/).map(Number);
    if (parts && parts.length === 4 && !Number.isNaN(parts[2]!) && !Number.isNaN(parts[3]!)) {
      return { width: parts[2]!, height: parts[3]! };
    }
  }
  const wMatch = raw.match(/\bwidth=["']?(\d+(?:\.\d+)?)/);
  const hMatch = raw.match(/\bheight=["']?(\d+(?:\.\d+)?)/);
  if (wMatch && hMatch) {
    return { width: Number(wMatch[1]), height: Number(hMatch[1]) };
  }
  throw new Error(`Cannot determine SVG dimensions for ${file}`);
}

function readRasterDimensions(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  const result = imageSize(buf);
  if (!result.width || !result.height) {
    throw new Error(`Cannot determine dimensions for ${file}`);
  }
  return { width: result.width, height: result.height };
}

async function generateWebpVariant(
  file: string,
  ext: ImageExt,
  categoryDir: string,
  basename: string,
): Promise<string> {
  const webpPath = join(TEXTURES_DIR, categoryDir, `${basename}.webp`);
  const buf = readFileSync(file);
  const pipeline = ext === "svg" ? sharp(buf, { density: 300 }) : sharp(buf);
  await pipeline
    .resize(MAX_SIZE, MAX_SIZE, {
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 90 })
    .toFile(webpPath);
  return webpPath;
}

function optimizeSvg(file: string): void {
  const raw = readFileSync(file, "utf-8");

  // SVGO's preset-default aggressively collapses `<metadata>` and removes any
  // children inside it because they aren't recognized SVG semantics. Capture
  // the original `<metadata>...</metadata>` block (if any) so we can re-insert
  // it after optimization. The catalog script reads this to group files
  // sharing a `piece id` into a single Piece with multiple VisualStates.
  const metaMatch = raw.match(/<metadata[^>]*>[\s\S]*?<\/metadata>/i);
  const preservedMetadata = metaMatch ? metaMatch[0] : null;

  const result = svgoOptimize(raw, {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            removeViewBox: false,
            removeMetadata: false,
          },
        },
      },
    ],
  });
  if (!("data" in result)) return;

  let data = result.data;

  // Re-insert the original metadata after optimization. We replace either an
  // existing `<metadata/>` (collapsed) or insert right after the opening
  // `<svg ...>` tag if SVGO dropped it entirely.
  if (preservedMetadata) {
    if (/<metadata[^>]*\/>|<metadata[^>]*><\/metadata>/i.test(data)) {
      data = data.replace(
        /<metadata[^>]*\/>|<metadata[^>]*><\/metadata>/i,
        preservedMetadata,
      );
    } else {
      data = data.replace(/(<svg\b[^>]*>)/i, `$1${preservedMetadata}`);
    }
  }

  writeFileSync(file, data, "utf-8");
}

/**
 * Parse `<metadata><piece id="..." visualState="..." state="..." opacity="..."/>
 * <trait kind="..." state="..." opacity="..."/></metadata>`.
 */
function parseMetadata(raw: string): {
  pieceId: string | null;
  visualStateId: string | null;
  traits: Array<Record<string, unknown>>;
} {
  const metaMatch = raw.match(/<metadata>([\s\S]*?)<\/metadata>/i);
  if (!metaMatch) return { pieceId: null, visualStateId: null, traits: [] };
  const inner = metaMatch[1]!;

  // <piece ...>
  let pieceId: string | null = null;
  let visualStateId: string | null = null;
  const pieceMatch = inner.match(/<piece\s+([^/>]+)\/?>/i);
  if (pieceMatch) {
    const attrs: Record<string, string> = {};
    const attrRe = /(\w+)\s*=\s*["']([^"']*)["']/g;
    let am: RegExpExecArray | null = attrRe.exec(pieceMatch[1]!);
    while (am !== null) {
      attrs[am[1]!] = am[2]!;
      am = attrRe.exec(pieceMatch[1]!);
    }
    pieceId = attrs.id ?? null;
    visualStateId = attrs.visualState ?? null;
  }

  // <trait ...>
  const traits: Array<Record<string, unknown>> = [];
  const traitRe = /<trait\s+([^/>]+)\/?>/gi;
  let tm: RegExpExecArray | null = traitRe.exec(inner);
  while (tm !== null) {
    const attrs: Record<string, unknown> = {};
    const attrRe = /(\w+)\s*=\s*["']([^"']*)["']/g;
    let am: RegExpExecArray | null = attrRe.exec(tm[1]!);
    while (am !== null) {
      const key = am[1]!;
      const val = am[2]!;
      attrs[key] = /^-?\d+(\.\d+)?$/.test(val) ? Number(val) : val;
      am = attrRe.exec(tm[1]!);
    }
    if (attrs.kind) traits.push(attrs);
    tm = traitRe.exec(inner);
  }

  return { pieceId, visualStateId, traits };
}

type ProcessedFile = {
  file: string;
  ext: string;
  fullPath: string;
  basename: string;
  category: string;
  imagePath: string;
  width: number;
  height: number;
  traits: Array<Record<string, unknown>>;
  pieceIdFromSvg: string | null;
  visualStateIdFromSvg: string | null;
  wasResized: boolean;
  isSquare: boolean;
};

async function processFile(category: string, file: string): Promise<ProcessedFile> {
  const ext = file.split(".").pop()!.toLowerCase();
  if (!isImageExt(ext)) {
    throw new Error(`Unsupported extension: ${ext}`);
  }
  const fullPath = join(TEXTURES_DIR, category, file);
  const basename = file.replace(/\.[^.]+$/, "");

  let imagePath: string;
  let dims: { width: number; height: number };
  let traits: Array<Record<string, unknown>> = [];
  let pieceIdFromSvg: string | null = null;
  let visualStateIdFromSvg: string | null = null;

  if (ext === "svg") {
    const raw = readFileSync(fullPath, "utf-8");
    const meta = parseMetadata(raw);
    traits = meta.traits;
    pieceIdFromSvg = meta.pieceId;
    visualStateIdFromSvg = meta.visualStateId;
    optimizeSvg(fullPath);
    dims = readSvgDimensions(fullPath);
    imagePath = `/pieces/textures/${category}/${file}`;
  } else {
    dims = readRasterDimensions(fullPath);
    await generateWebpVariant(fullPath, ext, category, basename);
    imagePath = `/pieces/textures/${category}/${basename}.webp`;
  }

  return {
    file,
    ext,
    fullPath,
    basename,
    category,
    imagePath,
    width: dims.width,
    height: dims.height,
    traits,
    pieceIdFromSvg,
    visualStateIdFromSvg,
    wasResized: ext !== "svg",
    isSquare: dims.width === dims.height,
  };
}

function listFilesRecursive(root: string, skipDirNames: string[] = []): string[] {
  const out: string[] = [];
  function walk(dir: string, rel: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && skipDirNames.includes(entry.name)) continue;
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), entryRel);
      } else if (entry.isFile()) {
        out.push(entryRel);
      }
    }
  }
  walk(root, "");
  return out;
}

function deleteOrphans(
  root: string,
  expected: Set<string>,
  skipExts: string[] = [],
  skipDirNames: string[] = [],
): string[] {
  const removed: string[] = [];
  const all = listFilesRecursive(root, skipDirNames);
  for (const rel of all) {
    if (expected.has(rel)) continue;
    const ext = rel.split(".").pop()!.toLowerCase();
    if (skipExts.includes(ext)) continue;
    if (!isImageExt(ext)) continue;
    const full = join(root, rel);
    try {
      unlinkSync(full);
      removed.push(rel);
    } catch (err) {
      console.error(`  ✗ Failed to delete ${rel}:`, err);
    }
  }
  function rmdirEmpty(dir: string, rel: string): void {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && skipDirNames.includes(e.name)) continue;
      if (e.isDirectory()) {
        rmdirEmpty(join(dir, e.name), `${rel}/${e.name}`);
      }
    }
    const remaining = readdirSync(dir);
    if (remaining.length === 0) {
      try {
        rmdirSync(dir);
      } catch {}
    }
  }
  rmdirEmpty(root, "");
  return removed;
}

async function main() {
  if (!existsSync(TEXTURES_DIR)) {
    console.error(`✗ Textures dir not found: ${TEXTURES_DIR}`);
    process.exit(1);
  }

  const processed: ProcessedFile[] = [];
  const warnings: string[] = [];
  let resized = 0;
  let optimized = 0;
  let webpGenerated = 0;

  const categories = readdirSync(TEXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);

  // Pass 1: process every file.
  for (const category of categories) {
    const dir = join(TEXTURES_DIR, category);
    const files = readdirSync(dir).filter((f) => {
      const ext = f.split(".").pop()!.toLowerCase();
      return isImageExt(ext);
    });

    for (const file of files) {
      try {
        const r = await processFile(category, file);
        processed.push(r);
        if (r.wasResized) resized++;
        if (r.ext === "svg") optimized++;
        else webpGenerated++;
        if (!r.isSquare) {
          warnings.push(
            `⚠ ${category}/${file} no es cuadrado (${r.width}×${r.height}px).`,
          );
        }
      } catch (err) {
        console.error(`✗ ${category}/${file}:`, err);
        process.exitCode = 1;
      }
    }
  }

  // Pass 2: group files into Pieces.
  interface PieceRecord {
    id: string;
    category: PieceCategory;
    visualStates: Array<{
      id: string;
      imagePath: string;
      width: number;
      height: number;
      isDefault: boolean;
      traits: Array<Record<string, unknown>>;
    }>;
    traits: Array<Record<string, unknown>>;
  }
  const pieceById = new Map<string, PieceRecord>();

  for (const f of processed) {
    const pieceId = f.pieceIdFromSvg ?? `${f.category}-${f.basename}`;
    // If the file declared a visualState, use that; otherwise derive from
    // the basename (last segment after the piece prefix).
    let visualStateId = f.visualStateIdFromSvg ?? "default";
    if (!f.visualStateIdFromSvg && f.pieceIdFromSvg) {
      // e.g. piece="door", basename="closed" → visualState="closed"
      visualStateId = f.basename.split("-").pop() ?? "default";
    }

    let piece = pieceById.get(pieceId);
    if (!piece) {
      piece = {
        id: pieceId,
        category: isValidCategory(f.category) ? f.category : "other",
        visualStates: [],
        traits: [],
      };
      pieceById.set(pieceId, piece);
    }

    const isDefault = piece.visualStates.length === 0;
    piece.visualStates.push({
      id: visualStateId,
      imagePath: f.imagePath,
      width: f.width,
      height: f.height,
      isDefault,
      traits: f.traits,
    });
    // Dedupe traits by `kind` so a piece with N visual states doesn't get N
// copies of the same trait. Each SVG file can declare the same trait; only
// the first occurrence per kind wins.
for (const t of f.traits) {
  if (!piece.traits.some((existing) => existing.kind === t.kind)) {
    piece.traits.push(t);
  }
}
  }

  const pieces: Piece[] = [];
  for (const rec of pieceById.values()) {
    rec.visualStates.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.id.localeCompare(b.id);
    });
    const def = rec.visualStates.find((v) => v.isDefault) ?? rec.visualStates[0]!;
    pieces.push({
      id: rec.id,
      name: prettifyBasename(rec.id),
      category: rec.category,
      visualStates: rec.visualStates.map<VisualState>((v) => ({
        id: v.id,
        imagePath: v.imagePath,
        ...(v.isDefault ? { isDefault: true } : {}),
      })),
      width: def.width,
      height: def.height,
      tags: [rec.category],
      ...(rec.traits.length > 0
        ? { traits: rec.traits as unknown as Piece["traits"] }
        : {}),
    });
  }
  pieces.sort((a, b) => a.id.localeCompare(b.id));

  const catalogContent = `// Auto-generated by src/assets/scripts/generate-catalog.ts
// Run \`pnpm gen-cat\` after adding or changing pieces.

import type { Piece } from "@/lib/shared/types";

export const ALL_PIECES: Piece[] = ${JSON.stringify(pieces, null, 2)};

/** @deprecated use ALL_PIECES. Kept for backwards compat during migration. */
export const ALL_TEXTURES: Piece[] = ALL_PIECES;

export function findPiece(pieceId: string): Piece | undefined {
  return ALL_PIECES.find((p) => p.id === pieceId);
}

/** @deprecated use findPiece. */
export function findTexture(pieceId: string): Piece | undefined {
  return findPiece(pieceId);
}

`;

  writeFileSync(CATALOG_PATH, catalogContent, "utf-8");

  // Cleanup: only SVGs and WebPs derived from raster sources stay on disk.
  // Anything else (JPG/PNG) is considered residue.
  const expectedSources = new Set<string>();
  for (const r of processed) {
    expectedSources.add(`${r.category}/${r.ext === "svg" ? r.file : `${r.basename}.webp`}`);
  }
  const orphanSources = deleteOrphans(TEXTURES_DIR, expectedSources, ["svg"]);

  const totalOrphans = orphanSources.length;

  console.log(
    `\n✓ Generated ${pieces.length} piece(s) (${processed.length} file(s)) → ${relative(REPO_ROOT, CATALOG_PATH)}`,
  );
  if (resized > 0) {
    console.log(`  Resized ${resized} oversized file(s) to max ${MAX_SIZE}px`);
  }
  if (optimized > 0) {
    console.log(`  Optimized ${optimized} SVG(s) (kept as .svg — vector is best for tiles)`);
  }
  if (webpGenerated > 0) {
    console.log(`  Generated ${webpGenerated} WebP variant(s) for raster sources`);
  }
  if (totalOrphans > 0) {
    console.log(`  Removed ${totalOrphans} orphan file(s):`);
    for (const o of orphanSources) {
      console.log(`    ✗ ${o}`);
    }
  }
  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ${w}`);
  }
  void statSync;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});