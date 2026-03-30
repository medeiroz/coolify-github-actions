import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @actions/core
const mockGetInput = vi.fn();
const mockGetBooleanInput = vi.fn();
const mockSetOutput = vi.fn();
const mockSetFailed = vi.fn();
const mockInfo = vi.fn();
const mockSetSecret = vi.fn();

vi.mock('@actions/core', () => ({
  getInput: (...args: unknown[]) => mockGetInput(...args),
  getBooleanInput: (...args: unknown[]) => mockGetBooleanInput(...args),
  setOutput: (...args: unknown[]) => mockSetOutput(...args),
  setFailed: (...args: unknown[]) => mockSetFailed(...args),
  info: (...args: unknown[]) => mockInfo(...args),
  setSecret: (...args: unknown[]) => mockSetSecret(...args),
  warning: vi.fn(),
}));

// Mock CoolifyClient
const mockDeploy = vi.fn();

vi.mock('../src/shared/coolify-client.js', () => ({
  CoolifyClient: class {
    constructor() {
      return { deploy: mockDeploy };
    }
  },
  CoolifyApiError: class CoolifyApiError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
    }
  },
}));

describe('Deploy Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('sets outputs on successful deploy', async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        api_url: 'https://coolify.example.com/api/v1',
        token: 'test-token',
        app_uuid: 'test-app-uuid',
      };
      return inputs[name] ?? '';
    });
    mockGetBooleanInput.mockReturnValue(false);
    mockDeploy.mockResolvedValue({
      deploymentUuid: 'deploy-123',
      resourceUuid: 'resource-456',
    });

    await import('../src/deploy/index.js');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockSetOutput).toHaveBeenCalledWith('deployment_uuid', 'deploy-123');
    expect(mockSetOutput).toHaveBeenCalledWith('resource_uuid', 'resource-456');
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  it('calls setFailed on error', async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        api_url: 'https://coolify.example.com/api/v1',
        token: 'test-token',
        app_uuid: 'test-app-uuid',
      };
      return inputs[name] ?? '';
    });
    mockGetBooleanInput.mockReturnValue(false);
    mockDeploy.mockRejectedValue(new Error('Deploy failed'));

    await import('../src/deploy/index.js');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockSetFailed).toHaveBeenCalledWith('Deploy failed');
  });

  it('fails when app_uuid is empty', async () => {
    mockGetInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        api_url: 'https://coolify.example.com/api/v1',
        token: 'test-token',
        app_uuid: '   ',
      };
      return inputs[name] ?? '';
    });
    mockGetBooleanInput.mockReturnValue(false);

    await import('../src/deploy/index.js');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockSetFailed).toHaveBeenCalledWith('app_uuid cannot be empty');
  });
});
