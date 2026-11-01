// PanditJi on a free AI model, called straight from the browser / Android app.
// Works with any OpenAI-compatible chat API that supports streaming and tool calls:
//   Gemini      https://generativelanguage.googleapis.com/v1beta/openai      (default; free key from Google AI Studio)
//   Groq        https://api.groq.com/openai/v1                               (free key, no card)
//   OpenRouter  https://openrouter.ai/api/v1                                 (models ending in ":free")
// The tools run on the device with the same engines as the rest of the site (panchang, muhurat, mantra, granth,
// rashifal), so dates and shlokas come from calculation and the library, not from the model's memory.
import { aiBase, aiKey, aiModel } from './ai-config';
import { addDays, computePanchang } from '../astro/panchang-engine';
import { findMuhurat, MUHURAT_EVENTS } from '../astro/muhurat-engine';
import { PanchangResult } from '../astro/models';
import { rashifalContext, rashiIndex, RASHIS } from '../astro/rashifal';
import { findMantra, loadMantras } from './mantra-search';
import { localSearch } from './api.service';
import { FOLLOWUP_RULE, stripFollowups } from './followups';
import { findText, readPassage } from './granth-library';

export interface AiEvent { type: 'delta' | 'card' | 'status' | 'done' | 'error'; text?: string; cardType?: string; payload?: unknown; tool?: string; message?: string; }
export interface AiContext { language: string; today: string; lat: number; lng: number; tz: string; tradition: string; placeName: string; }



const LANGS: Record<string, string> = {
  hi: 'Hindi (Devanagari script)', en: 'English', kn: 'Kannada (Kannada script)', ta: 'Tamil (Tamil script)', te: 'Telugu (Telugu script)',
  mr: 'Marathi (Devanagari script)', bn: 'Bengali (Bengali script)', gu: 'Gujarati (Gujarati script)',
};

function systemPrompt(c: AiContext): string {
  return `You are "AI PanditJi" (AI पंडित जी), a warm, learned and humble Vedic scholar and friendly guide inside the Vaidik Pandit app (website and Android app by Ekant Shukla).
You answer ANY question the user asks — dharma, scriptures, rituals, festivals, panchang, muhurat, mantras, rashifal and jyotish,
and also everyday questions (general knowledge, studies, health basics, cooking, technology, life advice, maths, writing help…).
Never refuse just because a question is not about religion; answer it helpfully like a wise, well-read family elder would.

TODAY is ${c.today} (time zone ${c.tz}). The user's place: ${c.placeName}. Resolve "aaj", "kal", "parson", "next week" from this date.

LANGUAGE (strict): The user has chosen ${LANGS[c.language] ?? LANGS['hi']} in the app. Write EVERYTHING in ${LANGS[c.language] ?? LANGS['hi']} only —
the answer, any question you ask back, and the [[NEXT]] suggestions — even if the user types in another language, in English or in Hinglish,
and even if earlier messages in this chat were in another language. Do not mix in other languages except proper names and quoted shlokas.
Quote Sanskrit shlokas and mantras in Devanagari (add an IAST line when teaching pronunciation), then explain them in ${LANGS[c.language] ?? LANGS['hi']}.

TOOLS (use them, never guess these):
- get_panchang: for tithi, nakshatra, yoga, karana, Rahu Kaal, choghadiya, sunrise, festivals or vrat on a date.
- find_muhurat: for auspicious dates (vivah, griha pravesh, vehicle, property, naming, mundan, annaprashan, vidyarambh, business). Explain the reasons it returns.
- get_rashifal: for any horoscope / rashifal / "aaj ka din kaisa rahega" question about a rashi. If the user has not said their rashi, ask for it (or their name's first letter) in one short line.
- search_scriptures: for what the Gita or Upanishads say. Quote ONLY verses the tool returns, with their exact citation, e.g. (Bhagavad Gita 2.47). If nothing relevant is returned, answer from general traditional understanding and say so. NEVER invent a shloka or a verse number.
- get_mantra: for a mantra, stotra, chalisa or aarti. The app shows the full text with a chant-along player.
- read_granth: to quote or explain a passage from the Vedas, Upanishads, Mahabharata (critical edition), Valmiki Ramayana, Ramcharitmanas, the Puranas, Ayurveda (Charaka, Sushruta), Natya Shastra, Arthashastra or Yoga Sutra. Fetch the exact Sanskrit before quoting it, and quote only what the tool returns, with its reference. The library has the original text only: translate and explain it yourself.

STYLE: Speak like a kind family pandit — respectful ("aap"), clear and concise. Plain text with short paragraphs; no tables, no markdown symbols like ** or #, because replies may be read aloud.
Present different sampradaya views fairly; never disparage any tradition or religion.
No fear-based astrology, no guaranteed outcomes, no costly remedies or gemstones as "musts"; suggest simple prayer, charity and good conduct. For major samskaras suggest confirming the muhurat with the family purohit.
For serious health, legal or money matters give useful general information and suggest a qualified professional too.
Be interactive: if a question is unclear or needs a detail (their rashi, which occasion, which date), ask one short question back.

${FOLLOWUP_RULE}`;
}

// (Gemini rejects an empty "required" list, so it is left out when empty)
const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, ...(required.length ? { required } : {}) } } });

const TOOLS = [
  fn('get_panchang', 'Astronomical panchang for a date at the user\'s location: sunrise/sunset, tithi, nakshatra, yoga, karana with end times, masa, samvat, Rahu Kaal, Yamaganda, Gulika, Abhijit, choghadiya, festivals and vrat.',
    { date: { type: 'string', description: 'YYYY-MM-DD; default today' } }),
  fn('find_muhurat', 'Auspicious time windows for an event between two dates (max 180 days) at the user\'s location, with reasons.',
    { event: { type: 'string', enum: MUHURAT_EVENTS.map(e => e.id) }, from_date: { type: 'string', description: 'YYYY-MM-DD' }, to_date: { type: 'string', description: 'YYYY-MM-DD' } },
    ['event', 'from_date', 'to_date']),
  fn('get_rashifal', 'Rashifal (horoscope) for a Moon sign, computed from the real Moon and Sun transit: rating, overall, work/money, family, health, lucky colour/number and a simple upay.',
    { rashi: { type: 'string', enum: RASHIS.map(r => r.en), description: 'Mesha (Aries) … Meena (Pisces)' }, date: { type: 'string', description: 'YYYY-MM-DD; default today' }, period: { type: 'string', enum: ['day', 'week', 'month'] } },
    ['rashi']),
  fn('search_scriptures', 'Search the verse library (complete Bhagavad Gita, Upanishads). Topic keywords in English or a reference like "Gita 2.47".',
    { query: { type: 'string' } }, ['query']),
  fn('read_granth', 'Read the original text of a passage from the Granth library. Chapter ids: mahabharata "parva.adhyaya" (Bhagavad Gita = 6.23–6.40, e.g. 6.24 is Gita ch. 2); valmiki-ramayana "kanda.sarga"; rigveda "mandala.sukta"; atharvaveda "kanda.sukta"; shukla-yajurveda "adhyaya"; bhagavata-purana "skandha.adhyaya"; vishnu/garuda/kurma/narada/brahmanda/linga-purana "part.adhyaya"; other puranas "adhyaya"; ramcharitmanas "kanda.doha-number"; yoga-sutra "pada"; katha/prashna/shvetashvatara-upanishad "adhyaya" or "valli"; chandogya/brihadaranyaka "adhyaya.khanda"; charaka/sushruta "sthana.adhyaya"; arthashastra "adhikarana.adhyaya".',
    { text: { type: 'string', description: 'mahabharata, valmiki-ramayana, ramcharitmanas, rigveda, samaveda, shukla-yajurveda, atharvaveda, katha-upanishad, prashna-upanishad, shvetashvatara-upanishad, aitareya-upanishad, chandogya-upanishad, brihadaranyaka-upanishad, kaivalya-upanishad, mandukya-karika, bhagavata-purana, vishnu-purana, shiva-purana, markandeya-purana, brahma-purana, brahmanda-purana, garuda-purana, kurma-purana, linga-purana, matsya-purana, narada-purana, vamana-purana, skanda-purana, agni-purana, narasimha-purana, devi-gita, charaka-samhita, sushruta-samhita, natya-shastra, dhanurveda, arthashastra, yoga-sutra' },
      chapter: { type: 'string', description: 'Chapter id, e.g. "6.24"' }, verse: { type: 'string', description: 'Verse number (optional)' } },
    ['text', 'chapter']),
  fn('get_mantra', 'Look up a mantra, stotra, chalisa or aarti by name, deity or purpose (e.g. "gayatri", "hanuman chalisa", "shiva tandava").',
    { query: { type: 'string' } }, ['query']),
];

function panchangText(p: PanchangResult): string {
  const t = (s?: string | null) => (s ? s.slice(11, 16) : '—');
  const list = (els: { name: string; ends: string | null }[]) => els.map(e => `${e.name}${e.ends ? ' until ' + e.ends.slice(0, 16).replace('T', ' ') : ''}`).join(', then ');
  return [
    `Panchang for ${p.date} (${p.vara.name}) at ${p.latitude.toFixed(2)},${p.longitude.toFixed(2)} ${p.timeZone}`,
    `Sunrise ${t(p.sunrise)}, sunset ${t(p.sunset)}`,
    `Tithi: ${list(p.tithis)} (${p.paksha} paksha)`, `Nakshatra: ${list(p.nakshatras)}`, `Yoga: ${list(p.yogas)}`, `Karana: ${list(p.karanas)}`,
    `Masa: ${p.masa}${p.isAdhikMasa ? ' (Adhik)' : ''} (${p.monthSystem}), Vikram Samvat ${p.vikramSamvat}, Shaka ${p.shakaSamvat}, ritu ${p.ritu}, ${p.ayana}`,
    `Sun in ${p.sunRashi}, Moon in ${p.moonRashi}`,
    `Rahu Kaal ${t(p.rahuKaal?.start)}-${t(p.rahuKaal?.end)}, Yamaganda ${t(p.yamaganda?.start)}-${t(p.yamaganda?.end)}, Gulika ${t(p.gulika?.start)}-${t(p.gulika?.end)}`,
    `Abhijit ${t(p.abhijitMuhurat?.start)}-${t(p.abhijitMuhurat?.end)}, Brahma muhurat ${t(p.brahmaMuhurat?.start)}-${t(p.brahmaMuhurat?.end)}`,
    `Day choghadiya: ${p.dayChoghadiya.map(c => `${c.name} ${t(c.start)}-${t(c.end)}`).join(', ')}`,
    `Festivals/vrat: ${p.observances.length ? p.observances.join(', ') : 'none'}`,
  ].join('\n');
}

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

async function runTool(name: string, args: Record<string, unknown>, c: AiContext): Promise<{ result: string; card?: { type: string; payload: unknown } }> {
  switch (name) {
    case 'get_panchang': {
      const p = computePanchang(isDate(args['date']) ? args['date'] : c.today, c.lat, c.lng, c.tz);
      return { result: panchangText(p), card: { type: 'panchang', payload: p } };
    }
    case 'find_muhurat': {
      const from = isDate(args['from_date']) ? args['from_date'] : c.today;
      let to = isDate(args['to_date']) ? args['to_date'] : addDays(from, 60);
      if (to > addDays(from, 180)) to = addDays(from, 180);
      const ev = MUHURAT_EVENTS.find(e => e.id.toLowerCase() === String(args['event'] ?? '').toLowerCase())?.id ?? 'VyaparAarambh';
      const r = findMuhurat(ev, from, to, c.lat, c.lng, c.tz, 12);
      const lines = r.windows.map(w => `- ${w.date} ${w.start.slice(11, 16)}-${w.end.slice(11, 16)} | ${w.tithi}, ${w.nakshatra}, ${w.yoga} yoga | score ${w.score} | ${w.reasons.join('; ')}`);
      return { result: `${r.eventName} muhurats ${r.from} to ${r.to}:\n${lines.join('\n') || 'No windows found in this range.'}${r.notes.length ? '\nNotes: ' + r.notes.join('; ') : ''}\n${r.disclaimer}`, card: { type: 'muhurat', payload: r } };
    }
    case 'get_rashifal': {
      const ri = rashiIndex(String(args['rashi'] ?? ''));
      if (ri === null) return { result: 'Unknown rashi. Ask the user for their Moon sign (rashi) or the first letter of their name.' };
      const period = (['day', 'week', 'month'] as const).find(p => p === args['period']) ?? 'day';
      const date = isDate(args['date']) ? args['date'] : c.today;
      return { result: rashifalContext(ri, date, c.tz, period), card: { type: 'rashifal', payload: { rashi: ri, date, period } } };
    }
    case 'search_scriptures': {
      const hits = await localSearch(String(args['query'] ?? ''), 5);
      if (!hits.length) return { result: 'No matching verses in the library.' };
      return {
        result: hits.map(v => `[${v.citation}]\n${v.sanskrit}\nEN: ${v.translationEn}\nHI: ${v.translationHi}`).join('\n\n'),
        card: { type: 'verses', payload: hits },
      };
    }
    case 'read_granth': {
      const t = await findText(String(args['text'] ?? '')).catch(() => undefined);
      if (!t) return { result: 'That text is not in the library. Answer from general knowledge and say the exact verse could not be checked.' };
      const verse = args['verse'] !== undefined && args['verse'] !== '' ? String(args['verse']) : undefined;
      const r = await readPassage(t.code, String(args['chapter'] ?? '1'), verse, 2).catch(() => null);
      if (!r) return { result: `Chapter "${args['chapter']}" not found in ${t.name}. Check the chapter id format in the tool description.` };
      let body = r.verses.map(v => `[${t.name} ${r.chapter}${/^\d/.test(v[0]) ? '.' + v[0] : ' ' + v[0]}]\n${v[1]}`).join('\n\n');
      if (body.length > 6000) body = body.slice(0, 6000) + `\n… (chapter continues; ask for a verse number to read further)`;
      return { result: `${t.name} (${t.src ?? ''})\n${body}`, card: { type: 'granth', payload: { code: t.code, name: t.name, nameDev: t.nameDev, chapter: r.chapter, verse, verses: r.verses.slice(0, 5) } } };
    }
    case 'get_mantra': {
      const q = String(args['query'] ?? '');
      const m = findMantra(q, await loadMantras(), c.tradition as never, 1);
      if (!m) return { result: `No mantra matching "${q}" in the library.` };
      const verses = m.sanskrit.split('\n\n');
      const text = verses.length > 4 ? verses.slice(0, 3).join('\n\n') + `\n… (${verses.length} verses; full text is in the card shown to the user)` : m.sanskrit;
      return {
        result: `${m.name} (${m.source}) [${m.kind ?? 'mantra'}]\n${text}\nAbout: ${m.meaningEn}\nHindi: ${m.meaningHi}\nWhen: ${m.benefits}\nPronunciation tips: ${m.pronunciationTips}\nRepetitions: ${m.recommendedRepetitions}`,
        card: { type: 'mantra', payload: m },
      };
    }
  }
  return { result: `Unknown tool ${name}` };
}

/** extra: Gemini 3's thought signature ({ google: { thought_signature } }), which must be sent back unchanged. */
interface ToolCall { id: string; name: string; args: string; extra?: unknown; }
type Msg = Record<string, unknown>;

/** One streamed completion. Calls onText for each text piece; returns the finished text and any tool calls. */
async function complete(messages: Msg[], withTools: boolean, onText: (t: string) => void, signal?: AbortSignal): Promise<{ text: string; calls: ToolCall[] }> {
  const body: Record<string, unknown> = { model: aiModel(), messages, stream: true, temperature: 0.6, max_tokens: 1400 };
  if (withTools) { body['tools'] = TOOLS; body['tool_choice'] = 'auto'; }
  const res = await fetch(`${aiBase()}/chat/completions`, {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${aiKey()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw Object.assign(new Error(`AI ${res.status}: ${err.slice(0, 300)}`), { status: res.status, body: err });
  }
  let text = '';
  const calls: ToolCall[] = [];
  const addCall = (tc: { index?: number; id?: string; function?: { name?: string; arguments?: string | object }; extra_content?: unknown }, pos: number) => {
    // Gemini sends whole calls without "index": a new id means a new call
    let i: number;
    if (typeof tc.index === 'number') i = tc.index;
    else if (tc.id) { const k = calls.findIndex(c => c?.id === tc.id); i = k >= 0 ? k : calls.length; }
    else i = calls.length ? calls.length - 1 : pos;
    const c = calls[i] ??= { id: '', name: '', args: '' };
    if (tc.extra_content) c.extra = tc.extra_content;
    if (tc.id) c.id = tc.id;
    if (tc.function?.name) c.name = tc.function.name;
    const a = tc.function?.arguments;
    if (a) c.args += typeof a === 'string' ? a : JSON.stringify(a);
  };
  const handle = (j: { choices?: { delta?: { content?: string; tool_calls?: unknown[] }; message?: { content?: string; tool_calls?: unknown[] } }[] }) => {
    const ch = j.choices?.[0];
    const d = ch?.delta ?? ch?.message;
    if (!d) return;
    if (d.content) { text += d.content; onText(d.content); }
    (d.tool_calls as never[] | undefined)?.forEach((tc, k) => addCall(tc, k));
  };

  const type = res.headers.get('content-type') ?? '';
  if (!res.body || !type.includes('event-stream')) { handle(await res.json()); }
  else {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try { handle(JSON.parse(data)); } catch { /* keep-alive or partial line */ }
      }
    }
  }
  calls.forEach((c, i) => { if (!c.id) c.id = `call_${Date.now()}_${i}`; });
  return { text, calls: calls.filter(c => c && c.name) };
}

/** Conversation memory for follow-up questions (text only, last 12 turns). */
const history: Msg[] = [];
export function clearAiHistory() { history.length = 0; }

const MAX_ROUNDS = 4;

/** Ask PanditJi on the free model. Emits the same events as the .NET hub (delta, card, status, done, error). */
export async function askFreeAi(question: string, c: AiContext, emit: (e: AiEvent) => void): Promise<void> {
  const lang = LANGS[c.language] ?? LANGS['hi'];
  // A reminder right before the model answers keeps the reply in the selected language even after a language switch
  const messages: Msg[] = [{ role: 'system', content: systemPrompt(c) }, ...history,
    { role: 'user', content: `${question}\n\n[App note: reply only in ${lang}, including any question you ask back and the [[NEXT]] suggestions.]` }];
  let full = '';
  let tools = true;
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    let r: { text: string; calls: ToolCall[] };
    try {
      r = await complete(messages, tools && round < MAX_ROUNDS, t => { full += t; emit({ type: 'delta', text: t }); });
    } catch (e) {
      // Some models occasionally write a broken tool call (Groq answers 400 "tool_use_failed"); retry once as plain chat
      const status = (e as { status?: number }).status;
      if (status === 400 && tools) { tools = false; round--; continue; }
      throw e;
    }
    if (!r.calls.length) break;
    messages.push({ role: 'assistant', content: r.text || '', tool_calls: r.calls.map(k => ({ id: k.id, type: 'function', function: { name: k.name, arguments: k.args || '{}' }, ...(k.extra ? { extra_content: k.extra } : {}) })) });
    for (const k of r.calls) {
      emit({ type: 'status', tool: k.name });
      let args: Record<string, unknown> = {};
      try { args = k.args ? JSON.parse(k.args) : {}; } catch { /* model sent bad JSON; tool uses defaults */ }
      let out: Awaited<ReturnType<typeof runTool>>;
      try { out = await runTool(k.name, args, c); } catch (err) { out = { result: `Tool failed: ${(err as Error).message}` }; }
      if (out.card) emit({ type: 'card', cardType: out.card.type, payload: out.card.payload });
      messages.push({ role: 'tool', tool_call_id: k.id, content: out.result });
    }
    if (full && !full.endsWith('\n')) { full += '\n\n'; emit({ type: 'delta', text: '\n\n' }); }
  }
  const answer = full.trim();
  history.push({ role: 'user', content: question }, { role: 'assistant', content: stripFollowups(answer) || '…' });
  if (history.length > 12) history.splice(0, history.length - 12);
  emit({ type: 'done', text: answer });
}
