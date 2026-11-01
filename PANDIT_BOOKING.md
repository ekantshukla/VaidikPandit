# Accounts and Pandit booking: setup

Vedic Pandit lets devotees create an account and book a verified Pandit. Pandits sign up, fill in a profile, and you approve them. After a Pandit accepts a booking, the devotee can chat with him in the app and call or WhatsApp him directly. Dakshina is paid straight to the Pandit; the site takes no payment.

Accounts and data are stored in **Firebase** (Google). The free Spark plan is enough, and you don't need a card. Until you finish these steps, the booking pages say "coming soon" and the rest of the site works as before.

## What you need to do once (about 15 minutes)

### 1. Create the Firebase project
1. Open https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project** and name it, for example `vedic-pandit`. Google Analytics is optional; you can turn it off.

### 2. Turn on email login
1. In the left menu, go to **Build → Authentication → Get started**.
2. Under **Sign-in method**, choose **Email/Password**, switch on the first toggle (Email/Password) and click **Save**.
3. Open the **Settings → Authorized domains** tab and click **Add domain**. Add `ekantshukla.github.io`. `localhost` is already listed, and the Android app needs it.

### 3. Create the database
1. Go to **Build → Firestore Database → Create database**.
2. Pick a location close to your users, for example `asia-south1 (Mumbai)`. You cannot change it later.
3. Start in **production mode**.
4. Open the **Rules** tab and replace everything there with the contents of [`firestore.rules`](firestore.rules) from this repository.
5. **Before you publish**, find this line and replace the example email with your own, in lower case:
   ```
   && request.auth.token.email.lower() in ['your-admin-email@gmail.com'];
   ```
   For more than one admin, list them like this: `['me@gmail.com', 'helper@gmail.com']`.
6. Click **Publish**.

### 4. Copy the web config into GitHub
1. In Firebase, click the gear icon → **Project settings**. Under **Your apps**, click the **Web** icon `</>`.
2. Name the app `Vedic Pandit web` (you don't need Hosting) and click **Register app**.
3. Firebase shows a block like this one. Copy the whole `firebaseConfig = { … }` part:
   ```js
   const firebaseConfig = {
     apiKey: "AIza…",
     authDomain: "vedic-pandit.firebaseapp.com",
     projectId: "vedic-pandit",
     storageBucket: "vedic-pandit.appspot.com",
     messagingSenderId: "…",
     appId: "1:…:web:…"
   };
   ```
4. On GitHub, open the repository, then **Settings → Secrets and variables → Actions → Variables** tab → **New repository variable**:
   - Name `FIREBASE_CONFIG`; value: paste the block you copied. JSON works too.
   - Name `ADMIN_EMAILS`; value: your admin email, the same one you put in the rules. Separate several emails with commas.

   These are **variables**, not secrets: the web config is public by design, and the Firestore rules protect the data.

### 5. Build again
Open the **Actions** tab, run **Deploy website to GitHub Pages**, then run **Build Android app**. When they finish, the site has:
- a person icon in the header (log in / my account),
- **Book Pandit** in the menu and on the home page,
- the pages `#/pandits`, `#/pandit` (for Pandits), `#/account` and `#/admin`.

### 6. Make yourself admin
1. On the website, open **My account → Sign up** and use the admin email.
2. Open the verification email and click the link, then click **I have verified** on the account page.
3. **Admin** now appears on your account page. It is also at `#/admin`.

## How it works day to day

**Pandit joins**
1. He opens *Are you a Pandit?* and creates a Pandit account.
2. He fills in his profile: photo, phone, WhatsApp, state and city, experience, tradition, languages, the pujas he performs, dakshina and an about section.
3. He submits it. The profile now waits for review and is not public. No ID documents are collected.

**You verify**
1. Open **Admin → Waiting**. Each card shows the Pandit's details, with Call and WhatsApp buttons.
2. Speak to him and check his knowledge and photo.
3. Then tap **Approve**, or tap **Reject** with a reason. The Pandit sees the reason and can fix his profile and submit again.
4. You can **Suspend** an approved Pandit at any time.

If an approved Pandit changes his name or photo, his profile goes back to *Waiting* for you to check again.

**Devotee books**
1. The devotee opens **Book a Pandit** and filters by state, puja and language.
2. They open a profile and send a request: puja, date, time, home, temple or online, address, and notes.

**Pandit answers**
1. The new request shows a red badge on his person icon.
2. He opens the request, chats with the devotee, then taps **Accept** or **Decline**.
3. On accept, his phone number is shared with that devotee only, and both see **Call** and **WhatsApp** buttons.
4. After the puja he marks it **Completed**. Either side can cancel.

## Privacy and limits
- **Devotee phone numbers:** stored in their own account, and copied into a booking only for the Pandit they book.
- **Pandit phone numbers:** kept in a private record (`panditPrivate`) that only he and the admins can read, until he accepts a booking.
- **Photos:** reduced to 320 × 320 and saved in the database, so you don't need the paid Storage plan.
- **Free plan limits:** 50,000 reads and 20,000 writes per day, which is plenty to start with. Usage is shown under **Firestore → Usage**.
- **Notifications:** there are no push notifications yet. Pages update live while they are open, and the header badge shows new requests and confirmed bookings.
- **Pandit accounts:** to remove a Pandit completely, delete his documents under `pandits` and `panditPrivate` in the Firestore console, and his user under **Authentication → Users**.

## Troubleshooting
- **Booking pages say "coming soon".** The `FIREBASE_CONFIG` variable is missing or empty. Add it, then run the workflows again.
- **"You are not allowed to do that".** Either the rules were not published, or the admin email in the rules does not match your login, or your email is not verified yet.
- **Admin page says it is only for the team.** Check that the `ADMIN_EMAILS` variable is set to the same email and that the site was rebuilt afterwards.
- **No verification or password reset email.** Look in the spam folder. You can change the sender name under **Authentication → Templates**.
