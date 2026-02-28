# 🚀 Deployment Guide - Inventory POS App

This guide will help you deploy your application to **FREE hosting** platforms.

---

## Option 1: Firebase Hosting (Recommended)

Since you're already using Firebase Auth & Firestore, this is the most seamless option.

### Prerequisites
- A Google account
- Your Firebase project already created (from development)

### Step 1: Install Firebase CLI

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Or if you're using bun
bun install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

This will open a browser window. Sign in with your Google account.

### Step 3: Initialize Firebase Hosting (if not done)

```bash
cd inventory-pos-app
firebase init hosting
```

When prompted:
- Select your existing Firebase project (or create a new one)
- Public directory: `dist`
- Single-page app: `Yes`
- Overwrite index.html: `No`

### Step 4: Build Your App

```bash
npm run build
# or
bun run build
```

### Step 5: Deploy

```bash
firebase deploy --only hosting
```

### Step 6: Get Your URL

After deployment, you'll see something like:
```
Hosting URL: https://your-project-id.web.app
```

**That's it! Your app is live! 🎉**

---

## Option 2: Vercel (Easiest)

Vercel is extremely easy and offers generous free tier.

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Deploy

```bash
cd inventory-pos-app
vercel
```

Follow the prompts:
- Link to existing project: `No`
- Project name: `inventory-pos-app` (or your choice)
- Framework: `Vite` (should auto-detect)

### Step 3: Production Deploy

```bash
vercel --prod
```

Your app will be live at: `https://your-project-name.vercel.app`

---

## Option 3: Netlify

### Method A: Drag & Drop (No CLI needed!)

1. Build your app:
   ```bash
   npm run build
   ```

2. Go to [Netlify Drop](https://app.netlify.com/drop)

3. Drag the `dist` folder onto the page

4. Done! Your site is live!

### Method B: CLI Deployment

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

---

## Option 4: GitHub Pages (Free)

### Step 1: Update vite.config.js

```javascript
export default defineConfig({
  plugins: [vue()],
  base: '/your-repo-name/', // Add this line
  // ... rest of config
})
```

### Step 2: Build and Deploy

```bash
npm run build

# Initialize git if not done
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repo on GitHub
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: `gh-pages` folder: `/ (root)`

---

## 🔧 Environment Variables

Create a `.env` file for your Firebase config (already in your firebase.js):

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 📋 Pre-Deployment Checklist

- [ ] Update Firebase security rules for production
- [ ] Test all features locally with `npm run preview`
- [ ] Check for console errors
- [ ] Verify Firebase Auth authorized domains include your hosting URL
- [ ] Test on mobile devices

---

## 🔒 Firebase Security Rules (Production)

Update your `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Products - authenticated users can read, admins/managers can write
    match /products/{productId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // Categories - same as products
    match /categories/{categoryId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'manager'];
    }
    
    // Transactions - all authenticated users can read, create; only admins can modify
    match /transactions/{transactionId} {
      allow read, create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Activity Logs
    match /activityLogs/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false; // Never allow modification
    }
    
    // Settings - only admins can modify
    match /settings/{settingId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

---

## 🌐 Custom Domain (Optional)

### Firebase Hosting
1. Go to Firebase Console → Hosting
2. Click "Add custom domain"
3. Follow DNS verification steps

### Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records

### Netlify
1. Go to Domain Settings
2. Add custom domain
3. Configure DNS

---

## 💡 Tips

1. **Free Tier Limits:**
   - Firebase Hosting: 10GB/month storage, 360MB/day transfer
   - Vercel: 100GB bandwidth/month
   - Netlify: 100GB bandwidth/month

2. **Performance:**
   - Enable gzip compression (automatic on all platforms)
   - Optimize images before upload
   - Use lazy loading for components

3. **Monitoring:**
   - Firebase: Use Firebase Console Analytics
   - Vercel: Use Vercel Analytics (free tier available)
   - Netlify: Use Netlify Analytics

---

## 🆘 Troubleshooting

### "Page not found" on refresh
- Ensure your hosting config has rewrites to index.html (already in firebase.json)

### Firebase Auth not working
- Add your hosting URL to Firebase Console → Authentication → Authorized domains

### Build errors
- Run `npm install` or `bun install` to ensure all dependencies are installed
- Check Node.js version (18+ recommended)

### CORS errors
- Not an issue with this app since we're using Base64 for images

---

## 📞 Need Help?

- Firebase Documentation: https://firebase.google.com/docs/hosting
- Vercel Documentation: https://vercel.com/docs
- Netlify Documentation: https://docs.netlify.com

---

**Happy Deploying! 🎉**
