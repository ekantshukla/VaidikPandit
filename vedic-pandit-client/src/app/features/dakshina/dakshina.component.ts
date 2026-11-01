import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import QRCode from 'qrcode';
import { I18nService } from '../../core/services/i18n.service';
import { NativeService } from '../../core/services/native.service';
import { UPI_ID, UPI_NAME } from '../../core/app-info';

/** Shagun amounts traditionally end in 1: the extra rupee marks a new beginning. */
const AMOUNTS = [11, 21, 51, 101, 251, 501, 1100];

@Component({
  selector: 'vp-dakshina',
  standalone: true,
  imports: [FormsModule],
  template: `
  <div class="wrap page">
    <header class="page-head dh">
      <button type="button" class="close" (click)="close()" [attr.aria-label]="i18n.t('closeChat')" [title]="i18n.t('closeChat')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <h1><span class="sa">दक्षिणा</span>@if (i18n.lang() !== 'hi' && i18n.lang() !== 'mr') {&ngsp;<span class="en">Dakshina</span>}</h1>
      <p>{{ i18n.t('dakIntro') }}</p>
    </header>

    <div class="grid">
      <section class="choose" aria-labelledby="amt-h">
        <h2 id="amt-h">{{ i18n.t('dakAmount') }}</h2>
        <div class="chips" role="radiogroup" [attr.aria-label]="i18n.t('dakAmount')">
          @for (a of amounts; track a) {
            <button type="button" role="radio" class="chip" [class.on]="amount() === a && !custom()" [attr.aria-checked]="amount() === a && !custom()" (click)="pick(a)">
              ₹{{ a.toLocaleString('en-IN') }}
            </button>
          }
        </div>
        <div class="field other">
          <label for="dak-other">{{ i18n.t('dakOther') }}</label>
          <div class="rupee">
            <span aria-hidden="true">₹</span>
            <input id="dak-other" class="input" type="number" inputmode="numeric" min="1" max="100000" step="1"
                   [ngModel]="custom()" (ngModelChange)="setCustom($event)" [placeholder]="i18n.t('dakAny')">
          </div>
        </div>
        <p class="why muted">{{ i18n.t('dakWhy') }}</p>

        @if (native.platform !== 'desktop') {
          <a class="btn pay" [href]="upiLink()">{{ i18n.f('dakPay', { amt: amountLabel() }) }}</a>
          <p class="faint small">{{ i18n.t('dakPayHint') }}</p>
        }
      </section>

      <section class="qr-card" aria-labelledby="qr-h">
        <h2 id="qr-h" class="sr-only">{{ i18n.t('dakScan') }}</h2>
        <div class="qr">@if (qrSvg()) { <img [src]="qrSvg()" [alt]="i18n.t('dakScan') + ' ' + amountLabel()" width="520" height="520"> }</div>
        <p class="amt num">{{ amountLabel() || i18n.t('dakAnyAmount') }}</p>
        <p class="scan">{{ i18n.t('dakScan') }}</p>

        <div class="upi">
          <span class="lbl">UPI ID</span>
          <code class="id" id="upi-id">{{ upiId }}</code>
          <button type="button" class="btn quiet copy" (click)="copy()">{{ copied() ? i18n.t('dakCopied') : i18n.t('dakCopy') }}</button>
        </div>
        <p class="to">{{ i18n.t('dakTo') }} <b>{{ upiName }}</b></p>
      </section>
    </div>

    <p class="safe faint">{{ i18n.t('dakSafe') }}</p>
  </div>`,
  styles: [`
    .dh { position: relative; padding-right: 56px; }
    .close { position: absolute; top: 0; right: 0; width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid var(--line); background: var(--card); color: var(--ink); cursor: pointer; display: grid; place-items: center; }
    .close:hover { border-color: var(--ink); }
    .close svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
    h1 .en { font-weight: 600; }
    h1 .sa { font-weight: 400; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: 32px; align-items: start; }
    h2 { font-size: var(--s1); margin-bottom: 12px; }
    .chips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; max-width: 520px; }
    .chip { min-width: 0; min-height: 48px; padding: 8px 16px; border-radius: 999px; border: 1.5px solid var(--line); background: var(--card);
            font-size: 1.1rem; font-weight: 600; color: var(--ink); cursor: pointer; font-variant-numeric: tabular-nums; }
    .chip:hover { border-color: var(--ink); }
    .chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
    .other { margin-top: 18px; max-width: 280px; }
    .rupee { position: relative; }
    .rupee span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); font-weight: 600; }
    .rupee .input { padding-left: 30px; font-size: 1.05rem; }
    .why { margin-top: 18px; font-size: var(--s-1); }
    .pay { width: 100%; max-width: 420px; min-height: 54px; font-size: 1.1rem; margin-top: 6px; text-decoration: none; }
    .small { font-size: var(--s-1); margin-top: 8px; }

    .qr-card { background: var(--ink); color: #F6F4FA; border-radius: var(--r-lg); padding: 24px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .qr { background: #fff; border-radius: var(--r-md); padding: 14px; width: min(260px, 100%); aspect-ratio: 1; max-width: 100%; }
    .qr img { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
    .amt { font-size: var(--s3); font-weight: 700; color: #fff; margin: 14px 0 0; }
    .scan { color: rgba(246,244,250,.72); margin: 0 0 18px; }
    .upi { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; background: rgba(255,255,255,.08); border-radius: 999px; padding: 6px 6px 6px 16px; max-width: 100%; }
    .lbl { font-size: var(--s-1); color: var(--haldi); font-weight: 600; }
    .id { font-family: var(--sans); font-size: 1.02rem; color: #fff; user-select: all; word-break: break-all; }
    .copy { min-height: 38px; padding: 6px 16px; }
    .to { margin: 12px 0 0; color: rgba(246,244,250,.75); font-size: var(--s-1); }
    .to b { color: #fff; font-weight: 600; }
    .safe { margin-top: 28px; font-size: var(--s-1); max-width: 70ch; }

    @media (max-width: 860px) {
      .grid { grid-template-columns: 1fr; gap: 24px; }
      .qr-card { order: -1; }
      .chip { padding: 8px 4px; font-size: 1rem; }
    }
  `],
})
export class DakshinaComponent {
  readonly i18n = inject(I18nService);
  readonly native = inject(NativeService);
  private router = inject(Router);
  /** Back to where the reader came from, or home if they opened Dakshina directly. */
  close() { history.length > 1 ? history.back() : this.router.navigate(['/']); }
  readonly amounts = AMOUNTS;
  readonly upiId = UPI_ID;
  readonly upiName = UPI_NAME;

  readonly amount = signal<number>(101);
  readonly custom = signal<number | null>(null);
  readonly copied = signal(false);
  readonly qrSvg = signal('');

  readonly value = computed(() => {
    const c = this.custom();
    return c && c > 0 ? Math.min(Math.floor(c), 100000) : this.amount();
  });
  readonly amountLabel = computed(() => this.value() ? `₹${this.value().toLocaleString('en-IN')}` : '');

  /** NPCI UPI deep link: opens GPay / PhonePe / Paytm / BHIM with payee and amount filled in. */
  readonly upiLink = computed(() => {
    const p = new URLSearchParams({ pa: UPI_ID, pn: UPI_NAME, cu: 'INR', tn: 'Dakshina - Vaidik Pandit' });
    if (this.value()) p.set('am', this.value().toFixed(2));
    return `upi://pay?${p.toString().replace(/\+/g, '%20')}`;
  });

  constructor() {
    effect(() => {
      const link = this.upiLink();
      QRCode.toDataURL(link, { margin: 0, width: 520, errorCorrectionLevel: 'M', color: { dark: '#1D1736', light: '#FFFFFF' } })
        .then(svg => this.qrSvg.set(svg))
        .catch(() => this.qrSvg.set(''));
    });
  }

  pick(a: number) { this.custom.set(null); this.amount.set(a); }
  setCustom(v: number | string | null) {
    const n = typeof v === 'string' ? parseInt(v, 10) : v;
    this.custom.set(n && n > 0 ? n : null);
  }

  async copy() {
    try { await navigator.clipboard.writeText(UPI_ID); }
    catch {
      // Clipboard blocked: select the ID so the visitor can copy it themselves
      const el = document.getElementById('upi-id');
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); }
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
