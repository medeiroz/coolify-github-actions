export interface DeploymentResponse {
  deployments?: Array<{
    deployment_uuid?: string;
    resource_uuid?: string;
  }>;
  deployment_uuid?: string;
  deployment_id?: string;
  resource_uuid?: string;
  resource_id?: string;
  message?: string;
}

export interface DeploymentStatusResponse {
  status?: string;
  updated_at?: string;
  deployment_uuid?: string;
}

export interface LogsResponse {
  logs?: string;
}

export interface DeployResult {
  deploymentUuid: string;
  resourceUuid: string;
}
