export default defineContentScript({
  matches: ["*://soundcloud.com/*"],
  runAt: "document_start",

  main() {
    // Forward messages from the background/popup to the MAIN world.
    browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      window.postMessage({ source: "SOUNDCLOUD_JAM", payload: msg }, "*");
      sendResponse({ status: "OK" });
    });

    // Forward messages from the MAIN world to the background.
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.source === "SOUNDCLOUD_JAM") {
        browser.runtime.sendMessage(event.data.payload).catch(() => {});
      }
    });

    // ── Detect logged-in user ───────────────────────────────────────
    // SoundCloud stores hydration data in a <script> tag on page load.
    // We wait for the page to be ready, then scrape the current user.
    function scrapeCurrentUser() {
      try {
        const scripts = document.querySelectorAll("script");
        for (const script of scripts) {
          if (script.textContent?.includes("window.__sc_hydration")) {
            const match = script.textContent.match(
              /window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/,
            );
            if (match?.[1]) {
              const data = JSON.parse(match[1]);
              const userEntry = data.find(
                (o: any) => o.hydratable === "meUser",
              );
              if (userEntry?.data) {
                const u = userEntry.data;
                browser.runtime
                  .sendMessage({
                    type: "CURRENT_USER",
                    data: {
                      username: u.permalink ?? u.username,
                      displayName: u.full_name || u.username || u.permalink,
                      avatarUrl: u.avatar_url ?? null,
                      profileUrl: u.permalink_url ?? `https://soundcloud.com/${u.permalink}`,
                    },
                  })
                  .catch(() => {});
                return true;
              }
            }
          }
        }
      } catch {
        // Parsing failed — will retry or user just isn't logged in
      }
      return false;
    }

    // ── Auto-join via ?jam=CODE in URL ──────────────────────────────
    function checkAutoJoin() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("jam");
      if (!code) return;

      // Remove the ?jam= param from the URL so it doesn't re-trigger
      const url = new URL(window.location.href);
      url.searchParams.delete("jam");
      history.replaceState(null, "", url.toString());

      // Wait for current user to be scraped, then auto-join
      const scraped = scrapeCurrentUser();
      if (scraped) {
        sendAutoJoin(code);
      } else {
        // User data might not be in DOM yet — wait and retry
        document.addEventListener("DOMContentLoaded", () => {
          scrapeCurrentUser();
          sendAutoJoin(code);
        });
      }
    }

    function sendAutoJoin(inviteCode: string) {
      // Small delay to let background register the CURRENT_USER first
      setTimeout(() => {
        browser.runtime
          .sendMessage({ type: "AUTO_JOIN", inviteCode })
          .catch(() => {});
      }, 500);
    }

    // Try scraping once the DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        scrapeCurrentUser();
        checkAutoJoin();
      });
    } else {
      scrapeCurrentUser();
      checkAutoJoin();
    }

    // ── Watch for SPA navigation (URL changes without page reload) ──
    // SoundCloud is an SPA, so pasting a ?jam= link into an already-open
    // tab won't trigger a full page load — we need to detect it here.
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        checkAutoJoin();
      }
    });
    observer.observe(document, { subtree: true, childList: true });
  },
});
