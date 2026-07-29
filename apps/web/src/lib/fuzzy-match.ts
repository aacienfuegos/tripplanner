// Duplicate-detection helpers shared by the AI import wizard (src/actions/import.ts)
// and the Diving Log logbook import (src/actions/dive-import.ts).

// Strips diacritics, punctuation, and extra whitespace for consistent comparison.
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// Sorts words before comparing so "Hotel Marriott" ≈ "Marriott Hotel",
// then applies Levenshtein for typos and minor AI variations.
export function isFuzzyMatch(a: string, b: string, threshold = 0.85): boolean {
  const na = normalize(a).split(" ").sort().join(" ");
  const nb = normalize(b).split(" ").sort().join(" ");
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  return maxLen > 0 && 1 - levenshtein(na, nb) / maxLen >= threshold;
}
