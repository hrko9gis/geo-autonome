import { describe, expect, it, vi } from 'vitest';
import { ChildProcessBlenderConverter, BlenderConverterError } from '../../src/pipeline/blender-converter.js';
import type { IChildProcessExecutor } from '../../src/pipeline/executor.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';

function makeExecutor(exitCode = 0): IChildProcessExecutor {
  return { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode }) };
}

function makeConfig(lodLevels = [1, 2]): PipelineConfig {
  return {
    area: 'osaka',
    inputPath: '/data/osaka.city.json',
    outputDir: '/output',
    lodLevels,
    textureAtlasMaxSizePx: 2048,
    polygonLimit: 50000,
  };
}

describe('ChildProcessBlenderConverter', () => {
  it('calls blender for each format and LOD level', async () => {
    const executor = makeExecutor();
    const converter = new ChildProcessBlenderConverter(executor, 'blender');
    await converter.convert('/input.city.json', '/output', makeConfig([1, 2]));

    // 3 formats × 2 LOD levels = 6 calls
    expect(executor.exec).toHaveBeenCalledTimes(6);
  });

  it('returns output file paths for all format/LOD combinations', async () => {
    const executor = makeExecutor();
    const converter = new ChildProcessBlenderConverter(executor);
    const outputs = await converter.convert('/input.city.json', '/output', makeConfig([1]));

    expect(outputs.length).toBe(3); // fbx, gltf, usd
    expect(outputs.some((p) => p.includes('fbx'))).toBe(true);
    expect(outputs.some((p) => p.includes('gltf'))).toBe(true);
    expect(outputs.some((p) => p.includes('usd'))).toBe(true);
  });

  it('throws BlenderConverterError when blender exits with non-zero code', async () => {
    const executor = makeExecutor(1);
    const converter = new ChildProcessBlenderConverter(executor);
    await expect(
      converter.convert('/input.city.json', '/output', makeConfig([1])),
    ).rejects.toThrow(BlenderConverterError);
  });

  it('calls blender with --background flag', async () => {
    const executor = makeExecutor();
    const converter = new ChildProcessBlenderConverter(executor, 'blender');
    await converter.convert('/input.city.json', '/output', makeConfig([1]));

    const [, args] = (executor.exec as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args).toContain('--background');
  });
});
