type YouTubeLoader = {
  Player?: new (container: string | HTMLElement, options: any) => any;
  PlayerState?: Record<string, number>;
};

declare global {
  interface Window {
    YT?: YouTubeLoader;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loaderPromise: Promise<YouTubeLoader> | null = null;

export const loadYouTubeIframeAPI = (): Promise<YouTubeLoader> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API is not available in SSR."));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (loaderPromise) {
    return loaderPromise;
  }
  loaderPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-youtube-iframe-api="true"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      window.onYouTubeIframeAPIReady = () => resolve(window.YT ?? {});
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.defer = true;
    script.dataset.youtubeIframeApi = "true";
    script.onerror = () => reject(new Error("Failed to load YouTube API."));
    document.body.appendChild(script);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT ?? {});
  });
  return loaderPromise;
};

export const parseYouTubeVideoId = (value: string): string | null => {
  const input = (value ?? "").trim();
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      const embedIndex = parts.indexOf("embed");
      if (embedIndex >= 0 && parts[embedIndex + 1]) {
        const id = parts[embedIndex + 1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
      const shortsIndex = parts.indexOf("shorts");
      if (shortsIndex >= 0 && parts[shortsIndex + 1]) {
        const id = parts[shortsIndex + 1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
      const liveIndex = parts.indexOf("live");
      if (liveIndex >= 0 && parts[liveIndex + 1]) {
        const id = parts[liveIndex + 1];
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }
  return null;
};

