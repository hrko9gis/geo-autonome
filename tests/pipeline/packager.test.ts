import { afterEach, describe, expect, it, vi } from 'vitest';
import { Packager } from '../../src/pipeline/packager.js';
import type { IChildProcessExecutor } from '../../src/pipeline/executor.js';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

function makeExecutor(exitCode = 0): IChildProcessExecutor {
  return { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode }) };
}

describe('Packager', () => {
  afterEach(() => vi.clearAllMocks());

  describe('generateReadme()', () => {
    it('includes the area name in the title', () => {
      const packager = new Packager(makeExecutor());
      const readme = packager.generateReadme('Osaka', ['plateau'], 'attribution text');
      expect(readme).toContain('Osaka');
    });

    it('includes attribution text', () => {
      const packager = new Packager(makeExecutor());
      const readme = packager.generateReadme('Osaka', ['plateau'], 'PLATEAU CC BY 4.0');
      expect(readme).toContain('PLATEAU CC BY 4.0');
    });

    it('lists data sources', () => {
      const packager = new Packager(makeExecutor());
      const readme = packager.generateReadme('Osaka', ['plateau', 'kokudo_chiriin'], '');
      expect(readme).toContain('plateau');
      expect(readme).toContain('kokudo_chiriin');
    });
  });

  describe('generateLicenseMd()', () => {
    it('includes attribution in the license file', () => {
      const packager = new Packager(makeExecutor());
      const license = packager.generateLicenseMd('PLATEAU CC BY 4.0 attribution here');
      expect(license).toContain('# License');
      expect(license).toContain('PLATEAU CC BY 4.0 attribution here');
    });
  });

  describe('pack()', () => {
    it('calls zip command with the output filename', async () => {
      const executor = makeExecutor();
      const packager = new Packager(executor);

      await packager.pack([], '/output/osaka.zip', 'README', 'LICENSE');

      const [command, args] = (executor.exec as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(command).toBe('zip');
      expect(args).toContain('osaka.zip');
    });

    it('writes README.md and LICENSE.md before zipping', async () => {
      const executor = makeExecutor();
      const packager = new Packager(executor);

      const { writeFile } = await import('node:fs/promises');
      await packager.pack([], '/output/osaka.zip', 'README content', 'LICENSE content');

      const writeCalls = (writeFile as ReturnType<typeof vi.fn>).mock.calls;
      const readmeCall = writeCalls.find(([p]) => String(p).endsWith('README.md'));
      const licenseCall = writeCalls.find(([p]) => String(p).endsWith('LICENSE.md'));
      expect(readmeCall).toBeDefined();
      expect(licenseCall).toBeDefined();
    });

    it('throws when zip command fails', async () => {
      const executor = makeExecutor(1);
      const packager = new Packager(executor);
      await expect(packager.pack([], '/output/osaka.zip', '', '')).rejects.toThrow('zip command failed');
    });
  });
});
