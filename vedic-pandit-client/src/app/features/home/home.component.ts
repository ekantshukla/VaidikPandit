import { AccountService } from '../../core/services/account.service';
import { Component, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { I18nService } from '../../core/services/i18n.service';
import { LocationService } from '../../core/services/location.service';
import { PanditJiService } from '../../core/services/panditji.service';
import { PanchangResult, TimeWindow } from '../../core/astro/models';
import { addDays, computePanchang, todayIn } from '../../core/astro/panchang-engine';
import { NowCardComponent } from '../../shared/now-card.component';
import { PanchangViewComponent } from '../../shared/panchang-view.component';
import { DayPipe, TimePipe } from '../../shared/time.pipe';
import { deva } from '../../core/astro/display';
import { TraditionService, forTradition, isFocus } from '../../core/services/tradition.service';

interface Upcoming { date: string; names: string[]; }

@Component({
  selector: 'vp-home',
  standalone: true,
  imports: [RouterLink, FormsModule, NowCardComponent, PanchangViewComponent, DayPipe, TimePipe],
  template: `
  <section class="hero">
    <div class="wrap grid">
      <div class="today">
        <p class="date">{{ today() | day: i18n.lang() }}<span class="place">{{ loc.place().nameHi && i18n.prefersDevanagari() ? loc.place().nameHi : loc.place().name }}</span></p>
        @if (p(); as p) {
          <h1 class="tithi" [class.sa]="i18n.lang() !== 'en'">{{ i18n.sanskritName(p.tithis[0].nameSanskrit, p.tithis[0].name) }}</h1>
          <p class="sub">
            {{ i18n.f('untilT', { t: (p.tithis[0].ends | hm: p.date) }) }},
            {{ i18n.t('nakshatra') }} <b [class.sa]="i18n.lang() !== 'en'">{{ i18n.sanskritName(p.nakshatras[0].nameSanskrit, p.nakshatras[0].name) }}</b>
          </p>
          @if (obs(p.observances)) { <p class="fest">{{ obs(p.observances) }}</p> }

          @if (kaalNow(); as k) {
            <p class="status avoid"><span class="dot"></span>{{ label(k.name) }} {{ i18n.t('now') }}, {{ i18n.f('untilT', { t: (k.end | hm) }) }}</p>
          } @else if (nextKaal()) {
            <p class="status"><span class="dot"></span>{{ label(nextKaal()!.name) }} {{ nextKaal()!.start | hm }}–{{ nextKaal()!.end | hm }}</p>
          }
          <dl class="sun num">
            <div><dt>{{ i18n.t('sunrise') }}</dt><dd>{{ p.sunrise | hm }}</dd></div>
            <div><dt>{{ i18n.t('sunset') }}</dt><dd>{{ p.sunset | hm }}</dd></div>
            <div><dt>{{ i18n.t('abhijit') }}</dt><dd>{{ p.abhijitMuhurat?.start | hm }}–{{ p.abhijitMuhurat?.end | hm }}</dd></div>
          </dl>
        }

        <p class="ai-l">✨ {{ i18n.t('askAiShort') }} <span>· {{ i18n.t('aiAnything') }}</span></p>
        <form class="ask" (ngSubmit)="ask()">
          <label for="home-ask" class="sr-only">{{ i18n.t('askPlaceholder') }}</label>
          <input id="home-ask" class="input" name="q" [(ngModel)]="q" [placeholder]="i18n.t('askPlaceholder')" autocomplete="off">
          <button class="btn" type="submit">{{ i18n.t('ask') }}</button>
        </form>
        <a routerLink="/rashifal" class="rf-btn">
          <span class="rf-sym" aria-hidden="true">♈♌♐</span>
          <span><b>{{ i18n.t('rfHomeBtn') }}</b><small>{{ i18n.t('rfHomeSub') }}</small></span>
          <span aria-hidden="true" class="rf-go">→</span>
        </a>
        @if (acc.configured) {
          <a routerLink="/pandits" class="rf-btn bk">
            <span class="rf-sym" aria-hidden="true">🕉️</span>
            <span><b>{{ i18n.t('bookTitle') }}</b><small>{{ i18n.t('bookSub') }}</small></span>
            <span aria-hidden="true" class="rf-go">→</span>
          </a>
        }
        <div class="ex">
          @for (k of ['ex1', 'ex2', 'ex3']; track k) { <button type="button" (click)="q = i18n.t(k); ask()">{{ i18n.t(k) }}</button> }
        </div>
      </div>
      <vp-now-card class="dial" />
    </div>
  </section>

  <section class="wrap body">
    <div class="col-main">
      <h2>{{ i18n.t('nav.panchang') }}</h2>
      <vp-panchang-view [p]="p()" />
      <a routerLink="/panchang" class="more">{{ i18n.t('nav.panchang') }}: {{ i18n.t('choghadiya') }}, {{ i18n.t('masa') }}, {{ i18n.t('samvat') }}</a>
    </div>
    <aside class="col-side">
      <h2>{{ i18n.t('observances') }}</h2>
      <ol class="upcoming">
        @for (u of upcomingFor(); track u.date) {
          <li [class.focus]="u.focus"><span class="ud">{{ u.date | day: i18n.lang() : 'short' }}</span><span>{{ obs(u.names) }}</span></li>
        }
      </ol>
      <nav class="paths" aria-label="Sections">
        <a routerLink="/rashifal"><b>{{ i18n.t('rashifalTitle') }}</b><span>{{ i18n.t('rashifalIntro') }}</span></a>
        <a routerLink="/muhurat"><b>{{ i18n.t('muhuratTitle') }}</b><span>{{ i18n.t('muhuratIntro') }}</span></a>
        <a routerLink="/milan"><b>💍 {{ i18n.t('nav.milan') }}</b><span>{{ i18n.t('milanSub') }}</span></a>
        <a routerLink="/paddhati"><b>📿 {{ i18n.t('nav.paddhati') }}</b><span>{{ i18n.prefersDevanagari() ? 'नित्य पूजा, देवता, पर्व, क्षेत्रीय व संप्रदाय अनुसार क्रमवार पूजा विधि मंत्रों सहित।' : 'Step-by-step puja vidhi with mantras: daily, by deity, festivals, regional and sampradaya.' }}</span></a>
        <a routerLink="/bhajan"><b>🪔 {{ i18n.t('nav.bhajan') }}</b><span>{{ i18n.t('bhajanSub') }}</span></a>
        <a routerLink="/mantra"><b>{{ i18n.t('mantraTitle') }}</b><span>{{ i18n.t('mantraIntro') }}</span></a>
        <a routerLink="/granth"><b>{{ i18n.t('granthTitle') }}</b><span>{{ i18n.t('libIntro') }}</span></a>
        @if (acc.configured) { <a routerLink="/pandits"><b>{{ i18n.t('bookTitle') }}</b><span>{{ i18n.t('bookSub') }}</span></a> }
      </nav>
    </aside>
  </section>`,
  styles: [`
    .hero { background: var(--ink); color: #F6F4FA; padding: 28px 0 40px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 40px; align-items: start; }
    .today { padding-top: 16px; }
    .date { color: rgba(246,244,250,.75); margin: 0 0 4px; display: flex; gap: 14px; flex-wrap: wrap; }
    .place { color: var(--haldi); }
    .tithi { color: #fff; font-size: clamp(2.6rem, 6vw, 4.4rem); line-height: 1.05; margin: 0 0 8px; font-weight: 600; }
    .tithi.sa { font-weight: 400; }
    .sub { font-size: var(--s1); color: rgba(246,244,250,.85); margin-bottom: 6px; }
    .sub b { color: #fff; font-weight: 600; }
    .fest { display: inline-block; background: var(--haldi); color: var(--ink); font-weight: 600; padding: 4px 14px; border-radius: 999px; margin: 6px 0 10px; }
    .status { display: flex; align-items: center; gap: 8px; color: rgba(246,244,250,.85); margin: 6px 0 14px; }
    .status .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--haldi); }
    .status.avoid { color: #FFD0D8; }
    .status.avoid .dot { background: #FF5A76; }
    .sun { display: flex; gap: 28px; margin: 0 0 22px; flex-wrap: wrap; }
    .sun dt { font-size: var(--s-1); color: rgba(246,244,250,.6); }
    .sun dd { margin: 0; font-size: var(--s1); font-weight: 600; color: #fff; }
    .ai-l { margin: 0 0 8px; font-weight: 700; color: var(--haldi); }
    .ai-l span { font-weight: 400; color: rgba(246,244,250,.75); }
    .ask { display: flex; gap: 8px; background: var(--card); padding: 6px; border-radius: 999px; box-shadow: 0 10px 30px rgba(29,23,54,.18); }
    .ask .input { border: 0; border-radius: 999px; color: var(--text); padding-left: 16px; }
    .ex { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; }
    .rf-btn { display: flex; align-items: center; gap: 14px; margin-top: 14px; padding: 12px 18px; border-radius: 16px; text-decoration: none;
      background: linear-gradient(135deg, var(--haldi), #F0B53A); color: var(--ink); box-shadow: 0 10px 26px rgba(0,0,0,.18); }
    .rf-btn:hover { filter: brightness(1.05); }
    .rf-btn.bk { background: rgba(255,255,255,.07); color: #fff; border: 1.5px solid rgba(227,162,26,.6); margin-top: 10px; }
    .rf-btn.bk small { color: rgba(246,244,250,.75); }
    .rf-btn b { display: block; font-size: 1.12rem; }
    .rf-btn small { display: block; font-size: .85rem; color: rgba(29,23,54,.78); }
    .rf-sym { font-size: 1.4rem; letter-spacing: 2px; color: var(--sindoor); font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', system-ui, sans-serif; flex: none; }
    .rf-go { margin-left: auto; font-size: 1.4rem; font-weight: 700; }
    .ex button { background: none; border: 0; padding: 4px 0; color: #F6F4FA; cursor: pointer; text-decoration: underline; text-decoration-color: var(--haldi); text-underline-offset: 4px; text-align: left; }
    .dial { display: block; }
    .body { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 48px; padding-top: 40px; padding-bottom: 40px; }
    .more { display: inline-block; margin-top: 18px; font-weight: 600; }
    .upcoming { list-style: none; margin: 0 0 32px; padding: 0; border-top: 1px solid var(--line); }
    .upcoming li { display: grid; grid-template-columns: 7.5rem 1fr; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); }
    .ud { color: var(--muted); font-variant-numeric: tabular-nums; }
    .upcoming li.focus span:last-child { color: var(--sindoor); font-weight: 600; }
    .paths { display: grid; gap: 4px; }
    .paths a { display: flex; flex-direction: column; text-decoration: none; padding: 14px 0; border-bottom: 1px solid var(--line); }
    .paths b { color: var(--sindoor); font-size: var(--s1); }
    .paths span { color: var(--muted); }
    @media (max-width: 900px) {
      .hero { padding-top: 10px; }
      .today { padding-top: 0; }
      .today .date { margin-top: 0; }
      .grid, .body { grid-template-columns: 1fr; gap: 24px; }
      .dial { width: 100%; }
    }
  `],
})
export class HomeComponent {
  readonly i18n = inject(I18nService);
  readonly loc = inject(LocationService);
  private api = inject(ApiService);
  private bot = inject(PanditJiService);
  private router = inject(Router);
  readonly acc = inject(AccountService);

  readonly p = signal<PanchangResult | null>(null);
  readonly today = signal(todayIn(this.loc.place().tz));
  readonly upcoming = signal<Upcoming[]>([]);
  private readonly now = signal(Date.now());
  q = '';

  constructor() {
    effect(() => {
      const place = this.loc.place();
      const d = todayIn(place.tz);
      this.today.set(d);
      this.api.panchang(d, place.lat, place.lng, place.tz).then(r => this.p.set(r));
      // Upcoming festivals for 45 days, computed in the browser (same engine as the server)
      setTimeout(() => {
        const list: Upcoming[] = [];
        for (let i = 1; i <= 45 && list.length < 12; i++) {
          const day = addDays(d, i);
          const r = computePanchang(day, place.lat, place.lng, place.tz);
          if (r.observances.length) list.push({ date: day, names: r.observances.map(o => o.replace(/ \(confirm[^)]*\)/, '')) });
        }
        this.upcoming.set(list);
      }, 50);
    });
    setInterval(() => this.now.set(Date.now()), 60000);
  }

  private windows(): TimeWindow[] {
    const p = this.p();
    return p ? [p.rahuKaal, p.yamaganda, p.gulika].filter((w): w is TimeWindow => !!w) : [];
  }
  kaalNow(): TimeWindow | undefined {
    const n = this.now();
    return this.windows().find(w => Date.parse(w.start) <= n && n < Date.parse(w.end));
  }
  nextKaal(): TimeWindow | undefined {
    const n = this.now();
    return this.windows().filter(w => Date.parse(w.start) > n).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0]
      ?? this.windows()[0];
  }
  private trad = inject(TraditionService);
  obs(list: string[]) { return forTradition(list, this.trad.tradition()).map(o => this.i18n.prefersDevanagari() ? deva(o) : o).join(', '); }
  upcomingFor() {
    const t = this.trad.tradition();
    return this.upcoming().map(u => ({ ...u, names: forTradition(u.names, t), focus: u.names.some(n => isFocus(n, t)) })).filter(u => u.names.length).slice(0, 8);
  }
  label(name: string) {
    const map: Record<string, string> = { 'Rahu Kaal': 'rahuKaal', 'Yamaganda': 'yamaganda', 'Gulika Kaal': 'gulika' };
    return this.i18n.t(map[name] ?? name);
  }

  ask() {
    const text = this.q.trim();
    if (!text) return;
    this.q = '';
    this.router.navigate(['/ask']);
    this.bot.ask(text);
  }
}
