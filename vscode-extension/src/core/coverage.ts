/**
 * coverage.ts — Finds source files that have no corresponding spec file.
 * Used by the "QA Gen: Find Coverage Gaps" command.
 */

import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import type { GapFile } from './types';

/**
 * Convert a filename (without extension) to kebab-case for fuzzy matching.
 *
 * Examples:
 *   LoginPage    → login-page
 *   userAuth     → user-auth
 *   APIClient    → api-client
 *   my_component → my-component
 */
export function normalizeForMatching(filename: string): string {
  return (
    filename
      // Insert hyphen before sequences of uppercase letters followed by lowercase
      // e.g. "APIClient" → "API-Client"
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      // Insert hyphen between lowercase/digit and uppercase
      // e.g. "loginPage" → "login-Page", "getV2Route" → "get-V2-Route"
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      // Replace underscores and spaces with hyphens
      .replace(/[_\s]+/g, '-')
      .toLowerCase()
  );
}

/**
 * Derive a human-readable feature name from a source filename.
 * e.g. "LoginPage.tsx" → "Login Page", "userAuth.ts" → "User Auth"
 */
function suggestedFeatureFromPath(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  // Convert kebab/snake/camel to title case words
  const words = base
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();

  return words
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Find all .ts/.tsx source files in `sourceDir` that have no corresponding
 * spec file in `testDir`.
 *
 * Matching logic: a source file "Foo.tsx" is considered covered if any spec
 * filename (without extension) contains the kebab-case normalized base name of
 * the source file as a substring.
 *
 * @param sourceDir   Absolute path to the source directory (e.g. /workspace/src)
 * @param testDir     Absolute path to the test directory (e.g. /workspace/tests)
 * @param workspaceRoot  Absolute path to workspace root (for relativePath)
 * @returns           Array of GapFile entries for uncovered source files
 */
export async function findCoverageGaps(
  sourceDir: string,
  testDir: string,
  workspaceRoot: string,
): Promise<GapFile[]> {
  const sourceDirExists = fs.existsSync(sourceDir);
  const testDirExists = fs.existsSync(testDir);

  if (!sourceDirExists) {
    return [];
  }

  // ── Collect source files ───────────────────────────────────────────────────
  const sourceFiles = await glob(`${sourceDir}/**/*.{ts,tsx}`, {
    ignore: [
      '**/node_modules/**',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.d.ts',
      '**/index.ts',
      '**/index.tsx',
    ],
  });

  if (sourceFiles.length === 0) {
    return [];
  }

  // ── Collect spec filenames ─────────────────────────────────────────────────
  let specNormalized: string[] = [];

  if (testDirExists) {
    const specFiles = await glob(`${testDir}/**/*.spec.{ts,tsx}`, {
      ignore: '**/node_modules/**',
    });

    specNormalized = specFiles.map((f) => {
      // Strip .spec.ts / .spec.tsx extension, then normalize
      const base = path.basename(f).replace(/\.spec\.(tsx?)$/, '');
      return normalizeForMatching(base);
    });
  }

  // ── Match source files against specs ──────────────────────────────────────
  const gaps: GapFile[] = [];

  for (const sourcePath of sourceFiles) {
    const base = path.basename(sourcePath, path.extname(sourcePath));
    const normalized = normalizeForMatching(base);

    const isCovered = specNormalized.some(
      (specName) => specName.includes(normalized) || normalized.includes(specName),
    );

    if (!isCovered) {
      gaps.push({
        sourcePath,
        relativePath: path.relative(workspaceRoot, sourcePath),
        suggestedFeature: suggestedFeatureFromPath(sourcePath),
      });
    }
  }

  // Sort alphabetically by relative path for consistent display
  gaps.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return gaps;
}
