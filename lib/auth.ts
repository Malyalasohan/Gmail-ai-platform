// NextAuth configuration with Google OAuth for Gmail API access
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { createServiceClient } from './supabase/server'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request Gmail API scopes
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
          ].join(' '),
          // Request offline access to get refresh token
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log('=== SignIn Callback Started ===')
      console.log('User:', user.email)
      console.log('Account provider:', account?.provider)
      console.log('Has refresh token:', !!account?.refresh_token)

      if (!account || !user.email) {
        console.error('Missing account or email')
        return false
      }

      try {
        console.log('Creating Supabase client...')
        const supabase = createServiceClient()

        console.log('Attempting to upsert user to database...')
        // Upsert user to database, storing refresh token
        const { error, data } = await supabase
          .from('users')
          .upsert({
            email: user.email,
            google_refresh_token: account.refresh_token,
          }, {
            onConflict: 'email',
          })
          .select()

        if (error) {
          console.error('❌ Database error:', error)
          console.error('Error details:', JSON.stringify(error, null, 2))
          return false
        }

        console.log('✅ User stored successfully:', data)
        return true
      } catch (error) {
        console.error('❌ Sign-in catch error:', error)
        return false
      }
    },
    async session({ session, token }) {
      // Add user ID to session for easy access in components/API routes
      if (session.user) {
        const supabase = createServiceClient()
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('email', session.user.email)
          .single()

        if (data) {
          session.user.id = data.id
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
    }
    accessToken?: string
  }
}
