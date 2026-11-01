import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccountService, Booking, Message } from '../../core/services/account.service';
import { BOOKING_CSS, BookingOffComponent, PUJAS, bookingStatusText, fmtDate, intlPhone, useTx } from './booking-ui';

/** One booking, seen by the devotee or the Pandit: status, actions, call/WhatsApp and the in-app chat. */
@Component({
  selector: 'vp-booking',
  standalone: true,
  imports: [FormsModule, RouterLink, BookingOffComponent],
  template: `
  <div class="wrap page narrow">
    <a [routerLink]="asPandit() ? '/pandit' : '/account'" class="back">← {{ asPandit() ? t.tx('Dashboard', 'डैशबोर्ड') : t.tx('My bookings', 'मेरी बुकिंग') }}</a>
    @if (!acc.configured) { <vp-booking-off /> }
    @else if (acc.user() === null) {
      <div class="panel empty">{{ t.tx('Please log in to see this booking.', 'यह बुकिंग देखने के लिए लॉग इन करें।') }}
        <a routerLink="/account" [queryParams]="{ next: '/booking/' + id() }">{{ t.tx('Log in', 'लॉग इन') }} →</a></div>
    }
    @else if (b(); as b) {
      <section class="head panel">
        <div class="ttl">
          <span class="pj" aria-hidden="true">🪔</span>
          <div><h1>{{ t.name(pujas, b.puja) }}</h1>
            <p class="muted">{{ asPandit() ? t.tx('Devotee', 'यजमान') + ': ' + b.userName : t.tx('Pandit', 'पंडित') + ': ' + b.panditName }}</p></div>
        </div>
        <span class="tag big" [class.ok]="b.status === 'accepted' || b.status === 'completed'" [class.bad]="b.status === 'declined' || b.status === 'cancelled'">{{ status(b) }}</span>
      </section>

      <dl class="facts">
        <div><dt>{{ t.tx('Date', 'तारीख़') }}</dt><dd>{{ date(b.date) }}</dd></div>
        @if (b.time) { <div><dt>{{ t.tx('Time', 'समय') }}</dt><dd>{{ b.time }}</dd></div> }
        <div><dt>{{ t.tx('Where', 'कहाँ') }}</dt><dd>{{ mode(b) }}</dd></div>
        @if (b.address) { <div class="wide"><dt>{{ t.tx('Address', 'पता') }}</dt><dd>{{ b.address }}</dd></div> }
        @if (b.notes) { <div class="wide"><dt>{{ t.tx('Notes', 'संदेश') }}</dt><dd>{{ b.notes }}</dd></div> }
        @if (b.status === 'declined' && b.declineReason) { <div class="wide"><dt>{{ t.tx('Reason', 'कारण') }}</dt><dd>{{ b.declineReason }}</dd></div> }
      </dl>

      @if (b.status === 'accepted' && phone()) {
        <div class="connect">
          <a class="btn call" [href]="'tel:+' + phone()">📞 {{ t.tx('Call', 'फ़ोन करें') }}</a>
          <a class="btn wa" [href]="waLink(b)" target="_blank" rel="noopener">💬 WhatsApp</a>
        </div>
      }

      @if (asPandit() && b.status === 'requested') {
        @if (declining()) {
          <div class="panel stack">
            <label for="rs">{{ t.tx('Reason (shown to the devotee)', 'कारण (यजमान को दिखेगा)') }}</label>
            <textarea id="rs" class="input" [(ngModel)]="reason" rows="2" [placeholder]="t.tx('Not available on this date…', 'इस तारीख़ को उपलब्ध नहीं…')"></textarea>
            <div class="actions"><button type="button" class="btn" (click)="respond(b, false)" [disabled]="busy()">{{ t.tx('Decline request', 'अनुरोध अस्वीकार करें') }}</button>
              <button type="button" class="btn ghost" (click)="declining.set(false)">{{ t.tx('Back', 'वापस') }}</button></div>
          </div>
        } @else {
          <div class="actions">
            <button type="button" class="btn accept" (click)="respond(b, true)" [disabled]="busy()">✔ {{ t.tx('Accept booking', 'बुकिंग स्वीकार करें') }}</button>
            <button type="button" class="btn ghost" (click)="declining.set(true)">{{ t.tx('Decline', 'अस्वीकार') }}</button>
          </div>
          <p class="note">{{ t.tx('When you accept, your phone number is shared with this devotee so they can call you.', 'स्वीकार करते ही आपका फ़ोन नंबर इस यजमान को दिखेगा ताकि वे आपको फ़ोन कर सकें।') }}</p>
        }
      }
      @if (b.status === 'accepted' || (!asPandit() && b.status === 'requested')) {
        <div class="actions">
          @if (asPandit() && b.status === 'accepted') { <button type="button" class="btn quiet" (click)="setStatus(b, 'completed')" [disabled]="busy()">✔ {{ t.tx('Mark puja completed', 'पूजा संपन्न हुई') }}</button> }
          <button type="button" class="btn ghost" (click)="setStatus(b, 'cancelled')" [disabled]="busy()">{{ t.tx('Cancel booking', 'बुकिंग रद्द करें') }}</button>
        </div>
      }
      @if (msg()) { <p class="err" role="status">{{ msg() }}</p> }

      <h2>{{ t.tx('Chat', 'बातचीत') }}</h2>
      <section class="chat panel">
        <div class="msgs" #box>
          @for (m of msgs(); track m.id) {
            <div class="m" [class.me]="m.from === acc.user()?.uid"><p>{{ m.text }}</p><small>{{ m.name }}@if (m.at) { · {{ clock(m.at) }} }</small></div>
          } @empty {
            <p class="muted hint">{{ asPandit() ? t.tx('Say Namaste and ask about the details.', 'नमस्ते कहें और पूजा की जानकारी लें।') : t.tx('Ask PanditJi about samagri, timing or dakshina.', 'पंडित जी से सामग्री, समय या दक्षिणा के बारे में पूछें।') }}</p>
          }
        </div>
        @if (open(b)) {
          <form class="send" (ngSubmit)="send()">
            <input class="input" name="text" [(ngModel)]="text" [placeholder]="t.tx('Write a message…', 'संदेश लिखें…')" autocomplete="off" maxlength="1000">
            <button class="btn" type="submit" [disabled]="!text.trim()" [attr.aria-label]="t.tx('Send', 'भेजें')">➤</button>
          </form>
        } @else { <p class="muted closed">{{ t.tx('This booking is closed.', 'यह बुकिंग बंद हो चुकी है।') }}</p> }
      </section>
      <p class="note">{{ t.tx('Please do not pay anyone before the puja is confirmed. Report misuse to the Vedic Pandit team.', 'पूजा पक्की होने से पहले किसी को भुगतान न करें। किसी भी गड़बड़ की सूचना वैदिक पंडित टीम को दें।') }}</p>
    }
    @else if (missing()) { <p class="muted">{{ t.tx('Booking not found, or you do not have access to it.', 'बुकिंग नहीं मिली, या आपको इसकी अनुमति नहीं है।') }}</p> }
    @else { <p class="muted">{{ t.tx('Loading…', 'लोड हो रहा है…') }}</p> }
  </div>`,
  styles: [BOOKING_CSS + `
    .narrow { max-width: 760px; }
    .head { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
    .ttl { display: flex; gap: 12px; align-items: center; min-width: 0; } .ttl h1 { font-size: var(--s2); } .ttl p { margin: 0; }
    .pj { font-size: 2rem; }
    .tag.big { font-size: .9rem; padding: 5px 14px; }
    .facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin: 14px 0; }
    .facts div { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; min-width: 0; }
    .facts .wide { grid-column: 1 / -1; }
    .facts dt { font-size: .78rem; color: var(--faint); } .facts dd { margin: 0; font-weight: 600; color: var(--ink); white-space: pre-line; overflow-wrap: anywhere; }
    .connect { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
    .call { background: var(--ink); } .wa { background: #1FA855; } .wa:hover { background: #168a45; }
    .accept { background: var(--tulsi); } .accept:hover { background: #24563f; }
    .actions { margin: 10px 0; }
    h2 { font-size: var(--s2); margin: 22px 0 10px; }
    .chat { padding: 0; overflow: hidden; }
    .msgs { max-height: 55vh; min-height: 160px; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: var(--paper); }
    .m { max-width: 80%; align-self: flex-start; background: var(--card); border: 1px solid var(--line); border-radius: 14px 14px 14px 4px; padding: 8px 12px; }
    .m.me { align-self: flex-end; background: var(--ink); color: #fff; border-color: var(--ink); border-radius: 14px 14px 4px 14px; }
    .m p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; } .m small { font-size: .72rem; opacity: .7; }
    .hint { text-align: center; margin: auto; }
    .send { display: flex; gap: 8px; padding: 10px; border-top: 1px solid var(--line); background: var(--card); }
    .send .btn { padding: 10px 16px; }
    .closed { text-align: center; padding: 12px; margin: 0; border-top: 1px solid var(--line); }
  `],
})
export class BookingComponent {
  readonly acc = inject(AccountService);
  readonly t = useTx();
  readonly pujas = PUJAS;
  readonly id = signal('');
  readonly b = signal<Booking | null>(null);
  readonly missing = signal(false);
  readonly msgs = signal<Message[]>([]);
  readonly busy = signal(false);
  readonly msg = signal('');
  readonly declining = signal(false);
  private box = viewChild<ElementRef<HTMLElement>>('box');
  reason = ''; text = '';
  private stops: (() => void)[] = [];

  readonly asPandit = computed(() => { const b = this.b(); return !!b && b.panditId === this.acc.user()?.uid; });
  /** The other person's number: the Pandit's (copied on accept) for the devotee, the devotee's for the Pandit. */
  readonly phone = computed(() => { const b = this.b(); return b ? intlPhone(this.asPandit() ? b.userPhone : (b.panditWhatsapp || b.panditPhone || '')) : ''; });

  constructor() {
    inject(ActivatedRoute).paramMap.subscribe(m => this.id.set(m.get('id') ?? ''));
    effect(() => {
      const id = this.id(), u = this.acc.user();
      this.stops.forEach(s => s()); this.stops = [];
      this.b.set(null); this.missing.set(false);
      if (!u || !id) return;
      this.stops.push(this.acc.watchBooking(id, b => { this.b.set(b); this.missing.set(!b); }));
      this.stops.push(this.acc.watchMessages(id, m => { this.msgs.set(m); setTimeout(() => this.scroll(), 30); }));
    });
    inject(DestroyRef).onDestroy(() => this.stops.forEach(s => s()));
  }

  status(b: Booking) { return bookingStatusText(b.status, this.t.hi()); }
  date(d: string) { return fmtDate(d, this.t.hi()); }
  mode(b: Booking) {
    return ({ home: this.t.tx('At home', 'घर पर'), temple: this.t.tx('At a temple', 'मंदिर में'), online: this.t.tx('Online (video)', 'ऑनलाइन (वीडियो)') })[b.mode];
  }
  open(b: Booking) { return b.status === 'requested' || b.status === 'accepted'; }
  clock(at: number) { return new Date(at).toLocaleString(this.t.hi() ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
  waLink(b: Booking) {
    const text = this.asPandit()
      ? this.t.tx(`Namaste ${b.userName} ji, about your ${b.puja} booking on ${b.date}.`, `नमस्ते ${b.userName} जी, ${b.date} की ${b.puja} बुकिंग के बारे में।`)
      : this.t.tx(`Namaste PanditJi, about my ${b.puja} booking on ${b.date} (Vedic Pandit).`, `नमस्ते पंडित जी, ${b.date} की ${b.puja} बुकिंग के बारे में (वैदिक पंडित)।`);
    return `https://wa.me/${this.phone()}?text=${encodeURIComponent(text)}`;
  }
  private scroll() { const el = this.box()?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }

  private async run(f: () => Promise<void>) {
    this.busy.set(true); this.msg.set('');
    try { await f(); } catch (e) { this.msg.set(this.acc.errorText(e, this.t.hi())); } finally { this.busy.set(false); }
  }
  respond(b: Booking, accept: boolean) { return this.run(async () => { await this.acc.respond(b, accept, this.reason.trim()); this.declining.set(false); }); }
  setStatus(b: Booking, s: 'cancelled' | 'completed') {
    if (s === 'cancelled' && !confirmCancel(this.t.hi())) return;
    return this.run(() => this.acc.setBookingStatus(b, s));
  }
  async send() {
    const text = this.text.trim(); if (!text) return;
    this.text = '';
    try { await this.acc.send(this.id(), text); } catch (e) { this.text = text; this.msg.set(this.acc.errorText(e, this.t.hi())); }
  }
}

function confirmCancel(hi: boolean): boolean {
  try { return window.confirm(hi ? 'क्या आप यह बुकिंग रद्द करना चाहते हैं?' : 'Cancel this booking?'); } catch { return true; }
}
