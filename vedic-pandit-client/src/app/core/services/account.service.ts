// Accounts, Pandit profiles, bookings and booking chat on Firebase (Authentication + Cloud Firestore).
// The Firebase SDK is loaded from Google's CDN on first use, so the website and app stay small and the build needs
// no extra packages. Data access is protected by firestore.rules (see PANDIT_BOOKING.md).
import { Injectable, computed, signal } from '@angular/core';
import { ADMIN_EMAILS, FIREBASE_CONFIG, WEBSITE_URL } from '../app-info';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
// Keep the bundler from trying to resolve the CDN URLs
const load = new Function('u', 'return import(u)') as (u: string) => Promise<any>;

export type Role = 'user' | 'pandit';
export type PanditStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type BookingStatus = 'requested' | 'accepted' | 'declined' | 'cancelled' | 'completed';

export interface Profile { uid: string; name: string; email: string; phone: string; city: string; role: Role; createdAt?: number; }
export interface Pandit {
  uid: string; name: string; photo: string; phone: string; whatsapp: string; state: string; city: string;
  languages: string[]; sampradaya: string; experience: number; pujas: string[]; fee: string; about: string;
  online: boolean; status: PanditStatus; rejectReason?: string; createdAt?: number; approvedAt?: number;
}
export interface Booking {
  id: string; userId: string; userName: string; userPhone: string; panditId: string; panditName: string; panditPhone?: string; panditWhatsapp?: string;
  puja: string; date: string; time: string; mode: 'home' | 'temple' | 'online'; address: string; notes: string;
  status: BookingStatus; createdAt?: number; updatedAt?: number; declineReason?: string;
}
export interface Message { id: string; from: string; name: string; text: string; at?: number; }

/** Accepts the JSON config, or the `const firebaseConfig = { apiKey: "…", … }` snippet the Firebase console shows. */
function parseConfig(raw: string): Record<string, string> | null {
  if (!raw.trim()) return null;
  try { const j = JSON.parse(raw); if (j?.apiKey) return j; } catch { /* not strict JSON */ }
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/(\w+)\s*:\s*["']([^"']+)["']/g)) out[m[1]] = m[2];
  return out['apiKey'] && out['projectId'] ? out : null;
}
function hadAccount(): boolean { try { return localStorage.getItem('vp.acct') === '1'; } catch { return true; } }
function rememberAccount(on: boolean) { try { if (on) localStorage.setItem('vp.acct', '1'); else localStorage.removeItem('vp.acct'); } catch { /* ignore */ } }
const ts = (v: any): number | undefined => (v?.toMillis ? v.toMillis() : typeof v === 'number' ? v : undefined);

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly cfg = parseConfig(FIREBASE_CONFIG);
  readonly configured = !!this.cfg;
  private readonly admins = ADMIN_EMAILS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  /** null = not signed in; undefined = still checking. */
  readonly user = signal<{ uid: string; email: string; verified: boolean } | null | undefined>(undefined);
  readonly profile = signal<Profile | null>(null);
  readonly myPandit = signal<Pandit | null>(null);
  readonly isAdmin = computed(() => { const u = this.user(); return !!u && this.admins.includes(u.email.toLowerCase()); });
  /** Bookings that need the signed-in person's attention (new requests for a pandit, new replies for a user). */
  readonly pending = signal(0);

  private fb?: Promise<{ auth: any; db: any; A: any; F: any }>;
  private unsubPending?: () => void;

  /** After verifying or resetting on Firebase's page, a "Continue" button brings the person back to their account here. */
  private backLink() { return { url: WEBSITE_URL + '#/account' }; }
  /** Verification email with the "Continue" link; falls back to the plain email if Firebase rejects the link. */
  private sendVerify(A: any, user: any): Promise<void> {
    return A.sendEmailVerification(user, this.backLink()).catch((e: any) => {
      if (String(e?.code).includes('continue') || String(e?.code).includes('domain')) return A.sendEmailVerification(user);
      throw e;
    });
  }

  constructor() {
    // Coming back to the tab after clicking the email link: refresh "verified" without a manual reload
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => { const u = this.user(); if (u && !u.verified) this.reloadUser().catch(() => undefined); });
    }
    // The Firebase SDK (~300 kB) is fetched only for people who have signed in on this device, or when a booking page
    // needs it. Everyone else starts the app without it, which keeps start-up fast on low-memory (Android Go) phones.
    if (this.configured && hadAccount()) this.init().catch(() => this.user.set(null));
    else this.user.set(null);
  }

  private init() {
    this.fb ??= this.boot().catch(e => { console.warn('Firebase failed to load', e); this.fb = undefined; throw e; });
    return this.fb;
  }

  private boot() {
    return (async () => {
      const [appMod, A, F] = await Promise.all([load(SDK + 'firebase-app.js'), load(SDK + 'firebase-auth.js'), load(SDK + 'firebase-firestore.js')]);
      const app = appMod.initializeApp(this.cfg);
      // No popup/redirect resolver: email sign-in only, which also works inside the Android app's WebView
      const auth = A.initializeAuth(app, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] });
      // Databases created in the new console may be named "default" instead of "(default)": add databaseId to FIREBASE_CONFIG then
      const dbId = this.cfg?.['databaseId'];
      const db = dbId && dbId !== '(default)' ? F.getFirestore(app, dbId) : F.getFirestore(app);
      A.onAuthStateChanged(auth, async (u: any) => {
        this.user.set(u ? { uid: u.uid, email: u.email ?? '', verified: !!u.emailVerified } : null);
        rememberAccount(!!u);
        this.profile.set(null); this.myPandit.set(null); this.unsubPending?.(); this.pending.set(0);
        if (u) await this.loadMine(u.uid);
      });
      return { auth, db, A, F };
    })();
  }

  private async loadMine(uid: string) {
    const { db, F } = await this.init();
    const p = await F.getDoc(F.doc(db, 'users', uid));
    if (p.exists()) this.profile.set({ uid, ...p.data(), createdAt: ts(p.data().createdAt) } as Profile);
    else {
      // The login exists but its profile was never saved (e.g. the database wasn't ready at sign-up): create a basic one
      const { auth } = await this.init();
      const u = auth.currentUser;
      const basic = { name: (u?.displayName ?? '').slice(0, 80), email: u?.email ?? '', phone: '', city: '', role: 'user' as Role };
      await F.setDoc(F.doc(db, 'users', uid), { ...basic, createdAt: F.serverTimestamp() }).catch((e: any) => console.warn('profile create failed', e));
      this.profile.set({ uid, ...basic });
    }
    const pd = await F.getDoc(F.doc(db, 'pandits', uid)).catch(() => null);
    if (pd?.exists()) this.myPandit.set(await this.withPrivate(this.toPandit(pd)));
    this.watchPending(uid);
  }

  private watchPending(uid: string) {
    this.init().then(({ db, F }) => {
      const field = this.profile()?.role === 'pandit' ? 'panditId' : 'userId';
      const want: BookingStatus = field === 'panditId' ? 'requested' : 'accepted';
      this.unsubPending = F.onSnapshot(
        F.query(F.collection(db, 'bookings'), F.where(field, '==', uid), F.where('status', '==', want)),
        (snap: any) => this.pending.set(snap.size), () => this.pending.set(0));
    });
  }

  private toPandit(d: any): Pandit {
    const x = d.data();
    return { uid: d.id, phone: '', whatsapp: '', languages: [], pujas: [], ...x, createdAt: ts(x.createdAt), approvedAt: ts(x.approvedAt) } as Pandit;
  }
  /** Phone numbers live in panditPrivate/{uid}, readable only by that Pandit and the admin. */
  private async withPrivate(p: Pandit): Promise<Pandit> {
    const { db, F } = await this.init();
    const d = await F.getDoc(F.doc(db, 'panditPrivate', p.uid)).catch(() => null);
    return d?.exists() ? { ...p, phone: d.data().phone ?? '', whatsapp: d.data().whatsapp ?? '' } : { ...p, phone: '', whatsapp: '' };
  }
  private toBooking(d: any): Booking {
    const x = d.data();
    return { id: d.id, ...x, createdAt: ts(x.createdAt), updatedAt: ts(x.updatedAt) } as Booking;
  }

  /** Friendly message for Firebase error codes. */
  errorText(e: any, hi: boolean): string {
    const c = String(e?.code ?? e?.message ?? e).toLowerCase();
    const map: [string, string, string][] = [
      ['invalid-credential', 'Wrong email or password.', 'ईमेल या पासवर्ड ग़लत है।'],
      ['wrong-password', 'Wrong email or password.', 'ईमेल या पासवर्ड ग़लत है।'],
      ['user-not-found', 'No account with this email.', 'इस ईमेल से कोई खाता नहीं है।'],
      ['email-already-in-use', 'An account with this email already exists. Please log in.', 'इस ईमेल से खाता पहले से है। कृपया लॉग इन करें।'],
      ['weak-password', 'Password must be at least 6 characters.', 'पासवर्ड कम से कम 6 अक्षर का हो।'],
      ['invalid-email', 'Please enter a valid email.', 'सही ईमेल लिखें।'],
      ['network-request-failed', 'No internet connection.', 'इंटरनेट कनेक्शन नहीं है।'],
      ['too-many-requests', 'Too many tries. Please wait a few minutes.', 'बहुत बार प्रयास हुआ। कुछ मिनट रुकें।'],
      ['permission-denied', 'You are not allowed to do that. (Check the Firestore rules are published.)', 'आपको यह करने की अनुमति नहीं है। (Firestore rules जाँचें)'],
      ['operation-not-allowed', 'Email sign-in is not switched on in Firebase Authentication.', 'Firebase में ईमेल लॉग इन चालू नहीं है।'],
      ['api-key', 'The Firebase config (FIREBASE_CONFIG) looks wrong.', 'Firebase config (FIREBASE_CONFIG) ग़लत लग रहा है।'],
      ['configuration-not-found', 'Firebase Authentication is not set up for this project.', 'इस प्रोजेक्ट में Firebase Authentication चालू नहीं है।'],
      ['unauthorized-domain', 'This website address is not in Firebase Authorised domains.', 'यह वेबसाइट Firebase Authorised domains में नहीं है।'],
      ['not-found', 'The Firestore database was not found. Its ID must be (default).', 'Firestore डेटाबेस नहीं मिला। उसकी ID (default) होनी चाहिए।'],
      ['expired-action-code', 'This link has expired. Please ask for a new one.', 'यह लिंक पुराना हो गया है। नया लिंक मँगवाएँ।'],
      ['invalid-action-code', 'This link was already used or is not valid. Please ask for a new one.', 'यह लिंक पहले ही उपयोग हो चुका है या सही नहीं है। नया लिंक मँगवाएँ।'],
      ['failed to fetch', 'Could not load Firebase. Check your internet and try again.', 'Firebase लोड नहीं हुआ। इंटरनेट जाँचें।'],
    ];
    const hit = map.find(([k]) => c.includes(k));
    console.warn('Firebase error', e);
    // Show the code too, so a problem can be reported and fixed
    return hit ? (hi ? hit[2] : hit[1]) : (hi ? 'कुछ गड़बड़ हुई। फिर प्रयास करें।' : 'Something went wrong. Please try again.') + (hit ? '' : ` [${c.slice(0, 120)}]`);
  }

  // ---------------- auth ----------------
  async signUp(d: { name: string; email: string; password: string; phone: string; city: string; role: Role }) {
    const { auth, db, A, F } = await this.init();
    const cred = await A.createUserWithEmailAndPassword(auth, d.email.trim(), d.password);
    await A.updateProfile(cred.user, { displayName: d.name.trim() }).catch(() => undefined);
    const profile = { name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim(), city: d.city.trim(), role: d.role, createdAt: F.serverTimestamp() };
    await F.setDoc(F.doc(db, 'users', cred.user.uid), profile);
    this.profile.set({ uid: cred.user.uid, ...profile, createdAt: Date.now() } as Profile);
    this.sendVerify(A, cred.user).catch(() => undefined);
  }
  async signIn(email: string, password: string) {
    const { auth, A } = await this.init();
    await A.signInWithEmailAndPassword(auth, email.trim(), password);
  }
  async signOut() { const { auth, A } = await this.init(); await A.signOut(auth); }
  // Links from Firebase emails (handled on the #/auth-action page)
  async actionInfo(code: string): Promise<{ email: string; operation: string }> {
    const { auth, A } = await this.init();
    const i = await A.checkActionCode(auth, code);
    return { email: i?.data?.email ?? i?.data?.previousEmail ?? '', operation: i?.operation ?? '' };
  }
  async applyAction(code: string) {
    const { auth, A } = await this.init();
    await A.applyActionCode(auth, code);
    if (auth.currentUser) await this.reloadUser().catch(() => undefined);
  }
  async resetEmailFor(code: string): Promise<string> { const { auth, A } = await this.init(); return A.verifyPasswordResetCode(auth, code); }
  async confirmReset(code: string, password: string) { const { auth, A } = await this.init(); await A.confirmPasswordReset(auth, code, password); }
  async resetPassword(email: string) { const { auth, A } = await this.init(); await A.sendPasswordResetEmail(auth, email.trim(), this.backLink()).catch((e: any) => { if (String(e?.code).includes('continue')) return A.sendPasswordResetEmail(auth, email.trim()); throw e; }); }
  async resendVerification() { const { auth, A } = await this.init(); if (auth.currentUser) await this.sendVerify(A, auth.currentUser); }
  async reloadUser() {
    const { auth } = await this.init();
    await auth.currentUser?.reload();
    const u = auth.currentUser;
    if (u) this.user.set({ uid: u.uid, email: u.email ?? '', verified: !!u.emailVerified });
  }
  async updateProfile(d: Partial<Pick<Profile, 'name' | 'phone' | 'city' | 'role'>>) {
    const { db, F } = await this.init();
    const u = this.user(); if (!u) throw new Error('not signed in');
    await F.updateDoc(F.doc(db, 'users', u.uid), d);
    this.profile.update(p => (p ? { ...p, ...d } : p));
  }

  // ---------------- pandits ----------------
  /**
   * Create or edit the signed-in pandit's profile. A new profile starts as 'pending' until the admin approves it.
   * A rejected profile, or an approved one whose name or photo changes, goes back for review.
   * Returns true when the profile is (again) waiting for review.
   */
  async savePandit(d: Omit<Pandit, 'uid' | 'status' | 'createdAt' | 'approvedAt' | 'rejectReason'>): Promise<boolean> {
    const { db, F } = await this.init();
    const u = this.user(); if (!u) throw new Error('not signed in');
    const ref = F.doc(db, 'pandits', u.uid);
    const { phone, whatsapp, ...pub } = d;
    const cur = this.myPandit();
    let review = true;
    if (!cur) await F.setDoc(ref, { ...pub, status: 'pending', createdAt: F.serverTimestamp() });
    else if (cur.status === 'rejected' || (cur.status === 'approved' && (cur.name !== d.name || cur.photo !== d.photo))) await F.updateDoc(ref, { ...pub, status: 'pending' });
    else { await F.updateDoc(ref, { ...pub }); review = cur.status === 'pending'; }
    await F.setDoc(F.doc(db, 'panditPrivate', u.uid), { phone, whatsapp });
    if (this.profile()?.role !== 'pandit') await this.updateProfile({ role: 'pandit' });
    const fresh = await F.getDoc(ref);
    this.myPandit.set({ ...this.toPandit(fresh), phone, whatsapp });
    return review;
  }
  async setOnline(online: boolean) {
    const { db, F } = await this.init();
    const u = this.user(); if (!u) return;
    await F.updateDoc(F.doc(db, 'pandits', u.uid), { online });
    this.myPandit.update(p => (p ? { ...p, online } : p));
  }
  async approvedPandits(): Promise<Pandit[]> {
    const { db, F } = await this.init();
    const snap = await F.getDocs(F.query(F.collection(db, 'pandits'), F.where('status', '==', 'approved')));
    return snap.docs.map((d: any) => this.toPandit(d));
  }
  async pandit(uid: string): Promise<Pandit | null> {
    const { db, F } = await this.init();
    const d = await F.getDoc(F.doc(db, 'pandits', uid));
    return d.exists() ? this.toPandit(d) : null;
  }
  // admin
  async panditsByStatus(status: PanditStatus): Promise<Pandit[]> {
    const { db, F } = await this.init();
    const snap = await F.getDocs(F.query(F.collection(db, 'pandits'), F.where('status', '==', status)));
    const list: Pandit[] = await Promise.all(snap.docs.map((d: any) => this.withPrivate(this.toPandit(d))));
    return list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }
  async setPanditStatus(uid: string, status: PanditStatus, reason = '') {
    const { db, F } = await this.init();
    await F.updateDoc(F.doc(db, 'pandits', uid), { status, rejectReason: reason, ...(status === 'approved' ? { approvedAt: F.serverTimestamp() } : {}) });
  }

  // ---------------- bookings ----------------
  async book(p: Pandit, d: Pick<Booking, 'puja' | 'date' | 'time' | 'mode' | 'address' | 'notes'>): Promise<string> {
    const { db, F } = await this.init();
    const u = this.user(), me = this.profile();
    if (!u || !me) throw new Error('not signed in');
    const ref = await F.addDoc(F.collection(db, 'bookings'), {
      userId: u.uid, userName: me.name, userPhone: me.phone, panditId: p.uid, panditName: p.name,
      ...d, status: 'requested', createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(),
    });
    return ref.id;
  }
  /** My bookings as a user, or the requests I received as a pandit, newest first. */
  watchBookings(as: 'user' | 'pandit', cb: (b: Booking[]) => void): () => void {
    let stop = () => undefined as void;
    this.init().then(({ db, F }) => {
      const u = this.user(); if (!u) return;
      stop = F.onSnapshot(F.query(F.collection(db, 'bookings'), F.where(as === 'user' ? 'userId' : 'panditId', '==', u.uid)),
        (snap: any) => cb(snap.docs.map((d: any) => this.toBooking(d)).sort((a: Booking, b: Booking) => (b.createdAt ?? Date.now()) - (a.createdAt ?? Date.now()))),
        () => cb([]));
    });
    return () => stop();
  }
  watchBooking(id: string, cb: (b: Booking | null) => void): () => void {
    let stop = () => undefined as void;
    this.init().then(({ db, F }) => {
      stop = F.onSnapshot(F.doc(db, 'bookings', id), (d: any) => cb(d.exists() ? this.toBooking(d) : null), () => cb(null));
    });
    return () => stop();
  }
  /** Pandit accepts: their phone numbers are copied into the booking so only this devotee can see them. */
  async respond(b: Booking, accept: boolean, reason = '') {
    const { db, F } = await this.init();
    const me = this.myPandit();
    await F.updateDoc(F.doc(db, 'bookings', b.id), accept
      ? { status: 'accepted', panditPhone: me?.phone ?? '', panditWhatsapp: me?.whatsapp || me?.phone || '', updatedAt: F.serverTimestamp() }
      : { status: 'declined', declineReason: reason, updatedAt: F.serverTimestamp() });
  }
  async setBookingStatus(b: Booking, status: 'cancelled' | 'completed') {
    const { db, F } = await this.init();
    await F.updateDoc(F.doc(db, 'bookings', b.id), { status, updatedAt: F.serverTimestamp() });
  }
  watchMessages(bookingId: string, cb: (m: Message[]) => void): () => void {
    let stop = () => undefined as void;
    this.init().then(({ db, F }) => {
      stop = F.onSnapshot(F.query(F.collection(db, 'bookings', bookingId, 'messages'), F.orderBy('at', 'asc'), F.limit(300)),
        (snap: any) => cb(snap.docs.map((d: any) => ({ id: d.id, ...d.data(), at: ts(d.data().at) }) as Message)), () => cb([]));
    });
    return () => stop();
  }
  async send(bookingId: string, text: string) {
    const { db, F } = await this.init();
    const u = this.user(); if (!u) throw new Error('not signed in');
    const name = this.profile()?.name ?? '';
    await F.addDoc(F.collection(db, 'bookings', bookingId, 'messages'), { from: u.uid, name, text: text.trim().slice(0, 1000), at: F.serverTimestamp() });
  }
}

/** Shrink a chosen photo to a small square JPEG data URL (stored in Firestore, so no paid Storage bucket is needed). */
export function photoToDataUrl(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
