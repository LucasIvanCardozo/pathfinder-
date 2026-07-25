// Catalog generator + texture processor.
//
// Run: pnpm gen-cat (from repo root)

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
import type { PieceCategory, Texture } from "@/pieces";

// The script is run from the project root (where public/ and src/ live).
const REPO_ROOT = process.cwd();
const TEXTURES_DIR = join(REPO_ROOT, "public/pieces/textures");
const CATALOG_PATH = join(REPO_ROOT, "src/assets/catalog.ts");

const MAX_SIZE = 128;

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
  const ext = file.split(".").pop()!.toLowerCase();
  if (!isImageExt(ext)) {
    throw new Error(`Unsupported extension: ${ext}`);
  }
  const fullPath = join(TEXTURES_DIR, category, file);
  const basename = file.replace(/\.[^.]+$/, "");

  let imagePath: string;
  let finalDims: { width: number; height: number };
  let originalDims: { width: number; height: number };

  if (ext === "svg") {
    optimizeSvg(fullPath);
    originalDims = readSvgDimensions(fullPath);
    finalDims = originalDims;
    imagePath = `/pieces/textures/${category}/${file}`;
  } else {
    originalDims = readRasterDimensions(fullPath);
    // Raster sources always become a square MAX_SIZE×MAX_SIZE cover crop.
    finalDims = { width: MAX_SIZE, height: MAX_SIZE };
    await generateWebpVariant(fullPath, ext, category, basename);
    imagePath = `/pieces/textures/${category}/${basename}.webp`;
  }

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
    // The "source" is whatever stays on disk: .svg for SVGs, .webp for rasters.
    sourceFile: ext === "svg" ? file : `${basename}.webp`,
    isSquare: true, // After cover, every output is square.
    wasResized: ext !== "svg",
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
  const ext = f.split(".").pop()!.toLowerCase();
      return isImageExt(ext);
    });

    for (const file of files) {
      try {
        const r = await processTexture(category, file);
        processed.push(r);
        if (r.wasResized) resized++;
      const ext = file.split(".").pop()!.toLowerCase();
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

  // expectedSources = archivos canónicos que deben quedar en disco:
  //   - SVGs (.svg) — vectoriales
  //   - WebPs (.webp) derivados de raster sources
  // Cualquier JPG/PNG/WebP no esperado se considera residuo y se borra.
  // expectedSources = archivos canónicos que deben quedar en disco:
  //   - SVGs (.svg) — vectoriales
  //   - WebPs (.webp) derivados de raster sources
  // Cualquier JPG/PNG/WebP no esperado se considera residuo y se borra.
  const expectedSources = new Set<string>();
  for (const r of processed) {
    expectedSources.add(`${r.category}/${r.sourceFile}`);
  }

  // Una sola pasada en TEXTURES_DIR: skippea SVGs (no se borran), borra
  // cualquier otro archivo de imagen que no esté esperado (incluye JPGs/PNGs
  // originales que ya se convirtieron a WebP).
  const orphanSources = deleteOrphans(TEXTURES_DIR, expectedSources, ["svg"]);

  const totalOrphans = orphanSources.length;

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
