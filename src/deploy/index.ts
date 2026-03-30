import * as core from '@actions/core';
import { CoolifyClient } from '../shared/coolify-client.js';

async function run(): Promise<void> {
  try {
    const apiUrl = core.getInput('api_url', { required: true });
    const token = core.getInput('token', { required: true });
    const appUuid = core.getInput('app_uuid', { required: true });
    const force = core.getBooleanInput('force');

    if (!appUuid.trim()) {
      throw new Error('app_uuid cannot be empty');
    }

    const client = new CoolifyClient(apiUrl, token);
    const result = await client.deploy(appUuid, force);

    core.info(`✅ Deployment triggered successfully!`);
    core.info(`   deployment_uuid: ${result.deploymentUuid}`);
    core.info(`   resource_uuid: ${result.resourceUuid}`);

    core.setOutput('deployment_uuid', result.deploymentUuid);
    core.setOutput('resource_uuid', result.resourceUuid);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
