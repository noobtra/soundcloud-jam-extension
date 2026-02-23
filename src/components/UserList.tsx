import type { JamUser } from "@/lib/protocol/types";

interface Props {
  users: JamUser[];
  currentUserId: string | null;
}

export default function UserList({ users, currentUserId }: Props) {
  return (
    <ul className="stagger-list space-y-1.5">
      {users.map((user) => {
        const inner = (
          <>
            <div className="relative shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-neutral-800 transition-all duration-200 group-hover:ring-orange-500/50"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-neutral-700 to-neutral-600 text-xs font-bold text-neutral-300 ring-1 ring-neutral-800 transition-all duration-200 group-hover:ring-orange-500/50">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              {user.isHost && (
                <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 text-[7px] font-bold text-white shadow-sm">
                  ★
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">
                <span className="font-medium">{user.displayName}</span>
                {user.id === currentUserId && (
                  <span className="ml-1.5 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">you</span>
                )}
              </p>
              {user.username && (
                <p className="truncate text-xs text-neutral-500">@{user.username}</p>
              )}
              {user.currentTrack && (
                <p className="truncate text-xs text-neutral-500">
                  <span className="text-orange-500/70">♪</span>{" "}
                  {user.currentTrack.artist} — {user.currentTrack.title}
                </p>
              )}
            </div>
          </>
        );

        return (
          <li key={user.id}>
            {user.profileUrl ? (
              <a
                href={user.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-xl bg-neutral-900/60 px-3 py-2.5 transition-colors duration-200 hover:bg-neutral-900/90"
              >
                {inner}
              </a>
            ) : (
              <div className="group flex items-center gap-2.5 rounded-xl bg-neutral-900/60 px-3 py-2.5">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
