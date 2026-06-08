import { describe, expect, it, vi } from 'vitest';
import { ChildProcessCityGmlParser, CityGmlParserError } from '../../src/pipeline/citygml-parser.js';
import type { IChildProcessExecutor } from '../../src/pipeline/executor.js';

function makeExecutor(exitCode = 0, stdout = '', stderr = ''): IChildProcessExecutor {
  return {
    exec: vi.fn().mockResolvedValue({ stdout, stderr, exitCode }),
  };
}

describe('ChildProcessCityGmlParser', () => {
  it('calls citygml-tools with correct arguments', async () => {
    const executor = makeExecutor();
    const parser = new ChildProcessCityGmlParser(executor, 'citygml-tools');
    await parser.parse('/data/osaka.gml', '/output');

    expect(executor.exec).toHaveBeenCalledWith(
      'citygml-tools',
      expect.arrayContaining(['--input', '/data/osaka.gml', '--output', '/output']),
    );
  });

  it('returns the expected output file path', async () => {
    const executor = makeExecutor();
    const parser = new ChildProcessCityGmlParser(executor);
    const result = await parser.parse('/data/osaka.gml', '/output');
    expect(result).toContain('osaka');
    expect(result).toContain('.city.json');
  });

  it('throws CityGmlParserError when exit code is non-zero', async () => {
    const executor = makeExecutor(1, '', 'Error: invalid CityGML');
    const parser = new ChildProcessCityGmlParser(executor);
    await expect(parser.parse('/data/bad.gml', '/output')).rejects.toThrow(CityGmlParserError);
  });
});
