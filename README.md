# Hyrox Trainer — Standalone Deployment Guide

## Deploy to Vercel (free, 5 minutes)

### One-time setup
1. Go to vercel.com → sign up free (use GitHub or email)
2. Install Vercel CLI on your computer:
   ```
   npm install -g vercel
   ```

### Deploy this project
1. Unzip the hyrox-trainer folder you downloaded
2. Open Terminal (Mac) or Command Prompt (Windows), navigate to the folder:
   ```
   cd path/to/hyrox-trainer
   npm install
   vercel
   ```
3. Follow the prompts — accept defaults. Vercel gives you a URL like:
   `https://hyrox-trainer-abc123.vercel.app`

### Give athletes their link
Send each athlete their URL. On iPhone:
1. Open the URL in **Safari** (not Chrome)
2. Tap the Share button (square with ↑ arrow)
3. Tap **Add to Home Screen**
4. Tap Add — icon appears on their home screen

On Android:
1. Open in Chrome
2. Tap ⋮ menu → Add to Home screen

### Customize for each athlete
Each athlete needs their own deployment with a custom PLAN block.
1. Duplicate this folder for each athlete
2. Open `src/HyroxTrainer.jsx`
3. Edit the `PLAN` object at the top (names, race, weeks, workouts)
4. Change `PLAN_ID` to something unique (e.g. "andrew-dallas-2026")
5. Run `vercel` again — new URL, isolated logs

### Logs are saved on each athlete's device
localStorage means data stays on their phone — no account needed, no login.
If you want logs shared across devices (e.g. coach can see all athletes),
replace the localStorage shim with Supabase (free tier). Ask Claude to do this.

## Local development
```
npm install
npm run dev
```
Opens at http://localhost:5173
