/**
 * Logger utility for MCP server
 * CRITICAL: All output goes to stderr to avoid corrupting stdio transport
 */
export const logger = {
  info: (msg: string, ...args: unknown[]) => {
    console.error(`[INFO] ${msg}`, ...args);
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${msg}`, ...args);
  },
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.error(`[DEBUG] ${msg}`, ...args);
    }
  },
};
