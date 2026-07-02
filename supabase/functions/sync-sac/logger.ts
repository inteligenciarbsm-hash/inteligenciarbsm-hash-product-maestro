export type LogLevel = "INFO" | "WARN" | "ERROR";

export function log(
  level: LogLevel,
  msg: string,
  ctx?: Record<string, unknown>
): void {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), level, msg, ...ctx })
  );
}
