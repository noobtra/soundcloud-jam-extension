import { useJamState } from "@/hooks/useJamState";
import ConnectionStatus from "@/components/ConnectionStatus";
import JamJoinCreate from "@/components/JamJoinCreate";
import JamLobby from "@/components/JamLobby";

export default function App() {
  const { session, userId, currentUser, connectionState, loading } =
    useJamState();

  function handleCreateJam(displayName: string) {
    browser.runtime.sendMessage({ type: "CREATE_JAM", displayName });
  }

  function handleJoinJam(inviteCode: string, displayName: string) {
    browser.runtime.sendMessage({ type: "JOIN_JAM", inviteCode, displayName });
  }

  function handleLeave() {
    browser.runtime.sendMessage({ type: "LEAVE_JAM" });
  }

  return (
    <div className="w-80 bg-neutral-950 text-white p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {/* SoundCloud icon */}
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-orange-500" fill="currentColor">
            <path d="M11.56 8.87V17h8.76c1.85 0 3.35-1.67 3.35-3.73 0-2.07-1.5-3.74-3.35-3.74-.37 0-.73.07-1.06.2a5.05 5.05 0 0 0-4.92-4.43c-.97 0-1.88.3-2.65.8v2.77h-.13ZM8.15 9.67V17h1.87V8.4c-.64.33-1.3.75-1.87 1.27ZM5.7 12.27V17h1.87v-5.87a12.21 12.21 0 0 0-1.87.77v.37ZM3.26 13.76V17h1.88v-4.08c-.65.2-1.28.5-1.88.84ZM.82 15V17H2.7v-2.6c-.66.08-1.3.27-1.88.6Z" />
          </svg>
          <h1 className="text-base font-bold tracking-tight">SoundCloud Jam</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => browser.runtime.sendMessage({ type: "FOCUS_SOUNDCLOUD" })}
            className="group relative flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 transition-all duration-200 hover:bg-neutral-800 hover:text-orange-400 active:scale-90"
            title="Open SoundCloud"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M11 3h6v6M17 3L8 12M8 3H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <ConnectionStatus state={connectionState} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 animate-fade-in">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-700 border-t-orange-500" />
          </div>
        ) : session && userId ? (
          <JamLobby
            session={session}
            userId={userId}
            onLeave={handleLeave}
          />
        ) : (
          <JamJoinCreate
            currentUser={currentUser}
            onCreateJam={handleCreateJam}
            onJoinJam={handleJoinJam}
          />
        )}
      </div>
    </div>
  );
}
