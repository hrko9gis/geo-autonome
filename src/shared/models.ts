export const HAIKU_MODEL = 'claude-haiku-4-5' as const;
export const SONNET_MODEL = 'claude-sonnet-4-6' as const;

export type AutonomousAgentModel = typeof HAIKU_MODEL | typeof SONNET_MODEL;

const ALLOWED_AUTONOMOUS_MODELS: readonly string[] = [HAIKU_MODEL, SONNET_MODEL];

export function assertAutonomousAgentModel(model: string): asserts model is AutonomousAgentModel {
  if (!ALLOWED_AUTONOMOUS_MODELS.includes(model)) {
    throw new Error(
      `Model "${model}" is not allowed for autonomous agents. ` +
        `Allowed: ${ALLOWED_AUTONOMOUS_MODELS.join(', ')}. ` +
        `Opus and other high-cost models must only be used via Claude Code Pro.`,
    );
  }
}
