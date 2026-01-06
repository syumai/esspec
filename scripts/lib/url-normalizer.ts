/**
 * Normalize URLs by removing /edit suffix while preserving trailing slashes
 *
 * This utility removes the `/edit` or `/edit/` suffix from URLs (commonly used
 * in connpass event management URLs) while preserving the original trailing slash.
 *
 * Examples:
 * - https://connpass.com/event/379664/edit/  → https://connpass.com/event/379664/
 * - https://connpass.com/event/379664/edit   → https://connpass.com/event/379664
 * - https://connpass.com/event/379664/       → https://connpass.com/event/379664/ (unchanged)
 * - https://connpass.com/event/379664        → https://connpass.com/event/379664 (unchanged)
 */

/**
 * Normalize URL by removing /edit suffix while preserving trailing slashes
 * @param url - URL string to normalize
 * @returns Normalized URL string
 * @throws Error if URL is malformed
 */
export function normalizeUrl(url: string): string {
  const urlObj = new URL(url);
  let pathname = urlObj.pathname;

  // Remove /edit/ (with trailing slash) and replace with just /
  if (pathname.endsWith('/edit/')) {
    pathname = pathname.slice(0, -5); // Remove 'edit' but keep the trailing /
  }
  // Remove /edit (without trailing slash)
  else if (pathname.endsWith('/edit')) {
    pathname = pathname.slice(0, -5); // Remove '/edit'
  }

  // Reconstruct URL with modified pathname
  urlObj.pathname = pathname;
  return urlObj.toString();
}
