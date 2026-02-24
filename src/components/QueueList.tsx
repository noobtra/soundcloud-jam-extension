import type { QueuedTrack } from "@/lib/protocol/types";

interface Props {
  queue: QueuedTrack[];
  isHost: boolean;
  onRemove: (queueId: string) => void;
  onPlay: (trackUrl: string) => void;
}

export default function QueueList({ queue, isHost, onRemove, onPlay }: Props) {
  if (queue.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-neutral-600">
        Queue is empty
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {queue.map((item) => (
        <div
          key={item.queueId}
          className="group flex items-center gap-2.5 rounded-lg bg-neutral-900/60 px-2.5 py-2 transition-colors duration-150 hover:bg-neutral-800/60"
        >
          {/* Artwork */}
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-neutral-800">
            {item.track.artworkUrl ? (
              <img
                src={item.track.artworkUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-600">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-white">
              {item.track.title}
            </p>
            <p className="truncate text-[10px] text-neutral-500">
              {item.track.artist} &middot; added by {item.addedByName}
            </p>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {/* Play button */}
            <button
              onClick={() => onPlay(item.track.trackUrl)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
              title="Play now"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path d="M4 3.5v9l8-4.5z" />
              </svg>
            </button>
            {/* Remove button — host only */}
            {isHost && (
              <button
                onClick={() => onRemove(item.queueId)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
                title="Remove from queue"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                  <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
