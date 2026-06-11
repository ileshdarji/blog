---
title: "Playwright Fixtures Explained — The Complete Guide"
date: 2026-06-10
categories: ["playwright"]
tags: ["playwright", "fixtures", "typescript", "testing"]
description: "Everything you need to know about Playwright fixtures — from built-ins to custom fixtures, fixture scoping, and composing fixtures for a scalable test framework."
draft: false
---

Fixtures are the most powerful feature in Playwright. They solve setup and teardown cleanly, share state safely across tests, and are the foundation of every scalable Playwright framework.

Yet most teams underuse them. They still write `beforeEach` everywhere, duplicate login logic across 40 test files, and wonder why maintenance is painful.

This guide is the one I wish I had when I started building Playwright frameworks for enterprise clients.

## What Is a Fixture?

A fixture is a function that provides something a test needs — a page, a logged-in session, a database record — and handles its own cleanup.

Playwright ships with several built-in fixtures:

```typescript
test('example', async ({ page, context, browser, request }) => {
  // page    → a new Page instance
  // context → the BrowserContext
  // browser → the Browser
  // request → APIRequestContext for API calls
});
```

You never call `browser.newPage()` yourself. Playwright handles it. When the test ends, it handles teardown too.

That's the contract: **fixtures own their lifecycle**.

## Why Fixtures Beat `beforeEach`

Here's the `beforeEach` pattern most teams start with:

```typescript
let page: Page;

beforeEach(async ({ browser }) => {
  page = await browser.newPage();
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'secret');
  await page.click('[type=submit]');
});
```

Problems:
- The `page` variable leaks outside the test
- If setup fails, the teardown might not run
- You can't reuse this across different test files cleanly
- Scoping is manual and error-prone

With a fixture:

```typescript
// fixtures.ts
import { test as base } from '@playwright/test';

type Fixtures = {
  loggedInPage: Page;
};

export const test = base.extend<Fixtures>({
  loggedInPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('[name=email]', 'test@example.com');
    await page.fill('[name=password]', 'secret');
    await page.click('[type=submit]');
    await page.waitForURL('/dashboard');

    await use(page); // hand the page to the test

    // teardown runs automatically after `use` resolves
    await page.close();
  },
});
```

Now any test that needs a logged-in page just uses it:

```typescript
// my-test.spec.ts
import { test } from './fixtures';

test('can view dashboard', async ({ loggedInPage }) => {
  await expect(loggedInPage.locator('h1')).toContainText('Dashboard');
});
```

Clean. Reusable. No state leaking.

## Fixture Scopes

By default, fixtures have **test** scope — they're created fresh for each test.

You can change this to **worker** scope when the fixture is expensive and safe to share across tests in the same worker process:

```typescript
export const test = base.extend<{}, { apiToken: string }>({
  apiToken: [async ({}, use) => {
    const token = await generateApiToken();
    await use(token);
  }, { scope: 'worker' }],  // runs once per worker, not per test
});
```

Use worker scope for:
- Generating API tokens (expensive)
- Starting a mock server
- Seeding a test database

Use test scope (default) for:
- Pages
- Logged-in sessions
- Anything that mutates state

## Composing Fixtures

Fixtures can depend on other fixtures. This is where the real power is.

```typescript
type MyFixtures = {
  apiToken: string;
  authenticatedRequest: APIRequestContext;
  adminPage: Page;
};

export const test = base.extend<MyFixtures>({
  apiToken: async ({}, use) => {
    const token = await createTestUser();
    await use(token);
    await deleteTestUser(token);
  },

  authenticatedRequest: async ({ request, apiToken }, use) => {
    // depends on apiToken
    await use(request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${apiToken}` }
    }));
  },

  adminPage: async ({ page, apiToken }, use) => {
    // depends on apiToken
    await page.setExtraHTTPHeaders({ Authorization: `Bearer ${apiToken}` });
    await page.goto('/admin');
    await use(page);
  },
});
```

Playwright resolves the dependency graph automatically. You don't need to manage the order.

## The API + UI Login Pattern

One pattern I use on every project: drive login through the API, not the UI.

UI login is slow and fragile. API login is fast and reliable.

```typescript
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser, request }, use) => {
    // 1. Login via API
    const response = await request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'secret' }
    });
    const { token } = await response.json();

    // 2. Inject token into browser storage
    const context = await browser.newContext({
      storageState: {
        cookies: [],
        origins: [{
          origin: process.env.BASE_URL!,
          localStorage: [{ name: 'auth_token', value: token }]
        }]
      }
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
```

Your tests are now fast because they skip the login UI entirely, and more reliable because the API is stable.

## Practical Tips

**1. Keep fixtures in a single `fixtures.ts` file** and import from it everywhere. Never import from `@playwright/test` directly in spec files.

**2. Name fixtures after what they provide**, not how they work. `adminPage` is better than `pageWithAdminLogin`.

**3. Use `test.use()` for global configuration** — like setting a base URL or viewport — rather than duplicating it in every fixture.

**4. Avoid fixtures that do too much.** If your fixture is over 30 lines, it should probably be split.

**5. Test your fixtures.** Write a simple smoke test for each custom fixture. It'll save you hours of debugging later.

## The Bottom Line

If you're still writing `beforeEach` in every test file, you're leaving maintainability on the table. Fixtures are not a nice-to-have — they're how Playwright is designed to be used.

Build your fixture library once. Use it everywhere.

---

*If you found this useful, subscribe to [The QA Edge](/newsletter/) — I cover Playwright, API testing, and contracting weekly.*
