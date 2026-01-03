/**
 * Extract video ID from various YouTube URL formats
 * Supports:
 * - https://youtube.com/live/VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 */
export function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Handle youtu.be short URLs
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1);
      return videoId || null;
    }

    // Handle youtube.com URLs
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com' || urlObj.hostname === 'm.youtube.com') {
      // Handle /watch?v=VIDEO_ID
      const vParam = urlObj.searchParams.get('v');
      if (vParam) {
        return vParam;
      }

      // Handle /live/VIDEO_ID
      const liveMatch = urlObj.pathname.match(/^\/live\/([a-zA-Z0-9_-]+)/);
      if (liveMatch) {
        return liveMatch[1];
      }

      // Handle /embed/VIDEO_ID
      const embedMatch = urlObj.pathname.match(/^\/embed\/([a-zA-Z0-9_-]+)/);
      if (embedMatch) {
        return embedMatch[1];
      }

      // Handle /v/VIDEO_ID
      const vMatch = urlObj.pathname.match(/^\/v\/([a-zA-Z0-9_-]+)/);
      if (vMatch) {
        return vMatch[1];
      }
    }

    return null;
  } catch (error) {
    // Invalid URL
    return null;
  }
}
