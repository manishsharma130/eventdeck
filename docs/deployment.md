# Web deployment

[← Back to README](../README.md) · [Architecture](architecture.md) · [File reference](file-reference.md) · [Development guide](development.md)

## One-time repository setup

GitHub Pages must be enabled for the repository before the deployment workflow can configure or deploy the site. A repository owner or maintainer should complete this once:

1. Open the repository on GitHub.
2. Select **Settings**.
3. Under **Code and automation**, select **Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. Return to **Actions**, open the failed deployment, and select **Re-run jobs**.

The workflow uses the built-in `GITHUB_TOKEN`. Do not add `enablement: true` to `actions/configure-pages` unless the workflow is also supplied with a separate token that has the elevated repository administration and Pages permissions required to create a Pages site. Manual one-time enablement avoids storing such a token.

## GitHub Pages workflow

Pushes to `main` trigger `.github/workflows/deploy-web.yml`:

```mermaid
flowchart LR
    Push[Push to main]
    Install[pnpm install<br/>frozen lockfile]
    Build[pnpm build:web]
    Upload[Upload apps/web/dist]
    Deploy[Deploy to GitHub Pages]

    Push --> Install --> Build --> Upload --> Deploy
```

Only the static web application is deployed. The local Node.js server is never uploaded to GitHub Pages.

The initial production URL is expected to be:

```text
https://manishsharma130.github.io/eventdeck/
```

Vite uses `/eventdeck/` as its production base, ensuring JavaScript and CSS assets resolve correctly when the site is hosted below the repository path rather than at `/`.

## HTTPS and the local WebSocket server

The hosted page uses HTTPS while the initial local endpoint uses:

```text
ws://127.0.0.1:4732
```

Browsers may block this connection as mixed content or apply loopback/private-network access restrictions. This behavior can differ between browser versions and security configurations.

The transport is isolated in `apps/web/src/services/websocket.ts`, and the endpoint is isolated in `apps/web/src/config/environment.ts`. A future secure solution can therefore be introduced without rewriting UI components.

No local certificate, `wss://` server, browser extension, or alternate bridge is included in the current foundation.

## Troubleshooting

### `Get Pages site failed: Not Found`

This error means GitHub does not yet have a Pages site configured for the repository:

```text
Get Pages site failed. Please verify that the repository has Pages enabled
and configured to build using GitHub Actions.
```

Complete the [one-time repository setup](#one-time-repository-setup), then rerun the workflow. It is not a web-build failure and does not require changing the generated files.

If the **Pages** settings are unavailable, confirm that:

- you have administrator or maintainer access;
- GitHub Pages is available for the repository's visibility and account plan; and
- an organization policy is not preventing Pages deployments.

## Future custom domain

A custom domain is intentionally not configured yet. When one is introduced, the web build's base-path and hosting configuration can be updated without changing the server package architecture.
