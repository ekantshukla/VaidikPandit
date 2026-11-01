// Kundli Milan (Ashtakoota Guna Milan, 36 gunas) for a bride (vadhu) and groom (var), plus Manglik dosha.
// Birth details give the exact Moon nakshatra/pada, Lagna and Mars; a name alone gives the naam nakshatra
// from the first syllable (Avakahada chakra). Same Lahiri ayanamsa and Moon theory as the panchang.
import { D2R, R2D, deltaTDays, lahiri, moonSidereal, norm360, toJd } from './astro';
import { tzOffsetMinutes } from './panchang-engine';
import { NAKSHATRA, NAKSHATRA_SA, RASHI, RASHI_SA } from './names';

export type L = { en: string; hi: string };
const l = (en: string, hi: string): L => ({ en, hi });

// ---------------------------------------------------------------- naam akshar → nakshatra pada
/** The 108 padas: 4 syllables per nakshatra. */
const PADA_DEVA = [
  ['चू', 'चे', 'चो', 'ला'], ['ली', 'लू', 'ले', 'लो'], ['अ', 'इ', 'उ', 'ए'], ['ओ', 'वा', 'वी', 'वू'], ['वे', 'वो', 'का', 'की'],
  ['कू', 'घ', 'ङ', 'छ'], ['के', 'को', 'हा', 'ही'], ['हू', 'हे', 'हो', 'डा'], ['डी', 'डू', 'डे', 'डो'], ['मा', 'मी', 'मू', 'मे'],
  ['मो', 'टा', 'टी', 'टू'], ['टे', 'टो', 'पा', 'पी'], ['पू', 'ष', 'ण', 'ठ'], ['पे', 'पो', 'रा', 'री'], ['रू', 'रे', 'रो', 'ता'],
  ['ती', 'तू', 'ते', 'तो'], ['ना', 'नी', 'नू', 'ने'], ['नो', 'या', 'यी', 'यू'], ['ये', 'यो', 'भा', 'भी'], ['भू', 'धा', 'फा', 'ढा'],
  ['भे', 'भो', 'जा', 'जी'], ['खी', 'खू', 'खे', 'खो'], ['गा', 'गी', 'गू', 'गे'], ['गो', 'सा', 'सी', 'सू'], ['से', 'सो', 'दा', 'दी'],
  ['दू', 'थ', 'झ', 'ञ'], ['दे', 'दो', 'चा', 'ची'],
];
export const PADA_ROMAN = [
  ['Chu', 'Che', 'Cho', 'La'], ['Li', 'Lu', 'Le', 'Lo'], ['A', 'I', 'U', 'E'], ['O', 'Va', 'Vi', 'Vu'], ['Ve', 'Vo', 'Ka', 'Ki'],
  ['Ku', 'Gha', 'Nga', 'Chha'], ['Ke', 'Ko', 'Ha', 'Hi'], ['Hu', 'He', 'Ho', 'Da'], ['Di', 'Du', 'De', 'Do'], ['Ma', 'Mi', 'Mu', 'Me'],
  ['Mo', 'Ta', 'Ti', 'Tu'], ['Te', 'To', 'Pa', 'Pi'], ['Pu', 'Sha', 'Na', 'Tha'], ['Pe', 'Po', 'Ra', 'Ri'], ['Ru', 'Re', 'Ro', 'Ta'],
  ['Ti', 'Tu', 'Te', 'To'], ['Na', 'Ni', 'Nu', 'Ne'], ['No', 'Ya', 'Yi', 'Yu'], ['Ye', 'Yo', 'Bha', 'Bhi'], ['Bhu', 'Dha', 'Pha', 'Dha'],
  ['Bhe', 'Bho', 'Ja', 'Ji'], ['Khi', 'Khu', 'Khe', 'Kho'], ['Ga', 'Gi', 'Gu', 'Ge'], ['Go', 'Sa', 'Si', 'Su'], ['Se', 'So', 'Da', 'Di'],
  ['Du', 'Tha', 'Jha', 'Nya'], ['De', 'Do', 'Cha', 'Chi'],
];
const DEVA_SYL: [string, number][] = [];
PADA_DEVA.forEach((row, n) => row.forEach((s, p) => DEVA_SYL.push([s, n * 4 + p])));
DEVA_SYL.push(['जू', 83], ['जे', 83], ['जो', 83], ['खा', 84]); // Abhijit syllables: Uttara Ashadha 4 / Shravana 1
DEVA_SYL.sort((a, b) => b[0].length - a[0].length);

// Roman: dental t/d (ता, दा), as Indian names are usually written. The retroflex rows (टा, डा, ष, ण, ठ) are Devanagari only.
const ROMAN_SYL: [string, number][] = [];
// Skip the retroflex readings (ड row of Pushya/Ashlesha, ट row of the Phalgunis, ष ण ठ of Hasta, ढा, ङ, ञ) so each Roman syllable has one home
const roSkip = (n: number, p: number) => (n === 7 && p === 3) || n === 8 || (n === 10 && p > 0) || (n === 11 && p < 2) || (n === 12 && p > 0)
  || (n === 19 && p === 3) || (n === 25 && p === 3) || (n === 5 && p === 2);
PADA_ROMAN.forEach((row, n) => row.forEach((s, p) => { if (!roSkip(n, p)) ROMAN_SYL.push([s.toLowerCase(), n * 4 + p]); }));
ROMAN_SYL.push(['ju', 83], ['je', 83], ['jo', 83], ['kha', 84], ['nya', 103]);
ROMAN_SYL.sort((a, b) => b[0].length - a[0].length);

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
export interface NamePada { nak: number; pada: number; rashi: number; syllable: string; }
const padaInfo = (idx: number, syllable: string): NamePada => ({ nak: Math.floor(idx / 4), pada: idx % 4 + 1, rashi: Math.floor(idx / 9), syllable });

/** Naam nakshatra/pada from the first syllable of a name (Devanagari or Roman). null if it can't tell. */
export function padaFromName(name: string): NamePada | null {
  let n = (name || '').trim();
  if (!n) return null;
  if (/[ऀ-ॿ]/.test(n)) {
    n = n.replace(/़/g, '').replace(/^क्ष/, 'क').replace(/^त्र/, 'त').replace(/^ज्ञ/, 'ज').replace(/^श्र/, 'स').replace(/^श/, 'स')
      .replace(/^ब/, 'व').replace(/^आ/, 'अ').replace(/^ई/, 'इ').replace(/^ऊ/, 'उ').replace(/^ऐ/, 'ए').replace(/^औ/, 'ओ').replace(/^ऋ/, 'री');
    const first = n[0];
    if (/[अ-औ]/.test(first)) { for (const [s, i] of DEVA_SYL) if (n.startsWith(s)) return padaInfo(i, s); return null; }
    // consonant (+ conjunct halves) + vowel sign
    let k = 1;
    while (n[k] === '्' && n[k + 1]) k += 2;
    const sign = n[k] && /[ा-ौ]/.test(n[k]) ? n[k] : '';
    const norm = (v: string) => ({ 'ि': 'ी', 'ु': 'ू', 'ै': 'े', 'ौ': 'ो', 'ृ': 'ी' } as Record<string, string>)[v] ?? v;
    const tries = sign ? [first + sign, first + norm(sign), first + ({ 'ी': 'ि', 'ू': 'ु' } as Record<string, string>)[sign]] : [first + 'ा', first];
    for (const t of tries) if (t) for (const [s, i] of DEVA_SYL) if (s === t) return padaInfo(i, s);
    for (const [s, i] of DEVA_SYL) if (s[0] === first) return padaInfo(i, s);
    return null;
  }
  let r = n.toLowerCase().replace(/[^a-z]/g, '');
  if (!r) return null;
  r = r.replace(/^shr/, 's').replace(/^sh/, 's').replace(/^w/, 'v').replace(/^f/, 'ph').replace(/^z/, 'j').replace(/^q/, 'k')
    .replace(/^ksh/, 'k').replace(/^x/, 'k').replace(/^c(?!h)/, 'k').replace(/^tr/, 't');
  if (/^b(?!h)/.test(r)) r = 'v' + r.slice(1);
  r = r.replace(/^(chh|ch|kh|gh|bh|dh|ph|jh|th|[bcdfghjklmnpstvz])[yr](?=[aeiou])/, '$1'); // Jyoti → Joti, Priya → Piya
  r = r.replace(/^([a-z]*?)aa/, '$1a').replace(/^([a-z]*?)ee/, '$1i').replace(/^([a-z]*?)oo/, '$1u').replace(/^([a-z]*?)ai/, '$1e').replace(/^([a-z]*?)au/, '$1o');
  for (const [s, i] of ROMAN_SYL) if (r.startsWith(s)) return padaInfo(i, cap(s));
  const c = r.match(/^(chh|ch|kh|gh|bh|dh|ph|jh|th|ng|ny|[a-z])/)?.[1];
  if (c) for (const v of ['a', 'i', 'u', 'e', 'o']) for (const [s, i] of ROMAN_SYL) if (s === c + v) return padaInfo(i, cap(s));
  return null;
}

// ---------------------------------------------------------------- birth chart (Moon, Lagna, Mars)
const sinD = (x: number) => Math.sin(x * D2R), cosD = (x: number) => Math.cos(x * D2R);

/** Local date + time at a place → UTC milliseconds (handles the zone's offset on that date). */
export function birthUtc(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '12:00').split(':').map(Number);
  const local = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let utc = local - tzOffsetMinutes(tz, local) * 60000;
  utc = local - tzOffsetMinutes(tz, utc) * 60000;
  return utc;
}

/** Sidereal ascendant (Lahiri) for a UT Julian day at latitude/longitude. */
export function lagna(jdUt: number, lat: number, lng: number): number {
  const t = (jdUt - 2451545) / 36525;
  const gmst = norm360(280.46061837 + 360.98564736629 * (jdUt - 2451545) + 0.000387933 * t * t);
  const lst = norm360(gmst + lng);
  const eps = 23.4392911 - 0.0130042 * t;
  const asc = Math.atan2(cosD(lst), -(sinD(lst) * cosD(eps) + Math.tan(lat * D2R) * sinD(eps))) * R2D;
  const jdTT = jdUt + deltaTDays(jdUt);
  return norm360(asc - lahiri(jdTT));
}

// Mean orbital elements (JPL "Keplerian elements for approximate positions", 1800–2050): a, e, I, L, ϖ, Ω and their rates per century.
const EARTH = [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0];
const MARS = [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343];
function helio(el: number[], t: number): [number, number, number] {
  const a = el[0] + el[1] * t, e = el[2] + el[3] * t, I = el[4] + el[5] * t, L = el[6] + el[7] * t, w = el[8] + el[9] * t, O = el[10] + el[11] * t;
  const om = w - O;
  let M = norm360(L - w); if (M > 180) M -= 360;
  const Mr = M * D2R;
  let E = Mr + e * Math.sin(Mr);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const co = cosD(om), so = sinD(om), cO = cosD(O), sO = sinD(O), cI = cosD(I), sI = sinD(I);
  return [
    (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    so * sI * xp + co * sI * yp,
  ];
}
/** Sidereal (Lahiri) geocentric longitude of Mars, about ±0.5°. */
export function marsSidereal(jdUt: number): number {
  const jdTT = jdUt + deltaTDays(jdUt);
  const t = (jdTT - 2451545) / 36525;
  const m = helio(MARS, t), e = helio(EARTH, t);
  const lonJ2000 = Math.atan2(m[1] - e[1], m[0] - e[0]) * R2D;
  return norm360(lonJ2000 + 1.396971 * t - lahiri(jdTT)); // precess J2000 → date, then sidereal
}

export interface Person {
  name: string;
  /** From birth details or from the name. */
  source: 'birth' | 'name';
  nak: number; pada: number; rashi: number;
  moonLon?: number; lagna?: number; mars?: number;
  /** Mars house from Lagna and from the Moon (1–12), when birth details are known. */
  marsFromLagna?: number; marsFromMoon?: number;
  manglik?: boolean; manglikMoon?: boolean;
  syllable?: string;
}

export function personFromBirth(name: string, date: string, time: string | null, lat: number, lng: number, tz: string): Person {
  const ms = birthUtc(date, time || '12:00', tz);
  const jd = toJd(ms);
  const moon = moonSidereal(jd);
  const idx = Math.floor(moon / (360 / 108));
  const mars = marsSidereal(jd);
  const moonR = Math.floor(moon / 30), marsR = Math.floor(mars / 30);
  const p: Person = { name, source: 'birth', nak: Math.floor(idx / 4), pada: idx % 4 + 1, rashi: moonR, moonLon: moon, mars };
  p.marsFromMoon = ((marsR - moonR + 12) % 12) + 1;
  p.manglikMoon = MANGLIK_HOUSES.includes(p.marsFromMoon);
  if (time) {
    p.lagna = lagna(jd, lat, lng);
    p.marsFromLagna = ((marsR - Math.floor(p.lagna / 30) + 12) % 12) + 1;
    p.manglik = MANGLIK_HOUSES.includes(p.marsFromLagna);
  }
  return p;
}
export function personFromName(name: string): Person | null {
  const n = padaFromName(name);
  return n ? { name, source: 'name', nak: n.nak, pada: n.pada, rashi: n.rashi, syllable: n.syllable } : null;
}
export const MANGLIK_HOUSES = [1, 2, 4, 7, 8, 12];

// ---------------------------------------------------------------- the eight kootas
const RASHI_LORD = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4]; // weekday-order planets: 0 Sun 1 Moon 2 Mars 3 Mercury 4 Jupiter 5 Venus 6 Saturn
export const PLANET: L[] = [l('Sun', 'सूर्य'), l('Moon', 'चंद्र'), l('Mars', 'मंगल'), l('Mercury', 'बुध'), l('Jupiter', 'गुरु'), l('Venus', 'शुक्र'), l('Saturn', 'शनि')];
// natural friendship: 2 friend, 1 neutral, 0 enemy  [planet][other]
const FRIEND = [
  [2, 2, 2, 1, 2, 0, 0], // Sun
  [2, 2, 1, 2, 1, 1, 1], // Moon
  [2, 2, 2, 0, 2, 1, 1], // Mars
  [2, 0, 1, 2, 1, 2, 1], // Mercury
  [2, 2, 2, 0, 2, 0, 1], // Jupiter
  [0, 0, 1, 2, 1, 2, 2], // Venus
  [0, 0, 0, 2, 1, 2, 2], // Saturn
];

const VARNA_OF = [1, 2, 0, 3, 1, 2, 0, 3, 1, 2, 0, 3]; // 0 Shudra 1 Kshatriya 2 Vaishya 3 Brahmin
const VARNA: L[] = [l('Shudra', 'शूद्र'), l('Kshatriya', 'क्षत्रिय'), l('Vaishya', 'वैश्य'), l('Brahmin', 'ब्राह्मण')];
const VASHYA: L[] = [l('Chatushpada (quadruped)', 'चतुष्पद'), l('Manava (human)', 'मानव'), l('Jalachara (water)', 'जलचर'), l('Vanachara (wild)', 'वनचर'), l('Keeta (insect)', 'कीट')];
const VASHYA_SCORE = [[2, 1, 1, 0.5, 1], [1, 2, 0.5, 0, 1], [1, 0.5, 2, 1, 1], [0.5, 0, 1, 2, 0], [1, 1, 1, 0, 2]];
function vashyaOf(p: Person): number {
  const r = p.rashi, half2 = p.moonLon !== undefined ? (p.moonLon % 30) >= 15 : false;
  if (r === 8) return half2 ? 0 : 1;   // Dhanu: first half human, second half quadruped
  if (r === 9) return half2 ? 2 : 0;   // Makara: first half quadruped, second half water
  return [0, 0, 1, 2, 3, 1, 1, 4, 1, 0, 1, 2][r];
}
const YONI_OF = [0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1];
const YONI: L[] = [l('Horse', 'अश्व'), l('Elephant', 'गज'), l('Sheep', 'मेष'), l('Serpent', 'सर्प'), l('Dog', 'श्वान'), l('Cat', 'मार्जार'), l('Rat', 'मूषक'),
  l('Cow', 'गौ'), l('Buffalo', 'महिष'), l('Tiger', 'व्याघ्र'), l('Deer', 'मृग'), l('Monkey', 'वानर'), l('Mongoose', 'नकुल'), l('Lion', 'सिंह')];
const YONI_SCORE = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1], [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0], [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2], [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1], [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2], [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1], [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1], [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1], [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2], [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
];
const GANA_OF = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0];
const GANA: L[] = [l('Deva', 'देव'), l('Manushya', 'मनुष्य'), l('Rakshasa', 'राक्षस')];
const GANA_SCORE = [[6, 6, 1], [5, 6, 0], [1, 0, 6]]; // [groom][bride]
const NADI_OF = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2];
const NADI: L[] = [l('Adi (Vata)', 'आदि (वात)'), l('Madhya (Pitta)', 'मध्य (पित्त)'), l('Antya (Kapha)', 'अन्त्य (कफ)')];

export interface Koota { key: string; name: L; max: number; score: number; groom: L; bride: L; meaning: L; note?: L; dosha?: boolean; cancelled?: boolean; }
export interface MilanResult {
  groom: Person; bride: Person; kootas: Koota[]; total: number;
  verdict: L; level: 'low' | 'average' | 'good' | 'excellent';
  manglik: { groom: boolean | null; bride: boolean | null; text: L; ok: boolean | null };
}

const tara = (from: number, to: number) => { const r = (((to - from + 27) % 27) + 1) % 9; return ![3, 5, 7].includes(r); };
const TARA_NAMES: L[] = [l('Janma', 'जन्म'), l('Sampat', 'सम्पत्'), l('Vipat', 'विपत्'), l('Kshema', 'क्षेम'), l('Pratyari', 'प्रत्यरि'), l('Sadhaka', 'साधक'), l('Vadha', 'वध'), l('Mitra', 'मित्र'), l('Ati-mitra', 'अति मित्र')];
const taraName = (from: number, to: number) => TARA_NAMES[(to - from + 27) % 27 % 9];

export function milan(groom: Person, bride: Person): MilanResult {
  const g = groom, b = bride;
  const k: Koota[] = [];

  // 1 Varna
  const vg = VARNA_OF[g.rashi], vb = VARNA_OF[b.rashi];
  k.push({ key: 'varna', name: l('Varna', 'वर्ण'), max: 1, score: vg >= vb ? 1 : 0, groom: VARNA[vg], bride: VARNA[vb],
    meaning: l('Spiritual and working temperament; ego balance.', 'स्वभाव, कार्य-प्रवृत्ति और अहं का संतुलन।') });
  // 2 Vashya
  const wg = vashyaOf(g), wb = vashyaOf(b);
  k.push({ key: 'vashya', name: l('Vashya', 'वश्य'), max: 2, score: VASHYA_SCORE[wg][wb], groom: VASHYA[wg], bride: VASHYA[wb],
    meaning: l('Mutual attraction and who influences whom.', 'आपसी आकर्षण और एक-दूसरे पर प्रभाव।') });
  // 3 Tara
  const t1 = tara(b.nak, g.nak), t2 = tara(g.nak, b.nak);
  k.push({ key: 'tara', name: l('Tara', 'तारा'), max: 3, score: t1 && t2 ? 3 : t1 || t2 ? 1.5 : 0, groom: taraName(b.nak, g.nak), bride: taraName(g.nak, b.nak),
    meaning: l('Destiny and health of the couple (birth-star count).', 'भाग्य और स्वास्थ्य (जन्म नक्षत्र की गणना)।') });
  // 4 Yoni
  const yg = YONI_OF[g.nak], yb = YONI_OF[b.nak];
  k.push({ key: 'yoni', name: l('Yoni', 'योनि'), max: 4, score: YONI_SCORE[yg][yb], groom: YONI[yg], bride: YONI[yb],
    meaning: l('Physical and intimate compatibility.', 'शारीरिक और दाम्पत्य अनुकूलता।') });
  // 5 Graha Maitri
  const lg = RASHI_LORD[g.rashi], lb = RASHI_LORD[b.rashi];
  const f1 = FRIEND[lg][lb], f2 = FRIEND[lb][lg];
  const maitri = lg === lb ? 5 : f1 + f2 === 4 ? 5 : f1 + f2 === 3 ? 4 : f1 === 1 && f2 === 1 ? 3 : f1 + f2 === 2 ? 1 : f1 + f2 === 1 ? 0.5 : 0;
  k.push({ key: 'maitri', name: l('Graha Maitri', 'ग्रह मैत्री'), max: 5, score: maitri, groom: PLANET[lg], bride: PLANET[lb],
    meaning: l('Friendship of the Moon-sign lords: mental wavelength and affection.', 'राशि स्वामियों की मित्रता: मानसिक तालमेल और स्नेह।') });
  // 6 Gana
  const gg = GANA_OF[g.nak], gb = GANA_OF[b.nak];
  const gana = GANA_SCORE[gg][gb];
  k.push({ key: 'gana', name: l('Gana', 'गण'), max: 6, score: gana, groom: GANA[gg], bride: GANA[gb], dosha: gana <= 1,
    meaning: l('Nature and behaviour (divine, human or fierce).', 'स्वभाव और व्यवहार (देव, मनुष्य या राक्षस)।') });
  // 7 Bhakoot
  const dist = ((g.rashi - b.rashi + 12) % 12) + 1;
  const badBhakoot = [2, 12, 5, 9, 6, 8].includes(dist);
  const bhakootCancel = badBhakoot && (lg === lb || (FRIEND[lg][lb] === 2 && FRIEND[lb][lg] === 2));
  const pair = badBhakoot ? `${Math.min(dist, 14 - dist)}/${Math.max(dist, 14 - dist)}` : '';
  k.push({ key: 'bhakoot', name: l('Bhakoot', 'भकूट'), max: 7, score: badBhakoot ? 0 : 7, groom: l(RASHI[g.rashi], RASHI_SA[g.rashi]), bride: l(RASHI[b.rashi], RASHI_SA[b.rashi]),
    dosha: badBhakoot, cancelled: bhakootCancel,
    meaning: l('Love, family welfare, finances and children (Moon-sign positions).', 'प्रेम, परिवार की समृद्धि, धन और संतान (राशियों की स्थिति)।'),
    note: badBhakoot ? (bhakootCancel
      ? l(`Bhakoot dosha (${pair}) is cancelled because the sign lords are the same or friends.`, `भकूट दोष (${pair}) का परिहार है, क्योंकि राशि स्वामी एक हैं या मित्र हैं।`)
      : l(`Bhakoot dosha: the Moon signs are ${pair} from each other.`, `भकूट दोष: राशियाँ एक-दूसरे से ${pair} पर हैं।`)) : undefined });
  // 8 Nadi
  const ng = NADI_OF[g.nak], nb = NADI_OF[b.nak];
  const sameNadi = ng === nb;
  const nadiCancel = sameNadi && ((g.rashi === b.rashi && g.nak !== b.nak) || (g.nak === b.nak && g.rashi !== b.rashi) || (g.nak === b.nak && g.pada !== b.pada));
  k.push({ key: 'nadi', name: l('Nadi', 'नाड़ी'), max: 8, score: sameNadi ? 0 : 8, groom: NADI[ng], bride: NADI[nb], dosha: sameNadi, cancelled: nadiCancel,
    meaning: l('Health, genes and progeny. Considered the most important koota.', 'स्वास्थ्य, वंश और संतान। इसे सबसे महत्वपूर्ण कूट माना जाता है।'),
    note: sameNadi ? (nadiCancel
      ? l('Nadi dosha is cancelled (same sign with different nakshatras, or same nakshatra with a different sign/pada).', 'नाड़ी दोष का परिहार है (एक राशि पर भिन्न नक्षत्र, या एक नक्षत्र पर भिन्न राशि/चरण)।')
      : l('Nadi dosha: both have the same Nadi. Traditionally a remedy (e.g. Maha Mrityunjaya jaap, Nadi dosha nivaran puja) is advised.', 'नाड़ी दोष: दोनों की नाड़ी एक है। परंपरा में उपाय (जैसे महामृत्युंजय जाप, नाड़ी दोष निवारण पूजा) बताया जाता है।')) : undefined });

  const total = k.reduce((s, x) => s + x.score, 0);
  const level = total < 18 ? 'low' : total <= 24 ? 'average' : total <= 32 ? 'good' : 'excellent';
  const verdict = {
    low: l('Below 18 gunas: traditionally not recommended without a detailed chart study and remedies.', '18 से कम गुण: परंपरा के अनुसार विस्तृत कुंडली विचार और उपाय के बिना उचित नहीं माना जाता।'),
    average: l('18–24 gunas: an acceptable match.', '18–24 गुण: सामान्य, विवाह योग्य मिलान।'),
    good: l('25–32 gunas: a very good match.', '25–32 गुण: बहुत अच्छा मिलान।'),
    excellent: l('33–36 gunas: an excellent match.', '33–36 गुण: उत्तम मिलान।'),
  }[level];

  // Manglik
  const mg = g.manglik ?? g.manglikMoon ?? null, mb = b.manglik ?? b.manglikMoon ?? null;
  let mtext: L, ok: boolean | null;
  if (mg === null || mb === null) { mtext = l('Manglik check needs the birth date of both (and the birth time for the exact Lagna).', 'मांगलिक विचार के लिए दोनों की जन्म तिथि (और सटीक लग्न के लिए जन्म समय) चाहिए।'); ok = null; }
  else if (mg === mb) { mtext = mg ? l('Both are Manglik, so the Mangal dosha cancels out.', 'दोनों मांगलिक हैं, इसलिए मंगल दोष का परिहार हो जाता है।') : l('Neither is Manglik.', 'दोनों में से कोई मांगलिक नहीं है।'); ok = true; }
  else { mtext = l(`${mg ? 'The groom' : 'The bride'} is Manglik and the other is not. Traditionally a Mangal dosha shanti puja or a careful chart study is advised.`, `${mg ? 'वर' : 'वधू'} मांगलिक हैं और दूसरे नहीं। परंपरा में मंगल दोष शांति पूजा या विस्तृत कुंडली विचार बताया जाता है।`); ok = false; }

  return { groom, bride, kootas: k, total, verdict, level, manglik: { groom: mg, bride: mb, text: mtext, ok } };
}

export const nakName = (n: number, hi: boolean) => (hi ? NAKSHATRA_SA[n] : NAKSHATRA[n]);
export const rashiName = (r: number, hi: boolean) => (hi ? RASHI_SA[r] : RASHI[r]);

/** Plain-text summary for AI PanditJi. */
export function milanContext(m: MilanResult): string {
  const p = (x: Person, who: string) => `${who} ${x.name || ''}: ${NAKSHATRA[x.nak]} pada ${x.pada}, ${RASHI[x.rashi]} rashi (${x.source === 'birth' ? 'from birth details' : 'from the name\'s first syllable'})`
    + (x.marsFromLagna ? `, Mars in house ${x.marsFromLagna} from Lagna` : '') + (x.marsFromMoon ? `, house ${x.marsFromMoon} from Moon` : '');
  return [
    'Vivaha Melapaka / Kundli Milan (Ashtakoota guna milan):', p(m.groom, 'Groom (var)'), p(m.bride, 'Bride (vadhu)'),
    ...m.kootas.map(k => `${k.name.en}: ${k.score}/${k.max} (groom ${k.groom.en}, bride ${k.bride.en})${k.dosha ? ' DOSHA' : ''}${k.cancelled ? ' (cancelled)' : ''}`),
    `Total ${m.total}/36. ${m.verdict.en}`, `Manglik: ${m.manglik.text.en}`,
  ].join('\n');
}
