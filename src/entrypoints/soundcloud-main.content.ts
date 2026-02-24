export default defineContentScript({
  matches: ["*://soundcloud.com/*"],
  runAt: "document_start",
  world: "MAIN",

  main() {
    // Prevent multiple injections
    if ((window as any).__SOUNDCLOUD_JAM_LOADED__) return;
    (window as any).__SOUNDCLOUD_JAM_LOADED__ = true;

    // Will later store the model constructor for creating track models
    (window as any).SoundCloudModelConstructor = null;

    // References to key functions from SoundCloud's internal modules
    let originalPlayCurrent: Function | null = null;
    let getQueueFunction: (() => any) | null = null;
    let addExplicitQueueItemFunction: ((item: any) => any) | null = null;
    let getCurrentQueueItemFunction: (() => any) | null = null;
    let playAudibleFunction: ((model: any) => any) | null = null;
    let prepareModelFunction: Function | null = null;

    /**
     * Posts info about the currently playing track with Unix timestamps.
     */
    function sendPlayingTrackInfo(sound: any) {
      let currentTime = 0;
      try {
        currentTime = sound.player.getPosition();
      } catch {
        // Can happen during track transitions — ignore.
      }

      const currentUnixTimestamp = Date.now();
      const startUnixTimestamp = currentUnixTimestamp - currentTime;
      const timeLeft = sound.attributes.duration - currentTime;
      const endUnixTimestamp = currentUnixTimestamp + timeLeft;

      window.postMessage(
        {
          source: "SOUNDCLOUD_JAM",
          payload: {
            type: "WS_SEND_TRACK",
            data: {
              artist: sound.computed__displayArtist,
              title: sound.attributes.title,
              start_time: startUnixTimestamp,
              end_time: endUnixTimestamp,
              artwork_url: sound.attributes.artwork_url,
              track_url: sound.attributes.permalink_url,
            },
          },
        },
        "*",
      );
    }

    /**
     * Scans a module for functions we need to hook.
     */
    function searchModuleForFunctions(moduleExports: any, _moduleId: string) {
      if (!moduleExports) return;

      // Hook playCurrent to detect track changes
      if (moduleExports.playCurrent && !originalPlayCurrent) {
        originalPlayCurrent = moduleExports.playCurrent;
        moduleExports.playCurrent = function (this: any, e: any) {
          const currentSound = this.getCurrentSound();
          if (currentSound?.attributes) {
            sendPlayingTrackInfo(currentSound);
          }
          return originalPlayCurrent!.apply(this, arguments);
        };
      }

      // Save references to queue functions
      if (moduleExports.getQueue && !getQueueFunction) {
        getQueueFunction = moduleExports.getQueue.bind(moduleExports);
      }
      if (moduleExports.addExplicitQueueItem && !addExplicitQueueItemFunction) {
        addExplicitQueueItemFunction =
          moduleExports.addExplicitQueueItem.bind(moduleExports);
      }
      if (moduleExports.getCurrentQueueItem && !getCurrentQueueItemFunction) {
        getCurrentQueueItemFunction =
          moduleExports.getCurrentQueueItem.bind(moduleExports);
      }

      // Hook playAudible
      if (
        moduleExports.properties?.playAudible &&
        moduleExports.properties?.after
      ) {
        const originalAfterSetup = moduleExports.properties.after.setup;
        moduleExports.properties.after.setup = function (this: any) {
          if (playAudibleFunction === null) {
            playAudibleFunction = this.playAudible.bind(this);
          }
          return originalAfterSetup.call(this);
        };
      }

      // Hook _prepareModel to capture the model constructor
      if (moduleExports.prototype?._prepareModel && !prepareModelFunction) {
        const originalPrepareModel = moduleExports.prototype._prepareModel;
        prepareModelFunction = function (this: any) {
          return originalPrepareModel.apply(this, arguments);
        }.bind(moduleExports.prototype);

        moduleExports.prototype._prepareModel = function (
          this: any,
          e: any,
          options: any,
        ) {
          if (typeof this.model !== "function") return null;
          const result = originalPrepareModel.call(this, e, options);
          if (
            result?.requestPreloading &&
            (window as any).SoundCloudModelConstructor === null
          ) {
            (window as any).SoundCloudModelConstructor = this.model;
          }
          return result;
        };
      }
    }

    /**
     * Hooks into webpack's module push method to intercept module loading.
     */
    function hookPushMethod(arr: any[]) {
      const originalPush = arr.push || Array.prototype.push;
      arr.push = function (...args: any[]) {
        const chunkArguments = args[0];
        if (chunkArguments?.[1]) {
          const modules = chunkArguments[1];
          Object.keys(modules).forEach((moduleId) => {
            const originalModuleFunction = modules[moduleId];
            modules[moduleId] = function (
              module: any,
              exports: any,
              __webpack_require__: any,
            ) {
              originalModuleFunction(module, exports, __webpack_require__);
              searchModuleForFunctions(module.exports, moduleId);
            };
          });
        }
        return originalPush.apply(this, args);
      };
      return arr;
    }

    // Override webpackJsonp to hook into module loading
    let webpackJsonp = hookPushMethod((window as any).webpackJsonp || []);
    Object.defineProperty(window, "webpackJsonp", {
      get: () => webpackJsonp,
      set: (value) => (webpackJsonp = hookPushMethod(value)),
      configurable: false,
    });

    // Expose functions for external use (called from message handler)
    (window as any).callGetQueue = function () {
      if (getQueueFunction) return getQueueFunction();
    };
    (window as any).callAddExplicitQueueItem = function (queueItem: any) {
      if (addExplicitQueueItemFunction)
        return addExplicitQueueItemFunction(queueItem);
    };
    (window as any).callGetCurrentQueueItem = function () {
      if (getCurrentQueueItemFunction) return getCurrentQueueItemFunction();
    };
    (window as any).callPlayAudible = function (model: any) {
      if (playAudibleFunction) return playAudibleFunction(model);
    };
    (window as any).callPrepareModel = function (modelData: any) {
      if (prepareModelFunction) {
        return new (window as any).SoundCloudModelConstructor(modelData);
      }
    };

    // ── Queue button injection on track cards ──────────────────────
    let jamActive = false;

    // Inject a <style> for the jam queue button so it stands out
    const jamStyle = document.createElement("style");
    jamStyle.textContent = `
      .jam-queue-btn {
        background: linear-gradient(135deg, #f97316, #ea580c) !important;
        color: #fff !important;
        border: none !important;
        border-radius: 4px !important;
        font-weight: 600 !important;
        transition: filter 0.15s, transform 0.1s !important;
      }
      .jam-queue-btn:hover {
        filter: brightness(1.15) !important;
      }
      .jam-queue-btn:active {
        transform: scale(0.95) !important;
      }
      .jam-queue-btn.jam-queue-btn--added {
        background: linear-gradient(135deg, #22c55e, #16a34a) !important;
      }
    `;
    // Append to <head> when available, otherwise <html>
    (document.head || document.documentElement).appendChild(jamStyle);

    /**
     * Extracts track info from the context around a queue button.
     * Supports two layouts:
     *   1) Stream / likes list — ancestor is `.sound.streamContext`
     *   2) Direct song page   — ancestor is `.listenEngagement__footer`
     */
    function extractTrackInfo(btn: HTMLElement) {
      // ── Stream / likes list ────────────────────────────────────
      const soundEl = btn.closest(".sound.streamContext");
      if (soundEl) {
        const trackUrlEl =
          soundEl.querySelector("a.sound__coverArt[href]") ||
          soundEl.querySelector("a.soundTitle__title[href]");
        const trackUrl = trackUrlEl
          ? new URL(
              trackUrlEl.getAttribute("href")!,
              window.location.origin,
            ).href
          : "";

        const artistEl = soundEl.querySelector("span.soundTitle__usernameText");
        const artist = artistEl?.textContent?.trim() ?? "Unknown";

        const titleEl = soundEl.querySelector("a.soundTitle__title span");
        const title = titleEl?.textContent?.trim() ?? "Unknown";

        const artworkEl = soundEl.querySelector("span.sc-artwork");
        let artworkUrl: string | null = null;
        if (artworkEl) {
          const bg = (artworkEl as HTMLElement).style.backgroundImage;
          const m = bg.match(/url\(["']?(.+?)["']?\)/);
          if (m) artworkUrl = m[1];
        }

        return { artist, title, artwork_url: artworkUrl, track_url: trackUrl };
      }

      // ── Direct song page ───────────────────────────────────────
      const listenFooter = btn.closest(".listenEngagement__footer");
      if (listenFooter) {
        // Title + artist live in the hero section above the footer
        const hero = document.querySelector(".l-listen-hero");

        const titleEl = hero?.querySelector("h1.soundTitle__title span");
        const title = titleEl?.textContent?.trim() ?? "Unknown";

        const artistEl =
          hero?.querySelector("h2.soundTitle__username a") ||
          hero?.querySelector(".soundTitle__username a");
        const artist = artistEl?.textContent?.trim() ?? "Unknown";

        const artworkEl = hero?.querySelector(
          ".listenArtworkWrapper span.sc-artwork",
        );
        let artworkUrl: string | null = null;
        if (artworkEl) {
          const bg = (artworkEl as HTMLElement).style.backgroundImage;
          const m = bg.match(/url\(["']?(.+?)["']?\)/);
          if (m) artworkUrl = m[1];
        }

        // On the direct page the URL *is* the track
        const trackUrl = window.location.origin + window.location.pathname;

        return { artist, title, artwork_url: artworkUrl, track_url: trackUrl };
      }

      return null;
    }

    function injectQueueButtons() {
      const groups = document.querySelectorAll(
        "div.sc-button-group:not([data-jam-queue])",
      );
      for (const group of groups) {
        // Only target groups inside .soundActions
        if (!group.closest(".soundActions")) continue;

        group.setAttribute("data-jam-queue", "1");

        const btn = document.createElement("button");
        btn.className =
          "sc-button sc-button-medium sc-button-icon sc-button-responsive jam-queue-btn";
        btn.title = "Add to Jam Queue";
        btn.style.display = jamActive ? "" : "none";
        btn.innerHTML = `<div><svg viewBox="0 0 16 16" width="16" height="16" style="pointer-events:none"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></div>`;

        let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Ignore clicks while feedback is showing (prevents duplicates)
          if (feedbackTimer !== null) return;

          const info = extractTrackInfo(btn);
          if (!info) return;

          window.postMessage(
            {
              source: "SOUNDCLOUD_JAM",
              payload: { type: "CONTENT_QUEUE_ADD", data: info },
            },
            "*",
          );

          // Visual feedback — brief green checkmark
          const origHTML = btn.innerHTML;
          btn.classList.add("jam-queue-btn--added");
          btn.innerHTML = `<div><svg viewBox="0 0 16 16" width="16" height="16" style="pointer-events:none"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div>`;
          feedbackTimer = setTimeout(() => {
            btn.innerHTML = origHTML;
            btn.classList.remove("jam-queue-btn--added");
            feedbackTimer = null;
          }, 1200);
        });

        // Insert before .sc-button-more if it exists, otherwise append
        const moreBtn = group.querySelector(".sc-button-more");
        if (moreBtn) {
          group.insertBefore(btn, moreBtn);
        } else {
          group.appendChild(btn);
        }
      }
    }

    // Observe DOM for new track cards (SPA navigation)
    let rafPending = false;
    const domObserver = new MutationObserver(() => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        injectQueueButtons();
      });
    });
    domObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
    });

    function setJamActive(active: boolean) {
      jamActive = active;
      const btns = document.querySelectorAll(".jam-queue-btn");
      for (const b of btns) {
        (b as HTMLElement).style.display = active ? "" : "none";
      }
    }

    // Listen for commands from the bridge (ISOLATED world)
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.source === "SOUNDCLOUD_JAM") {
        const payload = event.data.payload;

        if (payload.type === "JAM_ACTIVE_STATE") {
          setJamActive(payload.active);
        }

        if (payload.type === "SC_NAVIGATE" && payload.url) {
          // SPA navigation — pushState + popstate keeps playback alive
          try {
            const dest = new URL(payload.url, window.location.origin);
            history.pushState({}, "", dest.pathname + dest.search + dest.hash);
            window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
          } catch {
            // Fallback: full navigation
            window.location.href = payload.url;
          }
        }

        if (payload.type === "WS_PLAY_TRACK" && payload.data?.trackUrl) {
          fetchTrackInfo(payload.data.trackUrl)
            .then((trackData) => {
              if (trackData) {
                const model = (window as any).callPrepareModel(trackData);
                model.requestPreloading();
                model.player.seek(0);
                (window as any).callPlayAudible(model);
              }
            })
            .catch(() => {});
        }
      }
    });

    /**
     * Fetches track info from a SoundCloud track URL by parsing hydration data.
     */
    async function fetchTrackInfo(url: string) {
      const res = await fetch(url);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const scripts = [...doc.querySelectorAll("script")];
      for (const script of scripts) {
        if (script.textContent?.includes("window.__sc_hydration")) {
          const match = script.textContent.match(
            /window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/,
          );
          if (match?.[1]) {
            const data = JSON.parse(match[1]);
            return data.find((o: any) => o.hydratable === "sound")?.data;
          }
        }
      }
      return null;
    }
  },
});
