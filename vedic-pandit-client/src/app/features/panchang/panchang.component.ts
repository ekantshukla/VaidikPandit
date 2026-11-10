import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { I18nService } from '../../core/services/i18n.service';
import { LocationService } from '../../core/services/location.service';
import { MonthSystem, PanchangResult } from '../../core/astro/models';
import { addDays, todayIn } from '../../core/astro/panchang-engine';
import { PanchangViewComponent } from '../../shared/panchang-view.component';
import { DayPipe } from '../../shared/time.pipe';
import { CALENDARS, CalId, calendar, defaultCalendar, regionalDay } from '../../core/astro/regional';
import { useTx } from '../booking/booking-ui';

@Component({
  selector: 'vp-panchang-page',
  standalone: true,
  imports: [FormsModule, PanchangViewComponent, DayPipe],
  template: `
  <div class="wrap page">
    <header class="page-head">
      <h1>{{ i18n.t('nav.panchang') }}</h1>
      <p>{{ date() | day: i18n.lang() }}, {{ loc.place().name }}</p>
    </header>

    <div class="tools">
      <div class="nav-days">
        <button class="btn ghost" type="button" (click)="shift(-1)" [attr.aria-label]="i18n.t('prevDay')">‹</button>
        <label class="sr-only" for="pdate">{{ i18n.t('date') }}</label>
        <input id="pdate" type="date" class="input" [ngModel]="date()" (ngModelChange)="date.set($event)">
        <button class="btn ghost" type="button" (click)="shift(1)" [attr.aria-label]="i18n.t('nextDayBtn')">›</button>
        <button class="btn quiet" type="button" (click)="date.set(today())">{{ i18n.t('todayBtn') }}</button>
      </div>
      <label class="calsel">
        <span>🗓️ {{ tx.tx('Calendar', 'पंचांग पद्धति') }}</span>
        <select class="input" [ngModel]="cal()" (ngModelChange)="pickCal($event)" aria-label="Regional calendar">
          @for (c of calendars; track c.id) { <option [value]="c.id">{{ tx.hi() ? c.hi : c.en }}</option> }
        </select>
      </label>
    </div>

    @if (reg(); as r) {
      <section class="reg panel" [attr.aria-label]="tx.tx('Regional calendar', 'क्षेत्रीय पंचांग')">
        <div class="rtop">
          <span class="rk">{{ tx.hi() ? r.cal.hi : r.cal.en }}</span>
          <span class="rw">{{ tx.hi() ? r.cal.whereHi : r.cal.where }}</span>
        </div>
        <p class="rdate"><b class="sa">{{ r.date.native }}</b>@if (r.date.native !== r.date.en) { <span class="ren">{{ r.date.en }}</span> }</p>
        @if (r.lunar) { <p class="rl">🌙 <span class="sa">{{ r.lunar.native }}</span> <span class="ren">· {{ r.lunar.en }}</span></p> }
        <p class="ry">@for (y of r.years; track y.en) { <span><b class="sa">{{ y.native }}</b>@if (y.native !== y.en) { <small> ({{ y.en }})</small> }</span> }</p>
        @if (r.festivals.length) { <ul class="rf">@for (f of r.festivals; track f.en) { <li>🪔 <b class="sa">{{ f.native }}</b>@if (f.native !== f.en) { <small> · {{ f.en }}</small> }</li> }</ul> }
        <p class="rn">{{ tx.tx('Tithi, nakshatra, yoga and muhurat below are the same across India; only month names, month start and the era differ by region.',
          'नीचे दिए तिथि, नक्षत्र, योग व मुहूर्त पूरे भारत में एक ही हैं; क्षेत्र के अनुसार केवल मास के नाम, मास का आरंभ और संवत् बदलते हैं।') }}</p>
      </section>
    }

    @if (error()) { <p class="err">{{ i18n.t('error') }}</p> }
    <div class="panel" [class.loading]="loading()">
      <vp-panchang-view [p]="p()" />
    </div>
    <p class="faint note">Lahiri ayanamsa {{ p()?.ayanamsa?.toFixed(4) }}°</p>
  </div>`,
  styles: [`
    .tools { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .nav-days { display: flex; gap: 8px; align-items: center; }
    .nav-days .ghost { width: 44px; padding: 0; font-size: 1.4rem; }
    .nav-days input { width: auto; }
    .calsel { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--muted); }
    .calsel .input { width: auto; max-width: 280px; }
    .reg { margin-bottom: 18px; display: grid; gap: 6px; border-left: 4px solid var(--haldi); }
    .rtop { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
    .rk { font-weight: 700; color: var(--sindoor); }
    .rw { color: var(--muted); font-size: var(--s-1); }
    .rdate { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
    .rdate b { font-size: 1.6rem; color: var(--ink); }
    .ren { color: var(--muted); }
    .rl, .ry, .rn { margin: 0; }
    .ry { display: flex; flex-wrap: wrap; gap: 4px 18px; }
    .ry small, .rf small { color: var(--muted); }
    .rf { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .rf li { background: var(--haldi-soft); border-radius: 999px; padding: 3px 12px; }
    .rn { font-size: var(--s-1); color: var(--muted); }
    @media (max-width: 600px) { .calsel { width: 100%; } .calsel .input { flex: 1; max-width: none; } }
    .ms { border: 0; padding: 4px; margin: 0; display: flex; background: #EAE6F2; border-radius: 999px; }
    .ms label { padding: 8px 14px; border-radius: 999px; cursor: pointer; color: var(--muted); font-weight: 500; }
    .ms label.on { background: var(--card); color: var(--ink); box-shadow: 0 1px 3px rgba(29,23,54,.12); }
    .ms input { position: absolute; opacity: 0; pointer-events: none; }
    .ms label:has(input:focus-visible) { outline: 3px solid var(--haldi); }
    .panel.loading { opacity: .55; transition: opacity .2s; }
    .note { margin-top: 14px; font-size: var(--s-1); }
    .err { color: var(--sindoor); }
  `],
})
export class PanchangPageComponent {
  readonly i18n = inject(I18nService);
  readonly loc = inject(LocationService);
  private api = inject(ApiService);
  readonly tx = useTx();
  readonly calendars = CALENDARS;
  readonly cal = signal<CalId>(this.savedCal() ?? defaultCalendar(this.loc.place().state, this.i18n.lang()));
  readonly today = () => todayIn(this.loc.place().tz);
  readonly date = signal(this.today());
  readonly system = computed<MonthSystem>(() => calendar(this.cal()).system);
  readonly reg = computed(() => { const p = this.p(); try { return p ? regionalDay(this.cal(), p) : null; } catch { return null; } });
  readonly p = signal<PanchangResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  constructor() {
    effect(() => {
      const d = this.date(), place = this.loc.place(), sys = this.system();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      this.loading.set(true);
      this.error.set(false);
      this.api.panchang(d, place.lat, place.lng, place.tz, sys)
        .then(r => this.p.set(r))
        .catch(() => this.error.set(true))
        .finally(() => this.loading.set(false));
    });
  }

  private savedCal(): CalId | null { try { const c = localStorage.getItem('vp.cal'); return CALENDARS.some(x => x.id === c) ? c as CalId : null; } catch { return null; } }
  pickCal(id: CalId) { this.cal.set(id); try { localStorage.setItem('vp.cal', id); } catch { /* ignore */ } }
  shift(n: number) { this.date.set(addDays(this.date(), n)); }
}
