# GitHub and Cloud Run deployment guide

This guide assumes the repository is the source folder containing `package.json`, `Dockerfile`, `firebase.json`, and `firestore.rules`.

## 1. Download and prepare the files

Download `personal-gemini-journal-github.zip`, extract it, and open a terminal in the extracted folder.

Install the required tools:

- Git
- Node.js 24+
- pnpm
- Google Cloud CLI
- Docker Desktop or another Docker runtime

Verify:

```bash
node --version
pnpm --version
gcloud --version
docker --version
```

## 2. Push the source to GitHub

Create an empty GitHub repository first. Do not add a README, license, or `.gitignore` during GitHub creation because this folder already contains them.

```bash
git init
git branch -M main
git add .
git commit -m "Build Personal Gemini Journal"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Never commit `.env`, a Firebase service-account JSON file, or a Gemini API key. The included `.gitignore` protects local environment files.

## 3. Create and configure Firebase

In the Firebase Console:

1. Create or select a Firebase project.
2. Enable Authentication → Sign-in method → Email/Password.
3. Create a Firestore database.
4. Add a Web App and copy its public configuration values.
5. From this repository, deploy the rules:

```bash
firebase login
firebase deploy --project YOUR_FIREBASE_PROJECT_ID --only firestore:rules
```

Use the same project ID for Firebase and Google Cloud whenever possible.

## 4. Create the Gemini API key securely

In Google AI Studio, create a Gemini API key for the same Google Cloud project. First paste and enable the security constitution from `docs/AI_STUDIO_CUSTOM_INSTRUCTIONS.md`.

Enable the required Google Cloud APIs:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud config set project YOUR_GCP_PROJECT_ID
```

Create the Secret Manager secret. Run this locally; the key is not written into the repository:

```bash
printf '%s' 'YOUR_GEMINI_API_KEY' | \
  gcloud secrets create gemini-api-key --data-file=-
```

If the secret already exists, add a new version instead:

```bash
printf '%s' 'YOUR_GEMINI_API_KEY' | \
  gcloud secrets versions add gemini-api-key --data-file=-
```

Grant the Cloud Run runtime service account access:

```bash
PROJECT_NUMBER="$(gcloud projects describe YOUR_GCP_PROJECT_ID --format='value(projectNumber)')"
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 5. Build and push the Cloud Run image

Authenticate Docker with Artifact Registry:

```bash
gcloud auth configure-docker REGION-docker.pkg.dev
```

Create the repository once:

```bash
gcloud artifacts repositories create journal \
  --repository-format=docker \
  --location=REGION
```

Build using the public Firebase values. These six values are intentionally build arguments because Vite bundles them into the browser. Do not pass `GEMINI_API_KEY` here.

```bash
docker build \
  --build-arg VITE_FIREBASE_API_KEY='YOUR_FIREBASE_API_KEY' \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN='YOUR_FIREBASE_AUTH_DOMAIN' \
  --build-arg VITE_FIREBASE_PROJECT_ID='YOUR_FIREBASE_PROJECT_ID' \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET='YOUR_FIREBASE_STORAGE_BUCKET' \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID='YOUR_FIREBASE_MESSAGING_SENDER_ID' \
  --build-arg VITE_FIREBASE_APP_ID='YOUR_FIREBASE_APP_ID' \
  -t REGION-docker.pkg.dev/YOUR_GCP_PROJECT_ID/journal/personal-gemini-journal:latest .

docker push REGION-docker.pkg.dev/YOUR_GCP_PROJECT_ID/journal/personal-gemini-journal:latest
```

## 6. Deploy to Cloud Run

Deploy the public web container. The application itself still protects all journal APIs with Firebase ID tokens.

```bash
gcloud run deploy personal-gemini-journal \
  --image REGION-docker.pkg.dev/YOUR_GCP_PROJECT_ID/journal/personal-gemini-journal:latest \
  --region REGION \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID \
  --set-env-vars WEB_ORIGIN=https://YOUR_CLOUD_RUN_URL \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

Cloud Run prints the service URL after deployment. Run the deploy command once with a temporary `WEB_ORIGIN` if necessary, copy the final URL, and deploy again with the exact URL.

## 7. Verify the release

Open the Cloud Run URL and confirm:

1. The login screen loads.
2. A Firebase user can sign in.
3. A new journal can be created.
4. A message receives a Gemini response.
5. The response can be saved as an Insight Card.
6. A request without a token returns `401`:

```bash
curl -i https://YOUR_CLOUD_RUN_URL/api/journals
```

7. The browser bundle does not contain a Gemini key. Search only for the public Firebase values:

```bash
curl -s https://YOUR_CLOUD_RUN_URL/ | head
```

## 8. Update the app later

After making changes:

```bash
git add .
git commit -m "Describe the change"
git push
docker build ... -t REGION-docker.pkg.dev/YOUR_GCP_PROJECT_ID/journal/personal-gemini-journal:latest .
docker push REGION-docker.pkg.dev/YOUR_GCP_PROJECT_ID/journal/personal-gemini-journal:latest
gcloud run deploy personal-gemini-journal --image REGION-docker.pkg.dev/YOUR_GCP_PROJECT_ID/journal/personal-gemini-journal:latest --region REGION
```

Use the full build command from step 5 whenever the public Firebase configuration changes.