import path from 'node:path';
import type { IChildProcessExecutor } from './executor.js';
import type { PipelineConfig } from './types.js';

export interface IBlenderConverter {
  convert(inputPath: string, outputDir: string, config: PipelineConfig): Promise<string[]>;
}

export class BlenderConverterError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'BlenderConverterError';
  }
}

const SUPPORTED_FORMATS = ['fbx', 'gltf', 'usd'] as const;
type OutputFormat = typeof SUPPORTED_FORMATS[number];

export class ChildProcessBlenderConverter implements IBlenderConverter {
  constructor(
    private readonly executor: IChildProcessExecutor,
    private readonly blenderPath: string = 'blender',
  ) {}

  async convert(inputPath: string, outputDir: string, config: PipelineConfig): Promise<string[]> {
    const outputs: string[] = [];

    for (const format of SUPPORTED_FORMATS) {
      for (const lod of config.lodLevels) {
        const outputFile = this.getOutputPath(outputDir, config.area, format, lod);
        const result = await this.executor.exec(this.blenderPath, [
          '--background',
          '--python-expr',
          this.buildScript(inputPath, outputFile, format, lod, config),
        ]);

        if (result.exitCode !== 0) {
          throw new BlenderConverterError(
            `Blender conversion failed for ${format} LOD${lod}: ${result.stderr}`,
          );
        }

        outputs.push(outputFile);
      }
    }

    return outputs;
  }

  private getOutputPath(
    outputDir: string,
    area: string,
    format: OutputFormat,
    lod: number,
  ): string {
    return path.join(outputDir, format, `${area}_lod${lod}.${format}`);
  }

  private buildScript(
    inputPath: string,
    outputPath: string,
    format: OutputFormat,
    lod: number,
    _config: PipelineConfig,
  ): string {
    const safeInput = JSON.stringify(inputPath.replace(/\\/g, '/'));
    const safeOutput = JSON.stringify(outputPath.replace(/\\/g, '/'));
    return [
      `import bpy`,
      `bpy.ops.wm.open_mainfile(filepath=${safeInput})`,
      `for obj in bpy.data.objects:`,
      `    if obj.type == 'MESH':`,
      `        mod = obj.modifiers.new(name='LOD${lod}', type='DECIMATE')`,
      `        mod.ratio = ${lod === 1 ? 1.0 : 0.5 / lod}`,
      `        mod.use_collapse_triangulate = True`,
      `bpy.ops.export_scene.${this.getExportOp(format)}(filepath=${safeOutput})`,
    ].join('; ');
  }

  private getExportOp(format: OutputFormat): string {
    switch (format) {
      case 'fbx': return 'fbx';
      case 'gltf': return 'gltf2';
      case 'usd': return 'usd';
    }
  }
}
