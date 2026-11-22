const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
});

test('command deck and national resource dashboard render live game state', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Empire status' })).toBeVisible();
  for (const id of ['deck-population', 'deck-stability', 'deck-power', 'deck-science']) {
    await expect(page.locator('#' + id)).not.toHaveText('—');
  }
  await expect(page.locator('#metrics .metric-card')).toHaveCount(8);
  await expect(page.locator('#world-map svg')).toBeVisible();
});

test('all current game navigation panels open and expose the selected tab', async ({ page }) => {
  const tabs = ['world3d','overview','nation','market','diplomacy','research','campaign','director','creator','history'];
  for (const id of tabs) {
    await page.locator('[data-tab="' + id + '"]').click();
    await expect(page.locator('#tab-' + id)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-' + id)).toBeVisible();
  }
});

test('advancing the world updates the turn and persists the nation save', async ({ page }) => {
  const before = await page.locator('#turn-label').textContent();
  await page.getByRole('button', { name: /Advance World/ }).click();
  await expect(page.locator('#turn-label')).not.toHaveText(before);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')));
  expect(saved.turn).toBeGreaterThan(1);
  expect(saved.nation).toBeTruthy();
});

test('save export downloads a JSON game file', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^kingmaker-save-turn-\d+\.json$/);
});

test('command deck shortcuts open their matching game systems', async ({ page }) => {
  await page.locator('[data-jump-tab="world3d"]').click();
  await expect(page.locator('#panel-world3d')).toBeVisible();
  await page.locator('[data-jump-tab="research"]').click();
  await expect(page.locator('#panel-research')).toBeVisible();
  await page.locator('[data-jump-tab="market"]').click();
  await expect(page.locator('#panel-market')).toBeVisible();
});

test('3D world exposes construction tools and simulation status', async ({ page }) => {
  await page.locator('[data-tab="world3d"]').click();
  await expect(page.getByRole('heading', { name: 'Explore your nation in 3D' })).toBeVisible();
  await expect(page.locator('#world3d-build-palette button').first()).toBeVisible();
  await expect(page.locator('#world3d-viewport')).toBeVisible();
  await expect(page.locator('#world3d-stats')).toBeVisible();
});

test('CROWN mining connects to its configured backend but stays closed until operator launch', async ({ page }) => {
  await page.goto('/mining.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#session-state')).toContainText(/SIGN IN REQUIRED|NETWORK CLOSED|MINING SERVICE UNAVAILABLE/);
  await expect(page.getByRole('button', { name: /START 6-HOUR SESSION/i })).toBeDisabled();
  await expect(page.locator('#member-email')).toBeVisible();
  await expect(page.locator('#crown-balance')).toContainText(/— CROWN|Unavailable/);
});

test('mobile command deck and navigation do not create horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.getByRole('heading', { name: 'Empire status' })).toBeVisible();
});


test('3D residents accept exploration waypoints and persist their arrival location', async ({ page }) => {
  await page.locator('[data-tab="world3d"]').click();
  await expect.poll(() => page.evaluate(() => !!window.KingmakerWorld3D?.inspectCitizenById)).toBe(true);
  const citizenId = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')).citizens[0].id);
  expect(await page.evaluate(id => window.KingmakerWorld3D.inspectCitizenById(id), citizenId)).toBe(true);

  const inspector = page.locator('#world3d-citizen-inspector');
  await expect(inspector).toContainText('Set exploration waypoint');
  const cancelWaypoint = page.locator('#world3d-explore-cancel');
  await inspector.locator('[data-citizen-waypoint]').click();
  await expect(cancelWaypoint).toBeVisible();
  await cancelWaypoint.click();
  await expect(cancelWaypoint).toBeHidden();

  expect(await page.evaluate(id => window.KingmakerWorld3D.inspectCitizenById(id), citizenId)).toBe(true);
  await inspector.locator('[data-citizen-waypoint]').click();
  await expect(cancelWaypoint).toBeVisible();
  const destination = { x: -10, z: 0 };
  expect(await page.evaluate(point => window.KingmakerWorld3D.commitCitizenWaypoint(point), destination)).toBe(true);
  await expect(cancelWaypoint).toBeHidden();

  const travelling = await page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return save.citizens.find(citizen => citizen.id === id);
  }, citizenId);
  expect(travelling.destination).toEqual(destination);
  expect(travelling.activity).toBe('walking to waypoint');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="world3d"]').click();
  await expect.poll(() => page.evaluate(() => !!window.KingmakerWorld3D)).toBe(true);
  await expect.poll(() => page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return save.citizens.find(citizen => citizen.id === id).destination;
  }, citizenId), { timeout: 15000 }).toBeNull();

  const arrived = await page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return save.citizens.find(citizen => citizen.id === id);
  }, citizenId);
  expect(arrived.location).toEqual(destination);
  expect(arrived.destination).toBeNull();
  expect(arrived.activity).toBe('exploring the island');
  expect(arrived.memory.at(-1).text).toContain('Reached');
});
