'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMiningLedgerService } = require('../src/mining-ledger');

function fixture() {
  let time = 1_800_000_000_000;
  let nextId = 0;
  const service = createMiningLedgerService({
    baseRatePerWeightedHour: 2,
    getContribution: () => ({ verifiedSecurityMembers: 1, activeDirectReferrals: 2 }),
    now: () => time,
    id: () => 'test-id-' + (++nextId)
  });
  return { service, advance: seconds => { time += seconds * 1000; } };
}

test('starts one 6-hour session per authenticated account', () => {
  const { service } = fixture();
  const principal = { accountId: 'account-0001' };
  const session = service.startSession(principal);
  assert.equal(session.status, 'active');
  assert.equal(session.endsAt - session.startedAt, 21600 * 1000);
  assert.throws(() => service.startSession(principal), error => error.code === 'SESSION_ALREADY_ACTIVE');
});

test('settles elapsed time with server-validated contribution bonuses', () => {
  const { service, advance } = fixture();
  const principal = { accountId: 'account-0001' };
  const session = service.startSession(principal);
  advance(3600);
  const entry = service.settleSession(principal, session.sessionId);
  assert.equal(entry.activeSeconds, 3600);
  assert.equal(entry.multiplier, 1.8);
  assert.equal(entry.amount, 3.6);
  assert.equal(service.getBalance(principal), 3.6);
  assert.equal(service.getLedger(principal).length, 2);
});

test('cannot settle another account session or settle twice', () => {
  const { service, advance } = fixture();
  const owner = { accountId: 'account-0001' };
  const other = { accountId: 'account-0002' };
  const session = service.startSession(owner);
  assert.throws(() => service.settleSession(other, session.sessionId), error => error.code === 'SESSION_FORBIDDEN');
  advance(10);
  service.settleSession(owner, session.sessionId);
  assert.throws(() => service.settleSession(owner, session.sessionId), error => error.code === 'SESSION_ALREADY_SETTLED');
});

test('session accrual never exceeds the 6-hour session window', () => {
  const { service, advance } = fixture();
  const principal = { accountId: 'account-0001' };
  const session = service.startSession(principal);
  advance(21600 + 3600);
  const entry = service.settleSession(principal, session.sessionId);
  assert.equal(entry.activeSeconds, 21600);
  assert.equal(entry.amount, 21.6);
});

test('requires a positive configured reward rate and authenticated account identifier', () => {
  assert.throws(() => createMiningLedgerService({ baseRatePerWeightedHour: 0 }), TypeError);
  const { service } = fixture();
  assert.throws(() => service.startSession({ accountId: 'x' }), TypeError);
});
