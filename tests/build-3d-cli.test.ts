import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_CSV = `source_name,license_type,commercial_ok,requires_attribution,share_alike,notes
plateau,CC BY 4.0,true,true,false,PLATEAU 3D City Model by MLIT Japan
`;

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(MOCK_CSV),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
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

describe('build-3d-cli main()', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code ?? 'undefined'})`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('does not call process.exit when build succeeds', async () => {
    const { main } = await import('../src/build-3d-cli.js');
    await expect(main()).resolves.toBeUndefined();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('calls process.exit(5) when build fails', async () => {
    const { ThreeDPipeline } = await import('../src/pipeline/three-d-pipeline.js');
    (ThreeDPipeline as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      build: vi.fn().mockResolvedValue({
        success: false,
        assets: [],
        errors: ['License violation: osm'],
        warnings: [],
      }),
    }));

    const { main } = await import('../src/build-3d-cli.js');
    await expect(main()).rejects.toThrow('process.exit(5)');
    expect(exitSpy).toHaveBeenCalledWith(5);
  });
});
