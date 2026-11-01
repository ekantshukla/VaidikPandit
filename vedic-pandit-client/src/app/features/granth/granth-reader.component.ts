import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { PanditJiService } from '../../core/services/panditji.service';
import { GranthBook, GranthIndex, GranthText, GranthVerse, loadCatalog, loadChapter, loadIndex } from '../../core/services/granth-library';
import { SCRIPT_FOR_LANG, toIast, toScript } from '../../core/services/transliterate';

/** Reads one text of the library chapter by chapter: /granth/mahabharata?c=6.24&v=5 */
@Component({
  selector: 'vp-granth-reader',
  standalone: true,
  imports: [RouterLink],
  template: `
  <div class="wrap page">
    <a routerLink="/granth" class="back">← {{ i18n.t('granthTitle') }}</a>
    @if (text(); as t) {
      <header class="head">
        <h1><span class="sa">{{ t.nameDev }}</span> <small>{{ t.name }}</small></h1>
        @if (t.desc) { <p class="muted">{{ t.desc }}</p> }
      </header>
    }
    @if (error()) { <p class="note">{{ i18n.t('libOffline') }}</p> }

    @if (index(); as idx) {
      <div class="controls">
        @if (idx.books.length > 1) {
          <label class="field">
            <span>{{ i18n.t('libBook') }}</span>
            <select class="input" [value]="bookId()" (change)="pickBook($any($event.target).value)">
              @for (b of idx.books; track b.id) { <option [value]="b.id" [selected]="b.id === bookId()">{{ b.name }}</option> }
            </select>
          </label>
        }
        <label class="field">
          <span>{{ unitLabel() }}</span>
          <select class="input" [value]="chapter()" (change)="go($any($event.target).value)">
            @for (c of book()?.chapters ?? []; track c.id) {
              <option [value]="c.id" [selected]="c.id === chapter()">{{ shortId(c.id) }} · {{ c.n }} {{ i18n.t('verses') }}</option>
            }
          </select>
        </label>
        <label class="tog"><input type="checkbox" [checked]="roman()" (change)="roman.set(!roman())"> IAST</label>
      </div>

      <h2 class="ch">{{ book()?.name }} · {{ unitLabel() }} {{ shortId(chapter()) }}</h2>

      @if (loading()) { <p class="muted">{{ i18n.t('loading') }}</p> }
      <ol class="verses">
        @for (v of verses(); track $index) {
          <li class="verse" [id]="'v-' + v[0]" [class.hl]="v[0] === highlight()">
            <span class="no" [class.word]="!isNum(v[0])">{{ v[0] }}</span>
            <p class="sk" [class.sa]="!roman()">{{ show(v[1]) }}</p>
            <div class="acts">
              <button type="button" class="ai" (click)="explain(v)">✨ {{ i18n.t('libExplain') }}</button>
              <button type="button" class="lnk" (click)="copy(v)">{{ copied() === v[0] ? i18n.t('dakCopied') : i18n.t('dakCopy') }}</button>
              <a class="lnk" [href]="share(v)" target="_blank" rel="noopener">WhatsApp</a>
            </div>
          </li>
        }
      </ol>

      <nav class="pager" [attr.aria-label]="unitLabel()">
        <button type="button" class="btn ghost" [disabled]="!prevId()" (click)="go(prevId()!)">← {{ i18n.t('libPrev') }}</button>
        <span class="pos num">{{ pos() + 1 }} / {{ allIds().length }}</span>
        <button type="button" class="btn ghost" [disabled]="!nextId()" (click)="go(nextId()!)">{{ i18n.t('libNext') }} →</button>
      </nav>
      @if (text()?.src) { <p class="credit faint">{{ i18n.t('source') }}: {{ text()?.src }}</p> }
    }
  </div>`,
  styles: [`
    .back { display: inline-block; margin-bottom: 10px; font-weight: 600; text-decoration: none; color: var(--sindoor); }
    .head h1 { margin-bottom: 6px; }
    .head h1 .sa { font-weight: 400; }
    .head h1 small { display: block; font-size: .5em; color: var(--muted); font-weight: 600; margin-top: 4px; }
    .head p { margin-bottom: 14px; }
    .note { background: var(--haldi-soft); border-radius: var(--r-sm); padding: 10px 14px; max-width: none; }
    .controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; position: sticky; top: 64px; z-index: 5;
      background: var(--paper); padding: 8px 0; border-bottom: 1px solid var(--line); }
    .controls .field { flex: 1 1 220px; min-width: 0; }
    .controls select { font-size: 1rem; }
    .tog { display: flex; align-items: center; gap: 6px; min-height: 44px; font-weight: 600; color: var(--muted); cursor: pointer; }
    .tog input { width: 18px; height: 18px; accent-color: var(--sindoor); }
    .ch { font-size: var(--s1); margin: 16px 0 10px; }
    .verses { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; max-width: 860px; }
    .verse { position: relative; background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--haldi); border-radius: var(--r-sm);
      padding: 12px 14px 8px 52px; scroll-margin-top: 140px; }
    .verse.hl { border-color: var(--sindoor); box-shadow: 0 0 0 3px var(--sindoor-soft); }
    .no { position: absolute; left: 10px; top: 12px; min-width: 32px; height: 26px; padding: 0 6px; border-radius: 999px; background: var(--ink); color: #fff;
      font-size: .78rem; font-weight: 700; display: grid; place-items: center; font-variant-numeric: tabular-nums; }
    .no.word { position: static; display: inline-grid; margin-bottom: 6px; background: var(--haldi-soft); color: var(--ink); }
    .verse:has(.no.word) { padding-left: 14px; }
    .sk { white-space: pre-line; font-size: 1.18rem; line-height: 1.75; color: var(--ink); margin: 0 0 6px; max-width: none; overflow-wrap: anywhere; }
    .sk:not(.sa) { font-size: 1rem; font-style: italic; }
    .acts { display: flex; gap: 6px 14px; flex-wrap: wrap; align-items: center; }
    .ai { border: 1.5px solid var(--haldi); background: var(--haldi-soft); color: var(--ink); border-radius: 999px; padding: 6px 12px; min-height: 36px;
      font-weight: 600; font-size: .88rem; cursor: pointer; }
    .ai:hover { border-color: var(--sindoor); }
    .lnk { background: none; border: 0; color: var(--muted); font-size: .85rem; cursor: pointer; text-decoration: underline; text-decoration-color: var(--line); padding: 6px 2px; }
    .pager { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin: 22px 0 8px; max-width: 860px; }
    .pos { color: var(--faint); }
    .credit { font-size: var(--s-1); margin-top: 16px; }
    @media (max-width: 1024px) {
      .controls { position: static; }
      .pager { position: sticky; bottom: calc(68px + env(safe-area-inset-bottom, 0px)); background: var(--paper); padding: 8px 0; margin-bottom: 0; z-index: 5;
        border-top: 1px solid var(--line); }
      .pager .btn { min-height: 42px; padding: 8px 14px; }
    }
    @media (max-width: 560px) {
      .controls .field { flex: 1 1 100%; }
      .verse { padding: 10px 12px 6px 46px; }
      .no { left: 8px; min-width: 30px; }
      .sk { font-size: 1.1rem; }
    }
  `],
})
export class GranthReaderComponent {
  readonly i18n = inject(I18nService);
  private bot = inject(PanditJiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly code = signal('');
  readonly text = signal<GranthText | null>(null);
  readonly index = signal<GranthIndex | null>(null);
  readonly chapter = signal('');
  readonly verses = signal<GranthVerse[]>([]);
  readonly highlight = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly copied = signal<string | null>(null);
  readonly roman = signal(false);

  readonly allIds = computed(() => this.index()?.books.flatMap(b => b.chapters.map(c => c.id)) ?? []);
  readonly pos = computed(() => this.allIds().indexOf(this.chapter()));
  readonly prevId = computed(() => this.allIds()[this.pos() - 1]);
  readonly nextId = computed(() => (this.pos() >= 0 ? this.allIds()[this.pos() + 1] : undefined));
  readonly book = computed<GranthBook | undefined>(() => this.index()?.books.find(b => b.chapters.some(c => c.id === this.chapter())) ?? this.index()?.books[0]);
  readonly bookId = computed(() => this.book()?.id ?? '');

  constructor() {
    this.route.paramMap.subscribe(p => this.open(p.get('code') ?? ''));
    this.route.queryParamMap.subscribe(q => {
      const c = q.get('c');
      this.highlight.set(q.get('v'));
      if (c && this.index() && c !== this.chapter()) this.loadCh(c);
    });
    // In English, Sanskrit reads more easily in Roman letters
    effect(() => { if (SCRIPT_FOR_LANG[this.i18n.lang()] === 'iast') this.roman.set(true); }, { allowSignalWrites: true });
  }

  private async open(code: string) {
    if (!code || code === this.code()) return;
    this.code.set(code);
    this.error.set(false);
    try {
      const [cat, idx] = await Promise.all([loadCatalog(), loadIndex(code)]);
      this.text.set(cat.texts.find(t => t.code === code) ?? null);
      this.index.set(idx);
      const want = this.route.snapshot.queryParamMap.get('c');
      const first = idx.books[0]?.chapters[0]?.id ?? '';
      await this.loadCh(want && this.allIds().includes(want) ? want : first);
    } catch { this.error.set(true); }
  }

  private async loadCh(id: string) {
    this.chapter.set(id);
    this.loading.set(true);
    try {
      this.verses.set(await loadChapter(this.code(), id));
      this.error.set(false);
    } catch { this.verses.set([]); this.error.set(true); }
    this.loading.set(false);
    const v = this.highlight();
    setTimeout(() => {
      if (v) document.getElementById('v-' + v)?.scrollIntoView({ block: 'center' });
    }, 60);
  }

  go(id: string) {
    if (!id) return;
    this.highlight.set(null);
    this.router.navigate([], { queryParams: { c: id }, replaceUrl: true });
    this.loadCh(id);
    window.scrollTo({ top: 0 });
  }
  pickBook(id: string) {
    const b = this.index()?.books.find(x => x.id === id);
    if (b?.chapters[0]) this.go(b.chapters[0].id);
  }

  unitLabel() {
    const u = this.text()?.unit ?? 'adhyaya';
    const map: Record<string, [string, string]> = {
      adhyaya: ['Adhyaya', 'अध्याय'], sarga: ['Sarga', 'सर्ग'], sukta: ['Sukta', 'सूक्त'], doha: ['Doha', 'दोहा'],
      section: ['Section', 'खण्ड'], pada: ['Pada', 'पाद'],
    };
    const [en, hi] = map[u] ?? [u, u];
    return this.i18n.prefersDevanagari() ? hi : en;
  }
  /** "6.24" inside the Bhishma book shows as 24; deeper ids keep their tail. */
  shortId(id: string) {
    const b = this.book();
    if (b && id.startsWith(b.id + '.') && (this.index()?.books.length ?? 0) > 1) return id.slice(b.id.length + 1);
    return id;
  }
  isNum(s: string) { return /^\d/.test(s); }
  show(t: string) {
    if (this.roman()) return toIast(t);
    const sc = SCRIPT_FOR_LANG[this.i18n.lang()];
    return sc && sc !== 'iast' && sc !== 'deva' && this.text()?.lang === 'sa' ? toScript(t, sc) : t;
  }
  private ref(v: GranthVerse) { return `${this.text()?.name ?? this.code()} ${this.chapter()}${this.isNum(v[0]) ? '.' + v[0] : ''}`; }

  explain(v: GranthVerse) {
    const hi = this.i18n.prefersDevanagari();
    const q = hi
      ? `${this.ref(v)} का अर्थ सरल हिन्दी में समझाइए:\n${v[1]}`
      : `Explain ${this.ref(v)} in simple words (meaning, context and teaching):\n${v[1]}`;
    this.router.navigate(['/ask']);
    this.bot.ask(q);
  }
  async copy(v: GranthVerse) {
    try { await navigator.clipboard.writeText(`${v[1]}\n— ${this.ref(v)}`); this.copied.set(v[0]); setTimeout(() => this.copied.set(null), 1500); } catch { /* ignore */ }
  }
  share(v: GranthVerse) { return 'https://wa.me/?text=' + encodeURIComponent(`${v[1]}\n— ${this.ref(v)}\n\nVaidik Pandit`); }
}
