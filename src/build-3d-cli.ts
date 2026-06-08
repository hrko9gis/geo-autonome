import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ChildProcessBlenderConverter } from './pipeline/blender-converter.js';
import { ChildProcessCityGmlParser } from './pipeline/citygml-parser.js';
import { NodeChildProcessExecutor } from './pipeline/executor.js';
import { LicenseValidator } from './pipeline/license-validator.js';
import { Packager } from './pipeline/packager.js';
import { ThreeDPipeline } from './pipeline/three-d-pipeline.js';
import type { PipelineConfig } from './pipeline/types.js';
import { ChildProcessUnityValidator } from './pipeline/unity-validator.js';

const LICENSE_MATRIX_PATH = path.join('data', 'license_matrix.csv');
const DEFAULT_OUTPUT_DIR = path.join('pipeline', 'output');

function parseArgs(): { area: string; input: string; output: string; sources: string[] } {
  const args = process.argv.slice(2);
  const area = args[args.indexOf('--area') + 1] ?? 'unknown';
  const input = args[args.indexOf('--input') + 1] ?? '';
  const output = args[args.indexOf('--output') + 1] ?? DEFAULT_OUTPUT_DIR;
  const sourcesIdx = args.indexOf('--sources');
  const sources = sourcesIdx >= 0 ? args[sourcesIdx + 1].split(',') : ['plateau'];
  return { area, input, output, sources };
}

export async function main(): Promise<void> {
  const { area, input, output, sources } = parseArgs();

  const blenderPath = process.env['BLENDER_PATH'] ?? 'blender';
  const citygmlToolsPath = process.env['CITYGML_TOOLS_PATH'] ?? 'citygml-tools';
  const unityPath = process.env['UNITY_PATH'] ?? 'unity';

  if (!process.env['BLENDER_PATH']) {
    console.warn('[build-3d-cli] BLENDER_PATH not set, using system default: blender');
  }
  if (!process.env['CITYGML_TOOLS_PATH']) {
    console.warn('[build-3d-cli] CITYGML_TOOLS_PATH not set, using system default: citygml-tools');
  }

  const executor = new NodeChildProcessExecutor();

  const config: PipelineConfig = {
    area,
    inputPath: input,
    outputDir: output,
    lodLevels: [1, 2],
    textureAtlasMaxSizePx: 2048,
    polygonLimit: 50000,
  };

  const pipeline = new ThreeDPipeline(
    new LicenseValidator(LICENSE_MATRIX_PATH),
    new ChildProcessCityGmlParser(executor, citygmlToolsPath),
    new ChildProcessBlenderConverter(executor, blenderPath),
    new ChildProcessUnityValidator(executor, unityPath),
    new Packager(executor),
  );

  const result = await pipeline.build(config, sources);

  if (!result.success) {
    console.error('[build-3d-cli] Build failed:');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(5);
  }

  console.log(`[build-3d-cli] Build succeeded!`);
  console.log(`[build-3d-cli] Output: ${result.outputZipPath}`);

  if (result.warnings.length > 0) {
    console.warn('[build-3d-cli] Warnings:');
    for (const warn of result.warnings) {
      console.warn(`  - ${warn}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[build-3d-cli] Unexpected error:', err);
    process.exit(5);
  });
}
