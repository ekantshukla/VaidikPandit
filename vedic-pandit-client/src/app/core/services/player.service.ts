// Ad-free Bhajan / Aarti player. One <audio> element for the whole app, so music keeps playing while you move
// between pages. Plays our own recordings (public/audio, plus tracks the admin adds) and free 24×7 devotional
// internet radio found through the open Radio Browser directory (radio-browser.info). No video, no ads in the page.
import { Injectable, computed, signal } from '@angular/core';

export type TrackKind = 'aarti' | 'bhajan' | 'stotra' | 'mantra' | 'kirtan' | 'radio';
export interface Track {
  id: string;
  title: string; titleHi?: string;
  kind: TrackKind;
  deity?: string;
  url: string;
  credit?: string;
  /** Live radio: no length, no seeking. */
  live?: boolean;
  /** Radio: country / language / bitrate line. */
  info?: string;
  favicon?: string;
  /** Can be saved to the device. */
  download?: boolean;
  /** Source page (archive.org / Wikimedia Commons) for the licence credit. */
  page?: string;
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private audio?: HTMLAudioElement;
  readonly queue = signal<Track[]>([]);
  readonly index = signal(-1);
  readonly current = computed(() => this.queue()[this.index()] ?? null);
  readonly playing = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly time = signal(0);
  readonly duration = signal(0);

  private el(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = 'none';
    a.addEventListener('playing', () => { this.playing.set(true); this.loading.set(false); this.error.set(''); });
    a.addEventListener('pause', () => this.playing.set(false));
    a.addEventListener('waiting', () => this.loading.set(true));
    a.addEventListener('timeupdate', () => this.time.set(a.currentTime));
    a.addEventListener('durationchange', () => this.duration.set(isFinite(a.duration) ? a.duration : 0));
    a.addEventListener('ended', () => this.next(true));
    a.addEventListener('error', () => {
      this.loading.set(false); this.playing.set(false);
      this.error.set('unavailable');
      // A dead radio stream or a missing file: move on after a moment if there is more in the queue
      if (this.index() < this.queue().length - 1) setTimeout(() => this.next(true), 1500);
    });
    this.audio = a;
    this.media();
    return a;
  }

  /** Play a list starting at position i. */
  play(list: Track[], i = 0) {
    this.queue.set(list);
    this.index.set(i);
    this.load();
  }
  private load() {
    const t = this.current(); if (!t) return;
    const a = this.el();
    this.error.set(''); this.loading.set(true); this.time.set(0); this.duration.set(0);
    a.src = t.url;
    a.play().catch(() => { this.loading.set(false); this.playing.set(false); });
    this.meta(t);
  }
  toggle() {
    const a = this.el();
    if (!this.current()) return;
    if (a.paused) { if (this.current()?.live) { a.src = this.current()!.url; } a.play().catch(() => undefined); }
    else a.pause();
  }
  next(auto = false) {
    const n = this.index() + 1;
    if (n < this.queue().length) { this.index.set(n); this.load(); }
    else if (!auto && this.queue().length) { this.index.set(0); this.load(); }
  }
  prev() {
    const a = this.el();
    if (!this.current()?.live && a.currentTime > 5) { a.currentTime = 0; return; }
    const p = this.index() - 1;
    if (p >= 0) { this.index.set(p); this.load(); }
  }
  seek(sec: number) { const a = this.el(); if (!this.current()?.live && isFinite(sec)) a.currentTime = sec; }
  stop() {
    const a = this.audio; if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    this.queue.set([]); this.index.set(-1); this.playing.set(false); this.loading.set(false);
  }
  isCurrent(t: Track) { return this.current()?.id === t.id; }

  // Lock-screen / notification controls (Media Session API)
  private media() {
    const ms = typeof navigator !== 'undefined' ? (navigator as any).mediaSession : null;
    if (!ms) return;
    try {
      ms.setActionHandler('play', () => this.toggle());
      ms.setActionHandler('pause', () => this.toggle());
      ms.setActionHandler('nexttrack', () => this.next());
      ms.setActionHandler('previoustrack', () => this.prev());
    } catch { /* not supported */ }
  }
  private meta(t: Track) {
    const ms = typeof navigator !== 'undefined' ? (navigator as any).mediaSession : null;
    const MM = (window as any).MediaMetadata;
    if (!ms || !MM) return;
    try {
      ms.metadata = new MM({ title: t.titleHi || t.title, artist: t.credit || (t.live ? 'Live' : 'Vaidik Pandit'), album: 'Vaidik Pandit',
        artwork: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------- live devotional radio
const SERVERS = ['de1', 'de2', 'fi1', 'nl1', 'at1'].map(s => `https://${s}.api.radio-browser.info`);
const TAGS = ['bhajan', 'bhakti', 'devotional', 'aarti', 'kirtan', 'hindu', 'mantra', 'krishna', 'shiva', 'hanuman', 'spiritual india'];
let stationCache: Promise<Track[]> | null = null;

async function fetchJson(path: string): Promise<any[]> {
  for (const base of SERVERS) {
    try {
      const r = await fetch(base + path, { headers: { Accept: 'application/json' } });
      if (r.ok) return await r.json();
    } catch { /* try the next server */ }
  }
  return [];
}

/** Working HTTPS devotional stations, most listened first (cached for the session). */
export function devotionalStations(): Promise<Track[]> {
  stationCache ??= (async () => {
    const lists = await Promise.all(TAGS.map(tag =>
      fetchJson(`/json/stations/search?tag=${encodeURIComponent(tag)}&hidebroken=true&is_https=true&order=clickcount&reverse=true&limit=40`)));
    const seen = new Set<string>();
    const out: (Track & { score: number })[] = [];
    for (const s of lists.flat()) {
      const url: string = s.url_resolved || s.url;
      if (!url || !url.startsWith('https://') || s.lastcheckok !== 1) continue;
      const key = (s.name || '').trim().toLowerCase();
      if (!key || seen.has(key) || seen.has(url)) continue;
      // Keep it devotional: skip general music / news stations that merely mention a tag
      const tags = String(s.tags || '').toLowerCase();
      if (/news|talk|sports|cricket|bollywood hits|top 40|edm|dance|rock|pop(?!ular)/.test(tags) && !/bhajan|bhakti|devotional|aarti|kirtan/.test(tags)) continue;
      seen.add(key); seen.add(url);
      const lang = String(s.language || '').split(',')[0];
      out.push({
        id: 'radio:' + (s.stationuuid || url), title: String(s.name).trim().slice(0, 70), kind: 'radio', live: true, url,
        info: [s.country, lang && lang[0].toUpperCase() + lang.slice(1), s.bitrate ? s.bitrate + ' kbps' : ''].filter(Boolean).join(' · '),
        favicon: typeof s.favicon === 'string' && s.favicon.startsWith('https://') ? s.favicon : undefined,
        score: (s.clickcount || 0) + (s.countrycode === 'IN' ? 500 : 0) + (/bhajan|bhakti|devotional|aarti/.test(tags) ? 300 : 0),
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 60).map(({ score, ...t }) => t);
  })().catch(() => { stationCache = null; return []; });
  return stationCache;
}
