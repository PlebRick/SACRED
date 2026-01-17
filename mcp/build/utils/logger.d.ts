/**
 * Logger utility for MCP server
 * CRITICAL: All output goes to stderr to avoid corrupting stdio transport
 */
export declare const logger: {
    info: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
    debug: (msg: string, ...args: unknown[]) => void;
};
