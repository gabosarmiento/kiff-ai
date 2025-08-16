import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Call your existing backend API
          const backendUrl = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://nkbdpyszym.eu-west-3.awsapprunner.com'
          const response = await fetch(`${backendUrl}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': process.env.DEFAULT_TENANT_ID || '4485db48-71b7-47b0-8128-c6dca5be352d'
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
              tenant_id: process.env.DEFAULT_TENANT_ID || '4485db48-71b7-47b0-8128-c6dca5be352d'
            }),
            // Add timeout to prevent hanging
            signal: AbortSignal.timeout(10000)
          })

          if (!response.ok) {
            console.error(`Backend auth failed: ${response.status}`)
            return null
          }

          const data = await response.json()
          
          return {
            id: data.user?.id || data.id || `user_${Date.now()}`,
            email: data.user?.email || data.email || credentials.email,
            name: data.user?.full_name || data.full_name || credentials.email.split('@')[0],
            role: data.user?.role || data.role || 'user',
            tenant_id: data.user?.tenant_id || data.tenant_id || process.env.DEFAULT_TENANT_ID || '4485db48-71b7-47b0-8128-c6dca5be352d',
            access_token: data.access_token
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Persist additional user data to token
      if (user) {
        token.role = user.role
        token.tenant_id = user.tenant_id
        if (user.access_token) {
          token.accessToken = user.access_token
        }
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user) {
        session.user.role = token.role as string
        session.user.tenant_id = token.tenant_id as string
        session.accessToken = token.accessToken as string
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // For social logins, you might want to create/update user in your backend
      if (account?.provider === 'google' || account?.provider === 'github') {
        try {
          // Optional: sync with your backend
          const backendUrl = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://nkbdpyszym.eu-west-3.awsapprunner.com'
          const response = await fetch(`${backendUrl}/api/auth/social-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': process.env.DEFAULT_TENANT_ID || '4485db48-71b7-47b0-8128-c6dca5be352d'
            },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              provider: account.provider,
              provider_id: account.providerAccountId,
              tenant_id: process.env.DEFAULT_TENANT_ID || '4485db48-71b7-47b0-8128-c6dca5be352d'
            }),
            signal: AbortSignal.timeout(5000)
          })
          
          if (response.ok) {
            const data = await response.json()
            user.role = data.role || 'user'
            user.tenant_id = data.tenant_id || process.env.DEFAULT_TENANT_ID || '4485db48-71b7-47b0-8128-c6dca5be352d'
          } else {
            // Set defaults if backend sync fails
            user.role = 'user'
            user.tenant_id = process.env.DEFAULT_TENANT_ID || '4485db48-71b7-47b0-8128-c6dca5be352d'
          }
        } catch (error) {
          console.error('Social sync error:', error)
          // Set defaults if sync fails
          user.role = 'user'
          user.tenant_id = process.env.DEFAULT_TENANT_ID || '4485db48-71b7-47b0-8128-c6dca5be352d'
        }
      }
      return true
    }
  },
  pages: {
    signIn: '/login'
  },
  session: {
    strategy: 'jwt'
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }