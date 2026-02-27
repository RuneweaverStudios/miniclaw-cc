# Supabase Google OAuth Setup Guide

## 🚀 Quick Setup (5 minutes)

### 1. Create Supabase Project (Free)

1. Go to **https://supabase.com**
2. Click **"Start your project"**
3. Sign in with Google (recommended)
4. Create a new organization: "MiniClaw-CC"
5. Create a new project: "miniclaw-cc"
6. Choose your region (pick closest to you)

### 2. Get Your API Credentials

1. In Supabase dashboard, go to **Project Settings** > **API**
2. Copy **Project URL** → `VITE_SUPABASE_URL`
3. Copy **anon public** key → `VITE_SUPABASE_ANON_KEY`
4. Update `apps/web/.env.local` with these values

### 3. Enable Google OAuth

1. In Supabase dashboard, go to **Authentication** > **Providers**
2. Click **Google**
3. Enable Google provider
4. You'll need to create a Google OAuth app:
   - Go to the link shown
   - Create an OAuth 2.0 Client ID
   - Add authorized redirect URI: `http://localhost:3000/auth/callback`
5. Copy your **Client ID** and **Client Secret** back to Supabase
6. Click **Save**

### 4. Test It!

Refresh your browser at **http://localhost:3000/signup**

You should see a clean page with just a **"Continue with Google"** button.

Click it, authorize with your Google account, and you're signed in! 🎉

---

## 📝 .env.local Template

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## How It Works

**Before (Complex):**
- Enter name, email, password
- Choose stack
- Verify email
- Set up server

**Now (Simple):**
- Click "Continue with Google" ✅
- Done!

---

## Features

- ✅ One-click Google OAuth signup
- ✅ Automatic user creation
- ✅ Secure session management
- ✅ Profile data synced automatically
- ✅ Works on mobile devices
- ✅ No password to remember

---

## Need Help?

- [Supabase Docs](https://supabase.com/docs)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
