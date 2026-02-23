import type { JamSession, TrackInfo } from "@/lib/protocol/types";
import NowPlaying from "./NowPlaying";
import UserList from "./UserList";
import JamControls from "./JamControls";

interface Props {
  session: JamSession;
  userId: string;
  onLeave: () => void;
}

export default function JamLobby({ session, userId, onLeave }: Props) {
  const me = session.users.find((u) => u.id === userId);
  const isHost = session.hostId === userId;
  const myTrack: TrackInfo | null = me?.currentTrack ?? null;

  return (
    <div className="animate-fade-in space-y-4">
      {/* Now playing */}
      {myTrack && <NowPlaying track={myTrack} />}

      {/* Users */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            In the Jam
          </h2>
          <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-neutral-400">
            {session.users.length}
          </span>
        </div>
        <UserList users={session.users} currentUserId={userId} />
      </div>

      {/* Controls */}
      <JamControls
        isHost={isHost}
        inviteCode={session.inviteCode}
        onLeave={onLeave}
      />
    </div>
  );
}
