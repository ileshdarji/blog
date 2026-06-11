/**
 * generator.ts — Calls the Claude API to generate Playwright test files.
 * Adapted from the qa-gen CLI generator, using SecretStorage-provided API key.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { CodebaseProfile, GenerateOptions, GeneratedFile } from './types';

/**
 * Generate a Playwright test file using Claude.
 * @param options  Generation options (feature, url, model, etc.)
 * @param profile  Codebase profile built by scanTestSuite()
 * @param apiKey   Anthropic API key retrieved from VS Code SecretStorage
 */
export async function generateTests(
  options: GenerateOptions,
  profile: CodebaseProfile,
  apiKey: string,
): Promise<GeneratedFile> {
  const client = new Anthropic({ apiKey });

  const system = buildSystemPrompt(profile);
  const user = buildUserPrompt(options, profile);

  const response = await client.messages.create({
    model: options.model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const firstBlock = response.content[0];
  if (firstBlock.type !== 'text') {
    throw new Error(`Unexpected Claude response content type: ${firstBlock.type}`);
  }

  const code = extractCode(firstBlock.text);
  const filename = featureToFilename(options.feature);
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

  return { filename, content: code, tokensUsed };
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystemPrompt(profile: CodebaseProfile): string {
  const parts: string[] = [
    'You are an expert Playwright test engineer. Your job is to generate production-ready TypeScript Playwright test files.',
    'You MUST follow the conventions of the existing test suite shown below.',
    'Return ONLY valid TypeScript code with no markdown fences, no explanation, and no commentary.',
  ];

  if (profile.exampleTests.length > 0) {
    parts.push('\n## Existing Tests — Learn These Patterns Exactly\n');
    for (const ex of profile.exampleTests) {
      parts.push(`### ${ex.filename}\n\`\`\`typescript\n${ex.content}\n\`\`\``);
    }
  } else {
    parts.push('\n## No Existing Tests Found');
    parts.push(
      'Use standard Playwright best practices: TypeScript, async/await, proper expect() assertions, and semantic or data-testid locators.',
    );
  }

  if (profile.fixtures.length > 0) {
    parts.push('\n## Available Fixtures\n');
    for (const fx of profile.fixtures) {
      parts.push(`### ${fx.filename}\n\`\`\`typescript\n${fx.content}\n\`\`\``);
    }
    parts.push('\nImport from these fixture files, not directly from @playwright/test.');
  }

  parts.push('\n## Strict Rules');
  parts.push(conventionRules(profile));

  return parts.join('\n');
}

function buildUserPrompt(options: GenerateOptions, profile: CodebaseProfile): string {
  const lines: string[] = [];

  lines.push(`Generate a complete Playwright test file for the following feature:\n`);
  lines.push(`**Feature:** ${options.feature}`);
  if (options.url) {
    lines.push(`**URL:** ${options.url}`);
  }

  lines.push(`\n**Required test cases:**`);
  lines.push(`1. Happy path — the main successful flow`);
  lines.push(`2. Validation errors — what happens with bad/missing input`);
  lines.push(`3. Edge case — boundary condition, empty state, or permission check`);
  lines.push(
    `4. (Optional) Any additional case that a senior QA engineer would flag as high risk`,
  );

  lines.push(`\n**Import path for test/expect:** \`${profile.testImportPath}\``);

  if (profile.selectorStrategy !== 'unknown') {
    lines.push(
      `**Selector strategy detected in this codebase:** ${profile.selectorStrategy}`,
    );
  }

  lines.push(`\nReturn ONLY the TypeScript file content. No markdown, no explanation.`);

  return lines.join('\n');
}

function conventionRules(profile: CodebaseProfile): string {
  const rules: string[] = [];

  rules.push(`- Use the same import path as detected: \`${profile.testImportPath}\``);

  switch (profile.selectorStrategy) {
    case 'data-testid':
      rules.push('- Use data-testid attributes: `page.locator(\'[data-testid="..."]\')`');
      break;
    case 'aria':
      rules.push('- Prefer ARIA locators: getByRole(), getByLabel(), getByPlaceholder()');
      break;
    case 'css':
      rules.push('- Use CSS selectors via page.locator()');
      break;
    default:
      rules.push('- Prefer getByRole() and getByTestId() for reliable selectors');
  }

  if (profile.hasPageObjects) {
    rules.push(
      '- This codebase uses Page Object classes — reference them in tests where appropriate',
    );
  }

  rules.push('- Wrap related tests in `test.describe()` blocks');
  rules.push('- Use `await expect()` for all assertions — never raw assert()');
  rules.push('- Add `test.step()` for multi-step operations to improve test reporting');
  rules.push(
    '- Handle async operations with proper Playwright waiting — no `page.waitForTimeout()`',
  );
  rules.push('- Add `// Arrange / Act / Assert` section comments for readability');

  return rules.join('\n');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function extractCode(text: string): string {
  // Strip markdown code fences if Claude wrapped the output anyway
  const fenced = text.match(/```(?:typescript|ts)?\n([\s\S]+?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export function featureToFilename(feature: string): string {
  const slug = feature
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return `${slug}.spec.ts`;
}
