import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountService, Booking, Pandit, photoToDataUrl } from '../../core/services/account.service';
import { STATES } from '../../core/services/location.service';
import { BOOKING_CSS, BookingOffComponent, FaceComponent, PUJAS, PhoneInputComponent, SAMPRADAYAS, SPOKEN, bookingStatusText, fmtDate, panditStatusText, useTx, validPhone } from './booking-ui';

type Form = Omit<Pandit, 'uid' | 'status' | 'createdAt' | 'approvedAt' | 'rejectReason'>;

/** For Pandits: join (profile for verification), then see and answer booking requests. */
@Component({
  selector: 'vp-pandit-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, BookingOffComponent, FaceComponent, PhoneInputComponent],
  template: `
  <div class="wrap page narrow">
    @if (!acc.configured) { <vp-booking-off /> }
    @else if (acc.user() === undefined) { <p class="muted">{{ t.tx('Loading…', 'लोड हो रहा है…') }}</p> }
    @else if (acc.user() === null) {
      <section class="intro panel">
        <span class="om" aria-hidden="true">🕉️</span>
        <h1>{{ t.tx('Join Vaidik Pandit as a Pandit', 'वैदिक पंडित से पंडित के रूप में जुड़ें') }}</h1>
        <ul>
          <li>{{ t.tx('Free to join. No commission: devotees pay your dakshina directly to you.', 'जुड़ना मुफ़्त है। कोई कमीशन नहीं: यजमान दक्षिणा सीधे आपको देते हैं।') }}</li>
          <li>{{ t.tx('Get booking requests from devotees near you and online.', 'अपने क्षेत्र और ऑनलाइन यजमानों से बुकिंग पाएँ।') }}</li>
          <li>{{ t.tx('Our team checks every profile before it goes live. No ID documents needed.', 'हर प्रोफ़ाइल हमारी टीम जाँचती है। कोई पहचान-पत्र नहीं चाहिए।') }}</li>
        </ul>
        <div class="actions">
          <a class="btn" routerLink="/account" [queryParams]="{ role: 'pandit' }">{{ t.tx('Create Pandit account', 'पंडित खाता बनाएँ') }}</a>
          <a class="btn ghost" routerLink="/account" [queryParams]="{ next: '/pandit' }">{{ t.tx('I already have an account', 'मेरा खाता पहले से है') }}</a>
        </div>
      </section>
    }
    @else if (editing() || !acc.myPandit()) {
      <h1>{{ acc.myPandit() ? t.tx('Edit your Pandit profile', 'अपनी पंडित प्रोफ़ाइल बदलें') : t.tx('Your Pandit profile', 'आपकी पंडित प्रोफ़ाइल') }}</h1>
      <p class="lead">{{ t.tx('Fill this in honestly. Our team reviews it, may call you, and then makes your profile live.', 'सही जानकारी भरें। हमारी टीम इसे जाँचेगी, आपसे फ़ोन पर बात कर सकती है, फिर प्रोफ़ाइल चालू होगी।') }}</p>
      <form class="panel stack" (ngSubmit)="save()">
        <div class="photo">
          <vp-face [photo]="f.photo" [name]="f.name" [size]="88" />
          <label class="btn quiet up">📷 {{ f.photo ? t.tx('Change photo', 'फ़ोटो बदलें') : t.tx('Add your photo', 'अपनी फ़ोटो लगाएँ') }}
            <input type="file" accept="image/*" (change)="pickPhoto($event)" hidden></label>
        </div>
        <div class="field"><label for="n">{{ t.tx('Name (as devotees should see it)', 'नाम (जैसा यजमान देखें)') }}</label>
          <input id="n" class="input" name="name" [(ngModel)]="f.name" required [placeholder]="t.tx('Pt. Ramesh Sharma', 'पं. रमेश शर्मा')"></div>
        <div class="row2">
          <div class="field"><label for="ph">{{ t.tx('Mobile number', 'मोबाइल नंबर') }}</label>
            <vp-phone inputId="ph" [value]="f.phone" (valueChange)="f.phone = $event" /></div>
          <div class="field"><label for="wa">{{ t.tx('WhatsApp (if different)', 'व्हाट्सऐप (अगर अलग हो)') }}</label>
            <vp-phone inputId="wa" [value]="f.whatsapp" (valueChange)="f.whatsapp = $event" /></div>
        </div>
        <div class="row2">
          <div class="field"><label for="st">{{ t.tx('State', 'राज्य') }}</label>
            <select id="st" class="input" name="state" [(ngModel)]="f.state" (ngModelChange)="f.city = ''; stateSig.set($event)" required>
              <option value="">—</option>
              @for (s of states; track s.n) { <option [value]="s.n">{{ t.hi() ? s.h : s.n }}</option> }
            </select></div>
          <div class="field"><label for="ct">{{ t.tx('District / city', 'ज़िला / शहर') }}</label>
            <input id="ct" class="input" name="city" [(ngModel)]="f.city" list="dists" required>
            <datalist id="dists">@for (d of districts(); track d) { <option [value]="d"></option> }</datalist></div>
        </div>
        <div class="row2">
          <div class="field"><label for="ex">{{ t.tx('Years of experience', 'अनुभव (वर्ष)') }}</label><input id="ex" class="input" name="exp" type="number" min="0" max="80" [(ngModel)]="f.experience"></div>
          <div class="field"><label for="sp">{{ t.tx('Tradition', 'संप्रदाय') }}</label>
            <select id="sp" class="input" name="samp" [(ngModel)]="f.sampradaya">
              <option value="">—</option>
              @for (s of sampradayas; track s[0]) { <option [value]="s[0]">{{ t.pick(s) }}</option> }
            </select></div>
        </div>
        <div class="field"><span class="lbl">{{ t.tx('Languages you perform in', 'किन भाषाओं में पूजा कराते हैं') }}</span>
          <div class="chips">@for (l of spoken; track l[0]) { <button type="button" class="chip" [class.on]="f.languages.includes(l[0])" (click)="toggle(f.languages, l[0])">{{ t.pick(l) }}</button> }</div></div>
        <div class="field"><span class="lbl">{{ t.tx('Pujas you perform', 'आप कौन-सी पूजाएँ कराते हैं') }}</span>
          <div class="chips">@for (p of pujas; track p[0]) { <button type="button" class="chip" [class.on]="f.pujas.includes(p[0])" (click)="toggle(f.pujas, p[0])">{{ t.pick(p) }}</button> }</div></div>
        <div class="field"><label for="fee">{{ t.tx('Dakshina (optional)', 'दक्षिणा (वैकल्पिक)') }}</label>
          <input id="fee" class="input" name="fee" [(ngModel)]="f.fee" [placeholder]="t.tx('e.g. From ₹1,100, depends on puja', 'जैसे ₹1,100 से, पूजा अनुसार')"></div>
        <div class="field"><label for="ab">{{ t.tx('About you', 'आपके बारे में') }}</label>
          <textarea id="ab" class="input" name="about" [(ngModel)]="f.about" rows="4" maxlength="1200"
            [placeholder]="t.tx('Where you studied, your guru, temples you serve…', 'आपकी शिक्षा, गुरु, जिन मंदिरों में सेवा करते हैं…')"></textarea></div>
        @if (msg()) { <p class="err" role="status">{{ msg() }}</p> }
        <div class="actions">
          <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? t.tx('Saving…', 'सहेज रहे हैं…') : acc.myPandit() ? t.tx('Save changes', 'बदलाव सहेजें') : t.tx('Submit for verification', 'सत्यापन के लिए भेजें') }}</button>
          @if (acc.myPandit()) { <button type="button" class="btn ghost" (click)="editing.set(false)">{{ t.tx('Cancel', 'रद्द') }}</button> }
        </div>
        <p class="note">{{ t.tx('Your phone number is shown only to devotees whose booking you accept.', 'आपका फ़ोन नंबर केवल उन्हीं यजमानों को दिखता है जिनकी बुकिंग आप स्वीकार करते हैं।') }}</p>
        @if (acc.myPandit()?.status === 'approved') { <p class="note">{{ t.tx('Changing your name or photo sends your profile for a quick review again.', 'नाम या फ़ोटो बदलने पर प्रोफ़ाइल फिर से जाँच के लिए जाएगी।') }}</p> }
      </form>
    }
    @else {
      @let mp = acc.myPandit()!;
      <section class="me panel">
        <vp-face [photo]="mp.photo" [name]="mp.name" [size]="72" />
        <div class="who">
          <h1>{{ mp.name }}</h1>
          <p class="muted">📍 {{ mp.city }} · {{ mp.experience }} {{ t.tx('yrs', 'वर्ष') }}</p>
          <p><span class="tag" [class.ok]="mp.status === 'approved'" [class.bad]="mp.status === 'rejected' || mp.status === 'suspended'">{{ pStatus(mp) }}</span></p>
        </div>
      </section>

      @switch (mp.status) {
        @case ('pending') { <div class="banner">⏳ {{ t.tx('Thank you! Your profile is being checked. It goes live as soon as it is approved, usually within 1–2 days. You may get a call from our team.',
          'धन्यवाद! आपकी प्रोफ़ाइल की जाँच चल रही है। स्वीकृति मिलते ही यह चालू हो जाएगी, आमतौर पर 1–2 दिन में। हमारी टीम आपको फ़ोन कर सकती है।') }}</div> }
        @case ('rejected') { <div class="banner bad">{{ t.tx('Your profile was not approved.', 'आपकी प्रोफ़ाइल स्वीकृत नहीं हुई।') }} @if (mp.rejectReason) { <b>{{ mp.rejectReason }}</b> }
          {{ t.tx('Fix it and submit again.', 'सुधार कर फिर से भेजें।') }}</div> }
        @case ('suspended') { <div class="banner bad">{{ t.tx('Your profile is paused by the Vaidik Pandit team. Please contact us.', 'वैदिक पंडित टीम ने आपकी प्रोफ़ाइल रोकी है। कृपया संपर्क करें।') }}</div> }
        @case ('approved') {
          <label class="avail panel">
            <span><b>{{ mp.online ? t.tx('Taking bookings', 'बुकिंग ले रहे हैं') : t.tx('Not taking bookings', 'बुकिंग बंद है') }}</b>
              <small>{{ t.tx('Turn off when you are travelling or busy.', 'यात्रा या व्यस्तता में बंद करें।') }}</small></span>
            <input type="checkbox" class="sw" [checked]="mp.online" (change)="acc.setOnline($any($event.target).checked)">
          </label>
        }
      }
      <div class="actions top">
        <button type="button" class="btn ghost" (click)="startEdit()">✏️ {{ t.tx('Edit profile', 'प्रोफ़ाइल बदलें') }}</button>
        @if (mp.status === 'approved') { <a class="btn ghost" [routerLink]="['/pandits', mp.uid]">👁 {{ t.tx('Public profile', 'सार्वजनिक प्रोफ़ाइल') }}</a> }
      </div>

      <h2>{{ t.tx('Booking requests', 'बुकिंग अनुरोध') }}</h2>
      <div class="seg">
        @for (tb of tabs; track tb[0]) {
          <button type="button" [class.on]="tab() === tb[0]" (click)="tab.set(tb[0])">{{ t.tx(tb[1], tb[2]) }} <b class="num">{{ groups()[tb[0]].length }}</b></button>
        }
      </div>
      <div class="stack">
        @for (b of groups()[tab()]; track b.id) {
          <a class="bk" [routerLink]="['/booking', b.id]">
            <span class="pj" aria-hidden="true">{{ b.status === 'requested' ? '🔔' : '🪔' }}</span>
            <span class="who"><b>{{ t.name(pujas, b.puja) }} · {{ b.userName }}</b><small>{{ date(b.date) }} {{ b.time }} · {{ b.mode === 'online' ? t.tx('Online', 'ऑनलाइन') : b.address }}</small></span>
            <span class="tag" [class.ok]="b.status === 'accepted' || b.status === 'completed'" [class.bad]="b.status === 'declined' || b.status === 'cancelled'">{{ bStatus(b) }}</span>
          </a>
        } @empty { <div class="panel empty">{{ t.tx('Nothing here yet.', 'अभी यहाँ कुछ नहीं।') }}</div> }
      </div>
    }
  </div>`,
  styles: [BOOKING_CSS + `
    .narrow { max-width: 780px; }
    .intro { text-align: center; } .om { font-size: 2.8rem; } .intro h1 { font-size: var(--s3); margin: 6px 0 12px; }
    .intro ul { text-align: left; max-width: 52ch; margin: 0 auto 18px; padding-left: 20px; display: grid; gap: 6px; }
    .intro .actions { justify-content: center; }
    .photo { display: flex; gap: 16px; align-items: center; }
    .up { cursor: pointer; }
    .lbl { font-size: var(--s-1); color: var(--muted); font-weight: 500; }
    .me { display: flex; gap: 14px; align-items: center; } .me .who { min-width: 0; } .me h1 { font-size: var(--s2); } .me p { margin: 2px 0; }
    .banner { margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: var(--haldi-soft); }
    .banner.bad { background: var(--sindoor-soft); }
    .avail { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; cursor: pointer; padding: 14px 16px; }
    .avail small { display: block; color: var(--muted); }
    .sw { appearance: none; -webkit-appearance: none; width: 50px; height: 28px; border-radius: 999px; background: var(--line); position: relative; cursor: pointer; flex: none; transition: background .2s; }
    .sw::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 3px #0003; }
    .sw:checked { background: var(--tulsi); } .sw:checked::after { transform: translateX(22px); }
    .top { margin-top: 12px; }
    h2 { font-size: var(--s2); margin: 22px 0 10px; }
    .seg { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 12px; scrollbar-width: none; }
    .seg button { flex: none; border: 1.5px solid var(--line); background: var(--card); padding: 7px 14px; border-radius: 999px; font: inherit; font-weight: 600; color: var(--ink); cursor: pointer; }
    .seg button b { background: var(--haldi-soft); border-radius: 999px; padding: 0 7px; font-size: .8rem; margin-left: 4px; }
    .seg button.on { background: var(--ink); color: #fff; border-color: var(--ink); } .seg button.on b { color: var(--ink); }
    .pj { font-size: 1.5rem; }
  `],
})
export class PanditDashboardComponent {
  readonly acc = inject(AccountService);
  readonly t = useTx();
  readonly states = STATES;
  readonly pujas = PUJAS;
  readonly spoken = SPOKEN;
  readonly sampradayas = SAMPRADAYAS;
  readonly tabs: ['new' | 'upcoming' | 'past', string, string][] = [['new', 'New', 'नए'], ['upcoming', 'Confirmed', 'पक्की'], ['past', 'Past', 'पुरानी']];
  readonly tab = signal<'new' | 'upcoming' | 'past'>('new');
  readonly editing = signal(false);
  readonly busy = signal(false);
  readonly msg = signal('');
  readonly bookings = signal<Booking[]>([]);
  readonly stateSig = signal('');
  f: Form = this.blank();
  private stop?: () => void;

  constructor() {
    effect(() => {
      const mp = this.acc.myPandit(), u = this.acc.user();
      this.stop?.(); this.stop = undefined;
      if (u && mp) this.stop = this.acc.watchBookings('pandit', b => this.bookings.set(b));
      if (!mp && !this.f.name) {
        const p = this.acc.profile();
        if (p) { this.f.name = p.name; this.f.phone = p.phone; this.f.city = p.city; if (p.state) { this.f.state = p.state; this.stateSig.set(p.state); } }
      }
    });
    inject(DestroyRef).onDestroy(() => this.stop?.());
  }

  private blank(): Form {
    return { name: '', photo: '', phone: '', whatsapp: '', state: '', city: '', languages: ['Sanskrit', 'Hindi'], sampradaya: '', experience: 0, pujas: [], fee: '', about: '', online: true };
  }
  readonly districts = computed(() => (STATES.find(s => s.n === this.stateSig())?.d ?? []).map(d => d[0]));
  readonly groups = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    const all = this.bookings();
    return {
      new: all.filter(b => b.status === 'requested'),
      upcoming: all.filter(b => b.status === 'accepted').sort((a, b) => a.date.localeCompare(b.date)),
      past: all.filter(b => b.status !== 'requested' && (b.status !== 'accepted' || b.date < today)),
    };
  });

  pStatus(p: Pandit) { return panditStatusText(p.status, this.t.hi()); }
  bStatus(b: Booking) { return bookingStatusText(b.status, this.t.hi()); }
  date(d: string) { return fmtDate(d, this.t.hi()); }
  toggle(list: string[], v: string) { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); }

  startEdit() {
    const mp = this.acc.myPandit(); if (!mp) return;
    const { uid, status, createdAt, approvedAt, rejectReason, ...rest } = mp;
    this.f = { ...this.blank(), ...rest, languages: [...(rest.languages ?? [])], pujas: [...(rest.pujas ?? [])] };
    this.stateSig.set(this.f.state);
    this.editing.set(true); this.msg.set('');
  }

  async pickPhoto(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try { this.f.photo = await photoToDataUrl(file); } catch { this.msg.set(this.t.tx('Could not read that photo.', 'यह फ़ोटो नहीं खुल सकी।')); }
  }

  async save() {
    this.msg.set('');
    this.stateSig.set(this.f.state);
    const f = this.f;
    const bad = !f.name.trim() ? this.t.tx('Please enter your name.', 'नाम लिखें।')
      : !validPhone(f.phone) ? this.t.tx('Please enter a valid mobile number.', 'कृपया सही मोबाइल नंबर लिखें।')
      : f.whatsapp && !validPhone(f.whatsapp) ? this.t.tx('Please check the WhatsApp number.', 'व्हाट्सऐप नंबर जाँचें।')
      : !f.state || !f.city.trim() ? this.t.tx('Please choose your state and city.', 'राज्य और शहर चुनें।')
      : !f.pujas.length ? this.t.tx('Choose at least one puja.', 'कम से कम एक पूजा चुनें।')
      : !f.languages.length ? this.t.tx('Choose at least one language.', 'कम से कम एक भाषा चुनें।')
      : !f.photo ? this.t.tx('Please add a clear photo of yourself.', 'अपनी साफ़ फ़ोटो लगाएँ।') : '';
    if (bad) return this.msg.set(bad);
    this.busy.set(true);
    try {
      await this.acc.savePandit({ ...f, name: f.name.trim(), phone: f.phone, whatsapp: f.whatsapp, city: f.city.trim(),
        fee: f.fee.trim(), about: f.about.trim(), experience: Math.max(0, Math.min(80, Number(f.experience) || 0)) });
      this.editing.set(false);
    } catch (e) { this.msg.set(this.acc.errorText(e, this.t.hi())); }
    finally { this.busy.set(false); }
  }
}
