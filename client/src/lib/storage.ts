const PREFIX = "guess-the-date:v1";

export const unlimitedKey = `${PREFIX}:unlimited`;
export const recentKey = `${PREFIX}:recent`;

export function dailyKey(dateKey: string): string {
  return `${PREFIX}:daily:${dateKey}`;
}

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The game remains playable when storage is blocked or full.
  }
}
