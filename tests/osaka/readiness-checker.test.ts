import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataReadinessChecker } from '../../src/osaka/readiness-checker.js';
import { OSAKA_AREAS, getOsakaArea } from '../../src/osaka/area-config.js';

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  readdir: vi.fn().mockResolvedValue([]),
}));

describe('DataReadinessChecker', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns ready=true when LOD1 and textures exist with GML files', async () => {
    const { access, readdir } = await import('node:fs/promises');
    (access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined); // all exist
    (readdir as ReturnType<typeof vi.fn>).mockResolvedValue(['building01.gml', 'building02.gml']);

    const checker = new DataReadinessChecker();
    const report = await checker.checkArea(getOsakaArea('dotonbori'), '/data');

    expect(report.ready).toBe(true);
    expect(report.hasLod1).toBe(true);
    expect(report.hasTextures).toBe(true);
    expect(report.gmlFileCount).toBe(2);
    expect(report.issues).toHaveLength(0);
  });

  it('returns ready=false when LOD1 is missing', async () => {
    const { access } = await import('node:fs/promises');
    (access as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

    const checker = new DataReadinessChecker();
    const report = await checker.checkArea(getOsakaArea('namba'), '/data');

    expect(report.ready).toBe(false);
    expect(report.hasLod1).toBe(false);
    expect(report.issues.some((i) => i.includes('LOD1'))).toBe(true);
  });

  it('includes LOD2 missing as a non-blocking warning', async () => {
    const { access, readdir } = await import('node:fs/promises');
    // LOD1 and textures exist, LOD2 is missing
    let callCount = 0;
    (access as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 2) return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      return Promise.resolve(undefined);
    });
    (readdir as ReturnType<typeof vi.fn>).mockResolvedValue(['building01.gml']);

    const checker = new DataReadinessChecker();
    const report = await checker.checkArea(getOsakaArea('dotonbori'), '/data');

    expect(report.ready).toBe(true);
    expect(report.hasLod2).toBe(false);
    expect(report.issues.some((i) => i.includes('LOD2'))).toBe(true);
  });

  it('returns coverageScore=0 when LOD1 is missing', async () => {
    const { access } = await import('node:fs/promises');
    (access as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'));

    const checker = new DataReadinessChecker();
    const report = await checker.checkArea(getOsakaArea('dotonbori'), '/data');

    expect(report.coverageScore).toBe(0);
  });

  it('checkAll returns a report for each of the 4 Osaka areas', async () => {
    const { access, readdir } = await import('node:fs/promises');
    (access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (readdir as ReturnType<typeof vi.fn>).mockResolvedValue(['building01.gml']);

    const checker = new DataReadinessChecker();
    const reports = await checker.checkAll('/data');

    expect(reports).toHaveLength(OSAKA_AREAS.length);
    expect(reports.map((r) => r.area)).toContain('dotonbori');
    expect(reports.map((r) => r.area)).toContain('castle');
  });
});
