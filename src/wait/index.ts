import * as core from '@actions/core';
import { CoolifyClient, CoolifyApiError } from '../shared/coolify-client.js';

const POLL_INTERVAL_MS = 5000;
const MAX_CONSECUTIVE_ERRORS = 3;
const SUCCESS_STATUSES = ['finished', 'success'];
const FAILURE_STATUSES = ['failed', 'error'];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  try {
    const apiUrl = core.getInput('api_url', { required: true });
    const token = core.getInput('token', { required: true });
    const appUuid = core.getInput('app_uuid', { required: true });
    const deploymentUuid = core.getInput('deployment_uuid', { required: true });
    const timeoutMinutes = parseInt(core.getInput('timeout_minutes') || '5', 10);

    if (timeoutMinutes <= 0 || isNaN(timeoutMinutes)) {
      throw new Error(
        `Invalid timeout_minutes: must be a positive number. Got: ${core.getInput('timeout_minutes')}`,
      );
    }

    const client = new CoolifyClient(apiUrl, token);
    const maxAttempts = Math.ceil((timeoutMinutes * 60 * 1000) / POLL_INTERVAL_MS);
    let consecutiveErrors = 0;

    core.info(`🚀 Monitoring deployment: ${deploymentUuid}`);
    core.info(`⏱️  Timeout: ${timeoutMinutes} minute(s) (~${maxAttempts} attempts)`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let deployment: Awaited<ReturnType<typeof client.getDeploymentStatus>>;

      try {
        deployment = await client.getDeploymentStatus(deploymentUuid);
        consecutiveErrors = 0;
      } catch (error) {
        consecutiveErrors++;

        if (error instanceof CoolifyApiError && error.statusCode === 404) {
          core.setOutput('status', 'failed');
          core.setFailed(`Deployment ${deploymentUuid} not found (404). It may have been removed.`);
          return;
        }

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          core.setOutput('status', 'failed');
          core.setFailed(
            `Failed to fetch deployment status after ${MAX_CONSECUTIVE_ERRORS} consecutive errors: ${error instanceof Error ? error.message : String(error)}`,
          );
          return;
        }

        core.warning(
          `⚠️ [${attempt}/${maxAttempts}] Error fetching status (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${error instanceof Error ? error.message : String(error)}`,
        );
        await sleep(POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors - 1));
        continue;
      }

      const status = deployment.status;

      if (!status) {
        core.info(`⏳ [${attempt}/${maxAttempts}] Waiting for deployment to start...`);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      core.info(
        `⏳ [${attempt}/${maxAttempts}] Status: ${status} (updated: ${deployment.updated_at ?? 'N/A'})`,
      );

      if (SUCCESS_STATUSES.includes(status)) {
        core.info('✅ Deployment finished successfully!');
        core.info('');
        core.info('📋 Application logs:');
        core.info('-------------------');

        const logs = await client.getApplicationLogs(appUuid);
        core.info(logs);

        core.setOutput('status', 'success');
        return;
      }

      if (FAILURE_STATUSES.includes(status)) {
        core.setOutput('status', 'failed');
        core.setFailed('Deployment failed!');
        return;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    core.setOutput('status', 'timeout');
    core.setFailed(`Timed out after ${timeoutMinutes} minute(s)`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
