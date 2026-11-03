/**
 * The end-to-end stage of `pnpm ci:local`: the suites against the real stack
 * (`scripts/stack/stack.mjs`), after the Check job's steps pass. GitHub runs
 * the API's suite as a job of its own; the screens and the desktop app have
 * no runner there, so this is where they are checked before a push.
 *
 * What runs follows what the branch touches. `affected.mjs` lists every
 * changed package with its dependents, so a change under the API reaches the
 * screens and the desktop app too, which talk to it. A suite runs when the
 * branch touches any package in its row.
 *
 * A stack already up with `--web` (the screenshots') stays up with this
 * commit's API in it; one this run started comes down at the end.
 */

const E2E = ['@flama/e2e', '@flama/api'];

/** The suites, in the order they run: `{ id, packages, web, script }`. */
export const SUITES = [
  { id: 'api', name: 'e2e: API', packages: E2E, web: false, script: 'e2e:api' },
  // flama:begin web
  {
    id: 'web',
    name: 'e2e: screens',
    packages: ['@flama/web', ...E2E],
    web: true,
    script: 'e2e:web',
  },
  // The desktop app hosts the web build, so it needs both built first.
  {
    id: 'desktop',
    name: 'e2e: desktop app',
    packages: ['@flama/desktop', '@flama/web', ...E2E],
    web: false,
    script: 'e2e:desktop',
    build: ['--filter=@flama/web', '--filter=@flama/desktop'],
    display: true,
  },
  // flama:end web
];

/** The ids of the suites `packages` (affected, dependents included) select. */
export function suites(packages) {
  return SUITES.filter((suite) => suite.packages.some((name) => packages.includes(name))).map(
    (suite) => suite.id,
  );
}

/**
 * The stage's steps, in order, as `{ name, command, args }`. Empty when no
 * suite is selected. On Linux with no X server, a suite that opens windows
 * runs under `xvfb-run -a`.
 */
export function e2eSteps(packages, { linuxWithoutDisplay = false } = {}) {
  const picked = SUITES.filter((suite) => suites(packages).includes(suite.id));
  if (picked.length === 0) return [];
  const stack = (name, ...args) => ({
    name,
    command: 'node',
    args: ['scripts/stack/stack.mjs', ...args],
  });
  const steps = [
    // An API the stack started before runs an older commit; anything else on
    // the port is someone's own and is refused, not replaced.
    stack('stack: nothing else on the API port', 'api-port-free'),
    stack('stack: a stale API down', 'down', '--api'),
    stack('stack up', 'up', ...(picked.some((suite) => suite.web) ? ['--web'] : [])),
  ];
  for (const suite of picked) {
    if (suite.build) {
      steps.push({
        name: `build for ${suite.name}`,
        command: 'pnpm',
        args: ['turbo', 'run', 'build', ...suite.build],
      });
    }
    const run = ['pnpm', '--filter', '@flama/e2e', suite.script];
    steps.push(
      suite.display && linuxWithoutDisplay
        ? { name: suite.name, command: 'xvfb-run', args: ['-a', ...run] }
        : { name: suite.name, command: run[0], args: run.slice(1) },
    );
  }
  return steps;
}

/** What ends the stage, pass or fail: the stack comes down unless the screens are up on it. */
export const STACK_DOWN = {
  name: 'stack down',
  command: 'node',
  args: ['scripts/stack/stack.mjs', 'down', '--keep-console'],
};
