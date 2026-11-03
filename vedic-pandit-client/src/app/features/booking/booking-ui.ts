// Shared pieces for the account, Pandit booking and admin pages.
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/services/i18n.service';
import { BookingStatus, PanditStatus } from '../../core/services/account.service';

/** Pujas a Pandit can offer and a devotee can book. [English, Hindi] */
export const PUJAS: [string, string][] = [
  ['Satyanarayan Katha', 'सत्यनारायण कथा'], ['Griha Pravesh', 'गृह प्रवेश'], ['Vivah (Wedding)', 'विवाह संस्कार'],
  ['Namkaran', 'नामकरण'], ['Mundan', 'मुंडन'], ['Upanayana (Janeu)', 'यज्ञोपवीत संस्कार'], ['Annaprashan', 'अन्नप्राशन'],
  ['Rudrabhishek', 'रुद्राभिषेक'], ['Maha Mrityunjaya Jaap', 'महामृत्युंजय जाप'], ['Navagraha Shanti', 'नवग्रह शांति'],
  ['Kaal Sarp Dosh Puja', 'कालसर्प दोष पूजा'], ['Mangal Dosh Puja', 'मंगल दोष पूजा'], ['Pitru Dosh / Shraddh', 'पितृ दोष / श्राद्ध'],
  ['Antyeshti (last rites)', 'अंत्येष्टि संस्कार'], ['Vastu Shanti', 'वास्तु शांति'], ['Lakshmi Puja', 'लक्ष्मी पूजन'],
  ['Ganesh Puja', 'गणेश पूजन'], ['Durga Saptashati Path', 'दुर्गा सप्तशती पाठ'], ['Sunderkand Path', 'सुंदरकांड पाठ'],
  ['Hanuman Chalisa Path', 'हनुमान चालीसा पाठ'], ['Bhagavat Katha', 'भागवत कथा'], ['Havan / Yagya', 'हवन / यज्ञ'],
  ['Office / Shop Opening', 'दुकान / कार्यालय उद्घाटन'], ['Vehicle Puja', 'वाहन पूजा'], ['Kundli / Jyotish consultation', 'कुंडली / ज्योतिष परामर्श'],
  ['Online Puja', 'ऑनलाइन पूजा'],
];

/** Languages a Pandit can perform in. [English, Hindi] */
export const SPOKEN: [string, string][] = [
  ['Sanskrit', 'संस्कृत'], ['Hindi', 'हिंदी'], ['English', 'अंग्रेज़ी'], ['Marathi', 'मराठी'], ['Gujarati', 'गुजराती'],
  ['Bengali', 'बांग्ला'], ['Odia', 'ओड़िया'], ['Kannada', 'कन्नड़'], ['Tamil', 'तमिल'], ['Telugu', 'तेलुगु'],
  ['Malayalam', 'मलयालम'], ['Punjabi', 'पंजाबी'], ['Maithili', 'मैथिली'], ['Bhojpuri', 'भोजपुरी'], ['Nepali', 'नेपाली'],
];

export const SAMPRADAYAS: [string, string][] = [
  ['Smarta', 'स्मार्त'], ['Vaishnava', 'वैष्णव'], ['Shaiva', 'शैव'], ['Shakta', 'शाक्त'], ['Arya Samaj', 'आर्य समाज'], ['Other', 'अन्य'],
];

/** English or Hindi wording for the booking pages. Devanagari readers (hi, mr) get Hindi, everyone else English. */
export function useTx() {
  const i18n = inject(I18nService);
  const hi = computed(() => i18n.prefersDevanagari());
  const tx = (en: string, h: string) => (hi() ? h : en);
  const pick = (pair: [string, string] | undefined, fallback = '') => (pair ? (hi() ? pair[1] : pair[0]) : fallback);
  /** Show a stored English name (puja, language) in the reader's language. */
  const name = (list: [string, string][], en: string) => pick(list.find(p => p[0] === en), en);
  return { i18n, hi, tx, pick, name };
}

export function bookingStatusText(s: BookingStatus, hi: boolean): string {
  const m: Record<BookingStatus, [string, string]> = {
    requested: ['Waiting for PanditJi', 'पंडित जी के उत्तर की प्रतीक्षा'], accepted: ['Confirmed', 'पक्की हुई'],
    declined: ['Declined', 'अस्वीकार'], cancelled: ['Cancelled', 'रद्द'], completed: ['Completed', 'संपन्न'],
  };
  return m[s][hi ? 1 : 0];
}
export function panditStatusText(s: PanditStatus, hi: boolean): string {
  const m: Record<PanditStatus, [string, string]> = {
    pending: ['Under review', 'जाँच चल रही है'], approved: ['Verified', 'सत्यापित'],
    rejected: ['Not approved', 'स्वीकृत नहीं'], suspended: ['Suspended', 'निलंबित'],
  };
  return m[s][hi ? 1 : 0];
}
/** Digits only, with India's 91 in front for 10-digit numbers (for tel: and wa.me links). */
export function intlPhone(p: string): string {
  const d = (p || '').replace(/\D/g, '');
  return d.length === 10 ? '91' + d : d;
}
export function initials(name: string): string {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
export function fmtDate(iso: string, hi: boolean): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(+d) ? iso : d.toLocaleDateString(hi ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------------- countries and phone numbers ----------------
export interface Country { iso: string; en: string; hi: string; dial: string; min: number; max: number; }
/** India first, then where Indian families most often live. */
export const COUNTRIES: Country[] = [
  { iso: 'IN', en: 'India', hi: 'भारत', dial: '91', min: 10, max: 10 },
  { iso: 'NP', en: 'Nepal', hi: 'नेपाल', dial: '977', min: 10, max: 10 },
  { iso: 'US', en: 'United States', hi: 'अमेरिका', dial: '1', min: 10, max: 10 },
  { iso: 'CA', en: 'Canada', hi: 'कनाडा', dial: '1', min: 10, max: 10 },
  { iso: 'GB', en: 'United Kingdom', hi: 'ब्रिटेन', dial: '44', min: 9, max: 10 },
  { iso: 'AU', en: 'Australia', hi: 'ऑस्ट्रेलिया', dial: '61', min: 9, max: 9 },
  { iso: 'NZ', en: 'New Zealand', hi: 'न्यूज़ीलैंड', dial: '64', min: 8, max: 10 },
  { iso: 'AE', en: 'UAE', hi: 'संयुक्त अरब अमीरात', dial: '971', min: 9, max: 9 },
  { iso: 'SA', en: 'Saudi Arabia', hi: 'सऊदी अरब', dial: '966', min: 9, max: 9 },
  { iso: 'QA', en: 'Qatar', hi: 'क़तर', dial: '974', min: 8, max: 8 },
  { iso: 'KW', en: 'Kuwait', hi: 'कुवैत', dial: '965', min: 8, max: 8 },
  { iso: 'OM', en: 'Oman', hi: 'ओमान', dial: '968', min: 8, max: 8 },
  { iso: 'BH', en: 'Bahrain', hi: 'बहरीन', dial: '973', min: 8, max: 8 },
  { iso: 'SG', en: 'Singapore', hi: 'सिंगापुर', dial: '65', min: 8, max: 8 },
  { iso: 'MY', en: 'Malaysia', hi: 'मलेशिया', dial: '60', min: 9, max: 10 },
  { iso: 'HK', en: 'Hong Kong', hi: 'हांगकांग', dial: '852', min: 8, max: 8 },
  { iso: 'JP', en: 'Japan', hi: 'जापान', dial: '81', min: 10, max: 10 },
  { iso: 'LK', en: 'Sri Lanka', hi: 'श्रीलंका', dial: '94', min: 9, max: 9 },
  { iso: 'BD', en: 'Bangladesh', hi: 'बांग्लादेश', dial: '880', min: 10, max: 10 },
  { iso: 'BT', en: 'Bhutan', hi: 'भूटान', dial: '975', min: 8, max: 8 },
  { iso: 'MU', en: 'Mauritius', hi: 'मॉरीशस', dial: '230', min: 8, max: 8 },
  { iso: 'FJ', en: 'Fiji', hi: 'फ़िजी', dial: '679', min: 7, max: 7 },
  { iso: 'ZA', en: 'South Africa', hi: 'दक्षिण अफ़्रीका', dial: '27', min: 9, max: 9 },
  { iso: 'KE', en: 'Kenya', hi: 'केन्या', dial: '254', min: 9, max: 9 },
  { iso: 'TT', en: 'Trinidad and Tobago', hi: 'त्रिनिदाद और टोबैगो', dial: '1868', min: 7, max: 7 },
  { iso: 'GY', en: 'Guyana', hi: 'गयाना', dial: '592', min: 7, max: 7 },
  { iso: 'SR', en: 'Suriname', hi: 'सूरीनाम', dial: '597', min: 6, max: 7 },
  { iso: 'DE', en: 'Germany', hi: 'जर्मनी', dial: '49', min: 10, max: 11 },
  { iso: 'NL', en: 'Netherlands', hi: 'नीदरलैंड', dial: '31', min: 9, max: 9 },
  { iso: 'FR', en: 'France', hi: 'फ़्रांस', dial: '33', min: 9, max: 9 },
  { iso: 'IT', en: 'Italy', hi: 'इटली', dial: '39', min: 9, max: 10 },
  { iso: 'IE', en: 'Ireland', hi: 'आयरलैंड', dial: '353', min: 9, max: 9 },
];
export const countryOf = (iso: string | undefined) => COUNTRIES.find(c => c.iso === iso) ?? COUNTRIES[0];
export const flagUrl = (iso: string) => `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;

/** "+9779812345678" → { iso: 'NP', num: '9812345678' }. Plain 10 digits (older entries) are Indian. */
export function splitPhone(stored: string | undefined, hint?: string): { iso: string; num: string } {
  const raw = (stored || '').trim();
  const d = raw.replace(/\D/g, '');
  if (!d) return { iso: hint && COUNTRIES.some(c => c.iso === hint) ? hint : 'IN', num: '' };
  if (!raw.startsWith('+')) {
    if (d.length === 12 && d.startsWith('91')) return { iso: 'IN', num: d.slice(2) };
    if (d.length === 11 && d.startsWith('0')) return { iso: 'IN', num: d.slice(1) };
    return { iso: hint ?? 'IN', num: d };
  }
  const byLen = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  const hit = (hint && COUNTRIES.find(c => c.iso === hint && d.startsWith(c.dial))) || byLen.find(c => d.startsWith(c.dial));
  return hit ? { iso: hit.iso, num: d.slice(hit.dial.length) } : { iso: 'IN', num: d };
}
export const joinPhone = (iso: string, num: string) => { const n = (num || '').replace(/\D/g, ''); return n ? `+${countryOf(iso).dial}${n}` : ''; };
export function validPhone(stored: string): boolean {
  const { iso, num } = splitPhone(stored);
  const c = countryOf(iso);
  return num.length >= c.min && num.length <= c.max && (iso !== 'IN' || /^[6-9]/.test(num));
}
/** "+91 77606 88931" / "+977 9812345678" for display. */
export function showPhone(stored: string | undefined): string {
  if (!stored) return '';
  const { iso, num } = splitPhone(stored);
  return iso === 'IN' && num.length === 10 ? `+91 ${num.slice(0, 5)} ${num.slice(5)}` : `+${countryOf(iso).dial} ${num}`;
}

/**
 * Phone box with a country-code picker (flag + code). Two-way: [(value)] holds the full number, e.g. "+917760688931".
 * Uses plain events (no ngModel) so it can sit inside any form.
 */
@Component({
  selector: 'vp-phone',
  standalone: true,
  template: `
    <div class="phone">
      <label class="cc" [title]="t.tx('Country code', 'देश कोड')">
        <img [src]="flag(iso())" alt="" width="24" height="16" (error)="$any($event.target).style.display = 'none'">
        <span>+{{ dial() }}</span><span class="car" aria-hidden="true">▾</span>
        <select [attr.aria-label]="t.tx('Country code', 'देश कोड')" (change)="setIso($any($event.target).value)">
          @for (c of countries; track c.iso) { <option [value]="c.iso" [selected]="c.iso === iso()">{{ t.hi() ? c.hi : c.en }} (+{{ c.dial }})</option> }
        </select>
      </label>
      <input [id]="inputId" type="tel" inputmode="numeric" [attr.maxlength]="max()" [value]="num()" [placeholder]="iso() === 'IN' ? '98765 43210' : ''"
        autocomplete="tel-national" (input)="setNum($any($event.target))">
    </div>`,
  styles: [`
    :host { display: block; }
    .phone { display: flex; align-items: stretch; border: 1.5px solid var(--line); border-radius: var(--r-sm); background: var(--card); overflow: hidden; }
    .phone:focus-within { border-color: var(--ink); }
    .cc { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; background: var(--paper); border-right: 1.5px solid var(--line);
      font-weight: 600; color: var(--ink); font-size: 1rem; flex: none; cursor: pointer; }
    .cc img { border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,.12); object-fit: cover; }
    .car { font-size: .7rem; color: var(--faint); }
    .cc select { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; font-size: 16px; }
    input { border: 0; outline: none; flex: 1; min-width: 0; padding: 10px 12px; min-height: 44px; font: inherit; background: transparent; letter-spacing: .04em; }
  `],
})
export class PhoneInputComponent {
  readonly t = useTx();
  readonly countries = COUNTRIES;
  @Input() inputId = '';
  @Output() valueChange = new EventEmitter<string>();
  readonly iso = signal('IN');
  readonly num = signal('');
  readonly dial = computed(() => countryOf(this.iso()).dial);
  readonly max = computed(() => countryOf(this.iso()).max);
  private last = '';
  @Input() set value(v: string | undefined) {
    if ((v || '') === this.last) return;
    const p = splitPhone(v, this.iso());
    this.iso.set(p.iso); this.num.set(p.num); this.last = v || '';
  }
  /** Country to start with when the number is empty (e.g. the profile's country). */
  @Input() set country(c: string | undefined) { if (c && !this.num() && COUNTRIES.some(x => x.iso === c)) this.iso.set(c); }
  flag(iso: string) { return flagUrl(iso); }
  setIso(iso: string) { this.iso.set(iso); this.emit(); }
  setNum(el: HTMLInputElement) {
    const d = el.value.replace(/\D/g, '').slice(0, this.max());
    if (el.value !== d) el.value = d;
    this.num.set(d); this.emit();
  }
  private emit() { this.last = joinPhone(this.iso(), this.num()); this.valueChange.emit(this.last); }
}

/** Shown on every booking page when the site owner has not connected Firebase yet. */
@Component({
  selector: 'vp-booking-off',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="panel off">
      <span class="ic" aria-hidden="true">🙏</span>
      <h2>{{ t.tx('Pandit booking is coming soon', 'पंडित बुकिंग जल्द आ रही है') }}</h2>
      <p class="muted">{{ t.tx('Accounts and booking are not switched on for this site yet. Meanwhile you can ask AI PanditJi anything.',
        'इस साइट पर अभी खाते और बुकिंग चालू नहीं हुए हैं। तब तक आप AI पंडित जी से कुछ भी पूछ सकते हैं।') }}</p>
      <a routerLink="/ask" class="btn">✨ {{ t.i18n.t('askAiShort') }}</a>
    </div>`,
  styles: [`.off { text-align: center; padding: 32px 20px; } .ic { font-size: 2.6rem; } h2 { margin: 8px 0; font-size: var(--s2); } p { max-width: 46ch; margin: 0 auto 16px; }`],
})
export class BookingOffComponent { readonly t = useTx(); }

/** Round photo or initials. */
@Component({
  selector: 'vp-face',
  standalone: true,
  template: `@if (photo) { <img [src]="photo" [alt]="name" [style.width.px]="size" [style.height.px]="size"> }
    @else { <span class="ini" [style.width.px]="size" [style.height.px]="size" [style.font-size.px]="size * .38">{{ ini() }}</span> }`,
  styles: [`:host { display: inline-flex; flex: none; } img, .ini { border-radius: 50%; object-fit: cover; border: 2px solid var(--haldi); }
    .ini { display: grid; place-items: center; background: var(--ink); color: var(--haldi); font-weight: 700; }`],
})
export class FaceComponent {
  @Input() photo: string | undefined = '';
  @Input() name = '';
  @Input() size = 56;
  ini() { return initials(this.name); }
}

/** Common styles for the booking pages. */
export const BOOKING_CSS = `
  .back { display: inline-block; margin-bottom: 12px; font-weight: 600; text-decoration: none; color: var(--sindoor); }
  h1 { margin: 0 0 4px; } .lead { margin: 0 0 18px; color: var(--muted); }
  .stack { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
  .stack > *, .field, .row2 > * { min-width: 0; }
  select.input, .input { min-width: 0; max-width: 100%; text-overflow: ellipsis; }
  .row2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 999px; border: 1.5px solid var(--line);
    background: var(--card); color: var(--ink); font: inherit; font-size: .88rem; cursor: pointer; }
  .chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
  .tag { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: .78rem; font-weight: 600; background: var(--haldi-soft); color: var(--ink); }
  .tag.ok { background: var(--tulsi-soft); color: var(--tulsi); } .tag.bad { background: var(--sindoor-soft); color: var(--sindoor); }
  .err { color: var(--sindoor); margin: 0; font-weight: 500; } .okmsg { color: var(--tulsi); margin: 0; font-weight: 500; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; }
  textarea.input { min-height: 90px; resize: vertical; font: inherit; }
  .empty { text-align: center; padding: 26px 16px; color: var(--muted); }
  .bk { display: flex; gap: 12px; align-items: center; padding: 12px 14px; background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    text-decoration: none; color: inherit; min-width: 0; }
  .bk:hover { border-color: var(--ink); }
  .bk .who { min-width: 0; flex: 1; } .bk b { display: block; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bk small { color: var(--muted); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .note { font-size: var(--s-1); color: var(--faint); }
  @media (max-width: 560px) { .row2 { grid-template-columns: minmax(0, 1fr); } .actions .btn { flex: 1 1 auto; } }
`;
