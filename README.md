# Apex Performance Shop

Webshop for Apex Performance — https://shop.apex-performance.fit (test: https://test.shop.apex-performance.fit).

```bash
npm ci
npm start             # http://localhost:4200, test API
npm run test-build    # build for test.shop.apex-performance.fit
npm run production    # build for shop.apex-performance.fit
```

Push to `test` deploys to the test shop; push to `production` deploys to the live shop after approval.
See [CLAUDE.md](CLAUDE.md) for the full workflow.
