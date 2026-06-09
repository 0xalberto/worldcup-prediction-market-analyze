/** Tracks entrance animations already played this session (survives route changes). */
const played = new Set<string>();

export function entrancePlayed(key: string): boolean {
  return played.has(key);
}

export function markEntrancePlayed(key: string): void {
  played.add(key);
}
