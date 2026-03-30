# Coolify GitHub Actions — Monorepo

## Estrutura de Diretórios

```
coolify-github-actions/
├── action.yml                      ← action raiz (marketplace listing)
├── README.md
├── LICENSE
├── CHANGELOG.md
├── .github/
│   └── workflows/
│       ├── test.yml                ← testes em PRs
│       └── release.yml             ← release automático
├── deploy/
│   └── action.yml                  ← coolify-deploy
├── wait/
│   └── action.yml                  ← coolify-wait
└── tests/
    ├── deploy.bats
    ├── wait.bats
    └── fixtures/
        ├── deploy_success.json
        ├── deploy_fail.json
        ├── wait_in_progress.json
        └── wait_finished.json
```

---

## `deploy/action.yml`

```yaml
name: Coolify Deploy
description: Trigger a Coolify application deployment and return the deployment UUID
author: medeiroz

branding:
  icon: upload-cloud
  color: blue

inputs:
  api_url:
    description: Coolify API base URL (e.g. https://coolify.example.com/api/v1)
    required: true
  token:
    description: Coolify API token
    required: true
  app_uuid:
    description: UUID of the Coolify application to deploy
    required: true
  force:
    description: Force rebuild even if nothing changed
    required: false
    default: 'false'

outputs:
  deployment_uuid:
    description: UUID of the triggered deployment
    value: ${{ steps.deploy.outputs.deployment_uuid }}
  resource_uuid:
    description: UUID of the deployed resource
    value: ${{ steps.deploy.outputs.resource_uuid }}

runs:
  using: composite
  steps:
    - name: Install jq
      run: |
        if ! command -v jq &> /dev/null; then
          sudo apt-get update && sudo apt-get install -y jq
        fi
      shell: bash

    - id: deploy
      name: Trigger deployment
      run: |
        RESPONSE=$(curl --fail -s -X POST "${{ inputs.api_url }}/deploy" \
          -H "Authorization: Bearer ${{ inputs.token }}" \
          -H "Content-Type: application/json" \
          -d "{\"uuid\":\"${{ inputs.app_uuid }}\",\"force\":${{ inputs.force }}}")

        echo "$RESPONSE"

        DEPLOY_UUID=$(echo "$RESPONSE" | jq -r \
          '.deployments[0].deployment_uuid // .deployment_uuid // .deployment_id // empty')
        RESOURCE_UUID=$(echo "$RESPONSE" | jq -r \
          '.deployments[0].resource_uuid // .resource_uuid // .resource_id // empty')

        if [ -z "$DEPLOY_UUID" ]; then
          echo "::error::Failed to parse deployment_uuid from Coolify response"
          exit 1
        fi

        echo "deployment_uuid=$DEPLOY_UUID" >> $GITHUB_OUTPUT
        echo "resource_uuid=$RESOURCE_UUID" >> $GITHUB_OUTPUT
      shell: bash
```

---

## `wait/action.yml`

```yaml
name: Coolify Wait Deploy
description: Wait for a Coolify deployment to finish and display application logs
author: medeiroz

branding:
  icon: clock
  color: green

inputs:
  api_url:
    description: Coolify API base URL (e.g. https://coolify.example.com/api/v1)
    required: true
  token:
    description: Coolify API token
    required: true
  app_uuid:
    description: UUID of the Coolify application (for fetching logs)
    required: true
  deployment_uuid:
    description: UUID of the deployment to monitor
    required: true
  timeout_minutes:
    description: Max minutes to wait before timing out
    required: false
    default: '5'

outputs:
  status:
    description: Final deployment status (success or failed)
    value: ${{ steps.wait.outputs.status }}

runs:
  using: composite
  steps:
    - name: Install jq
      run: |
        if ! command -v jq &> /dev/null; then
          sudo apt-get update && sudo apt-get install -y jq
        fi
      shell: bash

    - id: wait
      name: Wait for deployment
      run: |
        MAX_ATTEMPTS=$(( ${{ inputs.timeout_minutes }} * 60 / 5 ))
        ATTEMPT=0

        echo "🚀 Monitoring deployment: ${{ inputs.deployment_uuid }}"
        echo "⏱️  Timeout: ${{ inputs.timeout_minutes }} minute(s) (~${MAX_ATTEMPTS} attempts)"

        while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
          ATTEMPT=$((ATTEMPT + 1))

          RESPONSE=$(curl -s \
            -H "Authorization: Bearer ${{ inputs.token }}" \
            "${{ inputs.api_url }}/deployments/${{ inputs.deployment_uuid }}")

          STATUS=$(echo "$RESPONSE" | jq -r '.status // empty' 2>/dev/null)

          if [ -z "$STATUS" ]; then
            echo "⏳ [$ATTEMPT/$MAX_ATTEMPTS] Waiting for deployment to start..."
            sleep 5
            continue
          fi

          UPDATED_AT=$(echo "$RESPONSE" | jq -r '.updated_at // ""' 2>/dev/null)
          echo "⏳ [$ATTEMPT/$MAX_ATTEMPTS] Status: $STATUS (updated: $UPDATED_AT)"

          if [ "$STATUS" = "finished" ] || [ "$STATUS" = "success" ]; then
            echo "✅ Deployment finished successfully!"
            echo ""
            echo "📋 Application logs:"
            echo "-------------------"
            LOGS_RESPONSE=$(curl -s \
              -H "Authorization: Bearer ${{ inputs.token }}" \
              "${{ inputs.api_url }}/applications/${{ inputs.app_uuid }}/logs?lines=100")
            echo "$LOGS_RESPONSE" | jq -r '.logs // "No logs available"'

            echo "status=success" >> $GITHUB_OUTPUT
            exit 0
          fi

          if [ "$STATUS" = "failed" ] || [ "$STATUS" = "error" ]; then
            echo "::error::Deployment failed!"
            echo "status=failed" >> $GITHUB_OUTPUT
            exit 1
          fi

          sleep 5
        done

        echo "::error::Timed out after ${{ inputs.timeout_minutes }} minute(s)"
        echo "status=timeout" >> $GITHUB_OUTPUT
        exit 1
      shell: bash
```

---

## `action.yml` (raiz — marketplace listing)

```yaml
name: Coolify Deploy & Wait
description: Deploy an application to Coolify and wait for it to finish
author: medeiroz

branding:
  icon: upload-cloud
  color: blue

inputs:
  api_url:
    description: Coolify API base URL (e.g. https://coolify.example.com/api/v1)
    required: true
  token:
    description: Coolify API token
    required: true
  app_uuid:
    description: UUID of the Coolify application to deploy
    required: true
  force:
    description: Force rebuild even if nothing changed
    required: false
    default: 'false'
  timeout_minutes:
    description: Max minutes to wait before timing out
    required: false
    default: '5'

outputs:
  deployment_uuid:
    description: UUID of the triggered deployment
    value: ${{ steps.deploy.outputs.deployment_uuid }}
  status:
    description: Final deployment status
    value: ${{ steps.wait.outputs.status }}

runs:
  using: composite
  steps:
    - id: deploy
      uses: ./deploy
      with:
        api_url: ${{ inputs.api_url }}
        token: ${{ inputs.token }}
        app_uuid: ${{ inputs.app_uuid }}
        force: ${{ inputs.force }}

    - id: wait
      uses: ./wait
      with:
        api_url: ${{ inputs.api_url }}
        token: ${{ inputs.token }}
        app_uuid: ${{ inputs.app_uuid }}
        deployment_uuid: ${{ steps.deploy.outputs.deployment_uuid }}
        timeout_minutes: ${{ inputs.timeout_minutes }}
```

---

## `tests/fixtures/deploy_success.json`

```json
{
  "deployments": [
    {
      "deployment_uuid": "abc123",
      "resource_uuid": "res456"
    }
  ]
}
```

## `tests/fixtures/deploy_fail.json`

```json
{
  "message": "Application not found"
}
```

## `tests/fixtures/wait_in_progress.json`

```json
{
  "status": "in_progress",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

## `tests/fixtures/wait_finished.json`

```json
{
  "status": "finished",
  "updated_at": "2026-01-01T00:01:00Z"
}
```

---

## `tests/deploy.bats`

```bash
#!/usr/bin/env bats

setup() {
  FIXTURES="$BATS_TEST_DIRNAME/fixtures"
}

@test "parses deployment_uuid from nested deployments array" {
  RESPONSE=$(cat "$FIXTURES/deploy_success.json")
  UUID=$(echo "$RESPONSE" | jq -r \
    '.deployments[0].deployment_uuid // .deployment_uuid // .deployment_id // empty')
  [ "$UUID" = "abc123" ]
}

@test "parses resource_uuid from nested deployments array" {
  RESPONSE=$(cat "$FIXTURES/deploy_success.json")
  UUID=$(echo "$RESPONSE" | jq -r \
    '.deployments[0].resource_uuid // .resource_uuid // .resource_id // empty')
  [ "$UUID" = "res456" ]
}

@test "returns empty when response has no deployment_uuid" {
  RESPONSE=$(cat "$FIXTURES/deploy_fail.json")
  UUID=$(echo "$RESPONSE" | jq -r \
    '.deployments[0].deployment_uuid // .deployment_uuid // .deployment_id // empty')
  [ -z "$UUID" ]
}

@test "parses deployment_uuid from flat response" {
  RESPONSE='{"deployment_uuid":"flat-uuid"}'
  UUID=$(echo "$RESPONSE" | jq -r \
    '.deployments[0].deployment_uuid // .deployment_uuid // .deployment_id // empty')
  [ "$UUID" = "flat-uuid" ]
}
```

---

## `tests/wait.bats`

```bash
#!/usr/bin/env bats

setup() {
  FIXTURES="$BATS_TEST_DIRNAME/fixtures"
}

@test "detects in_progress status" {
  RESPONSE=$(cat "$FIXTURES/wait_in_progress.json")
  STATUS=$(echo "$RESPONSE" | jq -r '.status // empty')
  [ "$STATUS" = "in_progress" ]
}

@test "detects finished status as success" {
  RESPONSE=$(cat "$FIXTURES/wait_finished.json")
  STATUS=$(echo "$RESPONSE" | jq -r '.status // empty')
  [ "$STATUS" = "finished" ]
  # Simula a condição de sucesso
  result="failed"
  if [ "$STATUS" = "finished" ] || [ "$STATUS" = "success" ]; then
    result="success"
  fi
  [ "$result" = "success" ]
}

@test "detects failed status" {
  RESPONSE='{"status":"failed","updated_at":"2026-01-01T00:00:00Z"}'
  STATUS=$(echo "$RESPONSE" | jq -r '.status // empty')
  result="ok"
  if [ "$STATUS" = "failed" ] || [ "$STATUS" = "error" ]; then
    result="failed"
  fi
  [ "$result" = "failed" ]
}

@test "handles missing status as empty" {
  RESPONSE='{"message":"not ready yet"}'
  STATUS=$(echo "$RESPONSE" | jq -r '.status // empty' 2>/dev/null)
  [ -z "$STATUS" ]
}
```

---

## `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Install bats-core
        run: |
          sudo apt-get update && sudo apt-get install -y bats jq

      - name: Run deploy tests
        run: bats tests/deploy.bats

      - name: Run wait tests
        run: bats tests/wait.bats

      - name: Lint YAML files
        run: |
          pip install yamllint
          yamllint action.yml deploy/action.yml wait/action.yml
```

---

## `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          release-type: simple

      # Atualiza a tag major (v1) após cada release
      - uses: actions/checkout@v6
        if: ${{ steps.release.outputs.release_created }}

      - name: Update major version tag
        if: ${{ steps.release.outputs.release_created }}
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag -fa v${{ steps.release.outputs.major }} \
            -m "chore: update v${{ steps.release.outputs.major }} tag"
          git push origin v${{ steps.release.outputs.major }} --force
```

---

## `README.md`

````markdown
# Coolify GitHub Actions

[![Tests](https://github.com/medeiroz/coolify-github-actions/actions/workflows/test.yml/badge.svg)](https://github.com/medeiroz/coolify-github-actions/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

GitHub Actions to deploy applications to [Coolify](https://coolify.io) via API.

## Actions

| Action                                      | Description                     |
| ------------------------------------------- | ------------------------------- |
| `medeiroz/coolify-github-actions/deploy@v1` | Trigger a deployment            |
| `medeiroz/coolify-github-actions/wait@v1`   | Wait for deployment + show logs |
| `medeiroz/coolify-github-actions@v1`        | Deploy + Wait (combined)        |

## Usage

### Combined (deploy + wait)

```yaml
- uses: medeiroz/coolify-github-actions@v1
  with:
    api_url: https://coolify.example.com/api/v1
    token: ${{ secrets.COOLIFY_TOKEN }}
    app_uuid: your-app-uuid
```

### Separate steps

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

## Inputs — `deploy`

| Input      | Required | Default | Description          |
| ---------- | -------- | ------- | -------------------- |
| `api_url`  | ✅       | —       | Coolify API base URL |
| `token`    | ✅       | —       | Coolify API token    |
| `app_uuid` | ✅       | —       | Application UUID     |
| `force`    | ❌       | `false` | Force rebuild        |

## Inputs — `wait`

| Input             | Required | Default | Description                 |
| ----------------- | -------- | ------- | --------------------------- |
| `api_url`         | ✅       | —       | Coolify API base URL        |
| `token`           | ✅       | —       | Coolify API token           |
| `app_uuid`        | ✅       | —       | Application UUID (for logs) |
| `deployment_uuid` | ✅       | —       | Deployment UUID to monitor  |
| `timeout_minutes` | ❌       | `5`     | Max wait time in minutes    |

## License

MIT © [medeiroz](https://github.com/medeiroz)
````

---

## `LICENSE`

```
MIT License

Copyright (c) 2026 medeiroz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Passos para publicar no Marketplace

1. Criar repo público `coolify-github-actions` no GitHub
2. Push deste código
3. Criar release `v1.0.0` com tag
4. Ir em **GitHub → Releases → Edit → Publish this Action to the Marketplace**
5. Usuários usam: `medeiroz/coolify-github-actions/deploy@v1`
