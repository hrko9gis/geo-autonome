import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LicenseValidator } from '../../src/pipeline/license-validator.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const MOCK_CSV = `source_name,license_type,commercial_ok,requires_attribution,share_alike,notes
plateau,CC BY 4.0,true,true,false,PLATEAU 3D City Model by MLIT Japan
estat,Government Standard 2.0,true,false,false,Statistics Japan e-Stat
osm,ODbL,false,true,true,OpenStreetMap - share-alike prevents commercial sales
`;

describe('LicenseValidator', () => {
  beforeEach(async () => {
    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CSV);
  });

  afterEach(() => vi.clearAllMocks());

  describe('validate()', () => {
    it('returns allowed=true for plateau-only sources', async () => {
      const validator = new LicenseValidator('/tmp/license_matrix.csv');
      const result = await validator.validate(['plateau']);
      expect(result.allowed).toBe(true);
      expect(result.blockedBy).toBeUndefined();
    });

    it('returns allowed=false when osm is included (share-alike)', async () => {
      const validator = new LicenseValidator('/tmp/license_matrix.csv');
      const result = await validator.validate(['plateau', 'osm']);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe('osm');
    });

    it('returns allowed=true for estat (commercial_ok=true, share_alike=false)', async () => {
      const validator = new LicenseValidator('/tmp/license_matrix.csv');
      const result = await validator.validate(['estat']);
      expect(result.allowed).toBe(true);
    });

    it('returns allowed=false for osm alone (commercial_ok=false)', async () => {
      const validator = new LicenseValidator('/tmp/license_matrix.csv');
      const result = await validator.validate(['osm']);
      expect(result.allowed).toBe(false);
    });

    it('includes attribution in the result', async () => {
      const validator = new LicenseValidator('/tmp/license_matrix.csv');
      const result = await validator.validate(['plateau']);
      expect(result.attribution).toContain('PLATEAU');
    });
  });

  describe('generateAttribution()', () => {
    it('includes source notes and license type', () => {
      const validator = new LicenseValidator('/tmp/license_matrix.csv');
      const attribution = validator.generateAttribution(['plateau'], [
        { sourceName: 'plateau', licenseType: 'CC BY 4.0', commercialOk: true, requiresAttribution: true, shareAlike: false, notes: 'PLATEAU 3D City Model by MLIT Japan' },
      ]);
      expect(attribution).toContain('PLATEAU 3D City Model');
      expect(attribution).toContain('CC BY 4.0');
    });

    it('excludes sources that do not require attribution', () => {
      const validator = new LicenseValidator('/tmp/license_matrix.csv');
      const attribution = validator.generateAttribution(['estat'], [
        { sourceName: 'estat', licenseType: 'Government Standard 2.0', commercialOk: true, requiresAttribution: false, shareAlike: false, notes: 'Statistics Japan e-Stat' },
      ]);
      expect(attribution).toBe('');
    });
  });

  describe('generateLicenseMd()', () => {
    it('wraps attribution in a LICENSE.md format', () => {
      const validator = new LicenseValidator('/tmp/license_matrix.csv');
      const md = validator.generateLicenseMd('Attribution text here');
      expect(md).toContain('# License');
      expect(md).toContain('Attribution text here');
    });
  });
});
