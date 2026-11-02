---
name: local-ci
description: The order of work for a change in this repository, from the edit to the push, and how to drive its pull request. `pnpm ci:local` runs the Check job and then the end-to-end suites against the local stack, and a push carries its green report. Use when committing, pushing, opening or updating a pull request, or when asked to run CI locally.
---

# From the edit to a pull request

`pnpm ci:local` (`scripts/ci/local.mjs`) is two stages:

1. **The Check job** of `.github/workflows/ci.yml`, step for step, over the
   packages the branch affects against `origin/main` (`scripts/ci/affected.mjs`).
2. **The end-to-end stage** (`scripts/ci/e2e-stage.mjs`): the local stack
   (`local-stack` skill) with this commit's API, and the suites the affected
   packages select: the API's (`@flama/api`, `@flama/e2e`), the screens'
   (also `@flama/web`), the desktop app's (also `@flama/desktop`). The
   screens and the desktop app have no CI runner, so this is the one place
   they are checked before a push.

A green run on a clean tree records the tree in `.git/flama-ci-ok`, which the
`pre-push` hook checks for every commit it pushes. Every run writes
`.ci-local/report.md`.

## The order

1. **Edit.**
2. **Commit**, staging files by path.
3. **Screens**, when the change shows on screen: the `local-stack` skill's
   "Show a visual change" (stack up `--web`, `pnpm screens <route>...`). Look
   at each picture and send them to the user. Take them again after an edit
   that changes how it looks.
4. **`pnpm ci:local`** on that commit. It runs the stack's API from this
   commit, swapping out one the stack started earlier; it refuses an API on
   the port that it did not start, so stop your own first. A stack already up
   with `--web` stays up.
5. **Push** on green, with the report and the screenshots in the pull
   request's description.

A fix after step 4 is a new commit and goes through 3–5 again.

## Before every push

- Push only on a green run on the commit you push. A red step is yours to
  fix, even one that predates the branch: the run names it, and the report
  says what failed.
- `--skip-e2e` runs the Check steps alone and records nothing. It is for
  re-running them after a fix, never for getting a push through.
- On this machine, keep the root `.env` from changing what the run checks: a
  `.env` with `NODE_ENV=development` makes the web build bundle React's
  development build and fails the first-load budget. Move it aside for the
  run, or leave `NODE_ENV` out of it.

## The pull request

- Put `.ci-local/report.md` in the description under `## Local CI`, and
  replace it after each push, so it always names the head commit.
- A visual change gets a `## Screenshots` section naming the routes, themes,
  widths and the commit they were taken on (`.screenshots/manifest.json`).
- GitHub still runs the Check job, the API's integration and e2e suites and
  the image builds on the pull request; the `CI` check is the one branch
  protection requires. Answer every review thread, and fix what CI reports
  rather than retrying it.
