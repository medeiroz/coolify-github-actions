# Coolify GitHub Actions

[![Tests](https://github.com/medeiroz/coolify-github-actions/actions/workflows/test.yml/badge.svg)](https://github.com/medeiroz/coolify-github-actions/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

GitHub Actions to deploy applications to [Coolify](https://coolify.io) via API.

## Actions

| Action                                      | Description                     |
| ------------------------------------------- | ------------------------------- |
| `medeiroz/coolify-github-actions/deploy@v1` | Trigger a deployment            |
| `medeiroz/coolify-github-actions/wait@v1`   | Wait for deployment + show logs |

## Prerequisites

To use these actions, you must enable the Coolify API and generate a token with the necessary permissions:

1. **Enable Coolify API:**
   - Log in to your Coolify dashboard.
   - Go to **Settings** > **Configuration** > **Advanced**.
   - Enable **API Access**.
2. **Generate API Token:**
   - Go to **Keys & Tokens** > **API tokens**.
   - Click **Create** and name your token.
   - Assign the **Deploy** permission (or `*` for full access) so the action can trigger deployments.
   - **Important:** Copy the token immediately, as it cannot be viewed again.
3. **Configure GitHub Secrets:**
   - In your repository, go to **Settings** > **Secrets and variables** > **Actions** > **Repository secrets**.
   - Add a new secret named `COOLIFY_TOKEN` containing your generated API token.

_Read more in the official [Coolify API documentation](https://coolify.io/docs/api/authentication)._

## Usage

### Deploy + Wait (separate steps)

```yaml
- id: deploy
  uses: medeiroz/coolify-github-actions/deploy@v1
  with:
    api_url: https://coolify.example.com/api/v1
    token: ${{ secrets.COOLIFY_TOKEN }}
    app_uuid: your-app-uuid

- uses: medeiroz/coolify-github-actions/wait@v1
  with:
    api_url: https://coolify.example.com/api/v1
    token: ${{ secrets.COOLIFY_TOKEN }}
    app_uuid: your-app-uuid
    deployment_uuid: ${{ steps.deploy.outputs.deployment_uuid }}
    timeout_minutes: 10
```

### Deploy only

```yaml
- id: deploy
  uses: medeiroz/coolify-github-actions/deploy@v1
  with:
    api_url: https://coolify.example.com/api/v1
    token: ${{ secrets.COOLIFY_TOKEN }}
    app_uuid: your-app-uuid
    force: true
```

## Inputs — `deploy`

| Input      | Required | Default | Description                                   |
| ---------- | -------- | ------- | --------------------------------------------- |
| `api_url`  | ✅       | —       | Coolify API base URL (must include `/api/v1`) |
| `token`    | ✅       | —       | Coolify API token                             |
| `app_uuid` | ✅       | —       | Application UUID                              |
| `force`    | ❌       | `false` | Force rebuild                                 |

## Outputs — `deploy`

| Output            | Description                      |
| ----------------- | -------------------------------- |
| `deployment_uuid` | UUID of the triggered deployment |
| `resource_uuid`   | UUID of the deployed resource    |

## Inputs — `wait`

| Input             | Required | Default | Description                                   |
| ----------------- | -------- | ------- | --------------------------------------------- |
| `api_url`         | ✅       | —       | Coolify API base URL (must include `/api/v1`) |
| `token`           | ✅       | —       | Coolify API token                             |
| `app_uuid`        | ✅       | —       | Application UUID (for logs)                   |
| `deployment_uuid` | ✅       | —       | Deployment UUID to monitor                    |
| `timeout_minutes` | ❌       | `5`     | Max wait time in minutes                      |

## Outputs — `wait`

| Output   | Description                                                 |
| -------- | ----------------------------------------------------------- |
| `status` | Final deployment status (`success`, `failed`, or `timeout`) |

## Features

- 🔒 **Token masking** — API tokens are automatically masked in logs
- 🔄 **Retry with backoff** — Network errors are retried with exponential backoff
- ⚡ **Fail-fast on 404** — If a deployment is not found, the action fails immediately
- 📋 **Application logs** — Logs are displayed after successful deployment
- ✅ **Input validation** — URLs, UUIDs, and timeouts are validated

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build bundles
npm run build

# Lint
npm run lint

# Format
npm run format
```

## License

MIT © [medeiroz](https://github.com/medeiroz)
