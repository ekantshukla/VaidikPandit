import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AccountService } from '../../core/services/account.service';
import { useTx } from './booking-ui';

type View = 'loading' | 'verify' | 'verified' | 'notme' | 'reset' | 'resetDone' | 'recover' | 'recovered' | 'changeEmail' | 'emailChanged' | 'error';

/**
 * Landing page for the links in Firebase emails (set as the "action URL" in Authentication → Templates).
 * Verify email: "Yes, verify" / "This wasn't me". Reset password: new password form. Recover email: undo an email change.
 */
@Component({
  selector: 'vp-auth-action',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
  <div class="stage">
    <section class="card">
      <div class="glow" aria-hidden="true"></div>
      <img class="logo" src="logo.svg" alt="" width="92" height="92">
      <p class="sa mantra">॥ शुभमस्तु ॥</p>

      @switch (view()) {
        @case ('loading') { <p class="muted">{{ t.tx('Please wait…', 'कृपया प्रतीक्षा करें…') }}</p> }

        @case ('verify') {
          <h1>🙏 {{ t.tx('Namaste!', 'नमस्ते!') }}</h1>
          <p class="lead">{{ t.tx('Please confirm that this email belongs to you, so we can keep your Vaidik Pandit account safe.',
            'कृपया पुष्टि करें कि यह ईमेल आपका है, ताकि आपका वैदिक पंडित खाता सुरक्षित रहे।') }}</p>
          @if (email()) { <p class="email">{{ email() }}</p> }
          <div class="btns">
            <button type="button" class="btn ok" (click)="verify()" [disabled]="busy()">✅ {{ t.tx('Yes, verify my email', 'हाँ, मेरा ईमेल सत्यापित करें') }}</button>
            <button type="button" class="btn ghost" (click)="view.set('notme')" [disabled]="busy()">✋ {{ t.tx("This wasn't me", 'यह मैंने नहीं किया') }}</button>
          </div>
        }

        @case ('verified') {
          <div class="diya" aria-hidden="true">🪔</div>
          <h1>{{ t.tx('Your email is verified', 'आपका ईमेल सत्यापित हो गया') }}</h1>
          <p class="lead">{{ t.tx('Welcome to the Vaidik Pandit family. May every puja bring peace and blessings to your home.',
            'वैदिक पंडित परिवार में आपका स्वागत है। हर पूजा आपके घर में शांति और आशीर्वाद लाए।') }}</p>
          <p class="sa blessing">सर्वे भवन्तु सुखिनः</p>
          <div class="btns">
            <a class="btn ok" routerLink="/account">{{ t.tx('Go to my account', 'मेरे खाते पर जाएँ') }}</a>
            <a class="btn ghost" routerLink="/pandits">📿 {{ t.tx('Book a Pandit', 'पंडित जी बुक करें') }}</a>
          </div>
        }

        @case ('notme') {
          <h1>{{ t.tx('No problem', 'कोई बात नहीं') }}</h1>
          <p class="lead">{{ t.tx('Nothing has been changed. Someone may have typed your email by mistake. You can simply ignore the email; the account stays unverified and cannot book anything.',
            'कुछ भी नहीं बदला गया है। शायद किसी ने ग़लती से आपका ईमेल लिखा। आप ईमेल को अनदेखा कर दें; खाता असत्यापित रहेगा और उससे कोई बुकिंग नहीं हो सकती।') }}</p>
          <div class="btns">
            <a class="btn ghost" routerLink="/">{{ t.tx('Go to Vaidik Pandit', 'वैदिक पंडित पर जाएँ') }}</a>
            <button type="button" class="btn link" (click)="view.set('verify')">← {{ t.tx('Actually, it was me', 'नहीं, यह मैंने ही किया था') }}</button>
          </div>
        }

        @case ('changeEmail') {
          <h1>📧 {{ t.tx('Confirm your new email', 'नया ईमेल पक्का करें') }}</h1>
          <p class="lead">{{ t.tx('Your Vaidik Pandit login email will change to:', 'आपके वैदिक पंडित खाते का ईमेल बदलकर यह होगा:') }}</p>
          @if (email()) { <p class="email">{{ email() }}</p> }
          <div class="btns">
            <button type="button" class="btn ok" (click)="confirmEmail()" [disabled]="busy()">✅ {{ t.tx('Yes, change my email', 'हाँ, मेरा ईमेल बदलें') }}</button>
            <button type="button" class="btn ghost" (click)="view.set('notme')" [disabled]="busy()">✋ {{ t.tx("This wasn't me", 'यह मैंने नहीं किया') }}</button>
          </div>
        }
        @case ('emailChanged') {
          <div class="diya" aria-hidden="true">🪔</div>
          <h1>{{ t.tx('Email changed', 'ईमेल बदल गया') }}</h1>
          <p class="lead">{{ t.tx('Please log in again with your new email address.', 'कृपया नए ईमेल पते से फिर लॉग इन करें।') }}</p>
          <div class="btns"><a class="btn ok" routerLink="/account">{{ t.tx('Log in', 'लॉग इन करें') }}</a></div>
        }

        @case ('reset') {
          <h1>🔑 {{ t.tx('Set a new password', 'नया पासवर्ड बनाएँ') }}</h1>
          @if (email()) { <p class="email">{{ email() }}</p> }
          <form class="form" (ngSubmit)="reset()">
            <input class="input" type="password" name="p1" [(ngModel)]="p1" minlength="6" required autocomplete="new-password"
              [placeholder]="t.tx('New password * (at least 6 characters)', 'नया पासवर्ड * (कम से कम 6 अक्षर)')">
            <input class="input" type="password" name="p2" [(ngModel)]="p2" minlength="6" required autocomplete="new-password"
              [placeholder]="t.tx('Type it again *', 'फिर से लिखें *')">
            <button class="btn ok" type="submit" [disabled]="busy()">{{ t.tx('Save new password', 'नया पासवर्ड सहेजें') }}</button>
          </form>
          <button type="button" class="btn link" (click)="view.set('notme')">✋ {{ t.tx("I didn't ask for this", 'मैंने यह नहीं माँगा') }}</button>
        }

        @case ('resetDone') {
          <div class="diya" aria-hidden="true">🪔</div>
          <h1>{{ t.tx('Password changed', 'पासवर्ड बदल गया') }}</h1>
          <p class="lead">{{ t.tx('You can now log in with your new password.', 'अब आप नए पासवर्ड से लॉग इन कर सकते हैं।') }}</p>
          <div class="btns"><a class="btn ok" routerLink="/account">{{ t.tx('Log in', 'लॉग इन करें') }}</a></div>
        }

        @case ('recover') {
          <h1>{{ t.tx('Undo the email change?', 'ईमेल बदलाव वापस लें?') }}</h1>
          <p class="lead">{{ t.tx('Your account email was changed. If you did not do this, restore your old email:', 'आपके खाते का ईमेल बदला गया था। अगर यह आपने नहीं किया, तो पुराना ईमेल वापस लाएँ:') }}</p>
          @if (email()) { <p class="email">{{ email() }}</p> }
          <div class="btns">
            <button type="button" class="btn ok" (click)="recover()" [disabled]="busy()">↩ {{ t.tx('Restore my email', 'मेरा ईमेल वापस लाएँ') }}</button>
            <a class="btn ghost" routerLink="/">{{ t.tx('It was me, keep it', 'यह मैंने किया, रहने दें') }}</a>
          </div>
        }

        @case ('recovered') {
          <h1>{{ t.tx('Your email is restored', 'आपका ईमेल वापस आ गया') }}</h1>
          <p class="lead">{{ t.tx('For safety, please also change your password from the log in page (Forgot password).', 'सुरक्षा के लिए, लॉग इन पृष्ठ से पासवर्ड भी बदल लें (पासवर्ड भूल गए)।') }}</p>
          <div class="btns"><a class="btn ok" routerLink="/account">{{ t.tx('Log in', 'लॉग इन करें') }}</a></div>
        }

        @case ('error') {
          <h1>{{ t.tx('This link did not work', 'यह लिंक काम नहीं किया') }}</h1>
          <p class="lead">{{ err() }}</p>
          <p class="muted small">{{ t.tx('If you already verified, just log in. Otherwise open My account and tap "Send again".', 'अगर आपने पहले ही सत्यापन कर लिया है, तो बस लॉग इन करें। नहीं तो मेरा खाता खोलकर "फिर भेजें" दबाएँ।') }}</p>
          <div class="btns"><a class="btn ok" routerLink="/account">{{ t.tx('Go to my account', 'मेरे खाते पर जाएँ') }}</a></div>
        }
      }
      @if (err() && view() !== 'error') { <p class="err" role="alert">{{ err() }}</p> }

      <p class="foot">वैदिक पंडित · Vaidik Pandit</p>
    </section>
  </div>`,
  styles: [`
    .stage { min-height: 78vh; display: grid; place-items: center; padding: 28px 16px 120px;
      background: radial-gradient(ellipse at top, #2C2450 0%, var(--ink) 60%); }
    .card { position: relative; overflow: hidden; width: min(520px, 100%); text-align: center; background: var(--card); border-radius: 24px;
      padding: 30px 24px 22px; border-top: 6px solid var(--haldi); box-shadow: 0 24px 60px rgba(0,0,0,.35); }
    .glow { position: absolute; inset: -40% -20% auto; height: 260px; background: radial-gradient(circle, rgba(227,162,26,.22), transparent 65%); pointer-events: none; }
    .logo { position: relative; display: block; margin: 0 auto 6px; }
    .mantra { position: relative; color: var(--sindoor); font-size: 1.15rem; margin: 0 0 12px; letter-spacing: .04em; }
    h1 { font-size: var(--s3); margin: 0 0 8px; color: var(--ink); }
    .lead { color: var(--muted); margin: 0 auto 14px; max-width: 42ch; }
    .email { display: inline-block; background: var(--haldi-soft); border-radius: 999px; padding: 6px 16px; font-weight: 600; color: var(--ink);
      margin: 0 0 16px; overflow-wrap: anywhere; }
    .btns { display: flex; flex-direction: column; gap: 10px; align-items: stretch; margin: 6px auto 0; max-width: 340px; }
    .btns .btn { white-space: normal; text-decoration: none; }
    .ok { background: var(--tulsi); } .ok:hover { background: #24563f; }
    .link { border: 0; background: none; color: var(--sindoor); font: inherit; font-weight: 600; cursor: pointer; margin-top: 10px; }
    .diya { font-size: 3rem; line-height: 1; margin-bottom: 6px; }
    .blessing { color: var(--sindoor); font-size: 1.2rem; margin: 0 0 14px; }
    .form { display: grid; gap: 10px; max-width: 340px; margin: 0 auto; }
    .err { color: var(--sindoor); font-weight: 500; margin: 12px 0 0; }
    .small { font-size: var(--s-1); }
    .foot { margin: 22px 0 0; padding-top: 14px; border-top: 1px dashed var(--line); color: var(--faint); font-size: .85rem; }
  `],
})
export class AuthActionComponent {
  private acc = inject(AccountService);
  readonly t = useTx();
  readonly view = signal<View>('loading');
  readonly email = signal('');
  readonly err = signal('');
  readonly busy = signal(false);
  private code = '';
  p1 = ''; p2 = '';

  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    const mode = q.get('mode') ?? '';
    this.code = q.get('oobCode') ?? '';
    if (q.get('lang') === 'hi') this.t.i18n.set('hi');
    this.start(mode);
  }

  private fail(e: unknown) { this.err.set(this.acc.errorText(e, this.t.hi())); this.view.set('error'); }

  private async start(mode: string) {
    if (!this.acc.configured || !this.code) { this.err.set(this.t.tx('This link is incomplete.', 'यह लिंक अधूरा है।')); this.view.set('error'); return; }
    try {
      if (mode === 'verifyEmail') { this.email.set((await this.acc.actionInfo(this.code)).email); this.view.set('verify'); }
      else if (mode === 'resetPassword') { this.email.set(await this.acc.resetEmailFor(this.code)); this.view.set('reset'); }
      else if (mode === 'verifyAndChangeEmail') { this.email.set((await this.acc.actionInfo(this.code)).email); this.view.set('changeEmail'); }
      else if (mode === 'recoverEmail') { this.email.set((await this.acc.actionInfo(this.code)).email); this.view.set('recover'); }
      else { this.err.set(this.t.tx('This link is not recognised.', 'यह लिंक पहचाना नहीं गया।')); this.view.set('error'); }
    } catch (e) { this.fail(e); }
  }

  private async run(f: () => Promise<void>, next: View) {
    this.busy.set(true); this.err.set('');
    try { await f(); this.view.set(next); } catch (e) { this.fail(e); } finally { this.busy.set(false); }
  }
  verify() { return this.run(() => this.acc.applyAction(this.code), 'verified'); }
  confirmEmail() { return this.run(async () => { await this.acc.applyAction(this.code); await this.acc.signOut().catch(() => undefined); }, 'emailChanged'); }
  recover() { return this.run(() => this.acc.applyAction(this.code), 'recovered'); }
  reset() {
    if (this.p1.length < 6) { this.err.set(this.t.tx('Password must be at least 6 characters.', 'पासवर्ड कम से कम 6 अक्षर का हो।')); return undefined; }
    if (this.p1 !== this.p2) { this.err.set(this.t.tx('The two passwords do not match.', 'दोनों पासवर्ड एक जैसे नहीं हैं।')); return undefined; }
    return this.run(() => this.acc.confirmReset(this.code, this.p1), 'resetDone');
  }
}
