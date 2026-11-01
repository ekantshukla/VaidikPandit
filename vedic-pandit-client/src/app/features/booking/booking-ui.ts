// Shared pieces for the account, Pandit booking and admin pages.
import { Component, Input, computed, inject } from '@angular/core';
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
  .stack { display: grid; gap: 14px; }
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
