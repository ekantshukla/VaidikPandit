/**
 * Where the website and the Android app live.
 * The GitHub workflows fill these in from the repository they run in
 * (see .github/workflows/android.yml), so you normally never edit this file.
 */
export const GITHUB_REPO = 'ekantshukla/VedicPandit';
export const APP_VERSION = '1.0.0';

/**
 * Address of the hosted .NET API (PanditJi's full answers), e.g. 'https://vedic-pandit-api.onrender.com'.
 * Empty = the API is on the same address as the site (Angular served by the .NET app), or there is none
 * and the site runs in demo mode. The GitHub workflows fill this in from the repository variable API_URL.
 */
export const API_URL: string = '';

/**
 * Free AI for PanditJi without any server (see FREE_AI.md). Any OpenAI-compatible API with tool calling works:
 * Google Gemini (default, free key at aistudio.google.com/apikey), Groq or OpenRouter.
 * The GitHub workflows fill these in from the repository secret FREE_AI_KEY and the variables AI_BASE_URL / AI_MODEL.
 * Empty key = PanditJi uses the .NET server if there is one, otherwise his built-in answers.
 */
export const AI_KEY: string = '';
export const AI_BASE_URL: string = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const AI_MODEL: string = 'gemini-3.1-flash-lite';

/**
 * Accounts, Pandit booking and verification (see PANDIT_BOOKING.md). The web config of your Firebase project as JSON,
 * filled in by the workflows from the repository variable FIREBASE_CONFIG. It is public by design: the Firestore
 * security rules protect the data. Empty = the booking pages say booking is not set up yet.
 */
export const FIREBASE_CONFIG: string = '';
/** Emails (comma separated) that see the Admin page. The same emails must be in firestore.rules. Variable ADMIN_EMAILS. */
export const ADMIN_EMAILS: string = '';

const [owner, repo] = GITHUB_REPO.split('/');
/** The live website (GitHub Pages). */
export const WEBSITE_URL = `https://${owner.toLowerCase()}.github.io/${repo}/`;
/** Always the newest Android app. */
export const APK_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/VaidikPandit.apk`;

/** Dakshina (donations) via UPI. */
export const UPI_ID = 'shuklaekant@okhdfcbank';
export const UPI_NAME = 'Ekant Shukla';
