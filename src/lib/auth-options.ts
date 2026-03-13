import CredentialsProvider from 'next-auth/providers/credentials'
import { verifyPassword, generateToken } from '@/lib/auth-utils'
import { supabase } from '@/lib/supabase'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('メールアドレスとパスワードを入力してください')
        }

        const { data: user, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('email', credentials.email)
          .single()

        if (userError || !user) {
          throw new Error('メールアドレスまたはパスワードが正しくありません')
        }

        const isValid = await verifyPassword(credentials.password, user.password_hash)
        if (!isValid) {
          throw new Error('メールアドレスまたはパスワードが正しくありません')
        }

        const token = generateToken(user.id)

        return {
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          accessToken: token,
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken
        token.userId = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string
      }
      (session as any).accessToken = token.accessToken as string
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
