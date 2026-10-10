/** Turning a search snippet with its match marks into text and highlighted pieces. */
export const MARK_OPEN = '\u0001';
export const MARK_CLOSE = '\u0002';

export type Piece = { text: string; hit: boolean };

export function pieces(snippet: string): Piece[] {
  return snippet.split(MARK_OPEN).flatMap((chunk, i) => {
    if (i === 0) return [{ text: chunk, hit: false }];
    const end = chunk.indexOf(MARK_CLOSE);
    if (end < 0) return [{ text: chunk, hit: true }];
    return [
      { text: chunk.slice(0, end), hit: true },
      { text: chunk.slice(end + 1), hit: false },
    ].filter((p) => p.text);
  });
}
