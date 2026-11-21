// Run with the Playwright MCP `browser_run_code_unsafe` (filename) or adapt to @playwright/test.
// Visits every CRM page as each role at two widths; records status, redirects, console errors,
// failed requests and horizontal overflow; saves a screenshot per page/role/width.
async (page) => {
  const B = 'http://localhost:3100';
  const PW = 'E2e-Test-Passw0rd!';
  const pages = ['/crm', '/crm/entrydashboard', '/crm/lead-management', '/crm/new-leads', '/crm/assigned-leads', '/crm/unassigned-leads',
    '/crm/my-leads', '/crm/trending-leads', '/crm/my-trending-leads', '/crm/won-leads', '/crm/conversions', '/crm/today-followups',
    '/crm/upcoming-followups', '/crm/activities', '/crm/activity-log', '/crm/import-leads', '/crm/reports/lead-insertion',
    '/crm/product-management', '/crm/product-dashboard', '/crm/quotations', '/crm/quotations/create', '/crm/user-management',
    '/crm/vendors', '/crm/vendors/active', '/crm/vendors/pending', '/crm/vendors/inactive', '/crm/vendors/import',
    '/crm/vendors/categories', '/crm/vendors/performance', '/crm/vendors/settings'];
  const results = [];
  const login = async (id) => {
    await page.context().clearCookies();
    await page.goto(B + '/crm/login');
    await page.getByLabel('Username or work email').fill(id);
    await page.getByLabel('Password').fill(PW);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/crm/entrydashboard', { timeout: 30000 });
  };
  for (const [role, id] of [['admin', 'qa.admin'], ['exec', 'qa.exec1']]) {
    await login(id);
    for (const width of [1366, 375]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      for (const p of pages) {
        const errors = [];
        const failed = [];
        const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); };
        const onPageError = (e) => errors.push('pageerror: ' + String(e).slice(0, 200));
        const onResp = (r) => { if (r.status() >= 400 && !r.url().includes('/_next/')) failed.push(`${r.status()} ${r.url().replace(B, '')}`); };
        page.on('console', onConsole); page.on('pageerror', onPageError); page.on('response', onResp);
        let status = 0;
        try {
          const resp = await page.goto(B + p, { waitUntil: 'networkidle', timeout: 60000 });
          status = resp ? resp.status() : 0;
        } catch (e) { errors.push('nav: ' + String(e).slice(0, 120)); }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth).catch(() => -1);
        const heading = await page.locator('h1').first().innerText({ timeout: 2000 }).catch(() => '');
        const bodyErr = await page.locator('text=/Application error|Unhandled Runtime Error|Something went wrong|This page could not be found/i').count().catch(() => 0);
        const shot = `test-artifacts/screens/${role}-${width}${p.replace(/\//g, '_')}.png`;
        await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
        page.off('console', onConsole); page.off('pageerror', onPageError); page.off('response', onResp);
        results.push({ role, width, path: p, status, final: page.url().replace(B, ''), h1: heading.slice(0, 40), overflow, bodyErr, errors: [...new Set(errors)].slice(0, 3), failed: [...new Set(failed)].slice(0, 3) });
      }
    }
  }
  return JSON.stringify(results);
}
