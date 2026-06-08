import path from 'node:path';
import type { IChildProcessExecutor } from './executor.js';

export interface ICityGmlParser {
  parse(inputPath: string, outputDir: string): Promise<string>;
}

export class CityGmlParserError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CityGmlParserError';
  }
}

export class ChildProcessCityGmlParser implements ICityGmlParser {
  constructor(
    private readonly executor: IChildProcessExecutor,
    private readonly toolPath: string = 'citygml-tools',
  ) {}

  async parse(inputPath: string, outputDir: string): Promise<string> {
    const result = await this.executor.exec(this.toolPath, [
      'to-cityjson',
      '--input',
      inputPath,
      '--output',
      outputDir,
    ]);

    if (result.exitCode !== 0) {
      throw new CityGmlParserError(
        `citygml-tools failed with exit code ${result.exitCode}: ${result.stderr}`,
      );
    }

    const baseName = path.basename(inputPath, path.extname(inputPath));
    return path.join(outputDir, `${baseName}.city.json`);
  }
}
