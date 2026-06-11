/**
 * scanner.ts — Scans an existing test suite and builds a CodebaseProfile.
 * Adapted from the qa-gen CLI scanner with Node.js fs and absolute paths.
 */

import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import type { CodebaseProfile } from './types';

const EXAMPLE_LIMIT = 3;
const FIXTURE_LIMIT = 2;
const FILE_SIZE_LIMIT = 8000; // chars — stay well within context budget

export async function scanTestSuite(testDir: string): Promise<CodebaseProfile> {
  if (!fs.existsSync(testDir)) {
    return emptyProfile();
  }

  const [specFiles, fixtureFiles, pageObjectFiles] = await Promise.all([
    glob(`${testDir}/**/*.spec.ts`, { ignore: '**/node_modules/**' }),
    glob(`${testDir}/**/fixture?(s).ts`, { ignore: '**/node_modules/**' }),
    glob(`${testDir}/**/pages/**/*.ts`, { ignore: '**/node_modules/**' }),
  ]);

  // ── Example specs ──────────────────────────────────────────────────────────
  const examples = specFiles
    .slice(0, EXAMPLE_LIMIT)
    .map((f) => ({
      filename: path.relative(testDir, f),
      content: truncate(fs.readFileSync(f, 'utf-8'), FILE_SIZE_LIMIT),
    }));

  // ── Fixtures ───────────────────────────────────────────────────────────────
  const fixtures = fixtureFiles
    .slice(0, FIXTURE_LIMIT)
    .map((f) => ({
      filename: path.relative(testDir, f),
      content: truncate(fs.readFileSync(f, 'utf-8'), FILE_SIZE_LIMIT),
    }));

  // ── Detect conventions ─────────────────────────────────────────────────────
  const allContent = examples.map((e) => e.content).join('\n');

  const selectorStrategy = detectSelectorStrategy(allContent);
  const commonImports = extractCommonImports(examples);
  const testImportPath = detectTestImportPath(allContent, fixtures.length > 0);
  const hasPageObjects = pageObjectFiles.length > 0;

  return {
    exampleTests: examples,
    fixtures,
    selectorStrategy,
    commonImports,
    hasPageObjects,
    testImportPath,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyProfile(): CodebaseProfile {
  return {
    exampleTests: [],
    fixtures: [],
    selectorStrategy: 'unknown',
    commonImports: [],
    hasPageObjects: false,
    testImportPath: '@playwright/test',
  };
}

function truncate(content: string, limit: number): string {
  if (content.length <= limit) return content;
  return content.slice(0, limit) + '\n// ... (truncated)';
}

function detectSelectorStrategy(content: string): CodebaseProfile['selectorStrategy'] {
  const hasDataTestId = /data-testid|getByTestId/.test(content);
  const hasAria = /getByRole|getByLabel|getByPlaceholder|getByAltText/.test(content);
  const hasCss = /locator\(['"]\.|querySelector/.test(content);

  const count = [hasDataTestId, hasAria, hasCss].filter(Boolean).length;
  if (count > 1) return 'mixed';
  if (hasDataTestId) return 'data-testid';
  if (hasAria) return 'aria';
  if (hasCss) return 'css';
  return 'unknown';
}

function extractCommonImports(
  examples: Array<{ filename: string; content: string }>,
): string[] {
  if (examples.length === 0) return [];

  const importSets = examples.map((e) => {
    const lines = e.content.match(/^import .+/gm) ?? [];
    return new Set(lines);
  });

  const [first, ...rest] = importSets;
  // Keep imports that appear in every example file
  const common = [...first].filter((line) => rest.every((s) => s.has(line)));
  return common;
}

function detectTestImportPath(content: string, hasFixtures: boolean): string {
  if (hasFixtures) {
    const match = content.match(/from ['"](\.[^'"]+fixtures?[^'"]*)['"]/i);
    if (match) return match[1];
  }
  return '@playwright/test';
}
