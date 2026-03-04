import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { supabase } from '@/lib/supabase'
import { verifyPassword, generateToken } from '@/lib/auth-utils'

const handler = NextAuth({
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

        try {
          // Find user by email
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', credentials.email)
            .single();

          if (userError || !user) {
            throw new Error('メールアドレスまたはパスワードが正しくありません')
          }

          // Verify password
          const isValid = await verifyPassword(credentials.password, user.password_hash);
          if (!isValid) {
            throw new Error('メールアドレスまたはパスワードが正しくありません')
          }

          // Generate access token
          const accessToken = generateToken(user.id);

          return {
            id: user.id,
            email: user.email,
            accessToken: accessToken,
          }
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(error.message)
          }
          throw new Error('認証に失敗しました')
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
      session.user!.id = token.userId as string
      session.accessToken = token.accessToken as string
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
