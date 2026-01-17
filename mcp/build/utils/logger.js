/**
 * Logger utility for MCP server
 * CRITICAL: All output goes to stderr to avoid corrupting stdio transport
 */
export const logger = {
    info: (msg, ...args) => {
        console.error(`[INFO] ${msg}`, ...args);
    },
    error: (msg, ...args) => {
        console.error(`[ERROR] ${msg}`, ...args);
    },
    debug: (msg, ...args) => {
        if (process.env.DEBUG) {
            console.error(`[DEBUG] ${msg}`, ...args);
        }
    },
};
