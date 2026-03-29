/**
 * Script runtime abstraction.
 * Wraps the sandboxed execution environment (QuickJS-in-WASM or V8 isolates).
 * Student TypeScript is compiled to JS and executed in this runtime.
 */
export interface ScriptRuntimeConfig {
  /** Maximum execution time per frame in milliseconds */
  maxFrameMs: number;
  /** Maximum memory in bytes */
  maxMemoryBytes: number;
  /** Maximum API calls per second */
  maxApiCallsPerSec: number;
}

export abstract class ScriptRuntime {
  abstract init(config: ScriptRuntimeConfig): Promise<void>;

  /** Load and execute a script in the sandbox */
  abstract execute(code: string): Promise<void>;

  /** Call a function defined in the sandbox */
  abstract call(functionName: string, ...args: unknown[]): Promise<unknown>;

  /** Register a host function that sandbox code can call */
  abstract registerHostFunction(
    name: string,
    fn: (...args: unknown[]) => unknown,
  ): void;

  abstract dispose(): void;
}
