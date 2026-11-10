import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountService, Pandit, PanditStatus } from '../../core/services/account.service';
import { BOOKING_CSS, BookingOffComponent, FaceComponent, PUJAS, SPOKEN, intlPhone, panditStatusText, useTx } from './booking-ui';

/** Owner only: review Pandit profiles, call them, then approve, reject or suspend. */
@Component({
  selector: 'vp-admin',
  standalone: true,
  imports: [FormsModule, RouterLink, BookingOffComponent, FaceComponent],
  template: `
  <div class="wrap page">
    <h1>🛡️ {{ t.tx('Pandit verification', 'पंडित सत्यापन') }}</h1>
    @if (!acc.configured) { <vp-booking-off /> }
    @else if (acc.user() === undefined) { <p class="muted">{{ t.tx('Loading…', 'लोड हो रहा है…') }}</p> }
    @else if (!acc.isAdmin()) {
      <div class="panel empty">{{ t.tx('This page is only for the Vaidik Pandit team.', 'यह पृष्ठ केवल वैदिक पंडित टीम के लिए है।') }}
        @if (acc.user() === null) { <a routerLink="/account" [queryParams]="{ next: '/admin' }">{{ t.tx('Log in', 'लॉग इन') }} →</a> }</div>
    } @else {
      @if (!acc.user()?.verified) { <p class="err">{{ t.tx('Verify your admin email first (see My account), or Firestore will refuse changes.', 'पहले अपना एडमिन ईमेल सत्यापित करें (मेरा खाता देखें), नहीं तो बदलाव नहीं होंगे।') }}</p> }
      <p class="lead">{{ t.tx('Call the Pandit on the number given, check his knowledge and photo, then approve. Only approved Pandits appear in Book a Pandit.',
        'दिए गए नंबर पर पंडित जी से बात करें, उनका ज्ञान और फ़ोटो जाँचें, फिर स्वीकृति दें। केवल स्वीकृत पंडित ही बुकिंग सूची में दिखते हैं।') }}</p>
      <div class="seg">
        @for (s of statuses; track s) { <button type="button" [class.on]="tab() === s" (click)="tab.set(s)">{{ label(s) }}</button> }
      </div>
      @if (msg()) { <p class="err" role="status">{{ msg() }}</p> }
      @if (loading()) { <p class="muted">{{ t.tx('Loading…', 'लोड हो रहा है…') }}</p> }
      <div class="list">
        @for (p of list(); track p.uid) {
          <article class="panel pa">
            <header>
              <vp-face [photo]="p.photo" [name]="p.name" [size]="84" />
              <div class="who">
                <h2>{{ p.name }}</h2>
                <p class="muted">📍 {{ p.city }}, {{ p.state }} · {{ p.experience }} {{ t.tx('yrs', 'वर्ष') }}@if (p.sampradaya) { · {{ p.sampradaya }} }@if (p.traditions.length) { · {{ p.traditions.join(', ') }} }</p>
                <p class="contact">
                  <a [href]="'tel:+' + phone(p.phone)">📞 {{ p.phone }}</a>
                  @if (p.whatsapp || p.phone) { <a [href]="'https://wa.me/' + phone(p.whatsapp || p.phone)" target="_blank" rel="noopener">💬 WhatsApp</a> }
                </p>
                @if (p.createdAt) { <p class="faint small">{{ t.tx('Applied', 'आवेदन') }}: {{ when(p.createdAt) }}</p> }
              </div>
            </header>
            <p><b>{{ t.tx('Languages', 'भाषाएँ') }}:</b> {{ langs(p) }}</p>
            <div class="chips">@for (x of p.pujas; track x) { <span class="chip">{{ t.name(pujas, x) }}</span> }</div>
            @if (p.fee) { <p><b>{{ t.tx('Dakshina', 'दक्षिणा') }}:</b> {{ p.fee }}</p> }
            @if (p.about) { <p class="about">{{ p.about }}</p> }
            @if (p.rejectReason) { <p class="faint">{{ t.tx('Last reason', 'पिछला कारण') }}: {{ p.rejectReason }}</p> }
            <div class="field"><input class="input" [(ngModel)]="reasons[p.uid]" [placeholder]="t.tx('Reason, if rejecting or suspending (the Pandit sees it)', 'अस्वीकार/निलंबन का कारण (पंडित जी देखेंगे)')"></div>
            <div class="actions">
              @if (p.status !== 'approved') { <button type="button" class="btn ok" (click)="set(p, 'approved')" [disabled]="busy()">✔ {{ t.tx('Approve', 'स्वीकृत करें') }}</button> }
              @if (p.status === 'pending') { <button type="button" class="btn ghost" (click)="set(p, 'rejected')" [disabled]="busy()">{{ t.tx('Reject', 'अस्वीकार') }}</button> }
              @if (p.status === 'approved') { <button type="button" class="btn ghost" (click)="set(p, 'suspended')" [disabled]="busy()">{{ t.tx('Suspend', 'निलंबित करें') }}</button>
                <a class="btn quiet" [routerLink]="['/pandits', p.uid]">👁 {{ t.tx('View', 'देखें') }}</a> }
            </div>
          </article>
        } @empty { @if (!loading()) { <div class="panel empty">{{ t.tx('No Pandits in this list.', 'इस सूची में कोई पंडित नहीं।') }}</div> } }
      </div>
    }
  </div>`,
  styles: [BOOKING_CSS + `
    .seg { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 14px; scrollbar-width: none; }
    .seg button { flex: none; border: 1.5px solid var(--line); background: var(--card); padding: 7px 14px; border-radius: 999px; font: inherit; font-weight: 600; color: var(--ink); cursor: pointer; }
    .seg button.on { background: var(--ink); color: #fff; border-color: var(--ink); }
    .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 14px; }
    .pa { display: grid; gap: 10px; min-width: 0; } .pa p { margin: 0; }
    .pa header { display: flex; gap: 14px; align-items: center; } .pa .who { min-width: 0; } .pa h2 { margin: 0; font-size: var(--s2); }
    .contact { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 4px !important; } .contact a { font-weight: 600; color: var(--sindoor); text-decoration: none; }
    .small { font-size: .8rem; } .about { white-space: pre-line; }
    .chip { cursor: default; }
    .ok { background: var(--tulsi); } .ok:hover { background: #24563f; }
  `],
})
export class AdminComponent {
  readonly acc = inject(AccountService);
  readonly t = useTx();
  readonly pujas = PUJAS;
  readonly statuses: PanditStatus[] = ['pending', 'approved', 'rejected', 'suspended'];
  readonly tab = signal<PanditStatus>('pending');
  readonly list = signal<Pandit[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly msg = signal('');
  reasons: Record<string, string> = {};

  constructor() {
    effect(() => { const s = this.tab(); if (this.acc.isAdmin()) this.load(s); });
  }

  label(s: PanditStatus) { return s === 'pending' ? this.t.tx('Waiting', 'प्रतीक्षा में') : panditStatusText(s, this.t.hi()); }
  phone(p: string) { return intlPhone(p); }
  langs(p: Pandit) { return p.languages.map(l => this.t.name(SPOKEN, l)).join(', '); }
  when(ms: number) { return new Date(ms).toLocaleString(this.t.hi() ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }

  private async load(s: PanditStatus) {
    this.loading.set(true); this.msg.set('');
    try { this.list.set(await this.acc.panditsByStatus(s)); }
    catch (e) { this.list.set([]); this.msg.set(this.acc.errorText(e, this.t.hi())); }
    finally { this.loading.set(false); }
  }
  async set(p: Pandit, s: PanditStatus) {
    const reason = (this.reasons[p.uid] ?? '').trim();
    if ((s === 'rejected' || s === 'suspended') && !reason) return this.msg.set(this.t.tx('Please write a reason first.', 'पहले कारण लिखें।'));
    this.busy.set(true); this.msg.set('');
    try { await this.acc.setPanditStatus(p.uid, s, s === 'approved' ? '' : reason); this.list.update(l => l.filter(x => x.uid !== p.uid)); }
    catch (e) { this.msg.set(this.acc.errorText(e, this.t.hi())); }
    finally { this.busy.set(false); }
  }
}
