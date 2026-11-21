# UI and browser audit

380 role, route and width observations across 375, 768, 1366, 1440 and 1920 px. Screenshots and traces were recorded against synthetic local data. CRM pages used ADMIN and USER sessions. Public and authentication pages used a guest session. Some USER routes redirect to the dashboard. These rows measure the landing page only.

| Role | Widths captured | Root overflow events | Page errors |
|---|---|---|---|
| ADMIN | 165 | 0 | 0 |
| USER | 165 | 0 | 0 |
| GUEST | 50 | 0 | 0 |

External resources were blocked deliberately, including marketing fonts. Request failures and console messages are retained per route. Measurements do not establish text contrast, accessibility, equivalent keyboard operation or unclipped controls inside a scroll container. The full per-control matrix remains open.

[Viewport observations](../../test-artifacts/browser-audit/results.json) · [Screenshots and traces](../../test-artifacts/browser-audit) · [Customer journey](../../test-artifacts/journey/steps.json)

## Accessibility retest

Chromium recorded 10,572 control appearances across 380 snapshots. Shared navigation and repeated widths count multiple times. 0 controls in the sampled roles lacked a computed accessible name after the fix. A separate keyboard test opened and dismissed search, switched themes and checked that the closed mobile sidebar leaves the accessibility tree. The test also opened and closed mobile navigation. These checks do not establish full WCAG conformance.
