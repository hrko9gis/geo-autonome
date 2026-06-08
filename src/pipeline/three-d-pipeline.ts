import path from 'node:path';
import type { IBlenderConverter } from './blender-converter.js';
import type { ICityGmlParser } from './citygml-parser.js';
import { LicenseValidator } from './license-validator.js';
import { Packager } from './packager.js';
import type { BuildResult, PipelineConfig } from './types.js';
import type { IUnityValidator } from './unity-validator.js';

export class ThreeDPipeline {
  constructor(
    private readonly licenseValidator: LicenseValidator,
    private readonly parser: ICityGmlParser,
    private readonly converter: IBlenderConverter,
    private readonly validator: IUnityValidator,
    private readonly packager: Packager,
  ) {}

  async build(config: PipelineConfig, sources: string[]): Promise<BuildResult> {
    const licenseResult = await this.licenseValidator.validate(sources);
    if (!licenseResult.allowed) {
      return {
        success: false,
        assets: [],
        errors: [
          `License violation: source "${licenseResult.blockedBy}" is not allowed for commercial use`,
        ],
        warnings: [],
      };
    }

    let parsedPath: string;
    try {
      parsedPath = await this.parser.parse(config.inputPath, config.outputDir);
    } catch (err) {
      return {
        success: false,
        assets: [],
        errors: [`CityGML parse failed: ${err instanceof Error ? err.message : String(err)}`],
        warnings: [],
      };
    }

    let assets: string[];
    try {
      assets = await this.converter.convert(parsedPath, config.outputDir, config);
    } catch (err) {
      return {
        success: false,
        assets: [],
        errors: [`Blender conversion failed: ${err instanceof Error ? err.message : String(err)}`],
        warnings: [],
      };
    }

    const fbxPaths = assets.filter((a) => a.endsWith('.fbx'));
    const unityWarnings: string[] = [];
    for (const fbxPath of fbxPaths) {
      const valid = await this.validator.validate(fbxPath);
      if (!valid) {
        unityWarnings.push(`Unity validation failed for ${path.basename(fbxPath)}`);
      }
    }

    const readme = this.packager.generateReadme(
      config.area,
      sources,
      licenseResult.attribution,
    );
    const licenseMd = this.packager.generateLicenseMd(licenseResult.attribution);
    const outputZip = path.join(config.outputDir, `${config.area}.zip`);

    let outputZipPath: string;
    try {
      outputZipPath = await this.packager.pack(assets, outputZip, readme, licenseMd);
    } catch (err) {
      return {
        success: false,
        assets,
        errors: [`Packaging failed: ${err instanceof Error ? err.message : String(err)}`],
        warnings: unityWarnings,
      };
    }

    return {
      success: true,
      outputZipPath,
      assets,
      errors: [],
      warnings: unityWarnings,
    };
  }
}
