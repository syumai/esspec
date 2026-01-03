/**
 * SRT Parser Utility
 * Parses SRT (SubRip Subtitle) files and extracts only dialogue text
 * Removes sequence numbers, timestamps, and formatting metadata
 */

export class SRTParser {
  /**
   * Parse SRT file content and extract only dialogue text
   * Removes sequence numbers, timestamps, and formatting
   * Preserves original line breaks in dialogue text
   *
   * @param srtContent - Raw SRT file content
   * @returns Clean dialogue text with preserved line breaks
   */
  static parseToText(srtContent: string): string {
    // Split by double newlines to separate subtitle blocks
    const blocks = srtContent.split('\n\n').filter(block => block.trim());

    const dialogueLines: string[] = [];

    for (const block of blocks) {
      const lines = block.split('\n').filter(line => line.trim());

      if (lines.length === 0) continue;

      let startIndex = 0;

      // Skip first line if it's a sequence number (e.g., "1", "2", "3")
      if (startIndex < lines.length && /^\d+$/.test(lines[startIndex].trim())) {
        startIndex++;
      }

      // Skip next line if it's a timestamp (e.g., "00:00:02,159 --> 00:00:05,279")
      if (startIndex < lines.length &&
          /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(lines[startIndex].trim())) {
        startIndex++;
      }

      // Collect remaining lines as dialogue text
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          dialogueLines.push(line);
        }
      }
    }

    // Join all dialogue with newlines to preserve line breaks
    return dialogueLines.join('\n');
  }
}
