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
  expect(saved.credits).toBe(455); // Includes the one-time founder campaign reward.
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

test('embassy missions enforce costs and persist diplomatic progress', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-tab="market"]').click();
  await expect(page.locator('#embassyPanel')).toContainText('Send envoy');
  await page.getByRole('button', { name: 'Send envoy · 30 credits' }).first().click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(saved.credits).toBe(120);
  expect(saved.relations.Aurelia).toBe(21);
  expect(saved.influence).toBe(22);
  expect(saved.diplomaticHistory[0].mission).toBe('Envoy');
});

test('embassy missions are disabled during an active war', async ({ page }) => {
  await page.addInitScript(() => {
    const s=JSON.parse(localStorage.getItem('kingmaker_save')||'{}');
    s.conflicts={...(s.conflicts||{}),Aurelia:{enemyStrength:20,turns:0}};
    localStorage.setItem('kingmaker_save',JSON.stringify(s));
  });
  await page.goto('/');
  await page.locator('[data-tab="market"]').click();
  await expect(page.getByRole('button', { name: 'Send envoy · 30 credits' }).first()).toBeDisabled();
});

test('national mandates display objective progress and claim a reward once', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-tab="campaign"]').click();
  await expect(page.locator('#mandateBoard')).toContainText('Food Security Reserve');
  await expect(page.locator('#mandateBoard')).toContainText('Regional Goodwill');
  await expect(page.locator('#mandateBoard')).toContainText('IN PROGRESS');
  const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(Array.isArray(initial.claimedMandates)).toBeTruthy();
});

test('eligible food security mandate pays once and persists its claim', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const s=JSON.parse(localStorage.getItem('kingmaker_save'));
    s.food=150;
    localStorage.setItem('kingmaker_save',JSON.stringify(s));
  });
  await page.reload();
  await page.locator('[data-tab="campaign"]').click();
  const card=page.locator('#mandateBoard .item').filter({hasText:'Food Security Reserve'});
  await expect(card).toContainText('READY TO CLAIM');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')).credits);
  await card.getByRole('button',{name:'Claim mandate'}).click();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(after.credits).toBe(before+45);
  expect(after.claimedMandates).toContain('food-security');
  await expect(card).toContainText('REWARD CLAIMED');
  await expect(card.getByRole('button',{name:'Completed'})).toBeDisabled();
});
test('rival governments execute focus-driven strategic decisions', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save')).npcData.Northreach.strength);
  await page.getByRole('button', { name: 'Advance World' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(saved.npcData.Northreach.strength).toBeGreaterThan(before);
  expect(saved.npcData.Northreach.lastAction).toContain('border');
  expect(saved.npcData.Meridian.research).toBeGreaterThan(0);
  expect(saved.npc.Aurelia).toBe(saved.npcData.Aurelia.lastAction);
});
test('diplomatic summits build trust before an alliance can be formed', async ({ page }) => {
  await page.addInitScript(() => {
    const s=JSON.parse(localStorage.getItem('kingmaker_save')||'{}');
    s.credits=300;s.influence=30;s.relations={...(s.relations||{}),Aurelia:30};
    localStorage.setItem('kingmaker_save',JSON.stringify(s));
  });
  await page.goto('/');
  await page.locator('[data-tab="market"]').click();
  await expect(page.locator('#embassyPanel')).toContainText('Host summit');
  await page.getByRole('button',{name:'Host summit · 50 credits + 8 influence'}).first().click();
  const afterSummit=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(afterSummit.diplomaticTrust.Aurelia).toBe(15);
  await page.locator('[data-tab="military"]').click();
  await page.getByRole('button',{name:'Propose alliance · 40 credits'}).first().click();
  const allied=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(allied.alliances).toContain('Aurelia');
  expect(allied.diplomaticTrust.Aurelia).toBe(25);
});


test('bilateral trade exchanges resources and improves diplomatic trust', async ({ page }) => {
  await page.addInitScript(() => {
    const s=JSON.parse(localStorage.getItem('kingmaker_save')||'{}');
    s.food=100;s.credits=100;s.materials=10;
    s.relations={...(s.relations||{}),Aurelia:20};
    localStorage.setItem('kingmaker_save',JSON.stringify(s));
  });
  await page.goto('/');
  await page.locator('[data-tab="market"]').click();
  await page.getByRole('button',{name:'Export 20 food · Receive 30 credits'}).first().click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(saved.food).toBe(80);
  expect(saved.credits).toBe(130);
  expect(saved.relations.Aurelia).toBe(23);
  expect(saved.diplomaticTrust.Aurelia).toBe(2);
  expect(saved.bilateralTradeHistory[0].nation).toBe('Aurelia');
});

test('bilateral trade cooldown prevents repeated deals with the same rival', async ({ page }) => {
  await page.addInitScript(() => {
    const s=JSON.parse(localStorage.getItem('kingmaker_save')||'{}');
    s.food=100;s.relations={...(s.relations||{}),Aurelia:20};
    localStorage.setItem('kingmaker_save',JSON.stringify(s));
  });
  await page.goto('/');
  await page.locator('[data-tab="market"]').click();
  await page.getByRole('button',{name:'Export 20 food · Receive 30 credits'}).first().click();
  await expect(page.getByRole('button',{name:'Export 20 food · Receive 30 credits'}).first()).toBeDisabled();
});


test('World Council opens on turn five and records a declined agenda', async ({ page }) => {
  await page.addInitScript(() => {
    const s=JSON.parse(localStorage.getItem('kingmaker_save')||'{}');
    s.turn=4;
    localStorage.setItem('kingmaker_save',JSON.stringify(s));
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Advance World'}).click();
  await page.locator('[data-tab="market"]').click();
  await expect(page.locator('#embassyPanel')).toContainText('Regional Food Relief Summit');
  await page.getByRole('button',{name:'Decline'}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(saved.worldCouncil.active.resolved).toBeTruthy();
  expect(saved.worldCouncil.active.decision).toBe('Contribution declined');
  expect(saved.worldCouncil.history[0].title).toBe('Regional Food Relief Summit');
});

test('World Council contribution spends resources and improves relations', async ({ page }) => {
  await page.addInitScript(() => {
    const s=JSON.parse(localStorage.getItem('kingmaker_save')||'{}');
    s.turn=4;s.food=45;s.credits=100;
    localStorage.setItem('kingmaker_save',JSON.stringify(s));
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Advance World'}).click();
  await page.locator('[data-tab="market"]').click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  await page.getByRole('button',{name:'Contribute to agenda'}).click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(saved.food).toBe(before.food-15);
  expect(saved.credits).toBe(before.credits-20);
  expect(saved.relations.Aurelia).toBeGreaterThanOrEqual(0);
  expect(saved.worldCouncil.active.resolved).toBeTruthy();
  expect(saved.worldCouncil.history[0].decision).toBe('Contribution accepted');
});


test('intelligence operation reveals rival reserves and records a report', async ({ page }) => {
  await page.addInitScript(() => {
    const s=JSON.parse(localStorage.getItem('kingmaker_save')||'{}');
    s.credits=100;s.turn=10;
    s.npcData={...(s.npcData||{}),Aurelia:{...(s.npcData?.Aurelia||{}),food:75,materials:30,treasury:120}};
    localStorage.setItem('kingmaker_save',JSON.stringify(s));
  });
  await page.goto('/');
  await page.locator('[data-tab="market"]').click();
  await page.evaluate(()=>{Math.random=()=>0;});
  await page.getByRole('button',{name:'Gather intelligence · 25 credits'}).first().click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(saved.credits).toBe(110); // 100 initial + 35 founder reward - 25 operation.
  expect(saved.intelligenceBureau.reports[0].success).toBeTruthy();
  expect(saved.intelligenceBureau.reports[0].detail).toContain('treasury 120');
});

test('counterintelligence upgrades spend resources and operation cooldown applies', async ({ page }) => {
  await page.addInitScript(() => {
    const s=JSON.parse(localStorage.getItem('kingmaker_save')||'{}');
    s.credits=150;s.materials=30;s.turn=10;
    localStorage.setItem('kingmaker_save',JSON.stringify(s));
  });
  await page.goto('/');
  await page.locator('[data-tab="market"]').click();
  await page.getByRole('button',{name:'Upgrade agency · 45 credits + 12 materials'}).click();
  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(saved.intelligenceBureau.level).toBe(1);
  expect(saved.credits).toBe(140); // 150 initial + 35 founder reward - 45 upgrade.
  await page.getByRole('button',{name:'Gather intelligence · 25 credits'}).first().click();
  await expect(page.getByRole('button',{name:'Gather intelligence · 25 credits'}).first()).toBeDisabled();
});

test('new-player guide explains the first economy, research and diplomacy steps', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#newPlayerGuide')).toBeVisible();
  await expect(page.locator('#guideSteps .guide-step')).toHaveCount(3);
  await page.getByRole('button', { name: 'Open infrastructure' }).click();
  await expect(page.locator('#nation')).toBeVisible();
  await page.locator('#newPlayerGuide button').filter({ hasText: 'Hide guide' }).click();
  await expect(page.locator('#newPlayerGuide')).toBeHidden();
  await page.getByRole('button', { name: 'Show beginner guide' }).click();
  await expect(page.locator('#newPlayerGuide')).toBeVisible();
});


test('national council presents a player decision every four turns and applies the chosen policy', async ({ page }) => {
  await page.goto('/');
  for (let i=0;i<4;i++) await page.getByRole('button', { name: 'Advance World' }).click();
  await expect(page.locator('#worldEventPanel')).toContainText('National Council Decision');
  await expect(page.locator('#worldEventPanel')).toContainText('Emergency Food Relief');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  await page.getByRole('button', { name: 'Approve decision' }).first().click();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('kingmaker_save')));
  expect(after.pendingCouncilDecision).toBeNull();
  expect(after.food).toBe(before.food+35);
  expect(after.credits).toBe(before.credits-15);
  await expect(page.locator('#worldEventPanel')).not.toContainText('National Council Decision');
});
