import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Mantra } from '../core/astro/models';
import { I18nService } from '../core/services/i18n.service';
import { SanskritVoice, SpeechService } from '../core/services/speech.service';
import { NativeService } from '../core/services/native.service';
import { SCRIPT_FOR_LANG, Script, toIast, toScript } from '../core/services/transliterate';
import { FreeItem, archiveTracks, findRecordings } from '../core/services/free-audio';
import { PlayerService } from '../core/services/player.service';

interface Word { w: string; s: number; e: number; l: number; }

const SCRIPTS: { id: Script; label: string }[] = [
  { id: 'deva', label: 'देवनागरी' }, { id: 'iast', label: 'IAST' }, { id: 'roman', label: 'Roman (simple)' },
  { id: 'knda', label: 'ಕನ್ನಡ' }, { id: 'telu', label: 'తెలుగు' }, { id: 'taml', label: 'தமிழ்' },
  { id: 'beng', label: 'বাংলা' }, { id: 'gujr', label: 'ગુજરાતી' }, { id: 'mlym', label: 'മലയാളം' },
];

/** Syllables in a Devanagari word (vowels, plus consonants not followed by a virama). */
function syllables(w: string): number {
  let n = 0; const ch = [...w];
  ch.forEach((c, i) => {
    const code = c.charCodeAt(0);
    if ((code >= 0x904 && code <= 0x914) || code === 0x950) n++;
    else if (code >= 0x915 && code <= 0x939 && ch[i + 1] !== '्') n++;
  });
  return Math.max(1, n);
}

/** Same rule as the server's ChantTiming: duration proportional to syllable count. */
function generateTiming(text: string): Word[] {
  const out: Word[] = [];
  let t = 0;
  text.replace(/\r/g, '').split('\n').filter(l => l.trim()).forEach((line, l) => {
    for (const w of line.split(' ').filter(Boolean)) {
      const dur = syllables(w) * 420;
      out.push({ w, s: t, e: t + dur, l });
      t += dur + 120;
    }
    t += 700;
  });
  return out;
}

@Component({
  selector: 'vp-mantra-player',
  standalone: true,
  imports: [FormsModule],
  template: `
  @if (mantra) {
  <article class="player">
    <header class="ph">
      <div>
        <h3 [class.sa]="i18n.prefersDevanagari()">{{ i18n.prefersDevanagari() ? mantra.nameHi : mantra.name }}</h3>
        <p class="src">{{ i18n.t('source') }}: {{ mantra.source }}</p>
      </div>
      <label class="script">
        <span class="sr-only">{{ i18n.t('script') }}</span>
        <select class="input" [ngModel]="script()" (ngModelChange)="script.set($event)" [attr.aria-label]="i18n.t('script')">
          @for (s of scripts; track s.id) { <option [value]="s.id">{{ s.label }}</option> }
        </select>
      </label>
    </header>

    @if (isLong()) {
      <div class="vnav">
        <button type="button" class="nav" (click)="go(vi() - 1)" [disabled]="vi() === 0" [attr.aria-label]="i18n.t('prevVerse')">‹</button>
        <span class="vof num">{{ i18n.f('verseOf', { n: '' + (vi() + 1), total: '' + verses().length }) }}</span>
        <button type="button" class="nav" (click)="go(vi() + 1)" [disabled]="vi() >= verses().length - 1" [attr.aria-label]="i18n.t('nextVerse')">›</button>
        <input type="range" class="seek" min="1" [max]="verses().length" [ngModel]="vi() + 1" (ngModelChange)="go(+$event - 1)" [attr.aria-label]="i18n.t('verseOf')">
      </div>
    }

    <div class="text" [class.big]="!compact">
      @for (line of lines(); track $index) {
        <p class="line">
          @for (w of line; track w.i) {
            <span class="w" [class.on]="w.i === current()" [class.done]="w.i < current()">
              <span class="main" [class.sa]="script() !== 'iast' && script() !== 'roman'">{{ w.main }}</span>
              @if (script() !== 'iast' && script() !== 'roman') { <span class="rom">{{ w.iast }}</span> }
            </span>
          }
        </p>
      }
    </div>

    <div class="controls">
      <button class="btn" type="button" (click)="toggle()">{{ playing() && !voiceOn() ? i18n.t('pause') : i18n.t('play') }}</button>
      <button class="btn ghost" type="button" (click)="restart()">{{ i18n.t('restart') }}</button>
      <label class="tempo">
        <span>{{ i18n.t('tempo') }} {{ tempo().toFixed(1) }}×</span>
        <input type="range" min="0.5" max="1.5" step="0.1" [ngModel]="tempo()" (ngModelChange)="setTempo(+$event)">
      </label>
      @if (!mantra.audioUrl && voice()) {
        <button class="btn quiet" type="button" (click)="toggleVoice()" [attr.aria-pressed]="voiceOn()">
          {{ voiceOn() ? i18n.t('stopReading') : i18n.t('voice') }}
        </button>
      }
      @if (mantra.audioUrl) { <audio #audio [src]="mantra.audioUrl" preload="metadata" (ended)="onAudioEnded()"></audio> }
    </div>
    @if (mantra.audioUrl && mantra.audioCredit) {
      @if (isAi()) { <p class="vnote ai">🤖 {{ i18n.prefersDevanagari() ? 'AI स्वर (AI4Bharat) — कंप्यूटर द्वारा बना; पंडित जी की रिकॉर्डिंग मिलने पर बदल दिया जाएगा।' : mantra.audioCredit }}</p> }
      @else { <p class="vnote rec">🎙 {{ mantra.audioCredit }}</p> }
    }
    @if (mantra.syncText === false) { <p class="vnote">{{ i18n.t('textComing') }}</p> }
    @if (!mantra.audioUrl) {
      @if (voice(); as v) { <p class="vnote">{{ i18n.f('voiceIs', { v: v.name }) }}</p> }
      @else if (voiceChecked() && !compact) { <p class="vnote">{{ native.isApp ? i18n.t('voiceNone') : i18n.t('voiceNoneWeb') }}</p> }
    }

    @if (!compact && (recs().length || recsLoading())) {
      <section class="recs">
        <h4>🎧 {{ i18n.prefersDevanagari() ? 'असली रिकॉर्डिंग (मुक्त संग्रह से)' : 'Real recordings (free libraries)' }}</h4>
        @if (recsLoading()) { <p class="vnote">{{ i18n.t('loading') }}</p> }
        <ul>
          @for (r of recs(); track r.id) {
            <li>
              <button type="button" class="rp" (click)="playRec(r)" [disabled]="opening() === r.id" [attr.aria-label]="i18n.t('play')">{{ opening() === r.id ? '…' : recPlaying(r) && audio.playing() ? '❚❚' : '▶' }}</button>
              <span class="rt"><b>{{ r.title }}</b><small><a [href]="r.page" target="_blank" rel="noopener">{{ r.source === 'ia' ? 'archive.org' : 'Wikimedia Commons' }}</a> · {{ r.license }}@if (r.creator) { · {{ r.creator }} }</small></span>
            </li>
          }
        </ul>
        <p class="vnote">{{ i18n.prefersDevanagari() ? 'ये रिकॉर्डिंग मुक्त लाइसेंस वाले संग्रहों से हैं; उच्चारण व पाठ अलग हो सकता है।' : 'From freely licensed collections; the reciter\'s style and text may differ from the words above.' }}</p>
      </section>
    }

    @if (!compact && !isLong()) {
    <div class="japa">
      <button type="button" class="bead" (click)="countUp()" [attr.aria-label]="i18n.t('count')">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="8"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--tulsi)" stroke-width="8" stroke-linecap="round"
            [attr.stroke-dasharray]="ring()" transform="rotate(-90 60 60)"/>
        </svg>
        <span class="cnt num">{{ count() }}<small>/{{ mantra.recommendedRepetitions }}</small></span>
      </button>
      <p class="muted">{{ i18n.t('tapToCount') }}</p>
    </div>
    }

    <dl class="info">
      <dt>{{ i18n.t('meaning') }}</dt>
      <dd>{{ i18n.prefersDevanagari() ? mantra.meaningHi : mantra.meaningEn }}</dd>
      <dt>{{ i18n.t('pronunciation') }}</dt>
      <dd>{{ mantra.pronunciationTips }}</dd>
      @if (!compact) { <dt>{{ i18n.t('benefits') }}</dt><dd>{{ mantra.benefits }}</dd> }
      @if (mantra.credit && !compact) { <dt>{{ i18n.t('textCredit') }}</dt><dd class="faint">{{ mantra.credit }}</dd> }
    </dl>

    @if (isLong() && !compact) {
      <details class="full">
        <summary>{{ i18n.t('fullText') }} ({{ verses().length }})</summary>
        <ol>
          @for (v of verses(); track $index) {
            <li [class.on]="$index === vi()"><button type="button" (click)="go($index)" [class.sa]="script() !== 'iast' && script() !== 'roman'">{{ show(v) }}</button></li>
          }
        </ol>
      </details>
    }
  </article>
  }`,
  styles: [`
    .player { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-md); padding: 20px; }
    .ph { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .ph h3 { margin: 0; }
    .ph h3.sa { font-weight: 400; font-size: 1.4rem; }
    .src { color: var(--faint); font-size: var(--s-1); margin: 2px 0 0; }
    .script select { width: auto; min-width: 150px; }
    .vnav { display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .nav { width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid var(--line); background: var(--card); font-size: 1.4rem; line-height: 1; cursor: pointer; color: var(--ink); }
    .nav:disabled { opacity: .4; cursor: default; }
    .vof { font-weight: 600; color: var(--ink); min-width: 7.5em; }
    .seek { flex: 1; min-width: 120px; accent-color: var(--sindoor); }
    .text { background: var(--ink); color: #F6F4FA; border-radius: var(--r-md); padding: 20px 18px; margin: 16px 0; }
    .line { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0 0 12px; max-width: none; }
    .line:last-child { margin-bottom: 0; }
    .w { display: inline-flex; flex-direction: column; align-items: flex-start; padding: 2px 4px; border-radius: 6px; transition: background-color .15s, color .15s; }
    .main { font-size: 1.35rem; line-height: 1.5; color: rgba(246,244,250,.78); }
    .big .main { font-size: 1.75rem; }
    .rom { font-size: .8rem; color: rgba(246,244,250,.55); }
    .w.done .main { color: #F6F4FA; }
    .w.on { background: var(--haldi); }
    .w.on .main, .w.on .rom { color: var(--ink); }
    .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .tempo { display: flex; flex-direction: column; font-size: var(--s-1); color: var(--muted); min-width: 140px; }
    .tempo input { accent-color: var(--sindoor); }
    .vnote { font-size: .8rem; color: var(--faint); margin: 8px 0 0; max-width: 70ch; }
    .vnote.rec { color: var(--tulsi); font-weight: 600; }
    .vnote.ai { color: var(--muted); font-weight: 600; }
    .recs { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 12px; }
    .recs h4 { margin: 0 0 8px; font-size: 1rem; }
    .recs ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .recs li { display: flex; gap: 10px; align-items: center; min-width: 0; }
    .rp { width: 36px; height: 36px; flex: none; border-radius: 50%; border: 0; background: var(--ink); color: #fff; cursor: pointer; font-size: .85rem; }
    .rt { display: flex; flex-direction: column; min-width: 0; }
    .rt b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rt small { color: var(--muted); } .rt a { color: var(--sindoor); text-decoration: none; }
    .japa { display: flex; align-items: center; gap: 16px; margin-top: 18px; }
    .japa p { margin: 0; }
    .bead { position: relative; width: 92px; height: 92px; border: 0; background: none; padding: 0; cursor: pointer; border-radius: 50%; }
    .bead svg { width: 100%; height: 100%; }
    .bead circle:last-child { transition: stroke-dasharray .25s; }
    .cnt { position: absolute; inset: 0; display: flex; align-items: baseline; justify-content: center; padding-top: 34px; font-weight: 700; font-size: 1.3rem; color: var(--ink); }
    .cnt small { font-size: .7rem; color: var(--faint); font-weight: 500; }
    .info { margin: 18px 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
    .info dt { color: var(--muted); font-weight: 600; }
    .info dd { margin: 0; max-width: 66ch; }
    .full { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 12px; }
    .full summary { cursor: pointer; font-weight: 600; color: var(--sindoor); }
    .full ol { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 4px; max-height: 60vh; overflow: auto; }
    .full li button { text-align: left; width: 100%; background: none; border: 0; border-left: 3px solid transparent; padding: 8px 10px; cursor: pointer;
      white-space: pre-line; font: inherit; color: var(--text); line-height: 1.6; border-radius: 4px; }
    .full li button.sa { font-family: var(--sanskrit); font-size: 1.05rem; }
    .full li button:hover { background: var(--paper); }
    .full li.on button { border-left-color: var(--sindoor); background: var(--paper); }
    @media (max-width: 560px) { .info { grid-template-columns: 1fr; } .info dd { margin-bottom: 8px; } .main { font-size: 1.2rem; } .big .main { font-size: 1.45rem; } }
  `],
})
export class MantraPlayerComponent implements OnChanges, OnDestroy {
  @Input() mantra?: Mantra;
  @Input() compact = false;
  @ViewChild('audio') audioRef?: ElementRef<HTMLAudioElement>;

  readonly i18n = inject(I18nService);
  readonly speech = inject(SpeechService);
  readonly native = inject(NativeService);
  readonly audio = inject(PlayerService);
  readonly recs = signal<FreeItem[]>([]);
  readonly recsLoading = signal(false);
  readonly opening = signal('');
  private recRun = 0;
  readonly scripts = SCRIPTS;
  readonly script = signal<Script>(SCRIPT_FOR_LANG[this.i18n.lang()] ?? 'deva');
  readonly verses = signal<string[]>([]);
  readonly vi = signal(0);
  readonly words = signal<Word[]>([]);
  readonly current = signal(-1);
  readonly playing = signal(false);
  readonly voiceOn = signal(false);
  readonly tempo = signal(1);
  readonly count = signal(0);
  readonly voice = signal<SanskritVoice>(null);
  readonly voiceChecked = signal(false);

  private raf = 0;
  private startedAt = 0;
  private offsetMs = 0;
  private voiceRun = 0;

  constructor() {
    this.speech.sanskritVoice().then(v => { this.voice.set(v); this.voiceChecked.set(true); });
  }

  /** Stotras, chalisas and aartis are read verse by verse. */
  readonly isLong = computed(() => this.verses().length > 1);

  readonly lines = computed(() => {
    const byLine: { i: number; main: string; iast: string }[][] = [];
    this.words().forEach((w, i) => {
      (byLine[w.l] ??= []).push({ i, main: toScript(w.w, this.script()), iast: toIast(w.w) });
    });
    return byLine.filter(Boolean);
  });
  readonly ring = computed(() => {
    const total = this.mantra?.recommendedRepetitions || 108;
    const c = 2 * Math.PI * 52;
    return `${(Math.min(this.count(), total) / total) * c} ${c}`;
  });

  ngOnChanges() {
    this.stopAll();
    this.count.set(0);
    if (!this.mantra) return;
    const v = this.mantra.sanskrit.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    this.verses.set(v.length ? v : [this.mantra.sanskrit]);
    this.load(0);
    this.loadRecordings();
  }

  readonly isAi = () => (this.mantra?.audioCredit ?? '').startsWith('AI voice');

  /** Real recordings of this text from Wikimedia Commons / Internet Archive (not for a human recording we already have). */
  private loadRecordings() {
    const run = ++this.recRun;
    this.recs.set([]);
    if (this.compact || !this.mantra || (this.mantra.audioUrl && !this.isAi())) return;
    this.recsLoading.set(true);
    findRecordings(this.mantra.name).then(l => { if (run === this.recRun) this.recs.set(l); })
      .catch(() => undefined).finally(() => { if (run === this.recRun) this.recsLoading.set(false); });
  }
  recPlaying(r: FreeItem) { const c = this.audio.current(); return !!c && c.id.startsWith(r.id + '#'); }
  async playRec(r: FreeItem) {
    if (this.recPlaying(r)) { this.audio.toggle(); return; }
    this.pause(); this.stopAll();
    this.opening.set(r.id);
    try { const l = r.tracks ?? await archiveTracks(r); if (l.length) this.audio.play(l, 0); }
    catch { /* unreachable */ } finally { this.opening.set(''); }
  }
  ngOnDestroy() { this.stopAll(); }

  show(v: string) { return toScript(v, this.script()); }

  private load(i: number) {
    this.vi.set(i);
    let timing: Word[] = [];
    if (!this.isLong()) { try { timing = JSON.parse(this.mantra?.timingJson || '[]'); } catch { timing = []; } }
    this.words.set(timing.length ? timing : generateTiming(this.verses()[i] ?? ''));
    this.current.set(-1);
    this.offsetMs = 0;
  }

  go(i: number) {
    if (i < 0 || i >= this.verses().length) return;
    const audio = this.audioRef?.nativeElement;
    if (audio && audio.duration) {
      // jump the recording to where this verse starts (same proportion rule as followAudio)
      const per = this.verses().map(v => { const w = generateTiming(v); return w.length ? w[w.length - 1].e + 700 : 0; });
      const total = per.reduce((x, y) => x + y, 0);
      audio.currentTime = (per.slice(0, i).reduce((x, y) => x + y, 0) / total) * audio.duration;
      this.load(i);
      return;
    }
    const wasVoice = this.voiceOn(), wasPlaying = this.playing();
    this.stopAll();
    this.load(i);
    if (wasVoice) this.toggleVoice(); else if (wasPlaying) this.play();
  }

  private get totalMs() { const w = this.words(); return w.length ? w[w.length - 1].e : 0; }

  toggle() {
    if (this.voiceOn()) { this.stopAll(); this.play(); return; }
    this.playing() ? this.pause() : this.play();
  }

  play() {
    const audio = this.audioRef?.nativeElement;
    if (audio) { audio.playbackRate = this.tempo(); audio.play(); }
    this.startedAt = performance.now();
    this.playing.set(true);
    const tick = () => {
      if (audio) { if (this.mantra?.syncText !== false) this.followAudio(audio); this.raf = requestAnimationFrame(tick); return; }
      const elapsed = this.offsetMs + (performance.now() - this.startedAt) * this.tempo();
      const idx = this.words().findIndex(w => elapsed >= w.s && elapsed < w.e + 120);
      if (idx >= 0) this.current.set(idx);
      if (!audio && elapsed >= this.totalMs) { this.onEnded(); return; }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    cancelAnimationFrame(this.raf);
    this.audioRef?.nativeElement.pause();
    this.offsetMs += (performance.now() - this.startedAt) * this.tempo();
    this.playing.set(false);
  }

  private stopAll() {
    cancelAnimationFrame(this.raf);
    this.playing.set(false);
    this.offsetMs = 0;
    if (this.voiceOn()) { this.voiceRun++; this.voiceOn.set(false); this.speech.stopSpeaking(); }
  }

  restart() {
    const wasVoice = this.voiceOn();
    this.stopAll();
    const a = this.audioRef?.nativeElement;
    if (a) a.currentTime = 0;
    this.load(0);
    wasVoice ? this.toggleVoice() : this.play();
  }

  /** End of the text (or of one verse): stotras move on to the next verse, mantras count one japa. */
  onEnded() {
    cancelAnimationFrame(this.raf);
    this.playing.set(false);
    this.offsetMs = 0;
    this.current.set(this.words().length);
    if (this.isLong() && this.vi() < this.verses().length - 1) {
      setTimeout(() => { this.load(this.vi() + 1); this.play(); }, 600);
      return;
    }
    this.count.update(c => c + 1);
  }

  /**
   * A recorded chant (e.g. your guru's voice) drives the highlighting: the recording's progress is spread over
   * every verse in proportion to its syllables, so the right verse opens and the right word lights up.
   */
  private followAudio(audio: HTMLAudioElement) {
    const dur = audio.duration;
    if (!dur || !isFinite(dur)) return;
    const per = this.verses().map(v => { const w = generateTiming(v); return w.length ? w[w.length - 1].e + 700 : 0; });
    const total = per.reduce((a, b) => a + b, 0);
    let at = (audio.currentTime / dur) * total, vi = 0;
    while (vi < per.length - 1 && at >= per[vi]) { at -= per[vi]; vi++; }
    if (vi !== this.vi()) { this.vi.set(vi); this.words.set(generateTiming(this.verses()[vi] ?? '')); }
    const idx = this.words().findIndex(w => at >= w.s && at < w.e + 120);
    if (idx >= 0) this.current.set(idx);
  }

  onAudioEnded() {
    cancelAnimationFrame(this.raf);
    this.playing.set(false);
    this.current.set(this.words().length);
    this.count.update(c => c + 1);
  }

  setTempo(v: number) {
    if (this.playing() && !this.voiceOn()) { this.pause(); this.tempo.set(v); this.play(); }
    else this.tempo.set(v);
    const a = this.audioRef?.nativeElement;
    if (a) a.playbackRate = v;
  }

  countUp() { this.count.update(c => c + 1); if (navigator.vibrate) navigator.vibrate(15); }

  /**
   * Voice guide: the device's Hindi/Sanskrit voice reads one line at a time and the words of that line light up
   * in step (spread by syllable count, since speech engines don't report word timings reliably).
   */
  async toggleVoice() {
    if (this.voiceOn()) { this.stopAll(); return; }
    if (!this.voice()) return;
    cancelAnimationFrame(this.raf);
    this.playing.set(false);
    this.voiceOn.set(true);
    const run = ++this.voiceRun;
    const alive = () => run === this.voiceRun;
    for (let vi = this.vi(); vi < this.verses().length && alive(); vi++) {
      if (vi !== this.vi()) this.load(vi);
      const words = this.words();
      const lineIds = [...new Set(words.map(w => w.l))];
      for (const l of lineIds) {
        if (!alive()) return;
        const idx = words.map((w, i) => ({ w, i })).filter(x => x.w.l === l);
        const text = idx.map(x => x.w.w).join(' ');
        const rate = 0.75 * this.tempo();
        // estimated time per syllable for a Hindi voice at this rate
        const per = 230 / rate;
        let t = 0;
        const timers = idx.map(x => { const at = t; t += syllables(x.w.w) * per; return setTimeout(() => alive() && this.current.set(x.i), at); });
        this.current.set(idx[0].i);
        await this.speech.speakSanskritLine(text, rate);
        timers.forEach(clearTimeout);
        if (!alive()) return;
        this.current.set(idx[idx.length - 1].i + 1);
        await new Promise(r => setTimeout(r, 250));
      }
      if (!this.isLong()) break;
    }
    if (alive()) { this.voiceOn.set(false); this.speech.speaking.set(false); this.count.update(c => c + 1); }
  }
}
