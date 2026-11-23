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
    return { id: island.id, name: island.name, localPopulation: island.population, nationalPopulation: save.nation.population };
  });
  await expect(page.locator('#world3d-territory-inspector')).toContainText(target.name);
  const claim = page.locator('#world3d-territory-inspector [data-action="claim-territory"]');
  await expect(claim).toBeEnabled();
  await claim.click();
  await expect(page.locator('#world3d-territory-inspector')).toContainText('Under your control');
  await expect(page.locator('#world3d-territory-inspector')).toContainText('National population');
  const saved = await page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return { territory: save.world.territories.find(territory => territory.id === id), population: save.nation.population,
      metric: document.querySelector('#metrics .metric-card')?.innerText || '' };
  }, target.id);
  expect(saved.territory.owner).toBe('player');
  expect(saved.population).toBe(target.nationalPopulation + target.localPopulation);
  expect(saved.metric.replace(/,/g, '')).toContain(String(saved.population));
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


test('a signed trade agreement opens a tariff-priced international route and delivers cargo', async ({ page }) => {
  const setup = await page.evaluate(() => {
    const engine = window.KingmakerEngine;
    const state = engine.createInitialState({ seed: 74007 });
    const rival = state.rivals.aurelia;
    rival.relation = 35;
    rival.resources.credits = 1000;
    const port = state.world.territories.find(territory => territory.owner === rival.id);
    port.harborLevel = 1;
    for (const node of state.world.resourceNodes.filter(item => item.territoryId === port.id)) {
      node.quantity = 0;
      node.depleted = true;
      node.operational = false;
      node.operatedSinceTurn = null;
    }
    engine.offerTreaty(state, rival.id, 'trade');
    localStorage.setItem('kingmaker_save_v1', engine.exportSave(state));
    return { portId: port.id, portName: port.name };
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="diplomacy"]').click();
  const panel = page.locator('.international-trade-panel').filter({ hasText: 'Aurelia' });
  await expect(panel).toContainText('International shipping');
  await page.locator('#international-export-source-aurelia').selectOption('home');
  await page.locator('#international-export-destination-aurelia').selectOption(setup.portId);
  await page.locator('#international-resource-aurelia').selectOption('food');
  await page.locator('#international-tariff-aurelia').selectOption('10');
  await panel.locator('[data-action="create-international-export-route"]').click();

  const created = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return save.world.shippingRoutes.find(route => route.partnerId === 'aurelia');
  });
  expect(created.sourceId).toBe('home');
  expect(created.destinationId).toBe(setup.portId);
  expect(created.tariffPercent).toBe(10);
  expect(created.unitPrice).toBe(3);
  expect(created.status).toBe('active');

  await page.locator('#advance-turn').click();
  const loaded = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')).world.shippingRoutes.find(route => route.partnerId === 'aurelia'));
  expect(loaded.inTransit.amount).toBeGreaterThan(0);
  for (let i = 0; i < created.travelTurns; i++) await page.locator('#advance-turn').click();

  const delivered = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')).world.shippingRoutes.find(route => route.partnerId === 'aurelia'));
  expect(delivered.deliveredTotal).toBeGreaterThan(0);
  expect(delivered.lastDeliveredTurn).toBeGreaterThan(created.createdTurn);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="diplomacy"]').click();
  await expect(page.locator('.international-trade-panel').filter({ hasText: 'Aurelia' })).toContainText('delivered');
});


test('a territorial campaign captures its selected island and updates national population', async ({ page }) => {
  const setup = await page.evaluate(() => {
    const engine = window.KingmakerEngine;
    const state = engine.createInitialState({ seed: 74204 });
    const rival = state.rivals.aurelia;
    const target = state.world.territories.find(territory => territory.owner === rival.id);
    state.resources.credits = 1000;
    state.resources.food = 1000;
    state.resources.materials = 1000;
    state.resources.ore = 1000;
    state.resources.power = 1000;
    state.resources.science = 100;
    state.resources.influence = 100;
    state.nation.stability = 100;
    rival.relation = -20;
    rival.stability = 100;
    rival.resources = { food: 1000, materials: 0, ore: 0, goods: 0, credits: 0, science: 0, power: 0, influence: 0 };
    for (const id of Object.keys(rival.buildings)) rival.buildings[id] = 0;
    rival.technologies = [];
    const before = state.nation.population;
    localStorage.setItem('kingmaker_save_v1', engine.exportSave(state));
    return { targetId: target.id, targetName: target.name, targetPopulation: target.population, before };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="diplomacy"]').click();
  const panel = page.locator('.diplomacy-card').filter({ hasText: 'Aurelia' });
  await expect(panel.locator('#war-target-aurelia')).toBeVisible();
  await expect(panel.locator('[data-action="conflict"]')).toContainText('Declare territorial campaign');
  await panel.locator('#war-target-aurelia').selectOption(setup.targetId);
  await panel.locator('[data-action="conflict"]').click();

  const declared = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')).diplomacy.conflicts[0]);
  expect(declared.targetTerritoryId).toBe(setup.targetId);
  for (let turn = 0; turn < 3; turn++) await page.locator('#advance-turn').click();

  const captured = await page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return {
      territory: save.world.territories.find(item => item.id === id),
      population: save.nation.population,
      ownedPopulation: save.world.territories.filter(item => item.owner === 'player').reduce((sum, item) => sum + item.population, 0),
      conflict: save.diplomacy.conflicts[0]
    };
  }, setup.targetId);
  expect(captured.conflict.status).toBe('resolved');
  expect(captured.conflict.playerScore).toBeGreaterThan(captured.conflict.rivalScore);
  expect(captured.territory.owner).toBe('player');
  expect(captured.population).toBe(captured.ownedPopulation);
  expect(captured.population).toBeGreaterThanOrEqual(setup.before + setup.targetPopulation);
  await page.locator('[data-tab="world3d"]').click();
  await page.evaluate(id => window.dispatchEvent(new CustomEvent('kingmaker:inspect-territory', { detail: { id } })), setup.targetId);
  await expect(page.locator('#world3d-territory-inspector')).toContainText('Under your control');
});


test('home-island garrison recruitment and fortification persist in the military inspector', async ({ page }) => {
  const setup = await page.evaluate(() => {
    const engine = window.KingmakerEngine;
    const state = engine.createInitialState({ seed: 75507 });
    state.resources.materials = 500;
    state.resources.ore = 500;
    state.resources.credits = 1000;
    localStorage.setItem('kingmaker_save_v1', engine.exportSave(state));
    const home = state.world.territories.find(item => item.id === 'home');
    return { initialGarrison: home.garrison, initialFortification: home.fortificationLevel };
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="world3d"]').click();
  const inspector = page.locator('#world3d-territory-inspector');
  await expect(inspector).toContainText('New Horizon');
  await expect(inspector).toContainText('Island defence');
  await expect(inspector).toContainText(setup.initialGarrison + ' garrison units');

  await inspector.locator('[data-action="recruit-garrison"]').click();
  await expect(inspector).toContainText((setup.initialGarrison + 1) + ' garrison units');
  await inspector.locator('[data-action="build-fortification"]').click();
  await expect(inspector).toContainText('Fortification level 1');

  const saved = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    const home = state.world.territories.find(item => item.id === 'home');
    return { schemaVersion: state.schemaVersion, garrison: home.garrison, fortificationLevel: home.fortificationLevel,
      military: window.KingmakerEngine.economicSnapshot(state).military };
  });
  expect(saved.schemaVersion).toBe(18);
  expect(saved.garrison).toBe(setup.initialGarrison + 1);
  expect(saved.fortificationLevel).toBe(1);
  expect(saved.military.units).toBe(setup.initialGarrison + 1);
  expect(saved.military.upkeep).toBe(setup.initialGarrison + 1);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="world3d"]').click();
  await expect(page.locator('#world3d-territory-inspector')).toContainText((setup.initialGarrison + 1) + ' garrison units');
  await expect(page.locator('#world3d-territory-inspector')).toContainText('Fortification level 1');
});


test('the island inspector warns of a rival counterattack and shows the retaken territory', async ({ page }) => {
  const targetId = await page.evaluate(() => {
    const engine = window.KingmakerEngine;
    const state = engine.createInitialState({ seed: 76106 });
    const rival = state.rivals.aurelia;
    const target = state.world.territories.find(item => item.owner === rival.id);
    state.turn = 4;
    target.owner = 'player';
    target.claimedTurn = state.turn;
    target.population = 50;
    target.garrison = 0;
    target.fortificationLevel = 0;
    target.harborLevel = 0;
    target.lastLostOwnerId = rival.id;
    target.lastLostTurn = state.turn - 1;
    target.counterattackStatus = 'active';
    target.counterattackForce = 0;
    rival.relation = -65;
    rival.stability = 100;
    rival.resources.credits = 1000;
    rival.resources.power = 1000;
    rival.resources.materials = 500;
    rival.resources.ore = 500;
    rival.buildings.power = 0;
    rival.technologies = [];
    state.resources.credits = 1000;
    state.resources.food = 1000;
    state.resources.power = 0;
    state.buildings.power = 0;
    state.technologies = [];
    state.nation.stability = 100;
    engine.syncNationalPopulation(state);
    state.diplomacy.conflicts.push({
      rivalId: rival.id, status: 'active', startedTurn: state.turn,
      playerScore: 0, rivalScore: 0, targetTerritoryId: target.id,
      initiator: 'rival', assaultGarrison: 3
    });
    localStorage.setItem('kingmaker_save_v1', engine.exportSave(state));
    return target.id;
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="world3d"]').click();
  await page.evaluate(id => window.dispatchEvent(new CustomEvent('kingmaker:inspect-territory', { detail: { id } })), targetId);
  const inspector = page.locator('#world3d-territory-inspector');
  await expect(inspector).toContainText('Counterattack by Aurelia');
  await expect(inspector).toContainText('Island defence');

  for (let turn = 0; turn < 3; turn++) {
    await page.getByRole('button', { name: /Advance World/ }).click();
  }
  await expect(inspector).toContainText('Controlled by Aurelia');
  const saved = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    const territory = state.world.territories.find(item => item.id === 'isle-aurelia');
    return { owner: territory.owner, status: territory.counterattackStatus, population: state.nation.population };
  });
  expect(saved.owner).toBe('aurelia');
  expect(saved.status).toBe('retaken');
  expect(saved.population).toBeGreaterThan(1);
});


test('home-island residents accept exploration waypoints and walk to saved destinations', async ({ page }) => {
  test.setTimeout(60000);
  await page.locator('[data-tab="world3d"]').click();
  await expect.poll(() => page.evaluate(() => !!window.KingmakerWorld3D?.inspectCitizenById), { timeout: 15000 }).toBe(true);
  const citizenId = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save_v1')).citizens[0].id);
  expect(await page.evaluate(id => window.KingmakerWorld3D.inspectCitizenById(id), citizenId)).toBe(true);

  const inspector = page.locator('#world3d-citizen-inspector');
  const cancelWaypoint = page.locator('#world3d-explore-cancel');
  await expect(inspector).toContainText('Set exploration waypoint');
  await inspector.locator('[data-citizen-waypoint]').click();
  await expect(cancelWaypoint).toBeVisible();
  await cancelWaypoint.click();
  await expect(cancelWaypoint).toBeHidden();

  expect(await page.evaluate(id => window.KingmakerWorld3D.inspectCitizenById(id), citizenId)).toBe(true);
  await inspector.locator('[data-citizen-waypoint]').click();
  await expect(cancelWaypoint).toBeVisible();
  const destination = { x: -10, z: 0, territoryId: 'home' };
  expect(await page.evaluate(point => window.KingmakerWorld3D.commitCitizenWaypoint(point), destination)).toBe(true);
  await expect(cancelWaypoint).toBeHidden();

  const travelling = await page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return save.citizens.find(citizen => citizen.id === id);
  }, citizenId);
  expect(travelling.destination).toEqual({ x: -10, z: 0 });
  expect(travelling.activity).toBe('walking to waypoint');
  const initialPath = await page.evaluate(id => window.KingmakerWorld3D.inspectCitizenPath(id), citizenId);
  expect(initialPath.length).toBeGreaterThan(0);
  expect(initialPath.at(-1)).toEqual({ x: -10, z: 0 });
  expect(initialPath.every(point => Math.hypot(point.x, point.z) <= 11.5)).toBe(true);
  expect(initialPath.every(point => Math.hypot(point.x, point.z) >= 1.48)).toBe(true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="world3d"]').click();
  await expect.poll(() => page.evaluate(() => !!window.KingmakerWorld3D), { timeout: 15000 }).toBe(true);
  await expect.poll(() => page.evaluate(id => window.KingmakerWorld3D.inspectCitizenById(id), citizenId), { timeout: 15000 }).toBe(true);
  const restoredPath = await page.evaluate(id => window.KingmakerWorld3D.inspectCitizenPath(id), citizenId);
  expect(restoredPath.length).toBeGreaterThan(0);
  expect(restoredPath.at(-1)).toEqual({ x: -10, z: 0 });
  await expect.poll(() => page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return save.citizens.find(citizen => citizen.id === id).destination;
  }, citizenId), { timeout: 15000 }).toBeNull();

  const arrived = await page.evaluate(id => {
    const save = JSON.parse(localStorage.getItem('kingmaker_save_v1'));
    return save.citizens.find(citizen => citizen.id === id);
  }, citizenId);
  expect(arrived.location).toEqual({ x: -10, z: 0 });
  expect(arrived.destination).toBeNull();
  expect(arrived.activity).toBe('exploring the home island');
  expect(arrived.memory.at(-1).text).toContain('Reached');
});

test('outer islands render resident agents and selecting one opens its local territory inspector', async ({ page }) => {
  await page.locator('[data-tab="world3d"]').click();
  await expect.poll(() => page.evaluate(() => !!window.KingmakerWorld3D?.inspectRemoteResidents), { timeout: 15000 }).toBe(true);
  const agents = await page.evaluate(() => window.KingmakerWorld3D.inspectRemoteResidents());
  expect(agents.length).toBeGreaterThanOrEqual(8);
  expect(new Set(agents.map(agent => agent.territoryId)).size).toBe(8);
  expect(await page.evaluate(id => window.KingmakerWorld3D.inspectRemoteResidentById(id), agents[0].id)).toBe(true);
  await expect(page.locator('#world3d-territory-inspector')).toContainText('local residents');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tab="world3d"]').click();
  await expect.poll(() => page.evaluate(() => !!window.KingmakerWorld3D?.inspectRemoteResidents), { timeout: 15000 }).toBe(true);
  const restored = await page.evaluate(() => window.KingmakerWorld3D.inspectRemoteResidents());
  expect(restored.map(agent => [agent.id, agent.territoryId])).toEqual(agents.map(agent => [agent.id, agent.territoryId]));
});
