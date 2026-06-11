export interface CodebaseProfile {
  /** Raw content of up to 3 example spec files */
  exampleTests: Array<{ filename: string; content: string }>;
  /** Raw content of any fixture files found */
  fixtures: Array<{ filename: string; content: string }>;
  /** Detected selector strategy */
  selectorStrategy: 'data-testid' | 'aria' | 'css' | 'mixed' | 'unknown';
  /** Common import line shared across tests */
  commonImports: string[];
  /** Whether the project uses page objects */
  hasPageObjects: boolean;
  /** Detected test runner import path (e.g. '@playwright/test' or './fixtures') */
  testImportPath: string;
}

export interface GenerateOptions {
  /** Human-readable feature/story description */
  feature: string;
  /** Optional URL the tests should navigate to */
  url?: string;
  /** Root directory of the existing test suite */
  testDir: string;
  /** Directory to write generated test files into */
  outputDir: string;
  /** Claude model to use */
  model: string;
  /** If true, print the raw Claude response before writing */
  verbose: boolean;
}

export interface GeneratedFile {
  filename: string;
  content: string;
  tokensUsed: number;
}
