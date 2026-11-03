import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LocationService, STATES, WORLD } from '../../core/services/location.service';
import { PanditJiService } from '../../core/services/panditji.service';
import { useTx } from '../booking/booking-ui';
import { MilanResult, Person, milan, milanContext, nakName, personFromBirth, personFromName, rashiName, PLANET } from '../../core/astro/milan';

interface Side {
  name: string; mode: 'birth' | 'name';
  date: string; time: string; noTime: boolean;
  state: string; place: string; // place = district name, or WORLD city name when state === '__world'
}

/** Kundli Milan: Ashtakoota guna milan (36 gunas), Nadi/Bhakoot/Gana dosha, Manglik dosha. */
@Component({
  selector: 'vp-milan',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
  <div class="wrap page">
    <header class="intro">
      <span class="ic" aria-hidden="true">💍</span>
      <div>
        <h1 class="sa">{{ t.tx('Vivāha Melāpaka', 'विवाह मेलापक') }}</h1>
        <p class="aka">{{ t.tx('Kundli Milan · Guna Milan · विवाह मेलापक', 'कुंडली मिलान · गुण मिलान · Vivāha Melāpaka') }}</p>
        <p class="lead">{{ t.tx('Ashtakoota matching of the bride and groom, as done before marriage: Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot and Nadi (36 gunas), with Manglik dosha.',
          'विवाह से पहले की जाने वाली वर-वधू की अष्टकूट गुण मिलान: वर्ण, वश्य, तारा, योनि, ग्रह मैत्री, गण, भकूट और नाड़ी (36 गुण), साथ में मांगलिक दोष विचार।') }}</p>
      </div>
    </header>

    <form class="pair" (ngSubmit)="match()">
      @for (s of sides; track $index) {
        @let who = $index === 0 ? 'groom' : 'bride';
        <fieldset class="panel side" [class.g]="who === 'groom'" [class.b]="who === 'bride'">
          <legend>{{ who === 'groom' ? t.tx('🤵 Groom (Var)', '🤵 वर') : t.tx('👰 Bride (Vadhu)', '👰 वधू') }}</legend>
          <div class="field"><label [for]="who + '-n'">{{ t.tx('Name', 'नाम') }}</label>
            <input class="input" [id]="who + '-n'" [name]="who + '-n'" [(ngModel)]="s.name" [placeholder]="who === 'groom' ? t.tx('e.g. Ram / राम', 'जैसे राम / Ram') : t.tx('e.g. Sita / सीता', 'जैसे सीता / Sita')" autocomplete="off"></div>
          <div class="seg" role="radiogroup">
            <button type="button" role="radio" [attr.aria-checked]="s.mode === 'birth'" [class.on]="s.mode === 'birth'" (click)="s.mode = 'birth'">📅 {{ t.tx('Birth details', 'जन्म विवरण') }}</button>
            <button type="button" role="radio" [attr.aria-checked]="s.mode === 'name'" [class.on]="s.mode === 'name'" (click)="s.mode = 'name'">🔤 {{ t.tx('Name only', 'केवल नाम') }}</button>
          </div>
          @if (s.mode === 'birth') {
            <div class="row2">
              <div class="field"><label [for]="who + '-d'">{{ t.tx('Date of birth', 'जन्म तिथि') }}</label>
                <input class="input" type="date" [id]="who + '-d'" [name]="who + '-d'" [(ngModel)]="s.date" max="2100-12-31" min="1900-01-01"></div>
              <div class="field"><label [for]="who + '-t'">{{ t.tx('Time of birth', 'जन्म समय') }}</label>
                <input class="input" type="time" [id]="who + '-t'" [name]="who + '-t'" [(ngModel)]="s.time" [disabled]="s.noTime"></div>
            </div>
            <label class="chk"><input type="checkbox" [name]="who + '-nt'" [(ngModel)]="s.noTime"> {{ t.tx("I don't know the birth time", 'जन्म समय नहीं पता') }}</label>
            <div class="row2">
              <div class="field"><label [for]="who + '-s'">{{ t.tx('Birth state', 'जन्म राज्य') }}</label>
                <select class="input" [id]="who + '-s'" [name]="who + '-s'" [(ngModel)]="s.state" (ngModelChange)="s.place = ''">
                  @for (st of states; track st.n) { <option [value]="st.n">{{ t.hi() ? st.h : st.n }}</option> }
                  <option value="__world">🌍 {{ t.tx('Outside India', 'भारत के बाहर') }}</option>
                </select></div>
              <div class="field"><label [for]="who + '-p'">{{ t.tx('Birth place', 'जन्म स्थान') }}</label>
                <select class="input" [id]="who + '-p'" [name]="who + '-p'" [(ngModel)]="s.place">
                  <option value="">—</option>
                  @for (p of placesFor(s); track p) { <option [value]="p">{{ p }}</option> }
                </select></div>
            </div>
          } @else {
            <p class="hint">{{ t.tx('The naam nakshatra is taken from the first syllable of the name (Avakahada chakra). Birth details give a more exact match.',
              'नाम के पहले अक्षर से नाम नक्षत्र लिया जाता है (अवकहड़ा चक्र)। जन्म विवरण से मिलान अधिक सटीक होता है।') }}</p>
            @if (s.name.trim()) {
              @let np = namePreview(s.name);
              @if (np) { <p class="np">{{ t.tx('Syllable', 'अक्षर') }} <b>{{ np.syllable }}</b> → {{ nk(np.nak) }} {{ t.tx('pada', 'चरण') }} {{ np.pada }} · {{ rs(np.rashi) }} {{ t.tx('rashi', 'राशि') }}</p> }
              @else { <p class="err">{{ t.tx("Couldn't read the first syllable. Try writing the name in Hindi.", 'पहला अक्षर नहीं पहचाना गया। नाम हिंदी में लिखकर देखें।') }}</p> }
            }
          }
        </fieldset>
      }
      @if (msg()) { <p class="err full" role="alert">{{ msg() }}</p> }
      <button class="btn go full" type="submit">🪔 {{ t.tx('Match the kundlis', 'कुंडली मिलाएँ') }}</button>
    </form>

    @if (res(); as r) {
      <section class="result" id="result">
        <div [class]="'score panel ' + r.level">
          <div class="dial" [style.--p]="r.total / 36">
            <span class="num"><b>{{ fmt(r.total) }}</b><small>/36</small></span>
          </div>
          <div class="sv">
            <h2>{{ t.tx('Gunas matched', 'मिले हुए गुण') }}</h2>
            <p class="verdict">{{ t.tx(r.verdict.en, r.verdict.hi) }}</p>
            <p class="names">{{ r.groom.name || t.tx('Groom', 'वर') }} 💍 {{ r.bride.name || t.tx('Bride', 'वधू') }}</p>
          </div>
        </div>

        <div class="people">
          @for (p of [r.groom, r.bride]; track $index) {
            <div class="panel person">
              <h3>{{ $index === 0 ? '🤵' : '👰' }} {{ p.name || ($index === 0 ? t.tx('Groom', 'वर') : t.tx('Bride', 'वधू')) }}</h3>
              <dl>
                <div><dt>{{ t.tx('Nakshatra', 'नक्षत्र') }}</dt><dd>{{ nk(p.nak) }} · {{ t.tx('pada', 'चरण') }} {{ p.pada }}</dd></div>
                <div><dt>{{ t.tx('Rashi (Moon sign)', 'राशि (चंद्र)') }}</dt><dd>{{ rs(p.rashi) }}</dd></div>
                @if (p.lagna !== undefined) { <div><dt>{{ t.tx('Lagna', 'लग्न') }}</dt><dd>{{ rs(floor(p.lagna / 30)) }}</dd></div> }
                @if (p.mars !== undefined) {
                  <div><dt>{{ t.tx('Mars', 'मंगल') }}</dt><dd>{{ rs(floor(p.mars / 30)) }}@if (p.marsFromLagna) { · {{ t.tx('house', 'भाव') }} {{ p.marsFromLagna }} }</dd></div>
                  <div><dt>{{ t.tx('Manglik', 'मांगलिक') }}</dt><dd [class.warn]="p.manglik ?? p.manglikMoon">{{ (p.manglik ?? p.manglikMoon) ? t.tx('Yes', 'हाँ') : t.tx('No', 'नहीं') }}@if (p.manglik === undefined) { <small> ({{ t.tx('from Moon', 'चंद्र से') }})</small> }</dd></div>
                }
              </dl>
              <p class="src">{{ p.source === 'birth' ? t.tx('From birth details', 'जन्म विवरण से') : t.tx('From the name', 'नाम से') + ' (' + p.syllable + ')' }}</p>
            </div>
          }
        </div>

        <div class="panel kootas">
          <table>
            <thead><tr><th>{{ t.tx('Koota', 'कूट') }}</th><th>🤵 {{ t.tx('Groom', 'वर') }}</th><th>👰 {{ t.tx('Bride', 'वधू') }}</th><th class="r">{{ t.tx('Gunas', 'गुण') }}</th></tr></thead>
            <tbody>
              @for (k of r.kootas; track k.key) {
                <tr [class.bad]="k.dosha && !k.cancelled">
                  <td><b>{{ t.tx(k.name.en, k.name.hi) }}</b><small>{{ t.tx(k.meaning.en, k.meaning.hi) }}</small>
                    @if (k.note) { <em [class.okn]="k.cancelled">{{ k.cancelled ? '✔' : '⚠' }} {{ t.tx(k.note.en, k.note.hi) }}</em> }</td>
                  <td>{{ t.tx(k.groom.en, k.groom.hi) }}</td>
                  <td>{{ t.tx(k.bride.en, k.bride.hi) }}</td>
                  <td class="r"><b class="pts">{{ fmt(k.score) }}<small>/{{ k.max }}</small></b>
                    <span class="bar"><i [style.width.%]="k.score / k.max * 100"></i></span></td>
                </tr>
              }
            </tbody>
            <tfoot><tr><td colspan="3">{{ t.tx('Total', 'कुल') }}</td><td class="r"><b class="pts">{{ fmt(r.total) }}<small>/36</small></b></td></tr></tfoot>
          </table>
        </div>

        <div class="panel mangal" [class.ok]="r.manglik.ok === true" [class.bad]="r.manglik.ok === false">
          <h3>🔴 {{ t.tx('Mangal (Manglik) dosha', 'मंगल (मांगलिक) दोष') }}</h3>
          <p>{{ t.tx(r.manglik.text.en, r.manglik.text.hi) }}</p>
          <p class="hint">{{ t.tx('Mars in the 1st, 2nd, 4th, 7th, 8th or 12th house (from Lagna, and from the Moon) makes a person Manglik.', 'लग्न (और चंद्र) से 1, 2, 4, 7, 8 या 12वें भाव में मंगल होने पर व्यक्ति मांगलिक माना जाता है।') }}</p>
        </div>

        <div class="next">
          <button type="button" class="btn" (click)="askAi(r)">✨ {{ t.tx('Ask AI PanditJi to explain', 'AI पंडित जी से समझें') }}</button>
          <a class="btn ghost" routerLink="/muhurat">📅 {{ t.tx('Find a vivah muhurat', 'विवाह मुहूर्त देखें') }}</a>
          <a class="btn ghost" routerLink="/pandits">🕉️ {{ t.tx('Consult a Pandit', 'पंडित जी से परामर्श') }}</a>
        </div>
        <p class="note">{{ t.tx('Guna milan is one part of matching. Families traditionally also consult a learned astrologer about the full charts, and above all the couple’s own understanding.',
          'गुण मिलान, मिलान का एक भाग है। परंपरा में पूरी कुंडलियों पर किसी विद्वान ज्योतिषी से परामर्श भी लिया जाता है, और सबसे बढ़कर वर-वधू की आपसी समझ ही महत्वपूर्ण है।') }}</p>
      </section>
    }
  </div>`,
  styles: [`
    .intro { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
    .intro .ic { font-size: 2.6rem; line-height: 1; }
    .intro h1 { margin: 0; font-weight: 400; } .aka { margin: 2px 0 8px; color: var(--sindoor); font-weight: 600; }
    .lead { margin: 0; color: var(--muted); max-width: 70ch; }
    .pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
    .full { grid-column: 1 / -1; }
    .side > *, .row2 > * { min-width: 0; }
    select.input { text-overflow: ellipsis; }
    .side { border: 1px solid var(--line); margin: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; min-width: 0; border-top: 5px solid var(--haldi); }
    .side.b { border-top-color: var(--sindoor); }
    legend { font-weight: 700; font-size: 1.1rem; color: var(--ink); padding: 0 6px; }
    .row2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
    .seg { display: grid; grid-template-columns: 1fr 1fr; background: var(--paper); border-radius: 999px; padding: 4px; border: 1px solid var(--line); }
    .seg button { border: 0; background: none; padding: 8px; border-radius: 999px; font: inherit; font-weight: 600; color: var(--muted); cursor: pointer; }
    .seg button.on { background: var(--ink); color: #fff; }
    .chk { display: flex; gap: 8px; align-items: center; font-size: .92rem; color: var(--muted); cursor: pointer; }
    .hint { margin: 0; font-size: var(--s-1); color: var(--faint); }
    .np { margin: 0; padding: 8px 12px; background: var(--haldi-soft); border-radius: 10px; }
    .err { color: var(--sindoor); margin: 0; font-weight: 500; }
    .go { min-height: 52px; font-size: 1.1rem; }
    .result { margin-top: 26px; display: grid; gap: 16px; scroll-margin-top: 90px; }
    .score { display: flex; gap: 22px; align-items: center; border-left: 6px solid var(--haldi); }
    .score.low { border-left-color: var(--sindoor); } .score.good, .score.excellent { border-left-color: var(--tulsi); }
    .dial { --c: var(--haldi); width: 130px; height: 130px; flex: none; border-radius: 50%; display: grid; place-items: center;
      background: conic-gradient(var(--c) calc(var(--p) * 360deg), var(--line) 0); }
    .low .dial { --c: var(--sindoor); } .good .dial, .excellent .dial { --c: var(--tulsi); }
    .dial .num { width: 104px; height: 104px; border-radius: 50%; background: var(--card); display: grid; place-items: center; align-content: center; line-height: 1; }
    .dial b { font-size: 2.4rem; color: var(--ink); } .dial small { color: var(--faint); }
    .sv h2 { margin: 0 0 4px; font-size: var(--s1); color: var(--muted); font-weight: 600; }
    .verdict { margin: 0 0 6px; font-size: 1.15rem; font-weight: 600; color: var(--ink); }
    .names { margin: 0; color: var(--muted); }
    .people { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
    .person h3 { margin: 0 0 10px; }
    .person dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin: 0; }
    .person dl div { background: var(--paper); border-radius: 10px; padding: 8px 10px; }
    .person dt { font-size: .76rem; color: var(--faint); } .person dd { margin: 0; font-weight: 600; color: var(--ink); }
    .person dd.warn { color: var(--sindoor); }
    .src { margin: 10px 0 0; font-size: .8rem; color: var(--faint); }
    .kootas { padding: 0; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 560px; }
    th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: top; }
    th { font-size: .8rem; color: var(--faint); font-weight: 600; background: var(--paper); }
    td small { display: block; color: var(--muted); font-size: .8rem; margin-top: 2px; }
    td em { display: block; font-style: normal; font-size: .82rem; margin-top: 6px; color: var(--sindoor); font-weight: 600; }
    td em.okn { color: var(--tulsi); }
    tr.bad td:first-child b { color: var(--sindoor); }
    .r { text-align: right; white-space: nowrap; }
    .pts { font-size: 1.1rem; color: var(--ink); } .pts small { color: var(--faint); font-weight: 400; }
    .bar { display: block; width: 90px; height: 6px; background: var(--line); border-radius: 3px; margin: 6px 0 0 auto; overflow: hidden; }
    .bar i { display: block; height: 100%; background: var(--haldi); border-radius: 3px; }
    tr.bad .bar i { background: var(--sindoor); }
    tfoot td { font-weight: 700; border-bottom: 0; background: var(--haldi-soft); }
    .mangal { border-left: 6px solid var(--line); } .mangal.ok { border-left-color: var(--tulsi); } .mangal.bad { border-left-color: var(--sindoor); }
    .mangal h3 { margin: 0 0 6px; } .mangal p { margin: 0 0 6px; }
    .next { display: flex; flex-wrap: wrap; gap: 10px; }
    .next .btn { text-decoration: none; }
    .note { font-size: var(--s-1); color: var(--faint); margin: 0; }
    @media (max-width: 760px) {
      .pair, .people { grid-template-columns: minmax(0, 1fr); }
      .score { flex-direction: column; text-align: center; }
      .next .btn { flex: 1 1 100%; white-space: normal; }
    }
  `],
})
export class MilanComponent {
  readonly t = useTx();
  private loc = inject(LocationService);
  private bot = inject(PanditJiService);
  private router = inject(Router);
  readonly states = STATES;
  readonly res = signal<MilanResult | null>(null);
  readonly msg = signal('');
  readonly floor = Math.floor;
  readonly sides: Side[];

  constructor() {
    const pl = this.loc.place();
    const inIndia = !!pl.state && STATES.some(s => s.n === pl.state);
    const blank = (): Side => ({ name: '', mode: 'birth', date: '', time: '', noTime: false,
      state: inIndia ? pl.state! : STATES[0].n, place: inIndia ? (pl.district ?? '') : '' });
    this.sides = [blank(), blank()];
  }

  placesFor(s: Side): string[] {
    if (s.state === '__world') return WORLD.map(w => w.name);
    return (STATES.find(x => x.n === s.state)?.d ?? []).map(d => d[0]);
  }
  private coords(s: Side): { lat: number; lng: number; tz: string } | null {
    if (s.state === '__world') { const w = WORLD.find(x => x.name === s.place); return w ? { lat: w.lat, lng: w.lng, tz: w.tz } : null; }
    const d = STATES.find(x => x.n === s.state)?.d.find(x => x[0] === s.place);
    return d ? { lat: d[1], lng: d[2], tz: 'Asia/Kolkata' } : null;
  }
  readonly namePreview = (n: string) => personFromName(n);
  nk(n: number) { return nakName(n, this.t.hi()); }
  rs(r: number) { return rashiName(r, this.t.hi()); }
  fmt(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
  readonly planet = PLANET;

  private person(s: Side, label: string): Person | string {
    if (s.mode === 'name') {
      if (!s.name.trim()) return this.t.tx(`Please enter the ${label}'s name.`, `कृपया ${label} का नाम लिखें।`);
      return personFromName(s.name.trim()) ?? this.t.tx(`Couldn't read the first syllable of the ${label}'s name. Try writing it in Hindi.`, `${label} के नाम का पहला अक्षर नहीं पहचाना गया। हिंदी में लिखकर देखें।`);
    }
    if (!s.date) return this.t.tx(`Please enter the ${label}'s date of birth.`, `कृपया ${label} की जन्म तिथि लिखें।`);
    if (!s.noTime && !s.time) return this.t.tx(`Please enter the ${label}'s time of birth, or tick "I don't know the birth time".`, `कृपया ${label} का जन्म समय लिखें, या "जन्म समय नहीं पता" चुनें।`);
    const c = this.coords(s);
    if (!c) return this.t.tx(`Please choose the ${label}'s birth place.`, `कृपया ${label} का जन्म स्थान चुनें।`);
    return personFromBirth(s.name.trim(), s.date, s.noTime ? null : s.time, c.lat, c.lng, c.tz);
  }

  match() {
    this.msg.set('');
    const g = this.person(this.sides[0], this.t.tx('groom', 'वर'));
    const b = this.person(this.sides[1], this.t.tx('bride', 'वधू'));
    if (typeof g === 'string') return this.msg.set(g);
    if (typeof b === 'string') return this.msg.set(b);
    this.res.set(milan(g, b));
    setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  askAi(r: MilanResult) {
    const q = this.t.tx(
      `Please explain this Kundli Milan result in simple words: what is good, which doshas matter, and any traditional remedies.\n\n${milanContext(r)}`,
      `कृपया इस कुंडली मिलान का परिणाम सरल शब्दों में समझाइए: क्या अच्छा है, कौन से दोष महत्वपूर्ण हैं, और पारंपरिक उपाय क्या हैं।\n\n${milanContext(r)}`);
    this.router.navigate(['/ask']);
    this.bot.ask(q);
  }
}
