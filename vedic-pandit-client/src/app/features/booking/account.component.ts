import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountService, Booking, Role, photoToDataUrl } from '../../core/services/account.service';
import { BOOKING_CSS, BookingOffComponent, FaceComponent, PUJAS, bookingStatusText, fmtDate, panditStatusText, useTx } from './booking-ui';

/** Log in / sign up (devotee or Pandit), then the profile and "My bookings". */
@Component({
  selector: 'vp-account',
  standalone: true,
  imports: [FormsModule, RouterLink, BookingOffComponent, FaceComponent],
  template: `
  <div class="wrap page narrow">
    @if (!acc.configured) { <vp-booking-off /> }
    @else if (acc.user() === undefined) { <p class="muted">{{ t.tx('Loading…', 'लोड हो रहा है…') }}</p> }
    @else if (acc.user() === null) {
      <h1>{{ mode() === 'up' ? t.tx('Create your account', 'अपना खाता बनाएँ') : mode() === 'reset' ? t.tx('Reset password', 'पासवर्ड बदलें') : t.tx('Welcome back', 'स्वागत है') }}</h1>
      <p class="lead">{{ t.tx('Book a verified Pandit for any puja, chat with him and call him directly.', 'किसी भी पूजा के लिए सत्यापित पंडित जी बुक करें, उनसे बात करें और सीधे फ़ोन करें।') }}</p>

      <div class="seg" role="tablist">
        <button type="button" role="tab" [class.on]="mode() !== 'up'" (click)="mode.set('in'); msg.set('')">{{ t.tx('Log in', 'लॉग इन') }}</button>
        <button type="button" role="tab" [class.on]="mode() === 'up'" (click)="mode.set('up'); msg.set('')">{{ t.tx('Sign up', 'नया खाता') }}</button>
      </div>

      <form class="panel stack" (ngSubmit)="submit()">
        @if (mode() === 'up') {
          <div class="field"><span class="lbl">{{ t.tx('I am a', 'मैं हूँ') }}</span>
            <div class="roles">
              <button type="button" class="role" [class.on]="role === 'user'" (click)="role = 'user'"><span aria-hidden="true">🙏</span><b>{{ t.tx('Devotee', 'यजमान / भक्त') }}</b><small>{{ t.tx('I want to book a Pandit', 'मुझे पंडित जी बुक करने हैं') }}</small></button>
              <button type="button" class="role" [class.on]="role === 'pandit'" (click)="role = 'pandit'"><span aria-hidden="true">🕉️</span><b>{{ t.tx('Pandit', 'पंडित / पुरोहित') }}</b><small>{{ t.tx('I perform pujas', 'मैं पूजा-पाठ कराता हूँ') }}</small></button>
            </div>
          </div>
          <div class="field"><label for="nm">{{ t.tx('Full name', 'पूरा नाम') }}</label><input id="nm" class="input" name="name" [(ngModel)]="name" required autocomplete="name"></div>
          <div class="row2">
            <div class="field"><label for="ph">{{ t.tx('Mobile number', 'मोबाइल नंबर') }}</label><input id="ph" class="input" name="phone" [(ngModel)]="phone" type="tel" inputmode="tel" required autocomplete="tel"></div>
            <div class="field"><label for="ct">{{ t.tx('City', 'शहर') }}</label><input id="ct" class="input" name="city" [(ngModel)]="city" autocomplete="address-level2"></div>
          </div>
        }
        <div class="field"><label for="em">{{ t.tx('Email', 'ईमेल') }}</label><input id="em" class="input" name="email" [(ngModel)]="email" type="email" required autocomplete="email"></div>
        @if (mode() !== 'reset') {
          <div class="field"><label for="pw">{{ t.tx('Password', 'पासवर्ड') }}</label>
            <input id="pw" class="input" name="password" [(ngModel)]="password" type="password" required minlength="6" [attr.autocomplete]="mode() === 'up' ? 'new-password' : 'current-password'"></div>
        }
        @if (msg()) { <p [class]="ok() ? 'okmsg' : 'err'" role="status">{{ msg() }}</p> }
        <button class="btn" type="submit" [disabled]="busy()">
          {{ busy() ? t.tx('Please wait…', 'कृपया रुकें…') : mode() === 'up' ? t.tx('Create account', 'खाता बनाएँ') : mode() === 'reset' ? t.tx('Send reset link', 'रीसेट लिंक भेजें') : t.tx('Log in', 'लॉग इन') }}
        </button>
        @if (mode() === 'in') { <button type="button" class="link" (click)="mode.set('reset'); msg.set('')">{{ t.tx('Forgot password?', 'पासवर्ड भूल गए?') }}</button> }
        @if (mode() === 'reset') { <button type="button" class="link" (click)="mode.set('in'); msg.set('')">← {{ t.tx('Back to log in', 'लॉग इन पर लौटें') }}</button> }
      </form>
      <p class="note">{{ t.tx('Your phone number is shared with a Pandit only when you book him. We never ask for ID documents.', 'आपका फ़ोन नंबर केवल उन्हीं पंडित जी को दिखता है जिन्हें आप बुक करते हैं। हम कोई पहचान-पत्र नहीं माँगते।') }}</p>
    } @else {
      @let p = acc.profile();
      <section class="me panel">
        <label class="pic" [title]="t.tx('Change photo', 'फ़ोटो बदलें')">
          <vp-face [name]="p?.name ?? ''" [photo]="p?.photo || acc.myPandit()?.photo" [size]="72" />
          <span class="cam" aria-hidden="true">📷</span>
          <input type="file" accept="image/*" (change)="pickPhoto($event)" hidden>
          <span class="sr-only">{{ t.tx('Change photo', 'फ़ोटो बदलें') }}</span>
        </label>
        <div class="who">
          <h1>{{ p?.name || acc.user()?.email }}</h1>
          <p class="muted">{{ acc.user()?.email }}@if (p?.phone) { · {{ p?.phone }} }@if (p?.city) { · {{ p?.city }} }</p>
          <p class="tags">
            <span class="tag">{{ p?.role === 'pandit' ? t.tx('Pandit', 'पंडित') : t.tx('Devotee', 'यजमान') }}</span>
            @if (acc.isAdmin()) { <span class="tag ok">Admin</span> }
          </p>
        </div>
      </section>

      @if (!acc.user()?.verified) {
        <div class="verify">
          <span>📧 {{ t.tx('Please verify your email. We sent you a link.', 'कृपया अपना ईमेल सत्यापित करें। हमने आपको लिंक भेजा है।') }}</span>
          <span class="actions">
            <button type="button" class="btn quiet" (click)="resend()">{{ t.tx('Send again', 'फिर भेजें') }}</button>
            <button type="button" class="btn ghost" (click)="acc.reloadUser()">{{ t.tx('I have verified', 'मैंने सत्यापित कर दिया') }}</button>
          </span>
        </div>
      }
      @if (msg()) { <p [class]="ok() ? 'okmsg' : 'err'" role="status">{{ msg() }}</p> }

      <div class="tiles">
        @if (p?.role === 'pandit') {
          <a routerLink="/pandit" class="tile hl"><span aria-hidden="true">🕉️</span><b>{{ t.tx('Pandit dashboard', 'पंडित डैशबोर्ड') }}</b>
            <small>@if (acc.myPandit(); as mp) { {{ statusText(mp.status) }} } @else { {{ t.tx('Complete your profile', 'अपनी प्रोफ़ाइल पूरी करें') }} }</small></a>
        }
        <a routerLink="/pandits" class="tile"><span aria-hidden="true">📿</span><b>{{ t.tx('Book a Pandit', 'पंडित जी बुक करें') }}</b><small>{{ t.tx('Verified Pandits near you', 'आपके पास के सत्यापित पंडित') }}</small></a>
        @if (acc.isAdmin()) { <a routerLink="/admin" class="tile"><span aria-hidden="true">🛡️</span><b>{{ t.tx('Admin', 'एडमिन') }}</b><small>{{ t.tx('Verify Pandits', 'पंडितों का सत्यापन') }}</small></a> }
        @if (p?.role !== 'pandit') {
          <a routerLink="/pandit" class="tile"><span aria-hidden="true">🪔</span><b>{{ t.tx('Are you a Pandit?', 'क्या आप पंडित हैं?') }}</b><small>{{ t.tx('Join and get bookings', 'जुड़ें और बुकिंग पाएँ') }}</small></a>
        }
      </div>

      <h2>{{ t.tx('My bookings', 'मेरी बुकिंग') }}</h2>
      @if (bookings().length) {
        <div class="stack">
          @for (b of bookings(); track b.id) {
            <a class="bk" [routerLink]="['/booking', b.id]">
              <span class="pj" aria-hidden="true">🪔</span>
              <span class="who"><b>{{ t.name(pujas, b.puja) }}</b><small>{{ b.panditName }} · {{ date(b.date) }} {{ b.time }}</small></span>
              <span class="tag" [class.ok]="b.status === 'accepted' || b.status === 'completed'" [class.bad]="b.status === 'declined' || b.status === 'cancelled'">{{ bStatus(b) }}</span>
            </a>
          }
        </div>
      } @else {
        <div class="panel empty">{{ t.tx('No bookings yet.', 'अभी कोई बुकिंग नहीं।') }} <a routerLink="/pandits">{{ t.tx('Find a Pandit', 'पंडित जी खोजें') }} →</a></div>
      }

      <details class="edit panel">
        <summary>{{ t.tx('Edit profile', 'प्रोफ़ाइल बदलें') }}</summary>
        <form class="stack" (ngSubmit)="saveProfile()">
          <div class="field"><label for="enm">{{ t.tx('Full name', 'पूरा नाम') }}</label><input id="enm" class="input" name="ename" [(ngModel)]="name" required></div>
          <div class="row2">
            <div class="field"><label for="eph">{{ t.tx('Mobile number', 'मोबाइल नंबर') }}</label><input id="eph" class="input" name="ephone" [(ngModel)]="phone" type="tel"></div>
            <div class="field"><label for="ect">{{ t.tx('City', 'शहर') }}</label><input id="ect" class="input" name="ecity" [(ngModel)]="city"></div>
          </div>
          <button class="btn" type="submit" [disabled]="busy()">{{ t.tx('Save', 'सहेजें') }}</button>
        </form>
      </details>
      <button type="button" class="btn ghost out" (click)="logout()">{{ t.tx('Log out', 'लॉग आउट') }}</button>
    }
  </div>`,
  styles: [BOOKING_CSS + `
    .narrow { max-width: 720px; }
    .seg { display: inline-flex; background: var(--card); border: 1.5px solid var(--line); border-radius: 999px; padding: 4px; margin-bottom: 14px; }
    .seg button { border: 0; background: none; padding: 8px 20px; border-radius: 999px; font: inherit; font-weight: 600; color: var(--muted); cursor: pointer; }
    .seg button.on { background: var(--ink); color: #fff; }
    .lbl { font-size: var(--s-1); color: var(--muted); font-weight: 500; }
    .roles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .role { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 12px; border-radius: 14px;
      border: 2px solid var(--line); background: var(--card); font: inherit; cursor: pointer; color: var(--ink); }
    .role span { font-size: 1.6rem; } .role small { color: var(--muted); }
    .role.on { border-color: var(--sindoor); background: var(--sindoor-soft); }
    .link { border: 0; background: none; color: var(--sindoor); font: inherit; font-weight: 600; cursor: pointer; justify-self: start; padding: 0; }
    .me { display: flex; gap: 14px; align-items: center; }
    .pic { position: relative; cursor: pointer; flex: none; display: inline-flex; }
    .cam { position: absolute; right: -2px; bottom: -2px; width: 28px; height: 28px; border-radius: 50%; background: var(--card);
      border: 2px solid var(--haldi); display: grid; place-items: center; font-size: .85rem; box-shadow: 0 2px 6px rgba(0,0,0,.15); }
    .pic:hover .cam { background: var(--haldi-soft); }
    .me .who { min-width: 0; } .me h1 { font-size: var(--s2); overflow-wrap: anywhere; }
    .me p { margin: 0; overflow-wrap: anywhere; } .tags { margin-top: 6px !important; display: flex; gap: 6px; }
    .verify { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-top: 12px; padding: 12px 14px;
      background: var(--haldi-soft); border-radius: 14px; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin: 16px 0 6px; }
    .tile { display: flex; flex-direction: column; gap: 2px; padding: 14px; border-radius: 14px; background: var(--card); border: 1px solid var(--line); text-decoration: none; color: inherit; }
    .tile span { font-size: 1.6rem; } .tile b { color: var(--ink); } .tile small { color: var(--muted); }
    .tile.hl { border: 2px solid var(--haldi); } .tile:hover { border-color: var(--ink); }
    h2 { font-size: var(--s2); margin: 22px 0 10px; }
    .pj { font-size: 1.5rem; }
    .edit { margin-top: 22px; } .edit summary { cursor: pointer; font-weight: 600; color: var(--ink); } .edit form { margin-top: 14px; }
    .out { margin-top: 16px; }
    @media (max-width: 560px) { .roles { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .tiles { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
  `],
})
export class AccountComponent {
  readonly acc = inject(AccountService);
  readonly t = useTx();
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly pujas = PUJAS;

  readonly mode = signal<'in' | 'up' | 'reset'>('in');
  readonly busy = signal(false);
  readonly msg = signal('');
  readonly ok = signal(false);
  readonly bookings = signal<Booking[]>([]);
  role: Role = 'user';
  name = ''; phone = ''; city = ''; email = ''; password = '';
  private stop?: () => void;

  constructor() {
    const q = this.route.snapshot.queryParamMap;
    if (q.get('role') === 'pandit') { this.role = 'pandit'; this.mode.set('up'); }
    if (q.get('mode') === 'up') this.mode.set('up');
    effect(() => {
      const u = this.acc.user();
      this.stop?.(); this.stop = undefined;
      if (u) this.stop = this.acc.watchBookings('user', b => this.bookings.set(b));
    });
    effect(() => {
      const p = this.acc.profile();
      if (p) { this.name = p.name; this.phone = p.phone; this.city = p.city; }
    });
    inject(DestroyRef).onDestroy(() => this.stop?.());
  }

  statusText(s: Parameters<typeof panditStatusText>[0]) { return panditStatusText(s, this.t.hi()); }
  bStatus(b: Booking) { return bookingStatusText(b.status, this.t.hi()); }
  date(d: string) { return fmtDate(d, this.t.hi()); }

  private say(text: string, good = false) { this.msg.set(text); this.ok.set(good); }

  async submit() {
    this.say('');
    if (!this.email.trim()) return this.say(this.t.tx('Please enter your email.', 'ईमेल लिखें।'));
    this.busy.set(true);
    try {
      if (this.mode() === 'reset') {
        await this.acc.resetPassword(this.email);
        this.say(this.t.tx('Reset link sent. Check your email (and spam folder).', 'रीसेट लिंक भेज दिया है। ईमेल (और स्पैम फ़ोल्डर) देखें।'), true);
      } else if (this.mode() === 'up') {
        if (!this.name.trim() || this.phone.replace(/\D/g, '').length < 10) return this.say(this.t.tx('Please enter your name and a 10-digit mobile number.', 'नाम और 10 अंकों का मोबाइल नंबर लिखें।'));
        await this.acc.signUp({ name: this.name, email: this.email, password: this.password, phone: this.phone, city: this.city, role: this.role });
        this.after();
      } else {
        await this.acc.signIn(this.email, this.password);
        this.after();
      }
    } catch (e) {
      this.say(this.acc.errorText(e, this.t.hi()));
    } finally { this.busy.set(false); this.password = ''; }
  }

  private after() {
    const next = this.route.snapshot.queryParamMap.get('next');
    if (next) this.router.navigateByUrl(next);
    else if (this.role === 'pandit' && this.mode() === 'up') this.router.navigate(['/pandit']);
  }

  async resend() {
    try { await this.acc.resendVerification(); this.say(this.t.tx('Verification email sent.', 'सत्यापन ईमेल भेज दिया।'), true); }
    catch (e) { this.say(this.acc.errorText(e, this.t.hi())); }
  }
  async pickPhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    try {
      const photo = await photoToDataUrl(file);
      await this.acc.updateProfile({ photo });
      this.say(this.t.tx('Photo updated.', 'फ़ोटो बदल गई।'), true);
    } catch (err) { this.say(this.acc.errorText(err, this.t.hi())); }
    finally { this.busy.set(false); }
  }
  async saveProfile() {
    this.busy.set(true);
    try { await this.acc.updateProfile({ name: this.name.trim(), phone: this.phone.trim(), city: this.city.trim() }); this.say(this.t.tx('Saved.', 'सहेज लिया।'), true); }
    catch (e) { this.say(this.acc.errorText(e, this.t.hi())); }
    finally { this.busy.set(false); }
  }
  async logout() { await this.acc.signOut(); this.say(''); }
}
