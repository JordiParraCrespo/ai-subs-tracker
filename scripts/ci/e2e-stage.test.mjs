import assert from 'node:assert/strict';
import { test } from 'node:test';
import { e2eSteps, SUITES, suites } from './e2e-stage.mjs';

const has = (id) => SUITES.some((suite) => suite.id === id);

// The selection is what decides whether a push was checked end to end: a
// change the rule misses ships without its journeys ever running.
test('an API change runs every suite, since the screens and the app talk to it', () => {
  assert.deepEqual(
    suites(['@flama/api']),
    SUITES.map((suite) => suite.id),
  );
});

test('nothing the suites cover selects no stage at all', () => {
  assert.deepEqual(e2eSteps(['@flama/tsconfig']), []);
});

test('the stage brings the stack up before its first suite and runs the API suite on it', () => {
  const names = e2eSteps(['@flama/api']).map((step) => step.name);
  assert.ok(names.indexOf('stack up') < names.indexOf('e2e: API'));
});

test('a desktop-only change runs the desktop suite alone, without the screens', () => {
  if (!has('desktop')) return;
  assert.deepEqual(suites(['@flama/desktop']), ['desktop']);
  const up = e2eSteps(['@flama/desktop']).find((step) => step.name === 'stack up');
  assert.deepEqual(up.args, ['scripts/stack/stack.mjs', 'up']);
});

test('without a display the desktop app runs under xvfb', () => {
  if (!has('desktop')) return;
  const last = e2eSteps(['@flama/desktop'], { linuxWithoutDisplay: true }).at(-1);
  assert.equal(last.command, 'xvfb-run');
  assert.deepEqual(last.args.slice(0, 2), ['-a', 'pnpm']);
});
