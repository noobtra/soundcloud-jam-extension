/** Protocol version — bump when breaking changes occur. */
export const PROTOCOL_VERSION = 1;

/** Default WebSocket server URL. */
export const DEFAULT_WS_URL = "ws://127.0.0.1:9005/ws";

/** Ping interval in ms (keep WS alive). */
export const PING_INTERVAL_MS = 20_000;

/** Initial reconnect delay in ms. */
export const RECONNECT_BASE_MS = 1_000;

/** Maximum reconnect delay in ms. */
export const RECONNECT_MAX_MS = 30_000;

/** Chrome alarm name for keeping the service worker alive. */
export const KEEP_ALIVE_ALARM = "jam-keep-alive";

/** Chrome alarm period in minutes (minimum is 0.5 for MV3). */
export const KEEP_ALIVE_PERIOD_MIN = 0.4;
