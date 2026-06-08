import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue('[]'),
}));

vi.mock('../src/pipeline/executor.js', () => ({
  NodeChildProcessExecutor: vi.fn().mockImplementation(() => ({
    exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
  })),
}));

vi.mock('../src/pipeline/three-d-pipeline.js', () => ({
  ThreeDPipeline: vi.fn().mockImplementation(() => ({
    build: vi.fn().mockResolvedValue({
      success: true,
      outputZipPath: '/output/osaka.zip',
      assets: [],
      errors: [],
      warnings: [],
    }),
  })),
}));

describe('osaka-release-cli main()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  const originalArgv = [...process.argv];

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 'undefined'})`);
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('check-readiness writes readiness report to file', async () => {
    process.argv = [...originalArgv, '--check-readiness'];
    const { writeFile } = await import('node:fs/promises');
    const { main } = await import('../src/osaka-release-cli.js');

    await main();

    expect(writeFile).toHaveBeenCalled();
    const writeCalls = (writeFile as ReturnType<typeof vi.fn>).mock.calls;
    const reportCall = writeCalls.find(([p]) => String(p).includes('osaka_readiness.json'));
    expect(reportCall).toBeDefined();
  });

  it('prints usage when no flag is provided', async () => {
    process.argv = [...originalArgv];
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { main } = await import('../src/osaka-release-cli.js');

    await main();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    logSpy.mockRestore();
  });

  it('does not call process.exit when --check-readiness succeeds', async () => {
    process.argv = [...originalArgv, '--check-readiness'];
    const { main } = await import('../src/osaka-release-cli.js');

    await expect(main()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('--build succeeds and logs success message', async () => {
    process.argv = [...originalArgv, '--build', 'dotonbori'];
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { main } = await import('../src/osaka-release-cli.js');
    await main();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('built successfully'));
    expect(exitSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('--build calls process.exit(5) when build fails', async () => {
    const { ThreeDPipeline } = await import('../src/pipeline/three-d-pipeline.js');
    (ThreeDPipeline as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      build: vi.fn().mockResolvedValue({
        success: false,
        errors: ['CityGML parse failed'],
        assets: [],
        warnings: [],
      }),
    }));

    process.argv = [...originalArgv, '--build', 'namba'];
    const { main } = await import('../src/osaka-release-cli.js');
    await expect(main()).rejects.toThrow('process.exit(5)');
    expect(exitSpy).toHaveBeenCalledWith(5);
  });

  it('--bundle creates mega pack and writes README', async () => {
    process.argv = [...originalArgv, '--bundle'];
    const { writeFile } = await import('node:fs/promises');
    const writeSpy = writeFile as ReturnType<typeof vi.fn>;

    const { main } = await import('../src/osaka-release-cli.js');
    await main();

    const writeCalls = writeSpy.mock.calls;
    expect(writeCalls.some(([p]) => String(p).includes('README.md'))).toBe(true);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
