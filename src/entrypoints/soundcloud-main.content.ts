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

    // Listen for commands from the bridge (ISOLATED world)
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.source === "SOUNDCLOUD_JAM") {
        const payload = event.data.payload;
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
