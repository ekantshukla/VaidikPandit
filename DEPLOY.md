# Putting Vaidik Pandit online

> **Just want PanditJi to answer everything for free, without a server?** See [FREE_AI.md](FREE_AI.md): one free
> Google Gemini key saved as a GitHub secret, then re-run the two workflows.

There are three pieces. You can do steps 1–3 in about 15 minutes.

| Piece | Where | What it needs |
|---|---|---|
| **API** (.NET: panchang, muhurat, PanditJi) | Render (free) or any Docker host | Your Claude API key |
| **Website** | GitHub Pages (or the same Render service) | The API's address |
| **Android app** | GitHub Releases (see [ANDROID.md](ANDROID.md)) | The API's address |

Without the API, the website and app still work: panchang, muhurat, mantra and granth run on the device, and
PanditJi gives built-in answers. With the API, PanditJi answers any question in all 8 languages.

## 1. Get a Claude API key

1. Sign in at **console.anthropic.com** and add billing (it is pay-per-use).
2. **API Keys → Create key**. Copy the `sk-ant-…` value.
3. Under **Limits**, set a monthly spend limit you are comfortable with. The API also limits each visitor to
   20 questions a minute.

## 2. Deploy the API to Render

1. Push this repo to GitHub (see ANDROID.md step 1).
2. At **render.com**: **New → Blueprint**, pick the `VedicPandit` repo. Render reads `render.yaml`.
3. When asked, paste your key into **Claude__ApiKey**. Click **Apply**.
4. The first build takes about 10 minutes (it also runs the tests). When it's live, open
   `https://<your-service>.onrender.com/api/health`. You should see `"ai": true`.

That address is now also a complete website (the Dockerfile puts the Angular site inside the API), so PanditJi
works there straight away.

**Free plan:** the service sleeps after 15 minutes without visitors; the next visitor waits about a minute while it
wakes (the chat shows "Waking up PanditJi…"). Render's Starter plan stays awake.

**Other hosts:** anything that runs a Docker image works the same way (Azure App Service, Railway, Fly.io, a VPS):
`docker build -t vedic-pandit .` then run it with `-e Claude__ApiKey=sk-ant-…` and port 8080 (or set `PORT`).
Mount a volume at `/data` to keep imported texts and the chat log across restarts.

## 3. Point the GitHub Pages site and the Android app at the API

1. In the GitHub repo: **Settings → Secrets and variables → Actions → Variables → New repository variable**.
   Name `API_URL`, value `https://<your-service>.onrender.com` (no trailing slash).
2. **Actions → Deploy website to GitHub Pages → Run workflow**, and **Actions → Build Android app → Run workflow**.
3. Open `https://<your-username>.github.io/VedicPandit/` and tap the floating PanditJi. Under his name it now says
   **Online** (green dot) instead of "Built-in answers", and answers stream in.
4. Install the new APK from the release (same link as before). The app has the API address built in, so it is online too.

If your site lives somewhere other than `https://<your-username>.github.io`, add that address to `CORS_ORIGINS`
in Render (comma-separated). The Android app is already allowed.

## Settings reference

| Setting (environment variable) | Default | Meaning |
|---|---|---|
| `FreeAI__ApiKey` | empty | Free key: Google Gemini (default), Groq or OpenRouter. When set, PanditJi uses it instead of Claude. |
| `FreeAI__BaseUrl` | `https://generativelanguage.googleapis.com/v1beta/openai` | The provider's OpenAI-compatible address. |
| `FreeAI__Model` | `gemini-3.1-flash-lite` | Model name at that provider. |
| `Claude__ApiKey` | empty | Claude API key. Empty (and no FreeAI key) = built-in answers only. |
| `Claude__Model` | `claude-sonnet-5-5` | Claude model. |
| `Claude__MaxTokens` | `1500` | Longest answer. |
| `CORS_ORIGINS` | the GitHub Pages site | Extra sites allowed to call the API (comma-separated). |
| `Admin__ApiKey` | empty | Required header `X-Admin-Key` for `POST /api/scriptures/import`. Empty = import disabled. |
| `Content__DataFolder` | `data` (`/data` in Docker) | Where imported texts and `chat-log.jsonl` are written. |
| `PORT` | 8080 in Docker | Port to listen on (set automatically by Render). |

## Checking it works

```bash
curl https://<your-service>.onrender.com/api/health
curl -X POST https://<your-service>.onrender.com/api/chat -H 'content-type: application/json' \
     -d '{"text":"What does the Gita say about anger?","language":"en"}'
```

The second call returns PanditJi's answer, the tools it used and the verse cards.
