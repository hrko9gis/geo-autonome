import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThreeDPipeline } from '../../src/pipeline/three-d-pipeline.js';
import { LicenseValidator } from '../../src/pipeline/license-validator.js';
import { Packager } from '../../src/pipeline/packager.js';
import type { ICityGmlParser } from '../../src/pipeline/citygml-parser.js';
import type { IBlenderConverter } from '../../src/pipeline/blender-converter.js';
import type { IUnityValidator } from '../../src/pipeline/unity-validator.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const MOCK_CSV = `source_name,license_type,commercial_ok,requires_attribution,share_alike,notes
plateau,CC BY 4.0,true,true,false,PLATEAU 3D City Model by MLIT Japan
osm,ODbL,false,true,true,OpenStreetMap
`;

function makeConfig(): PipelineConfig {
  return {
    area: 'osaka',
    inputPath: '/data/osaka.gml',
    outputDir: '/output',
    lodLevels: [1],
    textureAtlasMaxSizePx: 2048,
    polygonLimit: 50000,
  };
}

function makeParser(outputPath = '/output/osaka.city.json'): ICityGmlParser {
  return { parse: vi.fn().mockResolvedValue(outputPath) };
}

function makeConverter(outputs = ['/output/fbx/osaka_lod1.fbx']): IBlenderConverter {
  return { convert: vi.fn().mockResolvedValue(outputs) };
}

function makeUnityValidator(valid = true): IUnityValidator {
  return { validate: vi.fn().mockResolvedValue(valid) };
}

function makePackager(): Packager {
  const executor = { exec: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }) };
  const packager = new Packager(executor);
  vi.spyOn(packager, 'pack').mockResolvedValue('/output/osaka.zip');
  return packager;
}

describe('ThreeDPipeline', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns success=false with license violation error when osm is included', async () => {
    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CSV);

    const validator = new LicenseValidator('/tmp/license_matrix.csv');
    const pipeline = new ThreeDPipeline(
      validator,
      makeParser(),
      makeConverter(),
      makeUnityValidator(),
      makePackager(),
    );

    const result = await pipeline.build(makeConfig(), ['plateau', 'osm']);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('License violation');
    expect(result.warnings).toHaveLength(0);
  });

  it('returns success=true with outputZipPath for valid plateau sources', async () => {
    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CSV);

    const validator = new LicenseValidator('/tmp/license_matrix.csv');
    const pipeline = new ThreeDPipeline(
      validator,
      makeParser(),
      makeConverter(),
      makeUnityValidator(),
      makePackager(),
    );

    const result = await pipeline.build(makeConfig(), ['plateau']);

    expect(result.success).toBe(true);
    expect(result.outputZipPath).toBe('/output/osaka.zip');
  });

  it('continues processing even when Unity validation fails', async () => {
    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CSV);

    const validator = new LicenseValidator('/tmp/license_matrix.csv');
    const pipeline = new ThreeDPipeline(
      validator,
      makeParser(),
      makeConverter(['/output/fbx/osaka_lod1.fbx']),
      makeUnityValidator(false),
      makePackager(),
    );

    const result = await pipeline.build(makeConfig(), ['plateau']);

    expect(result.success).toBe(true);
    expect(result.warnings.some((w) => w.includes('Unity validation failed'))).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns success=false when CityGML parsing fails', async () => {
    const { readFile } = await import('node:fs/promises');
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_CSV);

    const validator = new LicenseValidator('/tmp/license_matrix.csv');
    const failingParser: ICityGmlParser = {
      parse: vi.fn().mockRejectedValue(new Error('Parse error')),
    };

    const pipeline = new ThreeDPipeline(
      validator,
      failingParser,
      makeConverter(),
      makeUnityValidator(),
      makePackager(),
    );

    const result = await pipeline.build(makeConfig(), ['plateau']);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('CityGML parse failed');
  });
});
