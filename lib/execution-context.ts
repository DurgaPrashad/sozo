import { AsyncLocalStorage } from "node:async_hooks";
import { after } from "next/server";
const context = new AsyncLocalStorage<ExecutionContext>();
export const runWithExecutionContext = <T>(
  ctx: ExecutionContext,
  callback: () => T,
): T => context.run(ctx, callback);
export function background(task: Promise<unknown>) {
  const ctx = context.getStore();
  // The Cloudflare worker entry provides ctx; Next.js hosts such as Vercel
  // keep the function alive for the task through after().
  if (ctx) ctx.waitUntil(task);
  else after(() => task);
}
