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

test('a neutral archipelago island can be inspected and claimed through the world UI', async ({ page }) => {
  await page.locator('[data-tab="world3d"]').click();
  const target = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    const island = save.world.territories.find(territory => territory.owner === 'unclaimed');
    window.dispatchEvent(new CustomEvent('kingmaker:inspect-territory', { detail: { id: island.id } }));
    return { id: island.id, name: island.name };
  });
  await expect(page.locator('#world3d-territory-inspector')).toContainText(target.name);
  const claim = page.locator('#world3d-territory-inspector [data-action="claim-territory"]');
  await expect(claim).toBeEnabled();
  await claim.click();
  await expect(page.locator('#world3d-territory-inspector')).toContainText('Under your control');
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('kingmaker_save_v1')).world.territories.find(territory => territory.id === id), target.id);
  expect(saved.owner).toBe('player');
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


test('a claimed outer island accepts construction and preserves it after reload', async ({ page }) => {
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    save.resources.materials = 1000;
    save.resources.credits = 1000;
    save.resources.influence = 100;
    localStorage.setItem('kingmaker_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="world3d"]').click();
  const target = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    const island = save.world.territories.find(territory => territory.owner === 'unclaimed');
    window.dispatchEvent(new CustomEvent('kingmaker:inspect-territory', { detail: { id: island.id } }));
    return { id: island.id, x: island.x, z: island.z, name: island.name };
  });
  await expect(page.locator('#world3d-territory-inspector')).toContainText(target.name);
  await page.locator('#world3d-territory-inspector [data-action="claim-territory"]').click();
  await expect(page.locator('#world3d-territory-inspector')).toContainText('Under your control');

  await page.evaluate(({ id, x, z }) => {
    window.dispatchEvent(new CustomEvent('kingmaker:place-building', {
      detail: { type: 'farm', territoryId: id, x, z }
    }));
    window.dispatchEvent(new CustomEvent('kingmaker:place-district', {
      detail: { type: 'agricultural', territoryId: id, x, z, radius: 2.6 }
    }));
    window.dispatchEvent(new CustomEvent('kingmaker:place-road', {
      detail: {
        territoryId: id,
        from: { x: x - 1.8, z },
        to: { x: x + 1.8, z }
      }
    }));
  }, target);

  const placed = await page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return {
      building: save.world.placedBuildings.find(item => item.territoryId === id),
      district: save.world.placedDistricts.find(item => item.territoryId === id),
      road: save.world.placedRoads.find(item => item.territoryId === id)
    };
  }, target.id);
  expect(placed.building.type).toBe('farm');
  expect(placed.district.type).toBe('agricultural');
  expect(placed.road.territoryId).toBe(target.id);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const restored = await page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return ['placedBuildings', 'placedDistricts', 'placedRoads'].every(key =>
      save.world[key].some(item => item.territoryId === id)
    );
  }, target.id);
  expect(restored).toBe(true);
});


test('a claimed island builds a harbor and ships local extraction into national reserves', async ({ page }) => {
  const setup = await page.evaluate(() => {
    const engine = window.KingmakerEngine;
    const state = engine.createInitialState({ seed: 72006 });
    state.resources.materials = 2000;
    state.resources.credits = 2000;
    state.resources.influence = 100;
    const island = state.world.territories.find(item => item.owner === 'unclaimed');
    const deposit = state.world.resourceNodes.find(item => item.territoryId === island.id);
    deposit.resource = 'Timber';
    deposit.quantity = 200;
    localStorage.setItem('kingmaker_save_v1', engine.exportSave(state));
    return { islandId: island.id, islandName: island.name, depositId: deposit.id };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="world3d"]').click();
  await page.evaluate(id => window.dispatchEvent(new CustomEvent('kingmaker:inspect-territory', { detail: { id } })), setup.islandId);
  await expect(page.locator('#world3d-territory-inspector')).toContainText(setup.islandName);
  await page.locator('#world3d-territory-inspector [data-action="claim-territory"]').click();
  await page.locator('#world3d-territory-inspector [data-action="upgrade-harbor"]').click();
  await expect(page.locator('#world3d-territory-inspector')).toContainText('Harbor level 1');

  await page.evaluate(id => window.dispatchEvent(new CustomEvent('kingmaker:inspect-resource', { detail: { id } })), setup.depositId);
  await page.locator('#world3d-resource-inspector [data-action="develop-resource"]').click();
  await expect(page.locator('#world3d-territory-inspector #shipping-destination')).toBeVisible();
  await page.locator('#shipping-destination').selectOption('home');
  await page.locator('#shipping-resource').selectOption('materials');
  await page.locator('#world3d-territory-inspector [data-action="create-shipping-route"]').click();

  const route = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')).world.shippingRoutes[0]);
  expect(route.sourceId).toBe(setup.islandId);
  expect(route.destinationId).toBe('home');
  expect(route.capacity).toBe(10);
  expect(route.status).toBe('active');

  await page.locator('#advance-turn').click();
  const loaded = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')).world.shippingRoutes[0]);
  expect(loaded.inTransit.amount).toBeGreaterThan(0);
  expect(loaded.loadedTotal).toBeGreaterThan(0);
  for (let i = 0; i < route.travelTurns; i++) await page.locator('#advance-turn').click();

  const delivered = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')).world.shippingRoutes[0]);
  expect(delivered.deliveredTotal).toBeGreaterThan(0);
  expect(delivered.lastDeliveredTurn).toBeGreaterThan(delivered.createdTurn);
  await expect(page.locator('#world3d-stats')).toContainText('Shipping');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')).world.shippingRoutes[0]);
  expect(restored.deliveredTotal).toBe(delivered.deliveredTotal);
});


test('rival ports, extraction and autonomous shipping appear in the 3D world inspector', async ({ page }) => {
  const setup = await page.evaluate(() => {
    const engine = window.KingmakerEngine;
    const state = engine.createInitialState({ seed: 73004 });
    const rival = state.rivals.duneward;
    const source = state.world.territories.find(item => item.owner === rival.id);
    const destination = state.world.territories.find(item => item.owner === 'unclaimed');
    destination.owner = rival.id;
    destination.claimedTurn = state.turn;
    source.harborLevel = 1;
    destination.harborLevel = 1;
    const owned = new Set([source.id, destination.id]);
    const deposits = state.world.resourceNodes.filter(node => owned.has(node.territoryId));
    for (const node of deposits) {
      node.quantity = 0;
      node.depleted = true;
      node.operational = false;
      node.operatedSinceTurn = null;
    }
    const deposit = deposits.find(node => node.territoryId === source.id);
    deposit.resource = 'Iron';
    deposit.quantity = 100;
    deposit.depleted = false;
    deposit.operational = true;
    deposit.operatedSinceTurn = state.turn;
    source.stockpile.ore = 20;
    rival.resources.materials = 1000;
    rival.resources.credits = 1000;
    engine.developRivalTerritories(state);
    const route = state.world.shippingRoutes.find(item => item.ownerId === rival.id);
    localStorage.setItem('kingmaker_save_v1', engine.exportSave(state));
    return { sourceId: source.id, sourceName: source.name, routeId: route.id };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="world3d"]').click();
  await page.evaluate(id => window.dispatchEvent(new CustomEvent('kingmaker:inspect-territory', { detail: { id } })), setup.sourceId);
  await expect(page.locator('#world3d-territory-inspector')).toContainText('Rival maritime infrastructure');
  await expect(page.locator('#world3d-territory-inspector')).toContainText('Harbor level 1');
  await expect(page.locator('#world3d-territory-inspector')).toContainText('Fleet activity');
  await expect(page.locator('#world3d-stats')).toContainText('Shipping');
  const route = await page.evaluate(id => JSON.parse(localStorage.getItem('kingmaker_save_v1')).world.shippingRoutes.find(item => item.id === id), setup.routeId);
  expect(route.ownerId).toBe('duneward');
  expect(route.status).toBe('active');
});
