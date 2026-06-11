---
title: "My API-First Testing Strategy for Microservices"
date: 2026-05-28
categories: ["api-testing"]
tags: ["api-testing", "microservices", "playwright", "strategy", "contract-testing"]
description: "How I structure API and UI tests across microservice architectures — including the layering strategy, contract testing, and the Playwright API + UI pattern that eliminates flaky setup."
draft: false
---

Most teams build their test pyramid upside-down.

They write end-to-end UI tests first because they're the most visible and seem the most realistic. Then they wonder why their suite is slow, flaky, and fails on deployment day for reasons that have nothing to do with the feature they're testing.

When I join a project — whether it's a Home Office case management system or a National Grid operational platform — the first thing I do is flip the pyramid. API tests first. UI tests only where they add unique value.

Here's how that works in practice.

## Why API Tests Are the Foundation

Microservices are independently deployable. Each service has a contract — a set of endpoints with defined inputs, outputs, and behaviours. That contract is what should be tested first, hardest, and most often.

API tests have three advantages over UI tests:

1. **Speed.** An API test suite that runs in 30 seconds gives you feedback before a PR review is stale. A UI suite that takes 20 minutes means the developer has moved on.

2. **Stability.** APIs change far less frequently than UIs. A contract that's been stable for 6 months needs maintenance far less than a set of CSS selectors.

3. **Isolation.** You can test a specific service's behaviour without running the entire application stack.

## The Layering Strategy

Here's how I layer tests across a microservice architecture:

```
┌─────────────────────────────────────┐
│        E2E UI Tests (Playwright)    │  ← Critical user journeys only
│     ~20% of suite, slow but visual  │
├─────────────────────────────────────┤
│      Integration API Tests          │  ← Service-to-service flows
│  ~30% of suite, medium speed        │
├─────────────────────────────────────┤
│      Contract Tests (Pact)          │  ← Consumer/provider contracts
│  Runs in CI per service deploy      │
├─────────────────────────────────────┤
│      Unit + Component Tests         │  ← Within each service
│  ~50% of suite, fast                │
└─────────────────────────────────────┘
```

The key insight: **most bugs live in the API layer**. Business logic, validation, state transitions, error handling — these are all API-level concerns. Test them at the API level.

The UI test's job is to verify that the UI correctly calls the right API and renders the response. Nothing more.

## API Testing with Playwright

Playwright's `APIRequestContext` is underused. Most teams know `page.goto()`. Fewer know this:

```typescript
test('creating a case requires authentication', async ({ request }) => {
  const response = await request.post('/api/cases', {
    data: { title: 'New Case', priority: 'high' }
  });
  expect(response.status()).toBe(401);
});

test('creates a case with valid token', async ({ request }) => {
  const response = await request.post('/api/cases', {
    headers: { Authorization: `Bearer ${process.env.TEST_TOKEN}` },
    data: { title: 'New Case', priority: 'high' }
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.id).toBeDefined();
  expect(body.title).toBe('New Case');
});
```

The same fixture library powers both API and UI tests. I create an `apiClient` fixture that wraps the `request` context with authentication and base URL:

```typescript
// fixtures.ts
export const test = base.extend<{ api: APIRequestContext }>({
  api: async ({ request }, use) => {
    const token = await getTestToken();
    const api = await request.newContext({
      baseURL: process.env.API_BASE_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` }
    });
    await use(api);
    await api.dispose();
  }
});
```

Now any test can call the API cleanly:

```typescript
test('case appears in list after creation', async ({ api, page }) => {
  // Create the case via API (fast, reliable)
  const { id } = await api.post('/cases', { title: 'My Case' }).then(r => r.json());

  // Then verify it appears in the UI
  await page.goto('/cases');
  await expect(page.locator(`[data-testid="case-${id}"]`)).toBeVisible();
});
```

This pattern eliminates the UI setup that makes tests slow and fragile. The test does one UI operation — verifying the render — and verifies it against a known-good API state.

## Contract Testing

In a microservices architecture, service A consumes service B's API. When service B changes its contract, service A might break — and you only find out in production.

Contract testing solves this with Pact or similar tools:

```typescript
// consumer test (service A)
const interaction = {
  state: 'a case with ID 123 exists',
  uponReceiving: 'a request for case 123',
  withRequest: { method: 'GET', path: '/cases/123' },
  willRespondWith: {
    status: 200,
    body: { id: 123, title: like('A case title'), status: like('open') }
  }
};
```

The consumer defines what it expects. The provider verifies it can satisfy that expectation. Both sides run independently.

In practice, I've found that even a simple contract test file per service integration catches 60% of breaking changes before they reach staging.

## Handling External Dependencies

When your service calls a third-party API (payment gateway, identity provider, notification service), your test should not call the real API.

Options:
1. **Mock at the HTTP level** using Playwright's `page.route()` or a tool like WireMock
2. **Use test environments** provided by the third party (most have them)
3. **Use service virtualisation** for complex stateful interactions

My preference:

```typescript
await page.route('**/payment-gateway/**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ transactionId: 'test-123', status: 'approved' })
  });
});
```

Playwright's route interception is clean, TypeScript-native, and requires no extra tooling.

## The Test That Shouldn't Exist

One thing I remove from every codebase I join: tests that verify the API returns what the database contains.

```typescript
// This test is useless
test('GET /users returns users from the database', async ({ api }) => {
  const response = await api.get('/users');
  const users = await response.json();
  // This just verifies the ORM works...
});
```

Your tests should verify **behaviour**, not implementation. Does creating a user with a duplicate email return a 409? Does a user with role VIEWER get a 403 on admin endpoints? Those are worth testing.

## The Bottom Line

An API-first strategy gives you:
- Faster feedback loops
- Fewer flaky tests
- Better coverage of the business logic that actually matters
- UI tests that are genuinely about UI behaviour

It takes discipline to maintain the pyramid. The temptation is always to write one more E2E test. Resist it. When you find a bug, ask: "Could this have been caught at the API level?" Usually yes.

---

*I cover test architecture and API testing patterns weekly in [The QA Edge](/newsletter/).*
