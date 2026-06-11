/**
 * Shared types for the QA Gen VS Code extension.
 */

/** Profile built from scanning an existing test suite. */
export interface CodebaseProfile {
  /** Raw content of up to 3 example spec files found in the test directory. */
  exampleTests: Array<{ filename: string; content: string }>;
  /** Raw content of any fixture files found. */
  fixtures: Array<{ filename: string; content: string }>;
  /** Dominant selector strategy detected from example tests. */
  selectorStrategy: 'data-testid' | 'aria' | 'css' | 'mixed' | 'unknown';
  /** Import lines that appear in every example file. */
  commonImports: string[];
  /** Whether the project uses Page Object classes. */
  hasPageObjects: boolean;
  /** Detected test runner import path (e.g. '@playwright/test' or './fixtures'). */
  testImportPath: string;
}

/** Options passed to the test generator. */
export interface GenerateOptions {
  /** Human-readable feature / user story description. */
  feature: string;
  /** Optional URL the tests should navigate to. */
  url?: string;
  /** Absolute path to the existing test directory (for scanning). */
  testDir: string;
  /** Absolute path to the output directory. */
  outputDir: string;
  /** Claude model identifier. */
  model: string;
}

/** The generated test file returned by the generator. */
export interface GeneratedFile {
  /** Filename only, e.g. "user-login.spec.ts". */
  filename: string;
  /** Full TypeScript source content. */
  content: string;
  /** Total tokens consumed in the API call. */
  tokensUsed: number;
}

/** A source file that has no corresponding spec file. */
export interface GapFile {
  /** Absolute path to the source file. */
  sourcePath: string;
  /** Path relative to the workspace root (for display). */
  relativePath: string;
  /** Human-readable feature name derived from the filename. */
  suggestedFeature: string;
}
