// KST (Asia/Seoul) date helpers for the frontend.
//
// All date logic must be KST-based: using the browser's local/UTC date would
// query the previous day during KST early-morning hours (when UTC is still
// yesterday). The backend has its own copy in lib/newsUtils.ts — these can't be
// shared because that module pulls in node-only deps (rss-parser, crypto).

/** Today's date in Asia/Seoul as YYYY-MM-DD (en-CA formats this way). */
export function getKstDateStr(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Current hour (0–23) in Asia/Seoul. */
export function getKstHour(): number {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
}
