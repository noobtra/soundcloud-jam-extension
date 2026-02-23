import { useState } from "react";
import type { CurrentUser } from "@/lib/protocol/types";

interface Props {
  currentUser: CurrentUser | null;
  onCreateJam: (displayName: string) => void;
  onJoinJam: (inviteCode: string, displayName: string) => void;
}

export default function JamJoinCreate({
  currentUser,
  onCreateJam,
  onJoinJam,
}: Props) {
  const [inviteCode, setInviteCode] = useState("");

  const loggedIn = currentUser !== null;
  const canJoin = loggedIn && inviteCode.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Current user profile */}
      {currentUser ? (
        <a
          href={currentUser.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-xl bg-neutral-900/80 px-3.5 py-3 transition-all duration-200 hover:bg-neutral-800/80"
        >
          <div className="relative shrink-0">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.displayName}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-neutral-800 transition-all duration-200 group-hover:ring-orange-500/50"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-bold text-white ring-2 ring-neutral-800 transition-all duration-200 group-hover:ring-orange-500/50">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-900 bg-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {currentUser.displayName}
            </p>
            <p className="truncate text-xs text-neutral-500">
              @{currentUser.username}
            </p>
          </div>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-600 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-neutral-400">
            <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      ) : (
        <div className="rounded-xl bg-neutral-900/80 px-4 py-5 text-center">
          <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-neutral-500">
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
            </svg>
          </div>
          <p className="text-sm text-neutral-400">
            Log in to SoundCloud to start or join a jam.
          </p>
        </div>
      )}

      {/* Create jam */}
      <button
        disabled={!loggedIn}
        onClick={() => onCreateJam(currentUser!.displayName)}
        className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all duration-200 hover:shadow-orange-500/30 hover:brightness-110 active:scale-[0.98] disabled:opacity-30 disabled:shadow-none disabled:hover:brightness-100"
      >
        Create Jam
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-neutral-800" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-600">or join</span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-neutral-800" />
      </div>

      {/* Join jam */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          placeholder="Invite code"
          disabled={!loggedIn}
          className="min-w-0 flex-1 rounded-xl border border-neutral-800/80 bg-neutral-900/80 px-3.5 py-2.5 text-sm font-mono tracking-wider text-white placeholder-neutral-600 outline-none transition-all duration-200 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-30"
        />
        <button
          disabled={!canJoin}
          onClick={() => onJoinJam(inviteCode.trim(), currentUser!.displayName)}
          className="rounded-xl bg-neutral-800 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-neutral-700 active:scale-[0.97] disabled:opacity-30 disabled:hover:bg-neutral-800"
        >
          Join
        </button>
      </div>
    </div>
  );
}
