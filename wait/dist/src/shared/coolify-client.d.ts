import type { DeploymentStatusResponse, DeployResult } from './types.js';
export declare class CoolifyApiError extends Error {
    statusCode: number;
    body?: string | undefined;
    constructor(message: string, statusCode: number, body?: string | undefined);
}
export declare class CoolifyClient {
    private http;
    private apiUrl;
    constructor(apiUrl: string, token: string);
    private assertOk;
    deploy(appUuid: string, force: boolean): Promise<DeployResult>;
    getDeploymentStatus(deploymentUuid: string): Promise<DeploymentStatusResponse>;
    getApplicationLogs(appUuid: string, lines?: number): Promise<string>;
}
//# sourceMappingURL=coolify-client.d.ts.map