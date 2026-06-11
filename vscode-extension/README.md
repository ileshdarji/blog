# QA Gen — AI Playwright Test Generator

**VS Code extension** by [QA with Ilesh](https://ileshdarji.com).

Generate Playwright tests from a plain-English feature description, directly inside VS Code. Powered by Claude AI.

---

## Features

### Generate Tests
**Command palette:** `QA Gen: Generate Tests`

1. Type a feature description: *"User can reset their password via email link"*
2. Optionally provide a URL
3. QA Gen scans your existing test suite to learn your patterns
4. Claude generates a `.spec.ts` file that matches your conventions
5. The file opens in your editor, ready to review

### Find Coverage Gaps
**Command palette:** `QA Gen: Find Coverage Gaps`

Scans your `src/` directory for TypeScript files that have no corresponding spec file. Shows a list — click any entry to generate tests for it immediately.

### Status Bar
Click **`$(beaker) QA Gen`** in the bottom-right status bar to open a quick command menu.

---

## Setup

### 1. Get an Anthropic API key
[console.anthropic.com](https://console.anthropic.com) → Create key

### 2. Set the key in VS Code
Run `QA Gen: Set API Key` from the command palette. Your key is stored in VS Code's SecretStorage — never in plaintext settings.

### 3. Configure directories (optional)

Open `Settings → Extensions → QA Gen`:

| Setting | Default | Description |
|---|---|---|
| `qaGen.testDirectory` | `tests` | Where your existing Playwright specs live |
| `qaGen.outputDirectory` | `tests/generated` | Where generated specs are written |
| `qaGen.sourceDirectory` | `src` | Scanned for coverage gaps |
| `qaGen.model` | `claude-sonnet-4-6` | Claude model to use |

---

## How It Works

```
SCAN   Read up to 3 existing spec files → detect fixtures, selector
       strategy (data-testid / aria / css), import paths

PROMPT Build a context-rich prompt with your codebase conventions
       + the feature description you provided

GENERATE  Claude writes a .spec.ts file that looks like it was
          written by a human who already knows your codebase

WRITE  File appears in your editor — you review, fix, and commit
```

---

## Part of the QA Gen Ecosystem

This extension is part of the broader **qa-gen** toolchain:

- **CLI** (`npx qa-gen generate`) — terminal-first workflow
- **VS Code Extension** (this) — inline generation inside the editor
- **GitHub Action** — generate tests on PR creation (coming in workflow)

---

## ⚠️ Review Before Committing

AI-generated tests are a starting point. Always:
1. Verify selectors match your actual DOM
2. Check test data suits your environment
3. Run `npx playwright test <file>` and fix failures
4. Commit only when tests genuinely pass and make sense

---

Built by [Ilesh Darji](https://ileshdarji.com) · [The QA Edge Newsletter](https://ileshdarji.com/newsletter/)
