import { AsyncLocalStorage } from "node:async_hooks";
const context = new AsyncLocalStorage<ExecutionContext>();
export const runWithExecutionContext = <T>(
  ctx: ExecutionContext,
  callback: () => T,
): T => context.run(ctx, callback);
export function background(task: Promise<unknown>) {
  const ctx = context.getStore();
  if (!ctx) throw new Error("Background execution context is unavailable.");
  ctx.waitUntil(task);
}
