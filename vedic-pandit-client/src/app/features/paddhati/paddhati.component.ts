import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CATS, PADDHATI, PCat, PStep, Paddhati } from '../../core/data/paddhati';
import { AccountService } from '../../core/services/account.service';
import { SCRIPT_FOR_LANG, toScript } from '../../core/services/transliterate';
import { useTx } from '../booking/booking-ui';

/** Puja Paddhati: step-by-step puja vidhi — general, by deity, festival, regional and by sampradaya. */
@Component({
  selector: 'vp-paddhati',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
  <div class="wrap page">
    @if (current(); as p) {
      <a routerLink="/paddhati" class="back">← {{ t.tx('All puja vidhis', 'सभी पूजा विधियाँ') }}</a>
      <header class="dh">
        <span class="di" aria-hidden="true">{{ p.icon }}</span>
        <div>
          <h1 [class.sa]="t.hi()">{{ t.hi() ? p.hi : p.en }}</h1>
          @if (p.tag) { <p class="tag">{{ t.hi() ? (p.tagHi || p.tag) : p.tag }}</p> }
          <p class="when">🕰️ {{ t.hi() ? p.whenHi : p.when }}</p>
        </div>
      </header>
      <p class="about">{{ t.hi() ? p.aboutHi : p.aboutEn }}</p>
      <div class="acts">
        @if (p.samagri) { <a class="btn quiet" routerLink="/samagri" [queryParams]="{ p: p.samagri }">🧺 {{ t.tx('Samagri list', 'सामग्री सूची') }}</a> }
        @if (acc.configured) { <a class="btn quiet" routerLink="/pandits" [queryParams]="p.book ? { puja: p.book } : {}">🕉️ {{ t.tx('Book a Pandit for this', 'इसके लिए पंडित जी बुक करें') }}</a> }
        @if (p.custom && acc.isAdmin()) { <button type="button" class="btn quiet del" (click)="remove(p)">🗑 {{ t.tx('Delete', 'हटाएँ') }}</button> }
      </div>

      <ol class="steps">
        @for (st of p.steps; track $index; let i = $index) {
          <li>
            <span class="no num">{{ i + 1 }}</span>
            <div class="sb">
              <h2 [class.sa]="t.hi()">{{ t.hi() ? st.hi : st.en }}</h2>
              <p>{{ t.hi() ? st.doHi : st.doEn }}</p>
              @if (st.mantra) {
                <div class="mantra">
                  <p class="sa" lang="sa">{{ st.mantra }}</p>
                  @if (translit(st.mantra); as tr) { <p class="tl">{{ tr }}</p> }
                  <span class="mact">
                    @if (st.slug) { <a [routerLink]="['/mantra', st.slug]">🔊 {{ t.tx('Listen & chant along', 'सुनें व साथ जपें') }}</a> }
                    <button type="button" (click)="copy(st, i)">{{ copied() === i ? '✔ ' + t.tx('Copied', 'कॉपी हुआ') : '📋 ' + t.tx('Copy', 'कॉपी') }}</button>
                  </span>
                </div>
              } @else if (st.slug) {
                <a class="lnk" [routerLink]="['/mantra', st.slug]">📖 {{ t.tx('Open the text', 'पाठ खोलें') }} →</a>
              }
            </div>
          </li>
        }
      </ol>
      <p class="note">{{ t.tx('This is the common household form. Your family tradition (kula-parampara) and your Pandit\\'s guidance always come first. Where "____" appears in the sankalp, say your own details.',
        'यह सामान्य गृहस्थ विधि है। आपकी कुल-परंपरा और पंडित जी का मार्गदर्शन सदा सर्वोपरि है। संकल्प में जहाँ "____" है, वहाँ अपना विवरण बोलें।') }}</p>
    } @else if (id()) {
      <a routerLink="/paddhati" class="back">← {{ t.tx('All puja vidhis', 'सभी पूजा विधियाँ') }}</a>
      <p class="muted">{{ loading() ? t.tx('Loading…', 'लोड हो रहा है…') : t.tx('This vidhi was not found.', 'यह विधि नहीं मिली।') }}</p>
    } @else {
      <header class="page-head">
        <h1>{{ t.i18n.t('nav.paddhati') }}</h1>
        <p>{{ t.tx('Step-by-step puja vidhi with mantras: daily puja, each deity, festivals, regional traditions and sampradayas.',
          'मंत्रों सहित क्रमवार पूजा विधि: नित्य पूजा, देवता अनुसार, पर्व-त्योहार, क्षेत्रीय परंपराएँ और संप्रदाय।') }}</p>
      </header>
      <div class="search"><input class="input" type="search" [(ngModel)]="q" [placeholder]="t.tx('Search: Diwali, Chhath, Ganesh, Onam…', 'खोजें: दीपावली, छठ, गणेश, ओणम…')" aria-label="Search"></div>
      <div class="chips" role="tablist">
        <button type="button" class="chip" [class.on]="!cat()" (click)="cat.set('')">✨ {{ t.tx('All', 'सभी') }}</button>
        @for (c of cats; track c.id) { <button type="button" class="chip" [class.on]="cat() === c.id" (click)="cat.set(c.id)">{{ c.icon }} {{ t.tx(c.en, c.hi) }}</button> }
      </div>
      @for (g of groups(); track g.cat.id) {
        <section>
          <h2 class="gh">{{ g.cat.icon }} {{ t.tx(g.cat.en, g.cat.hi) }}</h2>
          <div class="grid">
            @for (p of g.items; track p.id) {
              <a class="card" [routerLink]="['/paddhati', p.id]">
                <span class="ci" aria-hidden="true">{{ p.icon }}</span>
                <span class="ct">
                  <b [class.sa]="t.hi()">{{ t.hi() ? p.hi : p.en }}</b>
                  @if (p.tag) { <small class="tg">{{ t.hi() ? (p.tagHi || p.tag) : p.tag }}</small> }
                  <small>{{ t.hi() ? p.whenHi : p.when }}</small>
                </span>
              </a>
            }
          </div>
        </section>
      } @empty { <p class="muted">{{ t.tx('Nothing found. Try another word.', 'कुछ नहीं मिला। दूसरा शब्द आज़माएँ।') }}</p> }

      @if (acc.isAdmin()) {
        <details class="panel admin">
          <summary>➕ {{ t.tx('Add a puja vidhi (admin)', 'पूजा विधि जोड़ें (एडमिन)') }}</summary>
          <form class="stack" (ngSubmit)="add()">
            <div class="row2">
              <input class="input" name="en" [(ngModel)]="f.en" [placeholder]="t.tx('Title in English *', 'शीर्षक अंग्रेज़ी में *')">
              <input class="input" name="hi" [(ngModel)]="f.hi" [placeholder]="t.tx('Title in Hindi *', 'शीर्षक हिंदी में *')">
            </div>
            <div class="row2">
              <select class="input" name="cat" [(ngModel)]="f.cat">@for (c of cats; track c.id) { <option [value]="c.id">{{ t.tx(c.en, c.hi) }}</option> }</select>
              <input class="input" name="icon" [(ngModel)]="f.icon" placeholder="Icon (emoji) 🪔">
            </div>
            <div class="row2">
              <input class="input" name="tag" [(ngModel)]="f.tag" [placeholder]="t.tx('Region / sampradaya (optional)', 'क्षेत्र / संप्रदाय (वैकल्पिक)')">
              <input class="input" name="when" [(ngModel)]="f.when" [placeholder]="t.tx('When (e.g. Kartik Purnima)', 'कब (जैसे कार्तिक पूर्णिमा)')">
            </div>
            <textarea class="input" name="about" rows="2" [(ngModel)]="f.about" [placeholder]="t.tx('About this puja', 'इस पूजा के बारे में')"></textarea>
            <textarea class="input" name="steps" rows="9" [(ngModel)]="f.steps" [placeholder]="stepsHelp"></textarea>
            @if (msg()) { <p class="muted">{{ msg() }}</p> }
            <button class="btn" type="submit" [disabled]="busy()">{{ t.tx('Add vidhi', 'विधि जोड़ें') }}</button>
          </form>
        </details>
      }
    }
  </div>`,
  styles: [`
    .search { margin-bottom: 10px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
    .chip { border: 1.5px solid var(--line); background: var(--card); border-radius: 999px; padding: 6px 14px; font: inherit; font-weight: 600; cursor: pointer; color: var(--ink); }
    .chip.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .gh { margin: 22px 0 10px; font-size: 1.15rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
    .card { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border-radius: 16px; background: var(--card); border: 1px solid var(--line); text-decoration: none; color: inherit; min-width: 0; }
    .card:hover { border-color: var(--ink); }
    .ci { font-size: 1.8rem; width: 48px; height: 48px; flex: none; display: grid; place-items: center; border-radius: 14px; background: var(--haldi-soft); }
    .ct { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .ct b { color: var(--ink); font-size: 1.05rem; }
    .ct small { color: var(--muted); }
    .ct .tg { color: var(--sindoor); font-weight: 600; }
    .back { display: inline-block; margin-bottom: 12px; color: var(--sindoor); font-weight: 600; text-decoration: none; }
    .dh { display: flex; gap: 14px; align-items: center; }
    .dh h1 { margin: 0; }
    .di { font-size: 2.6rem; width: 72px; height: 72px; flex: none; display: grid; place-items: center; border-radius: 20px; background: var(--haldi-soft); }
    .tag { margin: 2px 0 0; color: var(--sindoor); font-weight: 600; }
    .when { margin: 2px 0 0; color: var(--muted); }
    .about { max-width: 72ch; font-size: 1.05rem; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 18px; }
    .del { color: var(--sindoor); }
    .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .steps > li { display: flex; gap: 14px; padding: 14px; border-radius: 16px; background: var(--card); border: 1px solid var(--line); min-width: 0; }
    .no { width: 34px; height: 34px; flex: none; border-radius: 50%; background: var(--ink); color: #fff; display: grid; place-items: center; font-weight: 700; }
    .sb { min-width: 0; flex: 1; }
    .sb h2 { margin: 4px 0 6px; font-size: 1.1rem; }
    .sb > p { margin: 0; }
    .mantra { margin-top: 10px; padding: 12px 14px; border-radius: 12px; background: #FBF4E4; border-left: 4px solid var(--haldi); }
    .mantra .sa { margin: 0; white-space: pre-line; font-size: 1.15rem; line-height: 1.7; color: var(--ink); }
    .mantra .tl { margin: 6px 0 0; white-space: pre-line; color: var(--muted); font-style: italic; }
    .mact { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; }
    .mact a, .mact button, .lnk { background: none; border: 0; padding: 0; font: inherit; font-weight: 600; color: var(--sindoor); cursor: pointer; text-decoration: none; }
    .lnk { display: inline-block; margin-top: 8px; }
    .note { margin-top: 18px; color: var(--muted); font-size: var(--s-1); max-width: 72ch; }
    .admin { margin-top: 24px; } .admin summary { cursor: pointer; font-weight: 600; }
    .stack { display: grid; gap: 10px; margin-top: 12px; }
    .row2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
    @media (max-width: 600px) { .row2 { grid-template-columns: minmax(0, 1fr); } .steps > li { padding: 12px; gap: 10px; } .dh .di { width: 56px; height: 56px; font-size: 2rem; } }
  `],
})
export class PaddhatiComponent {
  readonly t = useTx();
  readonly acc = inject(AccountService);
  private route = inject(ActivatedRoute);
  readonly cats = CATS;
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly id = computed(() => this.params().get('id') ?? '');
  readonly custom = signal<Paddhati[]>([]);
  readonly loading = signal(false);
  readonly all = computed(() => [...PADDHATI, ...this.custom()]);
  readonly current = computed(() => { const id = this.id(); return id ? this.all().find(p => p.id === id) ?? null : null; });
  readonly cat = signal<PCat | ''>('');
  private readonly qs = signal('');
  get q() { return this.qs(); } set q(v: string) { this.qs.set(v); }
  readonly copied = signal(-1);
  readonly msg = signal('');
  readonly busy = signal(false);
  f = { en: '', hi: '', cat: 'general' as PCat, icon: '🪔', tag: '', when: '', about: '', steps: '' };
  readonly stepsHelp = 'One step per block, blank line between steps:\nStep title | What to do\nमंत्र (optional, Devanagari)\n\nGanesh smaran | Offer flower and akshat to Ganesha\nवक्रतुण्ड महाकाय सूर्यकोटि समप्रभ।';

  readonly groups = computed(() => {
    const c = this.cat(), words = this.qs().toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (p: Paddhati) => !words.length || words.every(w =>
      [p.en, p.hi, p.tag, p.tagHi, p.when, p.whenHi, p.aboutEn].join(' ').toLowerCase().includes(w));
    return CATS.filter(x => !c || x.id === c)
      .map(x => ({ cat: x, items: this.all().filter(p => p.cat === x.id && hit(p)) }))
      .filter(g => g.items.length);
  });

  constructor() {
    if (this.acc.configured) {
      this.loading.set(true);
      this.acc.listPaddhati().then(l => this.custom.set(l)).catch(() => undefined).finally(() => this.loading.set(false));
    }
  }

  /** The mantra in the reader's own script (Kannada, Tamil…) or in IAST for English readers. */
  translit(m: string): string {
    const sc = SCRIPT_FOR_LANG[this.t.i18n.lang()];
    if (!sc || sc === 'deva') return '';
    try { return toScript(m, sc); } catch { return ''; }
  }

  async copy(st: PStep, i: number) {
    try { await navigator.clipboard.writeText(st.mantra ?? ''); this.copied.set(i); setTimeout(() => this.copied.set(-1), 1500); } catch { /* blocked */ }
  }

  async add() {
    const f = this.f;
    if (!f.en.trim() || !f.hi.trim() || !f.steps.trim()) return this.msg.set(this.t.tx('Title (English and Hindi) and steps are required.', 'शीर्षक (अंग्रेज़ी व हिंदी) और चरण आवश्यक हैं।'));
    const steps: PStep[] = f.steps.trim().split(/\n\s*\n/).map(block => {
      const [head, ...rest] = block.trim().split('\n');
      const [title, what = ''] = head.split('|').map(x => x.trim());
      const mantra = rest.join('\n').trim();
      return { en: title, hi: title, doEn: what, doHi: what, ...(mantra ? { mantra } : {}) };
    }).slice(0, 60);
    this.busy.set(true); this.msg.set('');
    try {
      await this.acc.addPaddhati({ cat: f.cat, icon: f.icon || '🪔', en: f.en.trim(), hi: f.hi.trim(), tag: f.tag.trim() || undefined, tagHi: f.tag.trim() || undefined,
        when: f.when.trim(), whenHi: f.when.trim(), aboutEn: f.about.trim(), aboutHi: f.about.trim(), steps });
      this.custom.set(await this.acc.listPaddhati());
      this.f = { en: '', hi: '', cat: f.cat, icon: '🪔', tag: '', when: '', about: '', steps: '' };
      this.msg.set(this.t.tx('Added.', 'जोड़ दिया।'));
    } catch (e) { this.msg.set(this.acc.errorText(e, this.t.hi())); }
    finally { this.busy.set(false); }
  }

  async remove(p: Paddhati) {
    try { await this.acc.deletePaddhati(p.id); this.custom.update(l => l.filter(x => x.id !== p.id)); history.back(); } catch (e) { this.msg.set(this.acc.errorText(e, this.t.hi())); }
  }
}
