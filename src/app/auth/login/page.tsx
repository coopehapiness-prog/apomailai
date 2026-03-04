'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        // Login with credentials
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          toast.error(result.error);
        } else if (result?.ok) {
          toast.success('ログインしました');
          router.push('/dashboard');
        }
      } else {
        // Register new account
        const registerRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!registerRes.ok) {
          const error = await registerRes.json();
          toast.error(error.message || '登録に失敗しました');
          return;
        }

        // Auto sign in after registration
        const signInResult = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (signInResult?.error) {
          toast.error(signInResult.error);
        } else if (signInResult?.ok) {
          toast.success('登録してログインしました');
          router.push('/dashboard');
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '予期しないエラーが発生しました'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            ApoMail AI
          </h1>
          <p className="text-gray-400 text-center mb-8">
            {isLogin ? 'ログイン' : '新規登録'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                placeholder="example@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition"
            >
              {isLoading
                ? '処理中...'
                : isLogin
                ? 'ログイン'
                : '新規登録'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              {isLogin ? 'アカウントをお持ちでない方？' : 'すでにアカウントをお持ちの方？'}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setEmail('');
                setPassword('');
              }}
              className="text-blue-500 hover:text-blue-400 font-medium text-sm mt-2 transition"
            >
              {isLogin ? '新規登録' : 'ログイン'}
            </button>
          </div>
        </div>

        <p className="text-gray-500 text-xs text-center mt-4">
          このサイトはセキュアです
        </p>
      </div>
    </div>
  );
}
