import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountService, Booking, Pandit } from '../../core/services/account.service';
import { STATES } from '../../core/services/location.service';
import { BOOKING_CSS, BookingOffComponent, FaceComponent, PUJAS, SAMPRADAYAS, SPOKEN, useTx } from './booking-ui';

/** One Pandit's public profile and the booking request form. */
@Component({
  selector: 'vp-pandit-profile',
  standalone: true,
  imports: [FormsModule, RouterLink, BookingOffComponent, FaceComponent],
  template: `
  <div class="wrap page narrow">
    <a routerLink="/pandits" class="back">← {{ t.tx('All Pandits', 'सभी पंडित') }}</a>
    @if (!acc.configured) { <vp-booking-off /> }
    @else if (loading()) { <p class="muted">{{ t.tx('Loading…', 'लोड हो रहा है…') }}</p> }
    @else if (pandit()) {
      @let p = pandit()!;
      <section class="hero panel">
        <vp-face [photo]="p.photo" [name]="p.name" [size]="96" />
        <div class="who">
          <h1>{{ p.name }}</h1>
          <p class="muted">📍 {{ p.city }}@if (p.state) {, {{ stateName(p.state) }} }</p>
          <p class="tags">
            @if (p.status === 'approved') { <span class="tag ok">✔ {{ t.tx('Verified by Vaidik Pandit', 'वैदिक पंडित द्वारा सत्यापित') }}</span> }
            @else { <span class="tag bad">{{ t.tx('Not available for booking', 'बुकिंग के लिए उपलब्ध नहीं') }}</span> }
            @if (p.online) { <span class="tag ok">● {{ t.tx('Available', 'उपलब्ध') }}</span> }
          </p>
        </div>
      </section>

      <dl class="facts">
        <div><dt>{{ t.tx('Experience', 'अनुभव') }}</dt><dd>{{ p.experience }} {{ t.tx('years', 'वर्ष') }}</dd></div>
        @if (p.sampradaya) { <div><dt>{{ t.tx('Tradition', 'संप्रदाय') }}</dt><dd>{{ t.name(sampradayas, p.sampradaya) }}</dd></div> }
        <div><dt>{{ t.tx('Languages', 'भाषाएँ') }}</dt><dd>{{ langs(p) }}</dd></div>
        @if (p.fee) { <div><dt>{{ t.tx('Dakshina', 'दक्षिणा') }}</dt><dd>{{ p.fee }}</dd></div> }
      </dl>
      @if (p.about) { <p class="about">{{ p.about }}</p> }
      <h2>{{ t.tx('Pujas performed', 'कराई जाने वाली पूजाएँ') }}</h2>
      <div class="chips">@for (x of p.pujas; track x) { <span class="chip static">{{ t.name(pujas, x) }}</span> }</div>

      @if (p.status === 'approved') {
        <h2 id="book">{{ t.tx('Request a booking', 'बुकिंग का अनुरोध') }}</h2>
        @if (acc.user() === null) {
          <div class="panel login">
            <p>{{ t.tx('Log in or create a free account to book this Pandit.', 'इन पंडित जी को बुक करने के लिए लॉग इन करें या मुफ़्त खाता बनाएँ।') }}</p>
            <a class="btn" routerLink="/account" [queryParams]="{ next: '/pandits/' + p.uid }">{{ t.tx('Log in / Sign up', 'लॉग इन / नया खाता') }}</a>
          </div>
        } @else if (acc.user()?.uid === p.uid) {
          <p class="muted">{{ t.tx('This is your own profile.', 'यह आपकी अपनी प्रोफ़ाइल है।') }} <a routerLink="/pandit">{{ t.tx('Open dashboard', 'डैशबोर्ड खोलें') }} →</a></p>
        } @else {
          <form class="panel stack" (ngSubmit)="book(p)">
            <div class="field"><label for="pj">{{ t.tx('Puja', 'पूजा') }}</label>
              <select id="pj" class="input" name="puja" [(ngModel)]="form.puja" required>
                @for (x of p.pujas; track x) { <option [value]="x">{{ t.name(pujas, x) }}</option> }
              </select></div>
            <div class="row2">
              <div class="field"><label for="dt">{{ t.tx('Date', 'तारीख़') }}</label><input id="dt" class="input" type="date" name="date" [min]="today" [(ngModel)]="form.date" required></div>
              <div class="field"><label for="tm">{{ t.tx('Time', 'समय') }}</label><input id="tm" class="input" type="time" name="time" [(ngModel)]="form.time"></div>
            </div>
            <div class="field"><span class="lbl">{{ t.tx('Where', 'कहाँ') }}</span>
              <div class="chips">
                @for (m of modes; track m[0]) { <button type="button" class="chip" [class.on]="form.mode === m[0]" (click)="form.mode = m[0]">{{ m[1] }} {{ t.tx(m[2], m[3]) }}</button> }
              </div></div>
            @if (form.mode !== 'online') {
              <div class="field"><label for="ad">{{ t.tx('Address', 'पता') }}</label><textarea id="ad" class="input" name="address" [(ngModel)]="form.address" rows="2"
                [placeholder]="t.tx('House, area, city (shared only with this Pandit)', 'मकान, मोहल्ला, शहर (केवल इन पंडित जी को दिखेगा)')"></textarea></div>
            }
            <div class="field"><label for="nt">{{ t.tx('Notes for PanditJi', 'पंडित जी के लिए संदेश') }}</label><textarea id="nt" class="input" name="notes" [(ngModel)]="form.notes" rows="3"
              [placeholder]="t.tx('Gotra, occasion, samagri needed, number of people…', 'गोत्र, अवसर, सामग्री, लोगों की संख्या…')"></textarea></div>
            @if (!acc.profile()?.phone) { <p class="err">{{ t.tx('Add your mobile number in your profile first.', 'पहले अपनी प्रोफ़ाइल में मोबाइल नंबर जोड़ें।') }} <a routerLink="/account">→</a></p> }
            @if (msg()) { <p class="err" role="status">{{ msg() }}</p> }
            <button class="btn" type="submit" [disabled]="busy() || !acc.profile()?.phone">{{ busy() ? t.tx('Sending…', 'भेज रहे हैं…') : t.tx('Send booking request', 'बुकिंग अनुरोध भेजें') }}</button>
            <p class="note">{{ t.tx('PanditJi will confirm, and then you can chat and call him. Dakshina is paid directly to him.', 'पंडित जी पुष्टि करेंगे, फिर आप उनसे बात व फ़ोन कर सकेंगे। दक्षिणा सीधे उन्हें दें।') }}</p>
          </form>
        }
      }
    } @else {
      <p class="muted">{{ t.tx('This Pandit was not found.', 'ये पंडित जी नहीं मिले।') }}</p>
    }
  </div>`,
  styles: [BOOKING_CSS + `
    .narrow { max-width: 760px; }
    .hero { display: flex; gap: 18px; align-items: center; }
    .hero .who { min-width: 0; } .hero p { margin: 2px 0; } .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px !important; }
    .facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin: 14px 0; }
    .facts div { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; min-width: 0; }
    .facts dt { font-size: .78rem; color: var(--faint); } .facts dd { margin: 0; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }
    .about { white-space: pre-line; }
    h2 { font-size: var(--s2); margin: 22px 0 10px; }
    .chip.static { cursor: default; }
    .lbl { font-size: var(--s-1); color: var(--muted); font-weight: 500; }
    .login { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; } .login p { margin: 0; }
    @media (max-width: 560px) { .hero { flex-direction: column; text-align: center; } .tags { justify-content: center; } }
  `],
})
export class PanditProfileComponent {
  readonly acc = inject(AccountService);
  readonly t = useTx();
  private router = inject(Router);
  readonly pujas = PUJAS;
  readonly sampradayas = SAMPRADAYAS;
  readonly modes: [Booking['mode'], string, string, string][] = [['home', '🏠', 'At my home', 'मेरे घर'], ['temple', '🛕', 'At a temple', 'मंदिर में'], ['online', '📱', 'Online (video)', 'ऑनलाइन (वीडियो)']];
  readonly pandit = signal<Pandit | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly msg = signal('');
  readonly today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  form = { puja: '', date: '', time: '', mode: 'home' as Booking['mode'], address: '', notes: '' };

  constructor() {
    inject(ActivatedRoute).paramMap.subscribe(m => {
      const id = m.get('id') ?? '';
      if (!this.acc.configured || !id) { this.loading.set(false); return; }
      this.loading.set(true);
      this.acc.pandit(id).then(p => {
        this.pandit.set(p);
        if (p) { this.form.puja = p.pujas[0] ?? ''; if (p.pujas.length === 1 && p.pujas[0] === 'Online Puja') this.form.mode = 'online'; }
      }).catch(() => this.pandit.set(null)).finally(() => this.loading.set(false));
    });
  }

  stateName(n: string) { const s = STATES.find(x => x.n === n); return s ? (this.t.hi() ? s.h : s.n) : n; }
  langs(p: Pandit) { return p.languages.map(l => this.t.name(SPOKEN, l)).join(', '); }

  async book(p: Pandit) {
    this.msg.set('');
    if (!this.form.puja || !this.form.date) return this.msg.set(this.t.tx('Please choose the puja and date.', 'पूजा और तारीख़ चुनें।'));
    if (this.form.mode !== 'online' && !this.form.address.trim()) return this.msg.set(this.t.tx('Please add the address.', 'पता लिखें।'));
    this.busy.set(true);
    try {
      const id = await this.acc.book(p, { ...this.form, address: this.form.mode === 'online' ? '' : this.form.address.trim(), notes: this.form.notes.trim() });
      this.router.navigate(['/booking', id]);
    } catch (e) { this.msg.set(this.acc.errorText(e, this.t.hi())); }
    finally { this.busy.set(false); }
  }
}
