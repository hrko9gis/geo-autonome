import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { NodeChildProcessExecutor } from './pipeline/executor.js';
import { LicenseValidator } from './pipeline/license-validator.js';
import { ChildProcessCityGmlParser } from './pipeline/citygml-parser.js';
import { ChildProcessBlenderConverter } from './pipeline/blender-converter.js';
import { ChildProcessUnityValidator } from './pipeline/unity-validator.js';
import { Packager } from './pipeline/packager.js';
import { ThreeDPipeline } from './pipeline/three-d-pipeline.js';
import { OSAKA_AREAS, OSAKA_MEGA_PACK, getOsakaArea } from './osaka/area-config.js';
import type { OsakaAreaName } from './osaka/area-config.js';
import { DataReadinessChecker } from './osaka/readiness-checker.js';
import { BundleCreator } from './osaka/bundle-creator.js';

const DATA_DIR = path.join('data', 'plateau', 'osaka');
const OUTPUT_DIR = path.join('pipeline', 'output', 'osaka');
const LICENSE_MATRIX_PATH = path.join('data', 'license_matrix.csv');
const READINESS_REPORT_PATH = path.join('data', 'osaka_readiness.json');

function getFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function getFlagValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

export async function main(): Promise<void> {
  const checkReadiness = getFlag('--check-readiness');
  const buildArea = getFlagValue('--build') as OsakaAreaName | undefined;
  const createBundle = getFlag('--bundle');

  if (checkReadiness) {
    console.log('[osaka-release-cli] Checking data readiness for all Osaka areas...');
    const checker = new DataReadinessChecker();
    const reports = await checker.checkAll(DATA_DIR);

    for (const report of reports) {
      const status = report.ready ? '✅ READY' : '❌ NOT READY';
      console.log(`  ${status} ${report.area} (coverage: ${report.coverageScore}%)`);
      for (const issue of report.issues) {
        console.warn(`    - ${issue}`);
      }
    }

    await mkdir(path.dirname(READINESS_REPORT_PATH), { recursive: true });
    await writeFile(READINESS_REPORT_PATH, JSON.stringify(reports, null, 2), 'utf8');
    console.log(`[osaka-release-cli] Report saved to ${READINESS_REPORT_PATH}`);
    return;
  }

  if (buildArea) {
    console.log(`[osaka-release-cli] Building ${buildArea} area...`);
    const area = getOsakaArea(buildArea);
    const executor = new NodeChildProcessExecutor();

    const pipeline = new ThreeDPipeline(
      new LicenseValidator(LICENSE_MATRIX_PATH),
      new ChildProcessCityGmlParser(executor, process.env['CITYGML_TOOLS_PATH'] ?? 'citygml-tools'),
      new ChildProcessBlenderConverter(executor, process.env['BLENDER_PATH'] ?? 'blender'),
      new ChildProcessUnityValidator(executor, process.env['UNITY_PATH'] ?? 'unity'),
      new Packager(executor),
    );

    const result = await pipeline.build(
      {
        area: area.name,
        inputPath: path.join(DATA_DIR, area.name, 'lod1'),
        outputDir: path.join(OUTPUT_DIR, area.name),
        lodLevels: [1, 2],
        textureAtlasMaxSizePx: 2048,
        polygonLimit: 50000,
      },
      ['plateau'],
    );

    if (!result.success) {
      console.error(`[osaka-release-cli] Build failed for ${buildArea}:`);
      for (const err of result.errors) console.error(`  - ${err}`);
      process.exit(5);
    }

    console.log(`[osaka-release-cli] ✅ ${area.displayName} built successfully!`);
    console.log(`[osaka-release-cli] Output: ${result.outputZipPath}`);
    return;
  }

  if (createBundle) {
    console.log('[osaka-release-cli] Creating Osaka Mega Pack bundle...');
    const executor = new NodeChildProcessExecutor();
    const creator = new BundleCreator(executor);

    const zipPaths = OSAKA_AREAS.map((a) =>
      path.join(OUTPUT_DIR, a.name, `${a.name}.zip`),
    );

    const attribution = 'This product uses PLATEAU 3D City Model data (CC BY 4.0) provided by the Ministry of Land, Infrastructure, Transport and Tourism (MLIT), Japan.';
    const readme = creator.generateMegaPackReadme([...OSAKA_AREAS], OSAKA_MEGA_PACK, attribution);
    const outputZip = path.join(OUTPUT_DIR, `${OSAKA_MEGA_PACK.productName}.zip`);

    await mkdir(path.dirname(outputZip), { recursive: true });
    await writeFile(path.join(path.dirname(outputZip), 'README.md'), readme, 'utf8');

    const bundlePath = await creator.createBundle(zipPaths, outputZip);
    console.log(`[osaka-release-cli] ✅ Mega Pack created: ${bundlePath}`);
    return;
  }

  console.log('[osaka-release-cli] Usage:');
  console.log('  --check-readiness   Check PLATEAU data readiness for all areas');
  console.log('  --build <area>      Build a specific area (dotonbori|namba|umeda|castle)');
  console.log('  --bundle            Create Osaka Mega Pack from all area ZIPs');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('[osaka-release-cli] Unexpected error:', err);
    process.exit(1);
  });
}
