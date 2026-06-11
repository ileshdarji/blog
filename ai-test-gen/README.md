# qa-gen

**AI-powered Playwright test generator** by [QA with Ilesh](https://ileshdarji.com).

Scans your existing Playwright test suite, learns your patterns and conventions, then generates tests that look like they were written by a human who already knows your codebase.

```bash
npx qa-gen generate --feature "User can reset their password" --url https://myapp.com/auth/reset
```

---

## Why qa-gen Exists

Test maintenance is the silent killer of QA productivity.

Teams spend 40–60% of their automation time maintaining existing tests — not writing new ones. When a new feature ships, writing the test is the last thing a QA engineer has time for.

`qa-gen` solves the blank-page problem. It doesn't replace the QA engineer — it handles the boilerplate so you can focus on the review, the edge cases, and the strategy.

---

## How It Works

```
1. SCAN    Read your existing spec files → detect fixtures, selector strategy,
           import patterns, naming conventions
           
2. GENERATE  Send a carefully engineered prompt to Claude with your codebase 
             context + the feature description
             
3. WRITE   Output a .spec.ts file in your chosen directory, ready to review
```

The generated test matches your team's conventions because Claude has seen your actual test code — not a generic template.

---

## Installation

```bash
# Run directly (no install needed)
npx qa-gen generate --feature "..."

# Or install globally
npm install -g qa-gen

# Or clone this repo and run locally
cd ai-test-gen
npm install
npm run dev -- generate --feature "..."
```

---

## Prerequisites

You need an Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Get one at [console.anthropic.com](https://console.anthropic.com).

---

## Usage

### Generate tests for a feature

```bash
qa-gen generate \
  --feature "User can log in with email and password" \
  --url https://myapp.com/login \
  --test-dir tests \
  --output tests/generated
```

### Scan your test suite (no generation)

```bash
qa-gen scan --test-dir tests
```

Example output:
```
  Spec files found:     12
  Fixture files found:  2
  Page objects:         yes
  Selector strategy:    data-testid
  Test import path:     ./fixtures
```

### All options

| Option | Default | Description |
|--------|---------|-------------|
| `-f, --feature` | *required* | Feature description or user story |
| `-u, --url` | — | URL to navigate to in tests |
| `-d, --test-dir` | `tests` | Root directory of your existing tests |
| `-o, --output` | `tests/generated` | Output directory for generated files |
| `-m, --model` | `claude-sonnet-4-6` | Claude model to use |
| `--verbose` | false | Print raw Claude response |

---

## GitHub Action

Trigger test generation directly from GitHub without any local setup.

### Setup

1. Add your API key to GitHub Secrets: `Settings → Secrets → ANTHROPIC_API_KEY`

2. The workflow file is already included at `.github/workflows/generate-tests.yml`

3. Run it: `Actions → QA Gen — AI Test Generator → Run workflow`

Fill in:
- **Feature** — plain English description
- **URL** — optional, where to navigate
- **Test directory** — where your existing tests live (to learn patterns)

The action will generate the test and open a PR for your review.

---

## What Gets Generated

For a feature like `"User can reset their password"`:

```typescript
import { test, expect } from './fixtures';

test.describe('Password Reset', () => {
  test('sends reset email for valid account', async ({ page }) => {
    // Arrange
    await page.goto('/auth/reset');

    // Act
    await test.step('Enter registered email', async () => {
      await page.getByTestId('email-input').fill('user@example.com');
      await page.getByTestId('reset-submit').click();
    });

    // Assert
    await expect(page.getByTestId('success-message'))
      .toContainText('Check your email');
  });

  test('shows error for unregistered email', async ({ page }) => {
    await page.goto('/auth/reset');
    await page.getByTestId('email-input').fill('notregistered@example.com');
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('error-message'))
      .toContainText('No account found');
  });

  test('validates email format before submitting', async ({ page }) => {
    await page.goto('/auth/reset');
    await page.getByTestId('email-input').fill('not-an-email');
    await page.getByTestId('reset-submit').click();
    await expect(page.getByTestId('email-input'))
      .toHaveAttribute('aria-invalid', 'true');
  });
});
```

If your existing tests use a different selector strategy, custom fixtures, or page objects — the generated code will match those patterns instead.

---

## Review Before You Commit

`qa-gen` generates a starting point. Always:

1. Open the file and read every line
2. Verify selectors match your actual DOM
3. Check test data is appropriate for your environment
4. Run `npx playwright test <generated-file>` and fix failures
5. Commit only when the tests genuinely pass and make sense

---

## Roadmap

This is v0.1 — the wedge product. The vision is bigger:

- [ ] Auto-detect when code changes break existing tests and suggest fixes
- [ ] Risk scoring: predict which areas of the codebase need more test coverage
- [ ] VS Code extension: generate tests inline without leaving the editor
- [ ] Coverage gap analysis: find what's untested in the codebase
- [ ] Continuous quality monitoring: a CI-native quality intelligence layer

---

## Built By

[Ilesh Darji](https://ileshdarji.com) — Senior QA Engineer and contractor.
Read the [QA with Ilesh blog](https://ileshdarji.com) and subscribe to
[The QA Edge newsletter](https://ileshdarji.com/newsletter/) for weekly QA insights.

---

## License

MIT
