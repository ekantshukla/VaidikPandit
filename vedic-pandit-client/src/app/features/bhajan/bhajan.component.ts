import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AccountService } from '../../core/services/account.service';
import { PlayerService, Track, TrackKind, devotionalStations } from '../../core/services/player.service';
import { DEITIES } from '../../core/data/deities';
import { useTx } from '../booking/booking-ui';

type Tab = 'rec' | 'radio';
/** Lower-case, and fold common Roman spelling variants so "Shiv"/"Shiva", "Jagdish"/"Jagadish", "aarti"/"arti" match. */
const norm = (s: string) => (s || '').toLowerCase().replace(/[.,()·:;!?'"\-–—]/g, ' ')
  .replace(/aa/g, 'a').replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/([bcdghjklmnprstvy])a(?=[bcdghjklmnprstvy]|\b)/g, '$1').replace(/\s+/g, ' ').trim();
const KINDS: { id: TrackKind | ''; en: string; hi: string }[] = [
  { id: '', en: 'All', hi: 'सभी' }, { id: 'aarti', en: 'Aarti', hi: 'आरती' }, { id: 'bhajan', en: 'Bhajan', hi: 'भजन' },
  { id: 'stotra', en: 'Stotra', hi: 'स्तोत्र' }, { id: 'kirtan', en: 'Kirtan', hi: 'कीर्तन' }, { id: 'mantra', en: 'Mantra', hi: 'मंत्र' },
];

/** Bhajan & Aarti: our own recordings and 24×7 devotional radio, in an ad-free player. */
@Component({
  selector: 'vp-bhajan',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
  <div class="wrap page">
    <header class="hero">
      <span class="ic" aria-hidden="true">🪔</span>
      <div>
        <h1>{{ t.tx('Bhajan & Aarti', 'भजन व आरती') }}</h1>
        <p class="lead">{{ t.tx('Listen without ads, right here. Music keeps playing while you open the panchang or other pages; use the player at the bottom.',
          'बिना विज्ञापन के, यहीं सुनें। पंचांग या दूसरे पेज खोलने पर भी भजन चलता रहता है; नीचे के प्लेयर से चलाएँ या रोकें।') }}</p>
      </div>
    </header>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [class.on]="tab() === 'rec'" [attr.aria-selected]="tab() === 'rec'" (click)="tab.set('rec')">🎵 {{ t.tx('Recordings', 'रिकॉर्डिंग') }}</button>
      <button type="button" role="tab" [class.on]="tab() === 'radio'" [attr.aria-selected]="tab() === 'radio'" (click)="openRadio()">📻 {{ t.tx('24×7 Bhajan Radio', '24×7 भजन रेडियो') }}</button>
    </div>

    @if (tab() === 'rec') {
      <div class="search">
        <input class="input" type="search" [(ngModel)]="rq" [placeholder]="t.tx('Search bhajans & aartis (e.g. Jagdish, Hanuman, Shiv)…', 'भजन व आरती खोजें (जैसे जगदीश, हनुमान, शिव)…')" aria-label="Search">
      </div>
      <div class="chips">
        @for (k of kinds; track k.id) { <button type="button" class="chip" [class.on]="kind() === k.id" (click)="kind.set(k.id)">{{ t.tx(k.en, k.hi) }}</button> }
      </div>
      @if (shown().length) {
        <button type="button" class="btn playall" (click)="player.play(shown(), 0)">▶ {{ t.tx('Play all', 'सब चलाएँ') }} ({{ shown().length }})</button>
        <ul class="list">
          @for (tr of shown(); track tr.id; let i = $index) {
            <li [class.now]="player.isCurrent(tr)">
              <button type="button" class="pl" (click)="playAt(i)" [attr.aria-label]="t.tx('Play', 'चलाएँ')">{{ player.isCurrent(tr) && player.playing() ? '❚❚' : '▶' }}</button>
              <span class="ti">
                <b [class.sa]="t.hi() && !!tr.titleHi">{{ t.hi() ? (tr.titleHi || tr.title) : tr.title }}</b>
                <small>{{ kindName(tr.kind) }}@if (deityName(tr.deity)) { · {{ deityName(tr.deity) }} }@if (tr.credit) { · {{ tr.credit }} }</small>
              </span>
              @if (acc.isAdmin() && tr.id.startsWith('fs:')) { <button type="button" class="del" (click)="remove(tr)" [title]="t.tx('Remove', 'हटाएँ')">🗑</button> }
            </li>
          }
        </ul>
      } @else if (rqs().trim()) {
        <div class="panel empty">
          <p>{{ t.tx('Nothing found for "' + rqs().trim() + '". Try another word, or listen on the 24×7 Bhajan Radio.', '"' + rqs().trim() + '" से कुछ नहीं मिला। दूसरा शब्द आज़माएँ, या 24×7 भजन रेडियो सुनें।') }}</p>
          <button type="button" class="btn quiet" (click)="rq = ''">✕ {{ t.tx('Clear search', 'खोज हटाएँ') }}</button>
        </div>
      } @else {
        <div class="panel empty">
          <p>{{ t.tx('More aartis and bhajans are being added. Meanwhile, try the 24×7 Bhajan Radio.', 'और आरतियाँ व भजन जोड़े जा रहे हैं। तब तक 24×7 भजन रेडियो सुनें।') }}</p>
          <button type="button" class="btn quiet" (click)="openRadio()">📻 {{ t.tx('Open Bhajan Radio', 'भजन रेडियो खोलें') }}</button>
        </div>
      }

      @if (acc.isAdmin()) {
        <details class="panel admin">
          <summary>🛡️ {{ t.tx('Admin: add a recording', 'एडमिन: रिकॉर्डिंग जोड़ें') }}</summary>
          <form class="stack" (ngSubmit)="add()">
            <div class="row2">
              <div class="field"><label for="tt">{{ t.tx('Title (English)', 'शीर्षक (अंग्रेज़ी)') }}</label><input id="tt" class="input" name="tt" [(ngModel)]="f.title" required></div>
              <div class="field"><label for="th">{{ t.tx('Title (Hindi)', 'शीर्षक (हिंदी)') }}</label><input id="th" class="input" name="th" [(ngModel)]="f.titleHi"></div>
            </div>
            <div class="row2">
              <div class="field"><label for="tk">{{ t.tx('Type', 'प्रकार') }}</label>
                <select id="tk" class="input" name="tk" [(ngModel)]="f.kind">@for (k of kinds.slice(1); track k.id) { <option [value]="k.id">{{ t.tx(k.en, k.hi) }}</option> }</select></div>
              <div class="field"><label for="td">{{ t.tx('Deity', 'देवता') }}</label>
                <select id="td" class="input" name="td" [(ngModel)]="f.deity"><option value="">—</option>@for (d of deities; track d.id) { <option [value]="d.id">{{ d.icon }} {{ t.hi() ? d.hi : d.en }}</option> }</select></div>
            </div>
            <div class="field"><label for="tu">{{ t.tx('Audio link (MP3/M4A)', 'ऑडियो लिंक (MP3/M4A)') }}</label>
              <input id="tu" class="input" name="tu" [(ngModel)]="f.url" placeholder="audio/om-jai-jagdish.mp3  or  https://…/aarti.mp3" required></div>
            <div class="field"><label for="tc">{{ t.tx('Singer / credit', 'गायक / श्रेय') }}</label>
              <input id="tc" class="input" name="tc" [(ngModel)]="f.credit" [placeholder]="t.tx('e.g. Voice: Pt. … (with permission)', 'जैसे स्वर: पं. … (अनुमति से)')"></div>
            @if (msg()) { <p [class]="ok() ? 'okmsg' : 'err'">{{ msg() }}</p> }
            <div class="actions">
              <button type="submit" class="btn" [disabled]="busy()">➕ {{ t.tx('Add recording', 'रिकॉर्डिंग जोड़ें') }}</button>
              @if (f.url) { <button type="button" class="btn ghost" (click)="preview()">▶ {{ t.tx('Test link', 'लिंक जाँचें') }}</button> }
            </div>
            <p class="note">{{ t.tx('Add only recordings you have the right to share: your own, your Guru ji’s with permission, or ones marked free to use (Creative Commons / public domain). Files placed in the repo folder vedic-pandit-client/public/audio are linked as audio/FILE-NAME.mp3.',
              'केवल वही रिकॉर्डिंग जोड़ें जिन्हें साझा करने का अधिकार हो: अपनी, अनुमति से गुरु जी की, या मुफ़्त उपयोग वाली (Creative Commons / सार्वजनिक)। रिपॉज़िटरी के vedic-pandit-client/public/audio फ़ोल्डर की फ़ाइलें audio/FILE-NAME.mp3 लिखकर जुड़ती हैं।') }}</p>
          </form>
        </details>
      }
    } @else {
      <div class="search">
        <input class="input" [(ngModel)]="q" [placeholder]="t.tx('Search stations (e.g. Krishna, Shiv, Gurbani)…', 'स्टेशन खोजें (जैसे कृष्ण, शिव, गुरबाणी)…')" aria-label="Search">
      </div>
      @if (radioLoading()) { <p class="muted">{{ t.tx('Finding live bhajan stations…', 'लाइव भजन स्टेशन खोजे जा रहे हैं…') }}</p> }
      @else if (!stations().length) {
        <div class="panel empty"><p>{{ t.tx("Couldn't reach the radio directory. Check your internet and try again.", 'रेडियो सूची तक नहीं पहुँच सके। इंटरनेट जाँचकर फिर प्रयास करें।') }}</p>
          <button type="button" class="btn quiet" (click)="reloadRadio()">↻ {{ t.tx('Try again', 'फिर प्रयास करें') }}</button></div>
      } @else {
        <ul class="list">
          @for (s of filtered(); track s.id; let i = $index) {
            <li [class.now]="player.isCurrent(s)">
              <button type="button" class="pl" (click)="playStation(s)" [attr.aria-label]="t.tx('Play', 'चलाएँ')">{{ player.isCurrent(s) && player.playing() ? '❚❚' : '▶' }}</button>
              @if (s.favicon) { <img class="fav" [src]="s.favicon" alt="" width="36" height="36" loading="lazy" (error)="$any($event.target).style.display = 'none'"> }
              <span class="ti"><b>{{ s.title }}</b><small><i class="live">● LIVE</i> {{ s.info }}</small></span>
            </li>
          } @empty { <li class="none">{{ t.tx('No station matches that search.', 'इस खोज से कोई स्टेशन नहीं मिला।') }}</li> }
        </ul>
        <p class="note">{{ t.tx('Live stations from the open Radio Browser directory, played inside Vaidik Pandit with no ads on our side. A station may include its own announcements; if one does not play, try another.',
          'लाइव स्टेशन खुली Radio Browser सूची से हैं और वैदिक पंडित के अंदर बिना हमारी ओर के विज्ञापन के चलते हैं। किसी स्टेशन में उसकी अपनी घोषणाएँ हो सकती हैं; कोई न चले तो दूसरा चुनें।') }}</p>
      }
    }
    <p class="more"><a routerLink="/learn">📿 {{ t.tx('Read aarti, chalisa and mantra texts by deity', 'देवता के अनुसार आरती, चालीसा और मंत्र पढ़ें') }} →</a></p>
  </div>`,
  styles: [`
    .hero { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
    .hero .ic { font-size: 2.6rem; line-height: 1; } .hero h1 { margin: 0 0 6px; }
    .lead { margin: 0; color: var(--muted); max-width: 70ch; }
    .tabs { display: inline-flex; background: var(--card); border: 1.5px solid var(--line); border-radius: 999px; padding: 4px; margin-bottom: 14px; max-width: 100%; }
    .tabs button { border: 0; background: none; padding: 9px 16px; border-radius: 999px; font: inherit; font-weight: 600; color: var(--muted); cursor: pointer; white-space: nowrap; }
    .tabs button.on { background: var(--ink); color: #fff; }
    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin-bottom: 12px; }
    .chip { flex: none; padding: 6px 14px; border-radius: 999px; border: 1.5px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-weight: 600; font-size: .9rem; cursor: pointer; }
    .chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
    .playall { margin-bottom: 10px; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .list li { display: flex; gap: 12px; align-items: center; padding: 10px 12px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; min-width: 0; }
    .list li.now { border-color: var(--haldi); box-shadow: 0 0 0 2px var(--haldi-soft); }
    .pl { width: 42px; height: 42px; flex: none; border-radius: 50%; border: 0; background: var(--sindoor); color: #fff; font-size: .95rem; cursor: pointer; display: grid; place-items: center; }
    .now .pl { background: var(--tulsi); }
    .fav { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex: none; background: var(--paper); }
    .ti { min-width: 0; flex: 1; display: flex; flex-direction: column; }
    .ti b { color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ti b.sa { font-weight: 400; font-size: 1.08rem; }
    .ti small { color: var(--muted); font-size: .8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .live { font-style: normal; color: var(--sindoor); font-weight: 700; margin-right: 4px; }
    .del { border: 0; background: none; cursor: pointer; font-size: 1.1rem; }
    .none { justify-content: center; color: var(--muted); }
    .empty { text-align: center; } .empty p { margin: 0 0 12px; color: var(--muted); }
    .search { margin-bottom: 12px; }
    .admin { margin-top: 18px; } .admin summary { cursor: pointer; font-weight: 600; color: var(--ink); } .admin form { margin-top: 12px; }
    .stack { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
    .row2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .err { color: var(--sindoor); margin: 0; } .okmsg { color: var(--tulsi); margin: 0; }
    .note { font-size: var(--s-1); color: var(--faint); margin: 12px 0 0; }
    .more { margin-top: 22px; } .more a { color: var(--sindoor); font-weight: 600; text-decoration: none; }
    @media (max-width: 560px) { .row2 { grid-template-columns: minmax(0, 1fr); } .tabs button { padding: 8px 12px; font-size: .92rem; } }
  `],
})
export class BhajanComponent {
  readonly t = useTx();
  readonly player = inject(PlayerService);
  readonly acc = inject(AccountService);
  private api = inject(ApiService);
  readonly kinds = KINDS;
  readonly deities = DEITIES;
  readonly tab = signal<Tab>('rec');
  readonly kind = signal<TrackKind | ''>('');
  readonly builtIn = signal<Track[]>([]);
  readonly added = signal<Track[]>([]);
  readonly stations = signal<Track[]>([]);
  readonly radioLoading = signal(false);
  readonly busy = signal(false);
  readonly msg = signal('');
  readonly ok = signal(false);
  private readonly qs = signal('');
  get q() { return this.qs(); } set q(v: string) { this.qs.set(v); }
  f = { title: '', titleHi: '', kind: 'aarti' as TrackKind, deity: '', url: '', credit: '' };

  constructor() {
    // Recordings that ship with the site: every mantra / stotra that has an audio file
    this.api.mantras().then(list => this.builtIn.set(list.filter(m => !!m.audioUrl).map(m => ({
      id: 'm:' + m.slug, title: m.name, titleHi: m.nameHi, kind: (m.kind === 'chalisa' ? 'stotra' : m.kind ?? 'mantra') as TrackKind,
      deity: DEITIES.find(d => d.re.test(m.deity))?.id, url: m.audioUrl!, credit: m.audioCredit?.replace(/^Voice:\s*/i, ''),
    }))));
    if (this.acc.configured) this.loadAdded();
  }

  private loadAdded() { this.acc.listTracks().then(l => this.added.set(l)).catch(() => this.added.set([])); }

  readonly all = computed(() => [...this.added(), ...this.builtIn()]);
  readonly rqs = signal('');
  get rq() { return this.rqs(); } set rq(v: string) { this.rqs.set(v); }
  /** Search matches English or Hindi title, deity (English, Hindi or id), type and singer; Roman spelling variants like Shiv/Shiva, Jagdish/Jagadish. */
  readonly shown = computed(() => {
    const k = this.kind();
    const words = norm(this.rqs()).split(' ').filter(Boolean);
    return this.all().filter(x => {
      if (k && x.kind !== k) return false;
      if (!words.length) return true;
      const d = DEITIES.find(y => y.id === x.deity);
      const kk = KINDS.find(y => y.id === x.kind);
      const hay = norm([x.title, x.titleHi, x.credit, x.deity, d?.en, d?.hi, kk?.en, kk?.hi].filter(Boolean).join(' '));
      return words.every(w => hay.includes(w));
    });
  });
  readonly filtered = computed(() => {
    const q = this.qs().trim().toLowerCase();
    return q ? this.stations().filter(s => (s.title + ' ' + (s.info ?? '')).toLowerCase().includes(q)) : this.stations();
  });

  kindName(k: TrackKind) { const x = KINDS.find(y => y.id === k); return x ? this.t.tx(x.en, x.hi) : ''; }
  deityName(id?: string) { const d = DEITIES.find(x => x.id === id); return d ? `${d.icon} ${this.t.hi() ? d.hi : d.en}` : ''; }

  playAt(i: number) {
    const tr = this.shown()[i];
    if (this.player.isCurrent(tr)) this.player.toggle(); else this.player.play(this.shown(), i);
  }
  playStation(s: Track) {
    if (this.player.isCurrent(s)) this.player.toggle(); else this.player.play(this.filtered(), this.filtered().indexOf(s));
  }
  openRadio() {
    this.tab.set('radio');
    if (!this.stations().length && !this.radioLoading()) this.reloadRadio();
  }
  reloadRadio() {
    this.radioLoading.set(true);
    devotionalStations().then(l => this.stations.set(l)).finally(() => this.radioLoading.set(false));
  }

  preview() { this.player.play([{ id: 'preview', title: this.f.title || 'Test', kind: this.f.kind, url: this.f.url.trim() }], 0); }
  async add() {
    this.msg.set('');
    const url = this.f.url.trim();
    if (!this.f.title.trim() || !url) { this.msg.set(this.t.tx('Please fill the title and the audio link.', 'कृपया शीर्षक और ऑडियो लिंक भरें।')); this.ok.set(false); return; }
    if (!/^(https:\/\/|audio\/)/.test(url)) { this.msg.set(this.t.tx('The link must start with https:// or audio/', 'लिंक https:// या audio/ से शुरू होना चाहिए')); this.ok.set(false); return; }
    this.busy.set(true);
    try {
      await this.acc.addTrack({ title: this.f.title.trim(), titleHi: this.f.titleHi.trim(), kind: this.f.kind, deity: this.f.deity || undefined, url, credit: this.f.credit.trim() });
      this.f = { title: '', titleHi: '', kind: this.f.kind, deity: '', url: '', credit: '' };
      this.msg.set(this.t.tx('Added. Everyone can now play it.', 'जुड़ गया। अब सभी इसे सुन सकते हैं।')); this.ok.set(true);
      this.loadAdded();
    } catch (e) { this.msg.set(this.acc.errorText(e, this.t.hi())); this.ok.set(false); }
    finally { this.busy.set(false); }
  }
  async remove(tr: Track) {
    let yes = true; try { yes = window.confirm(this.t.tx(`Remove "${tr.title}"?`, `"${tr.titleHi || tr.title}" हटाएँ?`)); } catch { /* ignore */ }
    if (!yes) return;
    try { await this.acc.deleteTrack(tr.id); this.loadAdded(); } catch (e) { this.msg.set(this.acc.errorText(e, this.t.hi())); this.ok.set(false); }
  }
}
