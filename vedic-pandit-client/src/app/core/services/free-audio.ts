// Free devotional audio from open libraries, played in our ad-free player and downloadable.
//  • Internet Archive (archive.org): only items whose uploader marked them Creative Commons or public domain.
//  • Wikimedia Commons: every file there is free to use (public domain or a free licence).
// Both APIs allow requests straight from the browser / app (CORS), so no server is needed.
import type { Track, TrackKind } from './player.service';

export type Source = 'ia' | 'wc';
export interface FreeItem {
  id: string;
  source: Source;
  title: string;
  creator?: string;
  license: string;
  /** Page on archive.org / commons.wikimedia.org: shown as the credit link (required by CC-BY). */
  page: string;
  kind: TrackKind;
  deity?: string;
  /** Wikimedia files are one track each; an Internet Archive item (an album) loads its tracks on demand. */
  tracks?: Track[];
}

const DEVOTIONAL = ['bhajan', 'bhajans', 'aarti', 'arti', 'aarati', 'kirtan', 'kirtana', 'bhakti', 'chalisa', 'stotram', 'stotra', 'stuti', 'bhajana', 'mantra', 'jaap'];

/** Guess the type from the title. */
export function guessKind(s: string, fallback: TrackKind = 'bhajan'): TrackKind {
  const x = s.toLowerCase();
  if (/\baa?ra?ti\b|aarati|आरती|jagdish hare|jai ambe gauri|kunj ?bihari ki|om jai|ॐ जय|ओम जय/.test(x)) return 'aarti';
  if (/chalisa|stotr|ashtak|stuti|sahasranam|kavach|चालीसा|स्तोत्र/.test(x)) return 'stotra';
  if (/kirtan|sankirtan|kirtana|कीर्तन/.test(x)) return 'kirtan';
  if (/mantra|jaap|japa|gayatri|मंत्र/.test(x)) return 'mantra';
  return /bhajan|भजन/.test(x) ? 'bhajan' : fallback;
}
const DEITY_RE: [string, RegExp][] = [
  ['ganesha', /ganesh|ganpati|ganapati|vinayak|gajanan|गणेश|गणपति/],
  ['hanuman', /hanuman|bajrang|maruti|anjaneya|हनुमान|बजरंग/],
  ['shiva', /\bshiv|mahadev|shankar|bhole|shambhu|rudra|nataraj|शिव|महादेव/],
  ['krishna', /krishna|krsna|govind|gopal|radhe|kanha|shyam|murari|vitthal|vithoba|bihari|kunj|nandlal|hare\s*rama?\s*hare|कृष्ण|राधे|श्याम/],
  ['rama', /\bshri\s*ram\b|\bram\b|\brama\b|raghu|sita\s*ram|सीताराम|राम/],
  ['vishnu', /vishnu|narayan|jagdish|jagadish|satyanarayan|balaji|venkatesh|विष्णु|जगदीश/],
  ['durga', /durga|ambe|jagdamb|navratri|sherawali|vaishno|mata\s*rani|दुर्गा|अम्बे/],
  ['lakshmi', /lakshmi|laxmi|mahalakshmi|लक्ष्मी/],
  ['saraswati', /saraswati|sarasvati|sharda|सरस्वती/],
  ['kali', /\bkali\b|kalika|काली/],
  ['shani', /shani|शनि/],
  ['surya', /surya|aditya|सूर्य/],
  ['guru', /\bguru\b|sai\s*baba|sai\b|गुरु/],
];
export function guessDeity(s: string): string | undefined {
  const x = s.toLowerCase();
  return DEITY_RE.find(([, re]) => re.test(x))?.[0];
}

const clean = (s: unknown) => String(Array.isArray(s) ? s[0] : s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const shortLicense = (url: string) => {
  const u = url.toLowerCase();
  if (/publicdomain|\/zero\//.test(u)) return 'Public domain';
  const m = u.match(/licenses\/([a-z-]+)\/([\d.]+)/);
  return m ? 'CC ' + m[1].toUpperCase() + ' ' + m[2] : 'Creative Commons';
};

// ---------------------------------------------------------------- Internet Archive
const IA = 'https://archive.org';
/** Search Internet Archive audio. Empty `q` = most downloaded devotional items. Only CC / public-domain items. */
export async function searchArchive(q: string, page = 1): Promise<{ items: FreeItem[]; total: number }> {
  const words = q.trim().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 6);
  const topic = '(' + DEVOTIONAL.join(' OR ') + ')';
  const text = words.length ? '(' + words.map(w => `(title:${w} OR subject:${w} OR description:${w} OR creator:${w})`).join(' AND ') + ') AND ' + topic : topic;
  return iaQuery(`${text} AND ${IA_FREE}`, 40, page);
}
const IA_FREE = 'mediatype:audio AND (licenseurl:*creativecommons.org* OR licenseurl:*publicdomain*)';
async function iaQuery(query: string, rows: number, page: number): Promise<{ items: FreeItem[]; total: number }> {
  const p = new URLSearchParams({ q: query, rows: String(rows), page: String(page), output: 'json' });
  ['identifier', 'title', 'creator', 'licenseurl', 'subject'].forEach(f => p.append('fl[]', f));
  p.append('sort[]', 'downloads desc');
  const r = await fetch(`${IA}/advancedsearch.php?${p}`);
  if (!r.ok) throw new Error('ia ' + r.status);
  const j = await r.json();
  const docs: any[] = j?.response?.docs ?? [];
  return {
    total: j?.response?.numFound ?? docs.length,
    items: docs.filter(d => d.identifier && d.licenseurl).map(d => {
      const title = clean(d.title) || d.identifier;
      const hay = title + ' ' + clean(d.subject);
      return {
        id: 'ia:' + d.identifier, source: 'ia' as const, title, creator: clean(d.creator) || undefined,
        license: shortLicense(clean(d.licenseurl)), page: `${IA}/details/${d.identifier}`,
        kind: guessKind(hay), deity: guessDeity(hay),
      };
    }),
  };
}

const AUDIO_EXT = /\.(mp3|m4a|ogg|opus|wav|flac)$/i;
/** The playable files of one Internet Archive item, in album order (MP3 preferred over other copies of the same song). */
export async function archiveTracks(item: FreeItem): Promise<Track[]> {
  if (item.tracks) return item.tracks;
  const id = item.id.slice(3);
  const r = await fetch(`${IA}/metadata/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error('ia ' + r.status);
  const j = await r.json();
  const files: any[] = (j?.files ?? []).filter((f: any) => AUDIO_EXT.test(f.name || '') && f.source !== 'metadata');
  // One entry per song: prefer VBR MP3, then any MP3, then the original
  const rank = (f: any) => /vbr mp3/i.test(f.format) ? 0 : /\.mp3$/i.test(f.name) ? 1 : /\.(m4a|ogg|opus)$/i.test(f.name) ? 2 : 3;
  const best = new Map<string, any>();
  for (const f of files) {
    const key = String(f.original && f.source === 'derivative' ? f.original : f.name).replace(/\.[^.]+$/, '').replace(/_(vbr|64kb|128kb)$/i, '');
    const prev = best.get(key);
    if (!prev || rank(f) < rank(prev)) best.set(key, f);
  }
  const num = (f: any) => parseInt(String(f.track ?? '').split('/')[0], 10);
  const list = [...best.values()].sort((a, b) => (num(a) || 999) - (num(b) || 999) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  item.tracks = list.map((f, i) => {
    const title = clean(f.title) || String(f.name).split('/').pop()!.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/^\s*\d{1,3}\s*[-.)]?\s+/, '');
    return {
      id: `${item.id}#${i}`, title, kind: guessKind(title, item.kind),
      deity: guessDeity(title) || item.deity,
      url: `${IA}/download/${encodeURIComponent(id)}/${String(f.name).split('/').map(encodeURIComponent).join('/')}`,
      credit: [clean(f.artist) || item.creator, item.license].filter(Boolean).join(' · '),
      download: true, page: item.page,
    };
  });
  return item.tracks;
}

// ---------------------------------------------------------------- Wikimedia Commons
const WC = 'https://commons.wikimedia.org/w/api.php';
/** Search audio files on Wikimedia Commons. `offset` comes from the previous call (null = no more). */
export async function searchCommons(q: string, offset = 0): Promise<{ items: FreeItem[]; next: number | null }> {
  const words = q.trim().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  return wcQuery((words ? words + ' ' : '') + '(' + DEVOTIONAL.slice(0, 12).join(' OR ') + ') filetype:audio', 40, offset);
}
async function wcQuery(search: string, limit: number, offset: number): Promise<{ items: FreeItem[]; next: number | null }> {
  const p = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrlimit: String(limit),
    gsrsearch: search, gsroffset: String(offset), prop: 'videoinfo', viprop: 'url|mime|extmetadata|derivatives',
  });
  const r = await fetch(`${WC}?${p}`);
  if (!r.ok) throw new Error('wc ' + r.status);
  const j = await r.json();
  const pages: any[] = Object.values(j?.query?.pages ?? {}).sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0));
  const items: FreeItem[] = [];
  for (const pg of pages) {
    const info = pg.videoinfo?.[0];
    if (!info?.url) continue;
    const meta = info.extmetadata ?? {};
    const title = clean(meta.ObjectName?.value) || String(pg.title).replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ');
    // Phones (iPhone especially) play MP3 more reliably than Ogg: use Commons' MP3 copy when there is one
    const mp3 = (info.derivatives ?? []).find((d: any) => /audio\/mpeg/.test(d.type || '') || /\.mp3$/i.test(d.src || ''));
    const creator = clean(meta.Artist?.value).slice(0, 80) || undefined;
    const license = clean(meta.LicenseShortName?.value) || 'Free licence';
    const page = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(pg.title)}`;
    const id = 'wc:' + pg.pageid;
    const kind = guessKind(pg.title + ' ' + title), deity = guessDeity(pg.title + ' ' + title);
    items.push({
      id, source: 'wc', title, creator, license, page, kind, deity,
      tracks: [{ id: id + '#0', title, kind, deity, url: mp3?.src || info.url, credit: [creator, license].filter(Boolean).join(' · '), download: true, page }],
    });
  }
  return { items, next: j?.continue?.gsroffset ?? null };
}

// ---------------------------------------------------------------- recordings of one mantra
const GENERIC = new Set(['mantra', 'mantram', 'stotram', 'stotra', 'stotras', 'shri', 'sri', 'the', 'of', 'and', 'aarti', 'chalisa', 'path', 'paath', 'ashtakam']);
const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ')
  .replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/sh/g, 's').replace(/([a-z])\1/g, '$1').replace(/\s+/g, ' ').trim();
/**
 * Real recordings of a mantra / stotra by name, from Wikimedia Commons and Internet Archive (free licences only).
 * Only results whose title contains every key word of the name are kept, e.g. "Gayatri", or "Hanuman" + "Chalisa".
 */
export async function findRecordings(name: string): Promise<FreeItem[]> {
  const all = name.replace(/\(.*?\)/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1);
  let key = all.filter(w => !GENERIC.has(w.toLowerCase()));
  if (!key.length) key = all;
  key = key.slice(0, 3);
  if (!key.length) return [];
  // Keep the generic word too when it tells texts apart (Hanuman *Chalisa* vs any Hanuman mantra)
  const kindWord = all.find(w => /chalisa|aarti|ashtakam|sahasranam/i.test(w));
  const must = [...key, ...(kindWord ? [kindWord] : [])].map(fold);
  const ok = (it: FreeItem) => { const t = fold(it.title); return must.every(w => t.includes(w)); };
  const [wc, ia] = await Promise.allSettled([
    wcQuery(key.map(w => `intitle:${w}`).join(' ') + ' filetype:audio', 10, 0),
    iaQuery('(' + key.map(w => `title:${w}`).join(' AND ') + ') AND ' + IA_FREE, 10, 1),
  ]);
  const list = [...(wc.status === 'fulfilled' ? wc.value.items : []), ...(ia.status === 'fulfilled' ? ia.value.items : [])];
  return list.filter(ok).slice(0, 6);
}

// ---------------------------------------------------------------- download
const fileName = (t: Track) => {
  const ext = (t.url.split('?')[0].match(/\.(mp3|m4a|ogg|opus|wav|flac)$/i)?.[0] || '.mp3').toLowerCase();
  return (t.title || 'bhajan').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) + ext;
};
/**
 * Save a track to the phone / computer. In the browser we fetch it and save it under a proper name.
 * In the Android app the file opens in the phone's browser, which downloads it (or shows ⋮ → Download).
 */
export async function downloadTrack(t: Track, inApp: boolean): Promise<void> {
  const url = new URL(t.url, document.baseURI).href;
  if (!inApp) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = fileName(t); a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
      return;
    } catch { /* fall through: open the file directly */ }
  }
  window.open(url, '_blank', 'noopener');
}
