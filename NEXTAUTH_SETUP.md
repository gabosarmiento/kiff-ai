# NextAuth.js Setup Guide

## 🎉 NextAuth Migration Complete!

Your Kiff AI frontend now uses NextAuth.js for authentication with social login support.

## Required Environment Variables

Copy `.env.local.example` to `.env.local` and fill in these values:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-use-openssl-rand-base64-32

# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth (Get from GitHub Developer Settings)
GITHUB_CLIENT_ID=your-github-client-id  
GITHUB_CLIENT_SECRET=your-github-client-secret

# Backend Configuration
BACKEND_ORIGIN=http://localhost:8000
DEFAULT_TENANT_ID=4485db48-71b7-47b0-8128-c6dca5be352d
```

## How to Get OAuth Credentials

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set authorized redirect URLs to: `http://localhost:3000/api/auth/callback/google`

### GitHub OAuth Setup  
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Set Authorization callback URL to: `http://localhost:3000/api/auth/callback/github`

## Features Added

✅ **Google Social Login**
✅ **GitHub Social Login**  
✅ **Email/Password Login** (uses your existing backend)
✅ **Session Management**
✅ **Role-based Authentication**
✅ **Multi-tenant Support**

## What Changed

### New Files Created:
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth configuration
- `src/contexts/NextAuthProvider.tsx` - Session provider wrapper
- `src/contexts/NextAuthContext.tsx` - Simplified auth context using NextAuth
- `src/components/auth/NextAuthLoginPage.tsx` - New login page with social buttons
- `types/next-auth.d.ts` - TypeScript declarations

### Files Updated:
- `src/app/layout.tsx` - Added NextAuthProvider
- `src/app/login/page.tsx` - Uses new NextAuthLoginPage

## Usage

### In Components:
```tsx
import { useSession, signIn, signOut } from 'next-auth/react'

function MyComponent() {
  const { data: session, status } = useSession()
  
  if (status === "loading") return <p>Loading...</p>
  
  if (session) {
    return (
      <div>
        <p>Signed in as {session.user?.email}</p>
        <button onClick={() => signOut()}>Sign out</button>
      </div>
    )
  }
  
  return (
    <div>
      <p>Not signed in</p>
      <button onClick={() => signIn('google')}>Sign in with Google</button>
      <button onClick={() => signIn('github')}>Sign in with GitHub</button>
    </div>
  )
}
```

## Testing

1. Set up your environment variables
2. Run `npm run dev`
3. Go to `/login`
4. Try both social login and email/password

## Migration Notes

- Your existing backend API is still used for credentials login
- Social logins can optionally sync with your backend via `/api/auth/social-sync`
- All your existing user roles and tenant logic is preserved
- Session data includes: `user.email`, `user.role`, `user.tenant_id`

## Next Steps

1. Set up OAuth applications with Google & GitHub
2. Configure environment variables  
3. Test the new login flow
4. Optionally implement the social sync endpoint in your backend
5. Update other components to use NextAuth hooks as needed

---

Need help? The new auth system is much simpler and more secure than the custom implementation!