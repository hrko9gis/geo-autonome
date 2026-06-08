export interface PipelineConfig {
  area: string;
  inputPath: string;
  outputDir: string;
  lodLevels: number[];
  textureAtlasMaxSizePx: number;
  polygonLimit: number;
}

export interface BuildResult {
  success: boolean;
  outputZipPath?: string;
  assets: string[];
  errors: string[];
  warnings: string[];
}

export interface LicenseResult {
  allowed: boolean;
  sources: string[];
  blockedBy?: string;
  attribution: string;
}
