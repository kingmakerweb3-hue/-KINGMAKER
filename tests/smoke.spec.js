const { test, expect } = require('@playwright/test');

test('game loads and renders its primary dashboard without browser errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#metrics .metricbox')).toHaveCount(5);
  await expect(page.locator('#worldMap')).not.toBeEmpty();
  await expect(page.locator('#buildings')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('quality console reports all diagnostics passing', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-tab="quality"]').click();
  await page.getByRole('button', { name: 'Run diagnostics' }).click();
  await expect(page.locator('#qaSummary')).toContainText('13 / 13 checks passed');
  await expect(page.locator('#qaResults .qa-result.fail')).toHaveCount(0);
});

test('all navigation tabs can be opened', async ({ page }) => {
  await page.goto('/');
  const tabs = ['overview','nation','market','research','director','military','studio','history','campaign','government','city','quality'];
  for (const id of tabs) {
    await page.locator('[data-tab="' + id + '"]').click();
    await expect(page.locator('#' + id)).toBeVisible();
  }
});

test('advancing a turn updates and persists the nation state', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save')).turn);
  await page.getByRole('button', { name: 'Advance World' }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save')).turn);
  expect(after).toBe(before + 1);
  await page.reload();
  await expect(page.locator('#season')).toContainText('TURN ' + after);
});

test('save export creates a JSON download', async ({ page }) => {
  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Save' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/kingmaker-save-v2\.json/);
});

test('legacy saves are migrated without losing valid progress', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kingmaker_save', JSON.stringify({
      turn: 9, name: 'Legacy Realm', credits: 420,
      buildings: { farm: 3 }, relations: { Aurelia: 44 },
      tech: ['agriculture'], events: ['Old campaign event']
    }));
  });
  await page.goto('/');
  await expect(page.locator('#nationName')).toHaveValue('Legacy Realm');
  await expect(page.locator('#season')).toContainText('TURN 9');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(saved.credits).toBe(420);
  expect(saved.buildings.workshop).toBe(1);
  expect(saved.relations.Meridian).toBe(-5);
  expect(Array.isArray(saved.victories)).toBeTruthy();
});

test('malformed local save safely starts a fresh nation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kingmaker_save', '{broken json'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#nationName')).toHaveValue('New Horizon');
  await expect(page.locator('#season')).toContainText('TURN 1');
  expect(errors).toEqual([]);
});
