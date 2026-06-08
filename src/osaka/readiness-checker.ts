import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { OSAKA_AREAS } from './area-config.js';
import type { OsakaArea, OsakaAreaName } from './area-config.js';

export interface DataReadinessReport {
  area: OsakaAreaName;
  hasLod1: boolean;
  hasLod2: boolean;
  hasTextures: boolean;
  gmlFileCount: number;
  coverageScore: number;
  issues: string[];
  ready: boolean;
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath);
    return true;
  } catch {
    return false;
  }
}

async function countGmlFiles(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath);
    return entries.filter((e) => e.endsWith('.gml')).length;
  } catch {
    return 0;
  }
}

function calculateCoverageScore(gmlCount: number, hasLod1: boolean, hasLod2: boolean, hasTextures: boolean): number {
  if (!hasLod1) return 0;
  let score = 40;
  score += Math.min(gmlCount * 5, 20);
  if (hasLod2) score += 20;
  if (hasTextures) score += 20;
  return Math.min(score, 100);
}

export class DataReadinessChecker {
  async checkArea(area: OsakaArea, dataDir: string): Promise<DataReadinessReport> {
    const areaDir = path.join(dataDir, area.name);
    const lod1Dir = path.join(areaDir, 'lod1');
    const lod2Dir = path.join(areaDir, 'lod2');
    const texturesDir = path.join(areaDir, 'textures');

    const [hasLod1, hasLod2, hasTextures] = await Promise.all([
      directoryExists(lod1Dir),
      directoryExists(lod2Dir),
      directoryExists(texturesDir),
    ]);

    const gmlFileCount = hasLod1 ? await countGmlFiles(lod1Dir) : 0;
    const issues: string[] = [];

    if (!hasLod1) issues.push(`LOD1 directory missing: ${lod1Dir}`);
    if (!hasLod2) issues.push(`LOD2 directory missing (optional but recommended): ${lod2Dir}`);
    if (!hasTextures) issues.push(`Textures directory missing: ${texturesDir}`);
    if (hasLod1 && gmlFileCount === 0) issues.push(`No GML files found in ${lod1Dir}`);

    const coverageScore = calculateCoverageScore(gmlFileCount, hasLod1, hasLod2, hasTextures);
    const ready = hasLod1 && hasTextures && gmlFileCount > 0;

    return {
      area: area.name,
      hasLod1,
      hasLod2,
      hasTextures,
      gmlFileCount,
      coverageScore,
      issues,
      ready,
    };
  }

  async checkAll(dataDir: string): Promise<DataReadinessReport[]> {
    const reports = await Promise.all(OSAKA_AREAS.map((area) => this.checkArea(area, dataDir)));
    return reports;
  }
}
