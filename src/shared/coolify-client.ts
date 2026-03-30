import { HttpClient } from '@actions/http-client';
import * as core from '@actions/core';
import type {
  DeploymentResponse,
  DeploymentStatusResponse,
  LogsResponse,
  DeployResult,
} from './types.js';

export class CoolifyApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: string,
  ) {
    super(message);
    this.name = 'CoolifyApiError';
  }
}

export class CoolifyClient {
  private http: HttpClient;
  private apiUrl: string;

  constructor(apiUrl: string, token: string) {
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      throw new Error(`Invalid api_url: must start with http:// or https://. Got: ${apiUrl}`);
    }

    this.apiUrl = apiUrl.replace(/\/+$/, '');

    core.setSecret(token);

    this.http = new HttpClient('coolify-github-action', [], {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async assertOk(
    response: { message: { statusCode?: number }; readBody(): Promise<string> },
    context: string,
  ): Promise<void> {
    const statusCode = response.message.statusCode ?? 0;
    if (statusCode >= 400) {
      const body = await response.readBody();
      const detail = body ? ` — ${body}` : '';

      if (statusCode === 401) {
        throw new CoolifyApiError(
          `Authentication failed (401). Check your Coolify API token.${detail}`,
          statusCode,
          body,
        );
      }
      if (statusCode === 404) {
        throw new CoolifyApiError(`${context} not found (404).${detail}`, statusCode, body);
      }
      throw new CoolifyApiError(
        `${context} failed with HTTP ${statusCode}.${detail}`,
        statusCode,
        body,
      );
    }
  }

  async deploy(appUuid: string, force: boolean): Promise<DeployResult> {
    const response = await this.http.post(
      `${this.apiUrl}/deploy`,
      JSON.stringify({ uuid: appUuid, force }),
    );

    await this.assertOk(response, 'Deploy');

    const body = await response.readBody();
    let data: DeploymentResponse;
    try {
      data = JSON.parse(body) as DeploymentResponse;
    } catch {
      throw new Error(`Failed to parse Coolify deploy response as JSON: ${body}`);
    }

    const deploymentUuid =
      data.deployments?.[0]?.deployment_uuid ?? data.deployment_uuid ?? data.deployment_id;
    const resourceUuid =
      data.deployments?.[0]?.resource_uuid ?? data.resource_uuid ?? data.resource_id;

    if (!deploymentUuid) {
      throw new Error(
        `Failed to parse deployment_uuid from Coolify response: ${JSON.stringify(data)}`,
      );
    }

    return {
      deploymentUuid,
      resourceUuid: resourceUuid ?? '',
    };
  }

  async getDeploymentStatus(deploymentUuid: string): Promise<DeploymentStatusResponse> {
    const response = await this.http.get(`${this.apiUrl}/deployments/${deploymentUuid}`);

    await this.assertOk(response, `Deployment ${deploymentUuid}`);

    const body = await response.readBody();
    try {
      return JSON.parse(body) as DeploymentStatusResponse;
    } catch {
      core.warning(`Failed to parse deployment status response: ${body}`);
      return {};
    }
  }

  async getApplicationLogs(appUuid: string, lines = 100): Promise<string> {
    try {
      const response = await this.http.get(
        `${this.apiUrl}/applications/${appUuid}/logs?lines=${lines}`,
      );

      const statusCode = response.message.statusCode ?? 0;
      if (statusCode >= 400) {
        core.warning(`Failed to fetch application logs (HTTP ${statusCode})`);
        return 'Failed to retrieve logs';
      }

      const body = await response.readBody();
      const data = JSON.parse(body) as LogsResponse;
      if (!data.logs) {
        core.warning(
          'Application logs endpoint returned empty. This is a known Coolify API limitation for some application types.',
        );
        return 'No logs available';
      }
      return data.logs;
    } catch (error) {
      core.warning(
        `Error fetching logs: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'Failed to retrieve logs';
    }
  }
}
