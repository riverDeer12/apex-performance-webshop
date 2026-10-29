# apex-performance-webshop

Angular 19 webshop for Apex Performance.
Production: https://shop.apex-performance.fit — Test: https://test.shop.apex-performance.fit

## Before the first release to shop.apex-performance.fit

shop.apex-performance.fit still shows the "uskoro" (coming soon) page; the shop runs only on test. Before
anything is pushed to `production` for the first time, remind the owner of these and ask them to confirm
each one is done (don't release on your own):

1. Stripe account of Apex Performance (the obrt) is open, connected to eRačuni, and its live keys plus the
   webhook signing secret are on the production API (`Stripe:ApexPerformance:SecretKey`, `...:WebhookSecret`).
2. BoxNow contract for Apex Performance, its settings on the production API (`BoxNow:ApexPerformance:*`).
3. A lawyer has checked the legal pages (Opći uvjeti, Povrat i reklamacije, Privatnost).
4. The accountant confirmed the obrt has online retail (trgovina putem interneta) registered.
5. Products, stock and shop settings entered in the production administration (its database is separate).
6. The `production` GitHub Environment of this repo requires the owner's approval.

## Branches

- `production` — the working branch. Make changes here.
- `test` — deploys to test.shop.apex-performance.fit via the "Deploy to Test" GitHub Action, no approval needed.
- Pushing to `production` triggers "Deploy to Production", which requires a manual approval on the
  `production` GitHub Environment before it runs (the repo owner approves it in GitHub's UI).

## Required workflow for any change

Never push straight to `production` without going through `test` first:

1. Make the change on `production` (the working tree).
2. `git stash push -u` the changed files (or just the ones relevant to this change).
3. `git checkout test && git pull origin test --ff-only`
4. `git stash pop`
5. Commit, then `git push origin test`.
6. Wait for the "Deploy to Test" GitHub Action to finish (`gh run list --branch test`, poll with `gh run view <id>`).
7. Verify the change on https://test.shop.apex-performance.fit before going further — actually load the page
   and check the change is real; do not fabricate verification.
8. `git checkout production && git pull origin production --ff-only && git merge test --no-edit`
9. `git push origin production`. If this is blocked by a permission prompt, stop and ask the user how
   they'd like to proceed rather than retrying it yourself.
10. Tell the user the deploy is waiting on their manual approval of the GitHub Environment gate.
11. Wait for the user to say they approved it, then re-verify with `gh run view <id> --json status,conclusion`
    — do not assume the approval took effect just because the user said so; if the run is still `waiting`,
    say so and wait for them to actually approve it in GitHub.
12. Once the run is `completed`/`success`, verify the live change on https://shop.apex-performance.fit.

## Build configurations

- `npm run production` — production config: `environment.production.ts` (production API
  `https://apex-performance.fit/api`) and the files in `deploy/production/`.
- `npm run test-build` — test config: `environment.test.ts` (test API `https://test.apex-performance.fit/api`)
  and the files in `deploy/test/`. Use this one for local verification builds so you don't exercise the
  production backend by accident.
- `npm start` — local dev server against the test API.

## Server

- IIS on the same Windows server as the app. Sites `shop.apex-performance.fit` (app pool `ApexShop`,
  `C:\inetpub\wwwroot\apex-performance-webshop\wwwroot`) and `test.shop.apex-performance.fit`
  (app pool `ApexShopTest`, `C:\inetpub\wwwroot\apex-performance-webshop-test\wwwroot`).
- Deploys run on a self-hosted runner registered to this repository with the label `apex-performance-webshop`.
- Let's Encrypt certificates by win-acme, renewed by its scheduled task.

## Known gotchas

- `deploy/<env>/` is copied into the build root: `web.config` (Angular route rewrite, needs the IIS URL Rewrite
  module) and `robots.txt`. The deploy mirrors the build with `robocopy /MIR`, so a file kept only on the server
  is deleted on the next deploy — anything IIS needs belongs in `deploy/<env>/`.
- The test shop must never be indexed: `deploy/test/` has `robots.txt` with `Disallow: /` and the
  `X-Robots-Tag: noindex` header; keep both. The page also shows a "TEST" banner (`environment.isTest`).
- Payments (once added): test uses the payment provider's test keys, production the live keys. Keys go into
  the GitHub Environment secrets of `test` / `production`, never into tracked files.
- `dist/`, `.angular/` and `node_modules/` are build output and are git-ignored — don't commit them.
