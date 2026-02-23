import type { ConnectionState } from "@/lib/messaging/types";

export interface ConnectionStatusInfo {
  label: string;
  color: string;
}

const labels: Record<ConnectionState, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  connected: "Connected",
};

const colors: Record<ConnectionState, string> = {
  disconnected: "bg-red-500",
  connecting: "bg-yellow-500",
  connected: "bg-green-500",
};

export function getConnectionStatusInfo(
  state: ConnectionState,
): ConnectionStatusInfo {
  return { label: labels[state], color: colors[state] };
}
