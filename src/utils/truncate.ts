export function truncateText(
  text: string,
  maxChars: number = 10000
): string {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  return (
    text.slice(0, half) +
    '\n\n... [truncated — showing first and last portions] ...\n\n' +
    text.slice(-half)
  );
}

export function truncateLines(
  content: string,
  maxLines: number = 500,
  offset: number = 0
): { text: string; totalLines: number; truncated: boolean } {
  const lines = content.split('\n');
  const totalLines = lines.length;
  const sliced = lines.slice(offset, offset + maxLines);
  const truncated = totalLines > offset + maxLines;

  const numbered = sliced.map(
    (line, i) => `${(offset + i + 1).toString().padStart(4)} | ${line}`
  );

  let text = numbered.join('\n');
  if (truncated) {
    text += `\n\n[... ${totalLines - offset - maxLines} more lines. Use offset=${offset + maxLines} to continue reading]`;
  }

  return { text, totalLines, truncated };
}
