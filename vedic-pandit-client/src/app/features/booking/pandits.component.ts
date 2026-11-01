import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountService, Pandit } from '../../core/services/account.service';
import { STATES } from '../../core/services/location.service';
import { BOOKING_CSS, BookingOffComponent, FaceComponent, PUJAS, SPOKEN, useTx } from './booking-ui';

/** Verified Pandits, filtered by state, puja and language. */
@Component({
  selector: 'vp-pandits',
  standalone: true,
  imports: [FormsModule, RouterLink, BookingOffComponent, FaceComponent],
  template: `
  <div class="wrap page">
    <h1>{{ t.tx('Book a Pandit', 'पंडित जी बुक करें') }}</h1>
    <p class="lead">{{ t.tx('Every Pandit here is checked and approved by Vedic Pandit. Send a request, chat, and call him once he accepts.',
      'यहाँ हर पंडित जी की जाँच करके स्वीकृति दी गई है। अनुरोध भेजें, बात करें और स्वीकार होने पर सीधे फ़ोन करें।') }}</p>

    @if (!acc.configured) { <vp-booking-off /> }
    @else {
      <div class="filters">
        <select class="input" [(ngModel)]="state" aria-label="State">
          <option value="">{{ t.tx('All states', 'सभी राज्य') }}</option>
          @for (s of states; track s.n) { <option [value]="s.n">{{ t.hi() ? s.h : s.n }}</option> }
        </select>
        <select class="input" [(ngModel)]="puja" aria-label="Puja">
          <option value="">{{ t.tx('Any puja', 'कोई भी पूजा') }}</option>
          @for (p of pujas; track p[0]) { <option [value]="p[0]">{{ t.pick(p) }}</option> }
        </select>
        <select class="input" [(ngModel)]="lang" aria-label="Language">
          <option value="">{{ t.tx('Any language', 'कोई भी भाषा') }}</option>
          @for (l of spoken; track l[0]) { <option [value]="l[0]">{{ t.pick(l) }}</option> }
        </select>
        <input class="input" [(ngModel)]="q" [placeholder]="t.tx('Name or city', 'नाम या शहर')" aria-label="Search">
      </div>

      @if (loading()) { <p class="muted">{{ t.tx('Loading Pandits…', 'पंडित जी की सूची आ रही है…') }}</p> }
      @else if (error()) { <p class="err">{{ error() }}</p> }
      @else {
        @let list = shown();
        <p class="count muted">{{ list.length }} {{ t.tx(list.length === 1 ? 'Pandit' : 'Pandits', 'पंडित') }}</p>
        <div class="grid">
          @for (p of list; track p.uid) {
            <a class="pcard" [routerLink]="['/pandits', p.uid]">
              <vp-face [photo]="p.photo" [name]="p.name" [size]="64" />
              <span class="info">
                <b>{{ p.name }} <span class="vf" [title]="t.tx('Verified', 'सत्यापित')">✔</span></b>
                <small>📍 {{ p.city }}@if (p.state) {, {{ stateName(p.state) }} }</small>
                <small>🕉️ {{ p.experience }} {{ t.tx('yrs', 'वर्ष') }} · {{ langs(p) }}</small>
                <span class="mini">@for (x of p.pujas.slice(0, 3); track x) { <i>{{ t.name(pujas, x) }}</i> }@if (p.pujas.length > 3) { <i>+{{ p.pujas.length - 3 }}</i> }</span>
              </span>
              @if (p.online) { <span class="on" [title]="t.tx('Available', 'उपलब्ध')"></span> }
            </a>
          } @empty {
            <div class="panel empty">
              @if (all().length) { {{ t.tx('No Pandit matches these filters. Try fewer filters.', 'इन विकल्पों से कोई पंडित नहीं मिले। कम विकल्प चुनें।') }} }
              @else { {{ t.tx('Pandits are joining soon. Are you a Pandit?', 'पंडित जी जल्द जुड़ रहे हैं। क्या आप पंडित हैं?') }} <a routerLink="/pandit">{{ t.tx('Join here', 'यहाँ जुड़ें') }} →</a> }
            </div>
          }
        </div>
      }
      <p class="note">{{ t.tx('Dakshina and samagri are settled directly with the Pandit. Vedic Pandit only connects you and does not take any payment.',
        'दक्षिणा और सामग्री की बात सीधे पंडित जी से होती है। वैदिक पंडित केवल आपको जोड़ता है, कोई भुगतान नहीं लेता।') }}</p>
      <a routerLink="/pandit" class="join">🪔 {{ t.tx('Are you a Pandit? Join Vedic Pandit', 'क्या आप पंडित हैं? वैदिक पंडित से जुड़ें') }} →</a>
    }
  </div>`,
  styles: [BOOKING_CSS + `
    .filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
    .count { margin: 0 0 8px; font-size: var(--s-1); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .pcard { position: relative; display: flex; gap: 14px; align-items: flex-start; padding: 14px 30px 14px 14px; border-radius: 16px; background: var(--card);
      border: 1px solid var(--line); text-decoration: none; color: inherit; min-width: 0; }
    .pcard:hover { border-color: var(--ink); }
    .info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .info b { color: var(--ink); font-size: 1.08rem; }
    .info small { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vf { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--tulsi); color: #fff; font-size: .7rem; vertical-align: 2px; }
    .mini { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .mini i { font-style: normal; font-size: .76rem; background: var(--haldi-soft); border-radius: 999px; padding: 1px 8px; }
    .on { position: absolute; top: 14px; right: 14px; width: 10px; height: 10px; border-radius: 50%; background: #2BB673; box-shadow: 0 0 0 3px #2BB67333; }
    .join { display: inline-block; margin-top: 6px; font-weight: 600; color: var(--sindoor); text-decoration: none; }
    @media (max-width: 760px) { .filters { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .grid { grid-template-columns: minmax(0, 1fr); } }
  `],
})
export class PanditsComponent {
  readonly acc = inject(AccountService);
  readonly t = useTx();
  readonly states = STATES;
  readonly pujas = PUJAS;
  readonly spoken = SPOKEN;
  readonly all = signal<Pandit[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  // filters (signals so `shown` recomputes)
  private readonly f = signal({ state: '', puja: '', lang: '', q: '' });
  get state() { return this.f().state; } set state(v: string) { this.f.update(x => ({ ...x, state: v })); }
  get puja() { return this.f().puja; } set puja(v: string) { this.f.update(x => ({ ...x, puja: v })); }
  get lang() { return this.f().lang; } set lang(v: string) { this.f.update(x => ({ ...x, lang: v })); }
  get q() { return this.f().q; } set q(v: string) { this.f.update(x => ({ ...x, q: v })); }

  constructor() {
    if (!this.acc.configured) { this.loading.set(false); return; }
    // Default to the reader's own state when we know it
    try { const pl = JSON.parse(localStorage.getItem('vp.place') ?? 'null'); if (pl?.state) this.f.update(x => ({ ...x, state: pl.state })); } catch { /* ignore */ }
    this.acc.approvedPandits()
      .then(l => this.all.set(l.sort((a, b) => Number(b.online) - Number(a.online) || b.experience - a.experience)))
      .catch(e => this.error.set(this.acc.errorText(e, this.t.hi())))
      .finally(() => this.loading.set(false));
  }

  readonly shown = computed(() => {
    const { state, puja, lang, q } = this.f();
    const qq = q.trim().toLowerCase();
    let l = this.all().filter(p => (!puja || p.pujas.includes(puja)) && (!lang || p.languages.includes(lang))
      && (!qq || p.name.toLowerCase().includes(qq) || p.city.toLowerCase().includes(qq)));
    // Same-state Pandits first, but never hide online pujas from other states
    if (state) l = l.filter(p => p.state === state || p.pujas.includes('Online Puja'))
      .sort((a, b) => Number(b.state === state) - Number(a.state === state));
    return l;
  });

  stateName(n: string) { const s = STATES.find(x => x.n === n); return s ? (this.t.hi() ? s.h : s.n) : n; }
  langs(p: Pandit) { return p.languages.slice(0, 3).map(l => this.t.name(SPOKEN, l)).join(', '); }
}
