import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Links in Firebase emails (verify email, reset password) open the site as ?mode=…&oobCode=…
// Hand them to the #/auth-action page, which shows the Verify / Not me buttons.
try {
  const q = new URLSearchParams(location.search);
  if (q.get('mode') && q.get('oobCode')) {
    const keep = new URLSearchParams();
    for (const k of ['mode', 'oobCode', 'lang']) { const v = q.get(k); if (v) keep.set(k, v); }
    history.replaceState(null, '', location.pathname + '#/auth-action?' + keep.toString());
  }
} catch { /* ignore */ }

/** Fade out the loading screen once the app is ready. In the Android app keep it at least 1.5 s from launch,
 *  because Android 12+ shows only the logo on its own splash, and the name + credit live on this screen. */
function hideBoot() {
  const el = document.getElementById('boot');
  if (!el) return;
  const inApp = !!(window as any).Capacitor?.isNativePlatform?.();
  const wait = inApp ? Math.max(0, 1500 - performance.now()) : 0;
  setTimeout(() => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; setTimeout(() => el.remove(), 400); }, wait);
}

bootstrapApplication(AppComponent, appConfig)
  .then(hideBoot)
  .catch((err) => { console.error(err); hideBoot(); });
