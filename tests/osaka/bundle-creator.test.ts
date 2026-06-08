import { describe, expect, it, vi } from 'vitest';
import { BundleCreator } from '../../src/osaka/bundle-creator.js';
import { OSAKA_AREAS, OSAKA_MEGA_PACK } from '../../src/osaka/area-config.js';
import type { IChildProcessExecutor } from '../../src/pipeline/executor.js';

function makeExecutor(exitCode = 0): IChildProcessExecutor {
  return { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode }) };
}

describe('BundleCreator', () => {
  describe('generateMegaPackReadme()', () => {
    it('includes all area display names', () => {
      const creator = new BundleCreator(makeExecutor());
      const readme = creator.generateMegaPackReadme(
        [...OSAKA_AREAS],
        OSAKA_MEGA_PACK,
        'PLATEAU CC BY 4.0 attribution',
      );

      expect(readme).toContain('Dotonbori');
      expect(readme).toContain('Namba');
      expect(readme).toContain('Umeda');
      expect(readme).toContain('Castle');
    });

    it('includes bundle price', () => {
      const creator = new BundleCreator(makeExecutor());
      const readme = creator.generateMegaPackReadme(
        [...OSAKA_AREAS],
        OSAKA_MEGA_PACK,
        'attribution',
      );

      expect(readme).toContain('$99');
    });

    it('includes attribution text', () => {
      const creator = new BundleCreator(makeExecutor());
      const readme = creator.generateMegaPackReadme(
        [...OSAKA_AREAS],
        OSAKA_MEGA_PACK,
        'PLATEAU CC BY 4.0',
      );

      expect(readme).toContain('PLATEAU CC BY 4.0');
    });
  });

  describe('createBundle()', () => {
    it('calls zip command with output zip name and area zip paths', async () => {
      const executor = makeExecutor();
      const creator = new BundleCreator(executor);

      await creator.createBundle(
        ['/output/dotonbori.zip', '/output/namba.zip'],
        '/output/osaka-mega-pack.zip',
      );

      expect(executor.exec).toHaveBeenCalledWith(
        'zip',
        expect.arrayContaining(['-r', 'osaka-mega-pack.zip']),
        '/output',
      );
    });

    it('returns the output zip path on success', async () => {
      const creator = new BundleCreator(makeExecutor());
      const result = await creator.createBundle([], '/output/osaka-mega-pack.zip');
      expect(result).toBe('/output/osaka-mega-pack.zip');
    });

    it('throws when zip command fails', async () => {
      const creator = new BundleCreator(makeExecutor(1));
      await expect(
        creator.createBundle(['/output/area.zip'], '/output/mega.zip'),
      ).rejects.toThrow('Bundle creation failed');
    });
  });
});
