# Swaputer Docs

Independent VitePress documentation site for the Swaputer protocol. VitePress
uses Vue 3 and Vite while keeping documentation content in Markdown.

```sh
npm ci
npm run dev
```

The local server listens on `http://127.0.0.1:4177`.

Production is deployed to the `swaputer-docs` Cloudflare Pages project and is
served from `https://docs.swaputer.com`:

```sh
npm run deploy:pages
```

The Pages `_headers` file applies `Cache-Control: no-transform` so Cloudflare
does not mistake versioned npm package names for email addresses.

The build pins the official VitePress 2 preview line because the latest stable
VitePress 1 release resolves to build dependencies currently rejected by
`npm audit`. Treat this as a build-tool pin: run the drift check, production
build, and a rendered-page review before changing it.
