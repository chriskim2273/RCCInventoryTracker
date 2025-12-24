# Ownership Transfer Guide

Guide for transferring this application to a new owner.

---

## 1. Netlify Transfer

1. Log in to [Netlify](https://app.netlify.com)
2. Go to **Site settings** > **General** > **Danger zone**
3. Click **Transfer site to another team**
4. Enter the new owner's Netlify team name or email
5. New owner accepts the transfer in their Netlify dashboard

**Note:** The new owner needs a Netlify account before transfer.

---

## 2. Supabase Transfer

1. Log in to [Supabase](https://supabase.com/dashboard)
2. Select the project
3. Go to **Project Settings** > **General**
4. Scroll to **Transfer project**
5. Enter the new owner's email (must have a Supabase account)
6. New owner accepts via email/dashboard

**Post-transfer:** New owner should regenerate API keys and update environment variables.

---

## 3. GitHub Repository (if applicable)

If the repo is hosted on GitHub:

1. Go to repo **Settings** > **General**
2. Scroll to **Danger Zone** > **Transfer ownership**
3. Enter new owner's GitHub username
4. New owner accepts via email

---

## 4. OpenRouter API Key (for AI Search)

The app uses OpenRouter for AI-powered search. The new owner needs their own API key.

1. Create account at [OpenRouter](https://openrouter.ai)
2. Go to **Keys** and create a new API key
3. Update `VITE_OPENROUTER_API_KEY` in Netlify environment variables

**Note:** The app uses free-tier models by default, so no payment required.

---

## 5. Gmail SMTP Configuration

Required for email notifications (new user signups, order status changes).

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**

### Step 2: Create App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select **Mail** and **Other (Custom name)**
3. Enter name: `Supabase SMTP`
4. Click **Generate** and copy the 16-character password

### Step 3: Configure Supabase Auth SMTP
1. In Supabase, go to **Project Settings** > **Auth** > **SMTP Settings**
2. Enable **Custom SMTP**
3. Enter:
   - **Host:** `smtp.gmail.com`
   - **Port:** `465`
   - **User:** `your-email@gmail.com`
   - **Password:** (App Password from Step 2)
   - **Sender email:** `your-email@gmail.com`
   - **Sender name:** `RCC Inventory Tracker`
4. Click **Save**

### Step 4: Set Edge Function Secrets
The edge functions also need Gmail credentials for admin notifications.

**Via Dashboard (easiest):**
1. Go to **Project Settings** > **Edge Functions**
2. Click **Manage Secrets**
3. Add these secrets:
   - `GMAIL_USERNAME` = your Gmail address
   - `GMAIL_APP_PASSWORD` = your 16-character app password
   - `SITE_URL` = your Netlify URL (e.g., `https://your-app.netlify.app`)

---

## 6. Environment Variables Summary

### Netlify Environment Variables
Update these in **Site settings** > **Environment variables**:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `VITE_OPENROUTER_API_KEY` | OpenRouter API key |

### Supabase Edge Function Secrets
Set via CLI or dashboard (**Project Settings** > **Edge Functions** > **Secrets**):

| Secret | Description |
|--------|-------------|
| `GMAIL_USERNAME` | Gmail address for sending |
| `GMAIL_APP_PASSWORD` | Gmail App Password (16-char) |
| `SITE_URL` | Your app's URL |

---

## 7. Post-Transfer Checklist

- [ ] Netlify transfer accepted
- [ ] Supabase transfer accepted
- [ ] GitHub repo transferred (if applicable)
- [ ] New Supabase API keys generated
- [ ] OpenRouter API key created
- [ ] Netlify environment variables updated
- [ ] Gmail SMTP configured in Supabase Auth
- [ ] Edge function secrets set
- [ ] Redeploy Netlify site
- [ ] Test: Application loads correctly
- [ ] Test: User signup works
- [ ] Test: Email notifications working
- [ ] Test: AI search working
