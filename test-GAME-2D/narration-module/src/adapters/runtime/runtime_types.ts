export type RuntimeAction = {
  action: string;
  params?: Record<string, unknown>;
};

export type RuntimeContext = {
  turnId: string;
};

export class RuntimeExecutionError extends Error {
  public readonly code: string;
  public readonly actionName: string;

  constructor(code: string, actionName: string, message: string) {
    super(message);
    this.name = "RuntimeExecutionError";
    this.code = code;
    this.actionName = actionName;
  }
}

export type RuntimeCommandHandler = (
  state: Record<string, unknown>,
  params: Record<string, unknown>,
  context: RuntimeContext,
) => void;

