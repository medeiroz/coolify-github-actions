import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @actions/core
const mockGetInput = vi.fn();
const mockSetOutput = vi.fn();
const mockSetFailed = vi.fn();
const mockInfo = vi.fn();
const mockWarning = vi.fn();
const mockSetSecret = vi.fn();

vi.mock('@actions/core', () => ({
  getInput: (...args: unknown[]) => mockGetInput(...args),
  getBooleanInput: vi.fn(),
  setOutput: (...args: unknown[]) => mockSetOutput(...args),
  setFailed: (...args: unknown[]) => mockSetFailed(...args),
  info: (...args: unknown[]) => mockInfo(...args),
  warning: (...args: unknown[]) => mockWarning(...args),
  setSecret: (...args: unknown[]) => mockSetSecret(...args),
}));

// Mock CoolifyClient
const mockGetDeploymentStatus = vi.fn();
const mockGetApplicationLogs = vi.fn();

vi.mock('../src/shared/coolify-client.js', () => ({
  CoolifyClient: class {
    constructor() {
      return {
        getDeploymentStatus: mockGetDeploymentStatus,
        getApplicationLogs: mockGetApplicationLogs,
      };
    }
  },
  CoolifyApiError: class CoolifyApiError extends Error {
    public statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'CoolifyApiError';
      this.statusCode = statusCode;
    }
  },
}));

function setupInputs(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    api_url: 'https://coolify.example.com/api/v1',
    token: 'test-token',
    app_uuid: 'test-app-uuid',
    deployment_uuid: 'test-deploy-uuid',
    timeout_minutes: '1',
  };
  const inputs = { ...defaults, ...overrides };
  mockGetInput.mockImplementation((name: string) => inputs[name] ?? '');
}

describe('Wait Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('sets status=success when deployment finishes', async () => {
    setupInputs();
    mockGetDeploymentStatus.mockResolvedValue({ status: 'success', updated_at: '2026-01-01' });
    mockGetApplicationLogs.mockResolvedValue('App started');

    await import('../src/wait/index.js');
    await vi.advanceTimersByTimeAsync(500);

    expect(mockSetOutput).toHaveBeenCalledWith('status', 'success');
    expect(mockSetFailed).not.toHaveBeenCalled();
  });

  it('sets status=success for "finished" status', async () => {
    setupInputs();
    mockGetDeploymentStatus.mockResolvedValue({ status: 'finished', updated_at: '2026-01-01' });
    mockGetApplicationLogs.mockResolvedValue('App started');

    await import('../src/wait/index.js');
    await vi.advanceTimersByTimeAsync(500);

    expect(mockSetOutput).toHaveBeenCalledWith('status', 'success');
  });

  it('sets status=failed when deployment fails', async () => {
    setupInputs();
    mockGetDeploymentStatus.mockResolvedValue({ status: 'failed', updated_at: '2026-01-01' });

    await import('../src/wait/index.js');
    await vi.advanceTimersByTimeAsync(500);

    expect(mockSetOutput).toHaveBeenCalledWith('status', 'failed');
    expect(mockSetFailed).toHaveBeenCalledWith('Deployment failed!');
  });

  it('fails immediately on 404 (deployment not found)', async () => {
    setupInputs();
    const { CoolifyApiError: MockedError } = await import('../src/shared/coolify-client.js');
    mockGetDeploymentStatus.mockRejectedValue(new MockedError('Not found', 404));

    await import('../src/wait/index.js');
    await vi.advanceTimersByTimeAsync(500);

    expect(mockSetOutput).toHaveBeenCalledWith('status', 'failed');
    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('not found (404)'));
  });

  it('rejects invalid timeout_minutes', async () => {
    setupInputs({ timeout_minutes: '-1' });

    await import('../src/wait/index.js');
    await vi.advanceTimersByTimeAsync(500);

    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('Invalid timeout_minutes'));
  });
});
