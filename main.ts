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

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
