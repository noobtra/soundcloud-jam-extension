import type { ClientMessage, ServerMessage } from "../protocol/types";
import { ping, serialize } from "../protocol/messages";
import {
  DEFAULT_WS_URL,
  PING_INTERVAL_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
} from "../protocol/constants";

export type WsConnectionState = "disconnected" | "connecting" | "connected";

export type MessageHandler = (msg: ServerMessage) => void;
export type StateChangeHandler = (state: WsConnectionState) => void;

export class JamWebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private state: WsConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pendingQueue: ClientMessage[] = [];

  private onMessage: MessageHandler | null = null;
  private onStateChange: StateChangeHandler | null = null;

  constructor(url: string = DEFAULT_WS_URL) {
    this.url = url;
  }

  /** Register a handler for incoming server messages. */
  setMessageHandler(handler: MessageHandler) {
    this.onMessage = handler;
  }

  /** Register a handler for connection state changes. */
  setStateChangeHandler(handler: StateChangeHandler) {
    this.onStateChange = handler;
  }

  getState(): WsConnectionState {
    return this.state;
  }

  /** Open (or re-open) the WebSocket connection. */
  connect() {
    if (this.state === "connecting" || this.state === "connected") return;
    this.cleanup();
    this.setState("connecting");

    try {
      this.socket = new WebSocket(this.url);
    } catch {
      this.setState("disconnected");
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState("connected");
      this.startPing();
      this.flushQueue();
    };

    this.socket.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data as string);
        if (msg.type === "PONG") return; // swallow pongs
        this.onMessage?.(msg);
      } catch {
        console.warn("[JamWS] Failed to parse message", event.data);
      }
    };

    this.socket.onclose = () => {
      this.setState("disconnected");
      this.stopPing();
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      // onclose will fire after onerror, so reconnect is handled there.
      this.socket?.close();
    };
  }

  /** Send a typed client message. Queues if still connecting. */
  send(msg: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(serialize(msg));
    } else if (this.state === "connecting") {
      this.pendingQueue.push(msg);
    }
  }

  /** Gracefully close the connection (no reconnect). */
  disconnect() {
    this.cancelReconnect();
    this.stopPing();
    this.pendingQueue = [];
    this.socket?.close();
    this.socket = null;
    this.setState("disconnected");
  }

  // ── Internals ────────────────────────────────────────────────────

  private flushQueue() {
    while (this.pendingQueue.length > 0) {
      const msg = this.pendingQueue.shift()!;
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(serialize(msg));
      }
    }
  }

  private setState(next: WsConnectionState) {
    if (this.state === next) return;
    this.state = next;
    this.onStateChange?.(next);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => this.send(ping()), PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    this.cancelReconnect();
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private cleanup() {
    this.cancelReconnect();
    this.stopPing();
    this.pendingQueue = [];
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      if (
        this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING
      ) {
        this.socket.close();
      }
      this.socket = null;
    }
  }
}
