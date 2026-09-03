# Personal Gemini Journal

Personal Gemini Journal is a production-oriented journaling and brainstorming app. Users sign in with Firebase Authentication, continue private multi-turn Gemini conversations, and save their own Insight Cards in Firestore. The Cloud Run server verifies Firebase ID tokens before every private operation.

## What is included

- Firebase email/password authentication in the browser.
- Firebase Admin SDK verification in the API server.
- Firestore isolation under `users/{uid}/journals` and `users/{uid}/insights`.
- Multi-turn Gemini conversations with server-only access to `GEMINI_API_KEY`.
- Private Insight Cards: turn useful thoughts into tagged, open/done action cards.
- Cloud Run Dockerfile and Secret Manager deployment instructions.
- Paste-ready AI Studio security constitution in `docs/AI_STUDIO_CUSTOM_INSTRUCTIONS.md`.
- GitHub and Cloud Run walkthrough in `DEPLOYMENT_GUIDE.md`.

## Local setup

1. Create a Firebase project and enable Email/Password sign-in and Firestore.
2. Publish `firestore.rules`.
3. In the web app environment, set the public Firebase configuration:

   ```text
   VITE_FIREBASE_API_KEY
   VITE_FIREBASE_AUTH_DOMAIN
   VITE_FIREBASE_PROJECT_ID
   VITE_FIREBASE_STORAGE_BUCKET
   VITE_FIREBASE_MESSAGING_SENDER_ID
   VITE_FIREBASE_APP_ID
   ```

4. For local server development, use Application Default Credentials or set `FIREBASE_SERVICE_ACCOUNT_JSON` through a secure local secret mechanism. Never commit it.
5. Set `GEMINI_API_KEY` only in the server environment. The browser must never receive it.
6. Start the API and web workflows from the project controls.

## Cloud Run deployment

The container serves both the built web app and `/api` from one Cloud Run service.
For a copy/paste walkthrough, use `DEPLOYMENT_GUIDE.md`. Firebase web values are
passed as Docker build arguments because they are public browser configuration;
the Gemini key is never passed to the build and is injected at runtime from
Secret Manager.

```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/journal/personal-gemini-journal
gcloud run deploy personal-gemini-journal \
  --image REGION-docker.pkg.dev/PROJECT_ID/journal/personal-gemini-journal \
  --region REGION \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=PROJECT_ID,WEB_ORIGIN=https://YOUR_CLOUD_RUN_HOSTNAME \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

Before deployment, create the secret and grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor`:

```bash
printf '%s' 'YOUR_GEMINI_API_KEY' | gcloud secrets create gemini-api-key --data-file=-
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Use the Google Cloud project service account's Application Default Credentials for Firebase Admin SDK. Do not put a service-account JSON file in the image.

## Security submission checklist

- [ ] AI Studio custom instructions pasted and enabled from `docs/AI_STUDIO_CUSTOM_INSTRUCTIONS.md`.
- [ ] Firebase Auth provider enabled and sign-in works.
- [ ] Firestore rules deployed from `firestore.rules`.
- [ ] Cloud Run uses `GEMINI_API_KEY` from Secret Manager.
- [ ] No Gemini credential appears in browser bundles, source control, or logs.
- [ ] A request without a Firebase bearer token returns 401.
- [ ] A user cannot read, edit, delete, or message another user's journal ID.
- [ ] Oversized titles, messages, tags, and insight bodies are rejected.
- [ ] Gemini is called only by the server and receives only the signed-in user's conversation.
- [ ] Cloud Run service is deployed from the included Dockerfile.

## Verification commands

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/personal-gemini-journal run build
```

The app intentionally shows a clear setup state when public Firebase configuration is absent; it never fabricates authentication or silently uses a shared demo account.