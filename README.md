# Swaputer Documentation

Private VitePress documentation repository for Swaputer. The site lives in
`apps/swaputer-docs`.

The private `swaputer/protocol` submodule supplies the exact protocol,
deployment, and toolchain inputs used by documentation drift checks. Clone
recursively before building:

```sh
git clone --recurse-submodules https://github.com/swaputer/docs.git
cd docs
npm ci --prefix apps/swaputer-docs
npm run build --prefix apps/swaputer-docs
```

Developer guides use the published, version-pinned `@swaputer-labs/tinysol`,
`@swaputer-labs/receipt-codec`, and `@swaputer-labs/cli` packages. The drift
check binds every documented version to the recorded npm publication evidence
from the pinned Tooling dependency.

This repository was split from private monorepo commit
`c9c8bb269e9dfd112d2dad78726a9db516940462` on September 6, 2026. Licensed
under the MIT License.
