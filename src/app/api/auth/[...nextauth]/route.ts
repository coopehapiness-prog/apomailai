import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { apiClient } from '@/lib/api-client'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        isRegister: { label: 'Is Register', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('メールアドレスとパスワードを入力してください')
        }

        try {
          const endpoint = credentials.isRegister === 'true'
            ? '/auth/register'
            : '/auth/login'

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            }
          )

          if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(
              error.message || 'ログインに失敗しました'
            )
          }

          const data = await response.json()

          return {
            id: data.userId || data.id,
            email: credentials.email,
            accessToken: data.accessToken || data.token,
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
      if (session.user) {
        apiClient.setAccessToken(token.accessToken as string)
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
