# Shopping Cart

A simple, real-time shopping list app for families. Built with vanilla JavaScript and Firebase.

## Features

- **Real-time sync** — Changes appear instantly across all devices
- **Google sign-in** — Secure, family-only access via email whitelist
- **Multiple lists** — Create lists for different stores or purposes
- **Tap to complete** — Strike through items you've got
- **Swipe to delete** — Swipe left to remove items or lists
- **Remembers last list** — Opens where you left off
- **Mobile-first design** — Optimized for phones with touch gestures

## Setup

### 1. Firebase Project

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Realtime Database**
3. Enable **Authentication** → **Google** sign-in method
4. Register a **Web App** to get your config

### 2. Configuration

In `index.js`, replace the placeholder with your Firebase config:

```js
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
}
```

### 3. Database Rules

In Firebase Console → Realtime Database → Rules, add your authorized emails:

```json
{
  "rules": {
    "shoppingList": {
      ".read": "auth != null && (auth.token.email === 'you@gmail.com' || auth.token.email === 'family@gmail.com')",
      ".write": "auth != null && (auth.token.email === 'you@gmail.com' || auth.token.email === 'family@gmail.com')"
    },
    "lists": {
      ".read": "auth != null && (auth.token.email === 'you@gmail.com' || auth.token.email === 'family@gmail.com')",
      ".write": "auth != null && (auth.token.email === 'you@gmail.com' || auth.token.email === 'family@gmail.com')"
    }
  }
}
```

### 4. Authorized Domains

In Firebase Console → Authentication → Settings → Authorized domains, add:
- `localhost` (for local dev)
- Your deployment domain (e.g., `your-app.netlify.app`)

## Development

```bash
npm install
npm run dev
```

## Deployment

### Netlify

1. Connect your GitHub repo to Netlify
2. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Add environment variable if needed:
   - `NODE_VERSION` = `20`

## Usage

| Action | Gesture |
|--------|---------|
| Add item | Type + Enter or tap "Add to cart" |
| Mark complete | Tap item |
| Unmark complete | Tap again |
| Delete item | Swipe left |
| Switch lists | Tap "Lists" button |
| Select list | Tap list name |
| Delete list | Swipe left on list |
| Clear Main List | Swipe left (cannot be deleted) |
| Go back | Tap "Back" or swipe right on Lists screen |

## Data Structure

```
/shoppingList              ← Main List items
  /{itemId}
    - text: "Milk"
    - completed: false

/lists                     ← Custom lists
  /{listId}
    /meta
      - name: "Costco"
      - createdAt: 1234567890
    /items
      /{itemId}
        - text: "Paper towels"
        - completed: false
```

## Tech Stack

- Vanilla JavaScript (ES6 modules)
- Firebase Realtime Database
- Firebase Authentication
- Vite (build tool)
- CSS3 (transitions, flexbox)

## License

MIT




## Acknowledgments
Heavily modified from a Scrimba project. Great team and platform. (I'm not affiliated.)


## About Scrimba

At Scrimba our goal is to create the best possible coding school at the cost of a gym membership! 💜
If we succeed with this, it will give anyone who wants to become a software developer a realistic shot at succeeding, regardless of where they live and the size of their wallets 🎉
The Frontend Developer Career Path aims to teach you everything you need to become a Junior Developer, or you could take a deep-dive with one of our advanced courses 🚀

- [Our courses](https://scrimba.com/allcourses)
- [The Frontend Career Path](https://scrimba.com/learn/frontend)
- [Become a Scrimba Pro member](https://scrimba.com/pricing)

Happy Coding!
