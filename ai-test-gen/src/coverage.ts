import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

export interface GapFile {
  sourcePath: string;
  relativePath: string;
  suggestedFeature: string;
}

export async function findCoverageGaps(
  sourceDir: string,
  testDir: string,
  workspaceRoot: string,
): Promise<GapFile[]> {
  if (!fs.existsSync(sourceDir)) return [];

  const sourceFiles = await glob(`${sourceDir}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/*.spec.ts', '**/*.spec.tsx',
             '**/*.test.ts', '**/*.test.tsx', '**/*.d.ts',
             '**/index.ts', '**/index.tsx'],
  });

  if (sourceFiles.length === 0) return [];

  let specNormalized: string[] = [];
  if (fs.existsSync(testDir)) {
    const specFiles = await glob(`${testDir}/**/*.spec.{ts,tsx}`, {
      ignore: '**/node_modules/**',
    });
    specNormalized = specFiles.map((f) => {
      const base = path.basename(f).replace(/\.spec\.(tsx?)$/, '');
      return normalizeForMatching(base);
    });
  }

  const gaps: GapFile[] = [];
  for (const sourcePath of sourceFiles) {
    const base = path.basename(sourcePath, path.extname(sourcePath));
    const normalized = normalizeForMatching(base);
    const isCovered = specNormalized.some(
      (s) => s.includes(normalized) || normalized.includes(s),
    );
    if (!isCovered) {
      gaps.push({
        sourcePath,
        relativePath: path.relative(workspaceRoot, sourcePath),
        suggestedFeature: suggestedFeature(sourcePath),
      });
    }
  }

  return gaps.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function normalizeForMatching(filename: string): string {
  return filename
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function suggestedFeature(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  const words = base
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return words.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
