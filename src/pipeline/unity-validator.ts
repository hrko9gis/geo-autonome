import type { IChildProcessExecutor } from './executor.js';

export interface IUnityValidator {
  validate(fbxPath: string): Promise<boolean>;
}

export class ChildProcessUnityValidator implements IUnityValidator {
  constructor(
    private readonly executor: IChildProcessExecutor,
    private readonly unityPath: string = 'unity',
  ) {}

  async validate(fbxPath: string): Promise<boolean> {
    const result = await this.executor.exec(this.unityPath, [
      '-batchmode',
      '-nographics',
      '-quit',
      '-importFile',
      fbxPath,
      '-logFile',
      '-',
    ]);

    return result.exitCode === 0;
  }
}
