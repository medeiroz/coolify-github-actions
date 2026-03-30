import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  setSecret: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

// Mock @actions/http-client
const mockPost = vi.fn();
const mockGet = vi.fn();

vi.mock('@actions/http-client', () => ({
  HttpClient: class {
    constructor() {
      return { post: mockPost, get: mockGet };
    }
  },
}));

import { CoolifyClient, CoolifyApiError } from '../src/shared/coolify-client.js';

function createMockResponse(statusCode: number, body: string) {
  let bodyRead = false;
  return {
    message: { statusCode },
    readBody: vi.fn().mockImplementation(() => {
      if (bodyRead) return Promise.resolve(body);
      bodyRead = true;
      return Promise.resolve(body);
    }),
  };
}

describe('CoolifyClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws error for invalid apiUrl', () => {
      expect(() => new CoolifyClient('invalid-url', 'token')).toThrow(
        'Invalid api_url: must start with http:// or https://',
      );
    });

    it('accepts http:// urls', () => {
      expect(() => new CoolifyClient('http://localhost/api/v1', 'token')).not.toThrow();
    });

    it('accepts https:// urls', () => {
      expect(() => new CoolifyClient('https://coolify.example.com/api/v1', 'token')).not.toThrow();
    });

    it('calls core.setSecret with the token', async () => {
      const core = await import('@actions/core');
      new CoolifyClient('https://coolify.example.com/api/v1', 'my-secret-token');
      expect(core.setSecret).toHaveBeenCalledWith('my-secret-token');
    });
  });

  describe('deploy', () => {
    it('parses deployment_uuid from nested deployments array', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockPost.mockResolvedValue(
        createMockResponse(
          200,
          JSON.stringify({
            deployments: [{ deployment_uuid: 'abc123', resource_uuid: 'res456' }],
          }),
        ),
      );

      const result = await client.deploy('app-uuid', false);
      expect(result.deploymentUuid).toBe('abc123');
      expect(result.resourceUuid).toBe('res456');
    });

    it('parses deployment_uuid from flat response', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockPost.mockResolvedValue(
        createMockResponse(200, JSON.stringify({ deployment_uuid: 'flat-uuid' })),
      );

      const result = await client.deploy('app-uuid', false);
      expect(result.deploymentUuid).toBe('flat-uuid');
      expect(result.resourceUuid).toBe('');
    });

    it('parses deployment_id as fallback', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockPost.mockResolvedValue(
        createMockResponse(200, JSON.stringify({ deployment_id: 'id-fallback' })),
      );

      const result = await client.deploy('app-uuid', false);
      expect(result.deploymentUuid).toBe('id-fallback');
    });

    it('throws error when deployment_uuid is missing', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockPost.mockResolvedValue(
        createMockResponse(200, JSON.stringify({ message: 'No deployment info' })),
      );

      await expect(client.deploy('app-uuid', false)).rejects.toThrow(
        'Failed to parse deployment_uuid',
      );
    });

    it('throws CoolifyApiError on HTTP 401', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockPost.mockResolvedValue(createMockResponse(401, 'Unauthorized'));

      await expect(client.deploy('app-uuid', false)).rejects.toThrow(CoolifyApiError);
    });

    it('throws CoolifyApiError on HTTP 404', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockPost.mockResolvedValue(createMockResponse(404, 'Not found'));

      await expect(client.deploy('app-uuid', false)).rejects.toThrow(CoolifyApiError);
    });

    it('throws CoolifyApiError on HTTP 500', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockPost.mockResolvedValue(createMockResponse(500, 'Internal Server Error'));

      await expect(client.deploy('app-uuid', false)).rejects.toThrow(CoolifyApiError);
    });

    it('throws error on invalid JSON response', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockPost.mockResolvedValue(createMockResponse(200, 'not json'));

      await expect(client.deploy('app-uuid', false)).rejects.toThrow(
        'Failed to parse Coolify deploy response as JSON',
      );
    });
  });

  describe('getDeploymentStatus', () => {
    it('returns deployment status', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockGet.mockResolvedValue(
        createMockResponse(
          200,
          JSON.stringify({ status: 'in_progress', updated_at: '2026-01-01' }),
        ),
      );

      const result = await client.getDeploymentStatus('deploy-uuid');
      expect(result.status).toBe('in_progress');
      expect(result.updated_at).toBe('2026-01-01');
    });

    it('returns success status', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockGet.mockResolvedValue(createMockResponse(200, JSON.stringify({ status: 'success' })));

      const result = await client.getDeploymentStatus('deploy-uuid');
      expect(result.status).toBe('success');
    });

    it('throws CoolifyApiError on HTTP 404', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockGet.mockResolvedValue(createMockResponse(404, 'Not found'));

      await expect(client.getDeploymentStatus('deploy-uuid')).rejects.toThrow(CoolifyApiError);
    });

    it('returns empty object on parse error with warning', async () => {
      const core = await import('@actions/core');
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockGet.mockResolvedValue(createMockResponse(200, 'not json'));

      const result = await client.getDeploymentStatus('deploy-uuid');
      expect(result).toEqual({});
      expect(core.warning).toHaveBeenCalled();
    });
  });

  describe('getApplicationLogs', () => {
    it('returns logs', async () => {
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockGet.mockResolvedValue(
        createMockResponse(200, JSON.stringify({ logs: 'App started on port 3000' })),
      );

      const result = await client.getApplicationLogs('app-uuid');
      expect(result).toBe('App started on port 3000');
    });

    it('returns warning message when logs are empty', async () => {
      const core = await import('@actions/core');
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockGet.mockResolvedValue(createMockResponse(200, JSON.stringify({ logs: '' })));

      const result = await client.getApplicationLogs('app-uuid');
      expect(result).toBe('No logs available');
      expect(core.warning).toHaveBeenCalled();
    });

    it('returns fallback on HTTP error', async () => {
      const core = await import('@actions/core');
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockGet.mockResolvedValue(createMockResponse(500, 'Error'));

      const result = await client.getApplicationLogs('app-uuid');
      expect(result).toBe('Failed to retrieve logs');
      expect(core.warning).toHaveBeenCalled();
    });

    it('returns fallback on network error', async () => {
      const core = await import('@actions/core');
      const client = new CoolifyClient('https://coolify.example.com/api/v1', 'token');
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await client.getApplicationLogs('app-uuid');
      expect(result).toBe('Failed to retrieve logs');
      expect(core.warning).toHaveBeenCalled();
    });
  });
});
