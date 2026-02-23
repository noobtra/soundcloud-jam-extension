import type { ConnectionState } from "@/lib/messaging/types";

interface Props {
  state: ConnectionState;
}

const config: Record<ConnectionState, { label: string; dot: string }> = {
  disconnected: { label: "Offline", dot: "bg-red-500" },
  connecting: { label: "Connecting", dot: "bg-yellow-500 animate-pulse" },
  connected: { label: "Live", dot: "bg-emerald-500 animate-pulse-glow" },
};

export default function ConnectionStatus({ state }: Props) {
  const { label, dot } = config[state];
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-2.5 py-1">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
        {label}
      </span>
    </div>
  );
}
