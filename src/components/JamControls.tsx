import { useState } from "react";

interface Props {
  isHost: boolean;
  inviteCode: string;
  onLeave: () => void;
}

export default function JamControls({ isHost, inviteCode, onLeave }: Props) {
  const [copied, setCopied] = useState(false);

  function copyInviteLink() {
    const link = `https://soundcloud.com?jam=${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={copyInviteLink}
        className="flex flex-1 items-center gap-2 rounded-xl bg-neutral-900/80 px-3.5 py-2.5 text-xs font-medium text-neutral-300 transition-all duration-200 hover:bg-neutral-800 active:scale-[0.98]"
        title="Copy invite link"
      >
        {/* Link icon */}
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5 shrink-0 text-neutral-500">
          <path d="M6.5 8.5a3 3 0 004.243 0l2-2a3 3 0 00-4.243-4.243l-1 1M9.5 7.5a3 3 0 00-4.243 0l-2 2a3 3 0 004.243 4.243l1-1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-mono tracking-wider">{inviteCode}</span>
        <span className="ml-auto text-[10px] text-neutral-500 transition-colors duration-200">
          {copied ? "Copied!" : "Copy link"}
        </span>
      </button>
      <button
        onClick={onLeave}
        className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-xs font-semibold text-red-400 transition-all duration-200 hover:bg-red-500/20 active:scale-[0.97]"
      >
        {isHost ? "End Jam" : "Leave"}
      </button>
    </div>
  );
}
