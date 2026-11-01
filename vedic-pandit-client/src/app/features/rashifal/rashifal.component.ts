import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../core/services/i18n.service';
import { LocationService } from '../../core/services/location.service';
import { PanditJiService } from '../../core/services/panditji.service';
import { addDays, todayIn } from '../../core/astro/panchang-engine';
import { dailyRashifal, GRAHA, monthlyRashifal, moonOverall, RASHIS, rashiFromName, stars, weeklyRashifal } from '../../core/astro/rashifal';
import { RASHI, RASHI_SA } from '../../core/astro/names';
import { DayPipe, TimePipe } from '../../shared/time.pipe';
import { COLOUR_HEX, ordinal, pick, saveRashi, savedRashi } from '../../shared/rashifal-util';

type Period = 'today' | 'tomorrow' | 'week' | 'month';

/** Rashifal: daily (today/tomorrow), weekly and monthly, by Moon sign, from the real transit of the Moon and Sun. */
@Component({
  selector: 'vp-rashifal',
  standalone: true,
  imports: [FormsModule, RouterLink, DayPipe, TimePipe],
  template: `
  <div class="wrap page">
    <header class="page-head">
      <h1>{{ i18n.t('rashifalTitle') }}</h1>
      <p>{{ i18n.t('rashifalIntro') }}</p>
    </header>

    <div class="tabs" role="tablist" [attr.aria-label]="i18n.t('rashifalTitle')">
      @for (p of periods; track p.id) {
        <button type="button" role="tab" [class.on]="period() === p.id" [attr.aria-selected]="period() === p.id" (click)="setPeriod(p.id)">{{ i18n.t(p.key) }}</button>
      }
    </div>

    <h2 class="sr-only">{{ i18n.t('rfPick') }}</h2>
    <div class="grid" role="radiogroup" [attr.aria-label]="i18n.t('rfPick')">
      @for (r of rashis; track r.id) {
        <button type="button" class="rashi" role="radio" [class.on]="sel() === r.id" [attr.aria-checked]="sel() === r.id" (click)="choose(r.id)">
          <span class="sym" aria-hidden="true">{{ r.sym }}</span>
          <span class="nm">{{ hi() ? r.hi : r.en }}</span>
          <span class="alt">{{ hi() ? r.en : r.hi }}</span>
          @if (overview()[r.id]; as s) { <span class="mini" [attr.aria-label]="s + '/5'">{{ star(s) }}</span> }
        </button>
      }
    </div>

    <form class="finder" (ngSubmit)="findByName()">
      <label for="rf-name">{{ i18n.t('rfName') }}</label>
      <div class="frow">
        <input id="rf-name" class="input" name="nm" [(ngModel)]="name" [placeholder]="i18n.t('rfNamePh')" autocomplete="off">
        <button class="btn ghost" type="submit">{{ i18n.t('rfFind') }}</button>
      </div>
      @if (nameMsg()) { <p class="nmsg" role="status">{{ nameMsg() }}</p> }
    </form>

    @if (sel() === null) {
      <p class="choose muted">{{ i18n.t('rfPick') }} ↑</p>
    } @else {
      @let R = rashis[sel()!];
      <section class="panel detail" aria-live="polite">
        <header class="dh">
          <span class="big" aria-hidden="true">{{ R.sym }}</span>
          <div class="dt">
            <h2>{{ hi() ? R.hi : R.en }} <small>{{ hi() ? R.en : R.hi }}</small></h2>
            <p class="muted">
              @if (day(); as d) { {{ d.date | day: i18n.lang() }} }
              @else if (period() === 'week') { {{ weekFrom() | day: i18n.lang() : 'short' }} – {{ addDays(weekFrom(), 6) | day: i18n.lang() : 'short' }} }
              @else if (month()) { {{ month()!.since | day: i18n.lang() : 'short' }} – {{ month()!.until | day: i18n.lang() : 'short' }} }
              · {{ i18n.t('rfLord') }}: {{ hi() ? graha[R.lord].hi : graha[R.lord].en }}
            </p>
          </div>
          @if (day(); as d) { <span class="score" [attr.aria-label]="d.score + '/5'">{{ star(d.score) }}</span> }
          @if (month(); as m) { <span class="score" [attr.aria-label]="m.score + '/5'">{{ star(m.score) }}</span> }
        </header>

        @if (day(); as d) {
          <p class="transit">{{ i18n.f('rfMoonIn', { r: rashiName(d.moonRashi), h: ord(d.house) }) }}</p>
          <div class="sections">
            <div><h3>{{ i18n.t('rfOverall') }}</h3><p>{{ L(d.text.overall) }}</p></div>
            <div><h3>{{ i18n.t('rfWork') }}</h3><p>{{ L(d.text.work) }}</p></div>
            <div><h3>{{ i18n.t('rfLove') }}</h3><p>{{ L(d.text.love) }}</p></div>
            <div><h3>{{ i18n.t('rfHealth') }}</h3><p>{{ L(d.text.health) }}</p></div>
          </div>
          @if (d.change; as c) {
            <p class="change"><b>{{ i18n.f('rfChange', { t: (c.at | hm: d.date), r: rashiName(c.moonRashi), h: ord(c.house) }) }}</b> {{ star(c.score) }}</p>
          }
          <dl class="lucky">
            <div><dt>{{ i18n.t('rfLuckyColour') }}</dt><dd><i class="sw" [style.background]="hex(d.luckyColour.en)"></i>{{ L(d.luckyColour) }}</dd></div>
            <div><dt>{{ i18n.t('rfLuckyNumber') }}</dt><dd class="num">{{ d.luckyNumbers.join(', ') }}</dd></div>
            <div class="up"><dt>{{ i18n.t('rfUpay') }}</dt><dd>{{ L(d.upay) }}. <a [routerLink]="['/mantra', d.mantra]">{{ i18n.t('rfChant') }}: {{ L(d.mantraName) }}</a></dd></div>
          </dl>
        }

        @if (period() === 'week') {
          <ol class="week">
            @for (w of week(); track w.date) {
              <li [class.best]="w.date === bestDay()">
                <span class="wd">{{ w.date | day: i18n.lang() : 'short' }}</span>
                <span class="bar" aria-hidden="true"><i [style.width.%]="w.score * 20" [class.lo]="w.score <= 2" [class.hi]="w.score >= 4"></i></span>
                <span class="ws" [attr.aria-label]="w.score + '/5'">{{ star(w.score) }}</span>
                <span class="wt">{{ weekLine(w.house) }}</span>
              </li>
            }
          </ol>
          <p class="muted">{{ i18n.t('rfBestDay') }}: <b>{{ bestDay() | day: i18n.lang() }}</b></p>
        }

        @if (month(); as m) {
          <p class="transit">{{ i18n.f('rfSunIn', { r: rashiName(m.sunRashi), h: ord(m.house) }) }}</p>
          <p class="mtext">{{ L(m.text) }}</p>
          @if (m.until) { <p class="muted"><b>{{ i18n.f('rfAfter', { d: (m.until | day: i18n.lang() : 'short') }) }}</b> {{ L(m.nextText) }}</p> }
        }

        <div class="acts">
          <button type="button" class="btn" (click)="askDetail()">{{ i18n.t('rfAsk') }}</button>
          <a class="btn ghost" [href]="waLink()" target="_blank" rel="noopener">{{ i18n.t('shareWhatsApp') }}</a>
        </div>
      </section>
    }
    <p class="note faint">{{ i18n.t('rfNote') }}</p>
  </div>`,
  styles: [`
    .tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 16px; }
    .tabs button { flex: none; border: 1.5px solid var(--line); background: var(--card); color: var(--ink); border-radius: 999px; padding: 8px 16px; font: inherit; font-weight: 600; cursor: pointer; white-space: nowrap; min-height: 42px; }
    .tabs button.on { background: var(--ink); border-color: var(--ink); color: #fff; }
    .grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
    .rashi { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px 6px 10px; background: var(--card); border: 1.5px solid var(--line);
      border-radius: var(--r-md); cursor: pointer; font: inherit; color: var(--ink); min-width: 0; }
    .rashi:hover { border-color: var(--ink); }
    .rashi.on { border-color: var(--sindoor); background: var(--sindoor-soft); }
    .rashi .sym { font-size: 1.7rem; line-height: 1.1; color: var(--sindoor); font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', system-ui, sans-serif; }
    .rashi .nm { font-weight: 700; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .rashi .alt { font-size: .76rem; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .rashi .mini { font-size: .72rem; color: var(--haldi); letter-spacing: 1px; }
    .finder { margin: 18px 0 22px; max-width: 560px; }
    .finder label { display: block; font-weight: 600; margin-bottom: 6px; color: var(--ink); }
    .frow { display: flex; gap: 8px; }
    .frow .input { flex: 1; min-width: 0; }
    .nmsg { margin: 8px 0 0; color: var(--tulsi); font-weight: 600; max-width: none; }
    .choose { font-size: var(--s1); }
    .detail { max-width: 860px; }
    .dh { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .big { width: 58px; height: 58px; border-radius: 50%; background: var(--ink); color: var(--haldi); display: grid; place-items: center; font-size: 1.9rem; flex: none;
      font-family: 'Segoe UI Symbol', 'Noto Sans Symbols', system-ui, sans-serif; }
    .dt { flex: 1; min-width: 180px; }
    .dt h2 { margin: 0; }
    .dt h2 small { font-size: .7em; color: var(--faint); font-weight: 500; }
    .dt p { margin: 2px 0 0; }
    .score { font-size: 1.35rem; color: var(--haldi); letter-spacing: 2px; white-space: nowrap; }
    .transit { background: var(--haldi-soft); border-radius: var(--r-sm); padding: 8px 12px; margin: 16px 0 6px; max-width: none; }
    .sections { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
    .sections h3 { margin: 14px 0 2px; font-size: var(--s0); color: var(--sindoor); }
    .sections p { margin: 0; }
    .change { margin: 16px 0 0; padding-top: 12px; border-top: 1px dashed var(--line); max-width: none; }
    .lucky { display: grid; grid-template-columns: auto auto 1fr; gap: 12px 28px; margin: 18px 0 0; padding-top: 14px; border-top: 1px solid var(--line); }
    .lucky dt { font-size: var(--s-1); color: var(--faint); }
    .lucky dd { margin: 0; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .lucky .up dd { font-weight: 400; display: block; }
    .sw { width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--line); display: inline-block; flex: none; }
    .week { list-style: none; margin: 16px 0 10px; padding: 0; border-top: 1px solid var(--line); }
    .week li { display: grid; grid-template-columns: 7.5rem 90px 6rem 1fr; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--line); }
    .week li.best { background: var(--tulsi-soft); border-radius: var(--r-sm); padding-inline: 8px; }
    .wd { font-weight: 600; color: var(--ink); }
    .bar { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--haldi); }
    .bar i.lo { background: var(--sindoor); } .bar i.hi { background: var(--tulsi); }
    .ws { color: var(--haldi); letter-spacing: 1px; white-space: nowrap; }
    .wt { color: var(--muted); font-size: var(--s-1); }
    .mtext { font-size: var(--s1); }
    .acts { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
    .note { margin-top: 22px; max-width: 72ch; }
    @media (max-width: 760px) {
      .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .rashi { padding: 10px 4px 8px; }
      .rashi .sym { font-size: 1.45rem; }
      .rashi .nm { font-size: .92rem; }
      .sections { grid-template-columns: 1fr; }
      .lucky { grid-template-columns: 1fr 1fr; }
      .lucky .up { grid-column: 1 / -1; }
      .week li { grid-template-columns: 6.2rem 1fr 5.4rem; }
      .week .wt { grid-column: 1 / -1; }
    }
  `],
})
export class RashifalComponent {
  readonly i18n = inject(I18nService);
  private loc = inject(LocationService);
  private bot = inject(PanditJiService);
  private router = inject(Router);
  readonly rashis = RASHIS;
  readonly graha = GRAHA;
  readonly addDays = addDays;
  readonly periods: { id: Period; key: string }[] = [
    { id: 'today', key: 'rfToday' }, { id: 'tomorrow', key: 'rfTomorrow' }, { id: 'week', key: 'rfWeek' }, { id: 'month', key: 'rfMonth' },
  ];

  readonly sel = signal<number | null>(savedRashi());
  readonly period = signal<Period>('today');
  readonly hi = computed(() => this.i18n.prefersDevanagari());
  name = '';
  readonly nameMsg = signal('');

  private readonly today = computed(() => todayIn(this.loc.place().tz));
  readonly weekFrom = computed(() => this.today());

  readonly day = computed(() => {
    const r = this.sel(), p = this.period();
    if (r === null || (p !== 'today' && p !== 'tomorrow')) return null;
    return dailyRashifal(r, p === 'today' ? this.today() : addDays(this.today(), 1), this.loc.place().tz);
  });
  readonly week = computed(() => {
    const r = this.sel();
    return r === null || this.period() !== 'week' ? [] : weeklyRashifal(r, this.weekFrom(), this.loc.place().tz);
  });
  readonly bestDay = computed(() => [...this.week()].sort((a, b) => b.score - a.score)[0]?.date ?? '');
  readonly month = computed(() => {
    const r = this.sel();
    return r === null || this.period() !== 'month' ? null : monthlyRashifal(r, this.today(), this.loc.place().tz);
  });
  /** Star rating of every rashi for the chosen day or month, shown on the rashi buttons. */
  readonly overview = computed<(number | null)[]>(() => {
    const p = this.period(), tz = this.loc.place().tz;
    if (p === 'week') return RASHIS.map(() => null);
    if (p === 'month') return RASHIS.map(r => monthlyRashifal(r.id, this.today(), tz).score);
    const d = p === 'today' ? this.today() : addDays(this.today(), 1);
    return RASHIS.map(r => dailyRashifal(r.id, d, tz).score);
  });

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const r = q.get('r'), p = q.get('p');
    if (r !== null && /^\d+$/.test(r) && +r < 12) this.sel.set(+r);
    if (p && this.periods.some(x => x.id === p)) this.period.set(p as Period);
  }

  L(x: { en: string; hi: string }) { return pick(x, this.hi()); }
  star(s: number) { return stars(s); }
  ord(n: number) { return ordinal(n, this.hi()); }
  hex(c: string) { return COLOUR_HEX[c] ?? '#ccc'; }
  rashiName(i: number) { return this.hi() ? RASHI_SA[i] : RASHI[i]; }
  weekLine(house: number) { return this.L(moonOverall(house)); }

  choose(r: number) { this.sel.set(r); saveRashi(r); this.nameMsg.set(''); }
  setPeriod(p: Period) { this.period.set(p); }

  findByName() {
    const n = this.name.trim();
    if (!n) return;
    const r = rashiFromName(n);
    if (r === null) { this.nameMsg.set(this.i18n.t('rfNameNone')); return; }
    this.choose(r);
    this.nameMsg.set(this.i18n.f('rfNameIs', { n, r: this.hi() ? RASHIS[r].hi : RASHIS[r].en }));
  }

  askDetail() {
    const r = this.sel();
    if (r === null) return;
    const q = this.i18n.f(`rfAskQ.${this.period()}`, { r: this.hi() ? RASHIS[r].hi : RASHIS[r].en });
    this.router.navigate(['/ask']);
    this.bot.ask(q);
  }

  waLink(): string {
    const r = this.sel();
    if (r === null) return '#';
    const R = RASHIS[r];
    const lines: string[] = [`${R.sym} ${this.hi() ? R.hi : R.en} — ${this.i18n.t('rashifalTitle')}`];
    const d = this.day(), m = this.month();
    if (d) lines.push(`${d.date} ${stars(d.score)}`, this.L(d.text.overall), this.L(d.text.work), `${this.i18n.t('rfLuckyColour')}: ${this.L(d.luckyColour)} · ${this.i18n.t('rfLuckyNumber')}: ${d.luckyNumbers.join(', ')}`);
    else if (m) lines.push(stars(m.score), this.L(m.text));
    else lines.push(...this.week().map(w => `${w.date} ${stars(w.score)}`));
    lines.push('', 'Vaidik Pandit');
    return 'https://wa.me/?text=' + encodeURIComponent(lines.join('\n'));
  }
}
