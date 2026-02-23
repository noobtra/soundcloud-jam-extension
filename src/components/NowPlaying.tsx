import { useEffect, useState } from "react";
import type { TrackInfo } from "@/lib/protocol/types";

interface Props {
  track: TrackInfo;
}

export default function NowPlaying({ track }: Props) {
  const artworkSrc = track.artworkUrl
    ? track.artworkUrl.replace("-large", "-t300x300")
    : null;

  const duration = track.endTime - track.startTime;
  const [progress, setProgress] = useState(0);

  // Live-update progress bar
  useEffect(() => {
    function update() {
      const elapsed = Date.now() - track.startTime;
      setProgress(duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [track.startTime, track.endTime, duration]);

  return (
    <div className="animate-fade-in overflow-hidden rounded-xl bg-neutral-900/80">
      <div className="flex items-center gap-3 p-3">
        {artworkSrc ? (
          <img
            src={artworkSrc}
            alt="Artwork"
            className="h-12 w-12 rounded-lg object-cover shadow-md"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-700 text-lg text-neutral-500 shadow-md">
            ♪
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {track.title}
          </p>
          <p className="truncate text-xs text-neutral-400">{track.artist}</p>
        </div>
      </div>

      {/* Progress bar — full width at bottom of card */}
      <div className="h-0.5 w-full bg-neutral-800">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
