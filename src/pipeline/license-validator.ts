import { readFile } from 'node:fs/promises';
import type { LicenseResult } from './types.js';

interface LicenseEntry {
  sourceName: string;
  licenseType: string;
  commercialOk: boolean;
  requiresAttribution: boolean;
  shareAlike: boolean;
  notes: string;
}

function parseCsv(content: string): LicenseEntry[] {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const [, ...dataLines] = lines;
  return dataLines.map((line) => {
    const [sourceName, licenseType, commercialOk, requiresAttribution, shareAlike, notes] =
      line.split(',');
    return {
      sourceName: sourceName.trim(),
      licenseType: licenseType.trim(),
      commercialOk: commercialOk.trim() === 'true',
      requiresAttribution: requiresAttribution.trim() === 'true',
      shareAlike: shareAlike.trim() === 'true',
      notes: (notes ?? '').trim(),
    };
  });
}

export class LicenseValidator {
  constructor(private readonly matrixPath: string) {}

  private async loadMatrix(): Promise<LicenseEntry[]> {
    const content = await readFile(this.matrixPath, 'utf8');
    return parseCsv(content);
  }

  async validate(sources: string[]): Promise<LicenseResult> {
    const matrix = await this.loadMatrix();
    const entryMap = new Map(matrix.map((e) => [e.sourceName, e]));

    for (const source of sources) {
      const entry = entryMap.get(source);
      if (!entry) {
        return {
          allowed: false,
          sources,
          blockedBy: source,
          attribution: this.generateAttribution(sources, matrix),
        };
      }

      if (entry.shareAlike) {
        return {
          allowed: false,
          sources,
          blockedBy: source,
          attribution: this.generateAttribution(sources, matrix),
        };
      }

      if (!entry.commercialOk) {
        return {
          allowed: false,
          sources,
          blockedBy: source,
          attribution: this.generateAttribution(sources, matrix),
        };
      }
    }

    return {
      allowed: true,
      sources,
      attribution: this.generateAttribution(sources, matrix),
    };
  }

  generateAttribution(sources: string[], matrix?: LicenseEntry[]): string {
    const entries = matrix ?? [];
    const entryMap = new Map(entries.map((e) => [e.sourceName, e]));

    const lines = sources
      .filter((s) => {
        const entry = entryMap.get(s);
        return entry?.requiresAttribution !== false;
      })
      .map((s) => {
        const entry = entryMap.get(s);
        if (entry) {
          return `- ${entry.notes || entry.sourceName} (${entry.licenseType})`;
        }
        return `- ${s}`;
      });

    if (lines.length === 0) return '';
    return `This product uses data from the following sources:\n\n${lines.join('\n')}`;
  }

  generateLicenseMd(attribution: string): string {
    return `# License\n\n${attribution}\n\nPlease refer to the original data sources for full license terms.\n`;
  }
}
