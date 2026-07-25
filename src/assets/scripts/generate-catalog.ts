// Catalog generator + texture processor.
//
// Run: pnpm gen-cat (from repo root)

import {
  existsSync,
  mkdirSync,
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
import type { PieceCategory, Texture } from "@/pieces";

// The script is run from the project root (where public/ and src/ live).
const REPO_ROOT = process.cwd();
const TEXTURES_DIR = join(REPO_ROOT, "public/pieces/textures");
const THUMBS_DIR = join(TEXTURES_DIR, "_thumbs");
const CATALOG_PATH = join(REPO_ROOT, "src/assets/catalog.ts");

const MAX_SIZE = 128;
const THUMB_SIZE = 256;

const VALID_CATEGORIES: PieceCategory[] = [
  "wall",
  "floor",
  "door",
  "water",
  "lava",
  "decoration",
  "other",
];

const IMAGE_EXTS = ["svg", "png", "jpg", "jpeg", "webp"] as const;
type ImageExt = (typeof IMAGE_EXTS)[number];

function isImageExt(s: string): s is ImageExt {
  return (IMAGE_EXTS as readonly string[]).includes(s);
}

function prettifyBasename(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isValidCategory(c: string): c is PieceCategory {
  return (VALID_CATEGORIES as string[]).includes(c);
}

function readSvgDimensions(file: string): { width: number; height: number } {
  const raw = readFileSync(file, "utf-8");
  const viewBox = raw.match(/viewBox=["']([^"']+)["']/);
  if (viewBox) {
    const parts = viewBox[1]?.trim().split(/\s+/).map(Number);
    if (parts.length === 4) {
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

function getDimensions(file: string, ext: ImageExt): { width: number; height: number } {
  return ext === "svg" ? readSvgDimensions(file) : readRasterDimensions(file);
}

async function resizeIfNeeded(
  file: string,
  ext: ImageExt,
  dims: { width: number; height: number },
): Promise<boolean> {
  const longest = Math.max(dims.width, dims.height);
  if (longest <= MAX_SIZE) return false;
  const target =
    longest === dims.width
      ? { width: MAX_SIZE, height: Math.round((dims.height / dims.width) * MAX_SIZE) }
      : { width: Math.round((dims.width / dims.height) * MAX_SIZE), height: MAX_SIZE };
  const buf = readFileSync(file);
  if (ext === "svg") {
    const out = await sharp(buf, { density: 300 })
      .resize(target.width, target.height, { fit: "fill" })
      .png()
      .toBuffer();
    writeFileSync(file, out);
  } else {
    const out = await sharp(buf).resize(target.width, target.height, { fit: "fill" }).toBuffer();
    writeFileSync(file, out);
  }
  return true;
}

async function generateThumb(
  file: string,
  ext: ImageExt,
  categoryDir: string,
  basename: string,
): Promise<void> {
  const thumbFile = join(THUMBS_DIR, categoryDir, `${basename}.webp`);
  mkdirSync(join(THUMBS_DIR, categoryDir), { recursive: true });
  const buf = readFileSync(file);
  const sharpInput = ext === "svg" ? sharp(buf, { density: 200 }) : sharp(buf);
  await sharpInput
    .resize(THUMB_SIZE, THUMB_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 80 })
    .toFile(thumbFile);
}

async function generateWebpVariant(
  file: string,
  ext: ImageExt,
  categoryDir: string,
  basename: string,
): Promise<string> {
  const webpPath = join(TEXTURES_DIR, categoryDir, `${basename}.webp`);
  const buf = readFileSync(file);
  if (ext === "svg") {
    await sharp(buf, { density: 300 }).webp({ quality: 90 }).toFile(webpPath);
  } else {
    await sharp(buf).webp({ quality: 90 }).toFile(webpPath);
  }
  return webpPath;
}

function optimizeSvg(file: string): void {
  const raw = readFileSync(file, "utf-8");
  const result = svgoOptimize(raw, {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: { overrides: { removeViewBox: false } },
      },
    ],
  });
  if ("data" in result) {
    writeFileSync(file, result.data, "utf-8");
  }
}

type ProcessedTexture = {
  texture: Texture;
  category: string;
  basename: string;
  sourceFile: string;
  isSquare: boolean;
  wasResized: boolean;
  originalSize: { width: number; height: number };
};

async function processTexture(category: string, file: string): Promise<ProcessedTexture> {
  const ext = file.split(".").pop()?.toLowerCase();
  if (!isImageExt(ext)) {
    throw new Error(`Unsupported extension: ${ext}`);
  }
  const fullPath = join(TEXTURES_DIR, category, file);
  const basename = file.replace(/\.[^.]+$/, "");

  const originalDims = getDimensions(fullPath, ext);
  const wasResized = await resizeIfNeeded(fullPath, ext, originalDims);
  const finalDims = wasResized ? getDimensions(fullPath, ext) : originalDims;

  if (ext === "svg") {
    optimizeSvg(fullPath);
  }

  let imagePath: string;
  if (ext === "svg") {
    imagePath = `/pieces/textures/${category}/${file}`;
  } else {
    await generateWebpVariant(fullPath, ext, category, basename);
    imagePath = `/pieces/textures/${category}/${basename}.webp`;
  }

  await generateThumb(fullPath, ext, category, basename);

  const cat: PieceCategory = isValidCategory(category) ? category : "other";
  const texture: Texture = {
    id: `${category}-${basename}`,
    name: prettifyBasename(basename),
    imagePath,
    width: finalDims.width,
    height: finalDims.height,
    category: cat,
    tags: [category],
  };

  return {
    texture,
    category,
    basename,
    sourceFile: file,
    isSquare: finalDims.width === finalDims.height,
    wasResized,
    originalSize: originalDims,
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
    const ext = rel.split(".").pop()?.toLowerCase();
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

  const processed: ProcessedTexture[] = [];
  const warnings: string[] = [];
  let resized = 0;
  let optimized = 0;
  let webpGenerated = 0;
  let _svgKept = 0;

  const categories = readdirSync(TEXTURES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);

  for (const category of categories) {
    const dir = join(TEXTURES_DIR, category);
    const files = readdirSync(dir).filter((f) => {
      const ext = f.split(".").pop()?.toLowerCase();
      return isImageExt(ext);
    });

    for (const file of files) {
      try {
        const r = await processTexture(category, file);
        processed.push(r);
        if (r.wasResized) resized++;
        const ext = file.split(".").pop()?.toLowerCase();
        if (ext === "svg") {
          optimized++;
          _svgKept++;
        } else {
          webpGenerated++;
        }
        if (!r.isSquare) {
          warnings.push(
            `⚠ ${category}/${file} no es cuadrado (${r.texture.width}×${r.texture.height}px). Se registrará con sus dimensiones reales.`,
          );
        }
      } catch (err) {
        console.error(`✗ ${category}/${file}:`, err);
        process.exitCode = 1;
      }
    }
  }

  const catalogContent = `// Auto-generated by src/assets/scripts/generate-catalog.ts
// Run \`pnpm gen-cat\` after adding or changing textures.

import type { Texture } from "@/pieces";

export const ALL_TEXTURES: Texture[] = ${JSON.stringify(
    processed.map((r) => r.texture),
    null,
    2,
  )};

export function findTexture(textureId: string): Texture | undefined {
  return ALL_TEXTURES.find((t) => t.id === textureId);
}

export function findTexturesByIds(ids: string[]): Texture[] {
  return ids
    .map((id) => findTexture(id))
    .filter((t): t is Texture => t !== undefined);
}
`;

  writeFileSync(CATALOG_PATH, catalogContent, "utf-8");

  const expectedSources = new Set<string>();
  const expectedWebps = new Set<string>();
  const expectedThumbs = new Set<string>();
  for (const r of processed) {
    expectedSources.add(`${r.category}/${r.sourceFile}`);
    if (!r.sourceFile.endsWith(".svg")) {
      expectedWebps.add(`${r.category}/${r.basename}.webp`);
    }
    expectedThumbs.add(`${r.category}/${r.basename}.webp`);
  }

  const orphanSources = deleteOrphans(TEXTURES_DIR, expectedSources, [], ["_thumbs"]);
  const orphanWebps = deleteOrphans(TEXTURES_DIR, expectedWebps, ["svg"], ["_thumbs"]);
  const orphanThumbs = deleteOrphans(THUMBS_DIR, expectedThumbs);

  const totalOrphans = orphanSources.length + orphanWebps.length + orphanThumbs.length;

  console.log(
    `\n✓ Generated ${processed.length} texture(s) → ${relative(REPO_ROOT, CATALOG_PATH)}`,
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
  console.log(`  Generated ${processed.length} thumbnail(s) in _thumbs/`);
  if (totalOrphans > 0) {
    console.log(`  Removed ${totalOrphans} orphan file(s):`);
    for (const o of [...orphanSources, ...orphanWebps, ...orphanThumbs]) {
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
