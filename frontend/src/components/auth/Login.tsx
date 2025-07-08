import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Button, LoadingSpinner } from '../common';
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState(localStorage.getItem('temp_username') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const { login, error, clearError } = useAuthStore();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      await login({ username: username.trim(), password });
      localStorage.removeItem('temp_username');
      onLogin?.();
    } catch (error) {
      // Error is handled by the store
      // Clear only password on error, keep username
      setPassword('');
      // Focus password field for easy retry
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save username to localStorage on change
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    localStorage.setItem('temp_username', value);
  };

  // Clear temp username on successful login
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mvv_auth_token')) {
        localStorage.removeItem('temp_username');
      }
    };
  }, []);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const isFormValid = username.trim().length > 0 && password.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            MVV Extraction System
          </h1>
          <p className="text-gray-600">
            管理者認証が必要です
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Field */}
          <div>
            <label 
              htmlFor="username" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              ユーザー名
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="ユーザー名を入力"
                required
                disabled={isSubmitting}
                autoComplete="username"
                autoFocus
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              パスワード
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="パスワードを入力"
                required
                disabled={isSubmitting}
                autoComplete="current-password"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 focus:outline-none focus:text-gray-600 disabled:pointer-events-none"
                disabled={isSubmitting}
                aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5 text-gray-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-600 font-medium">
                    ログインエラー
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full py-3 text-base font-medium"
            size="lg"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-3" />
                認証中...
              </div>
            ) : (
              'ログイン'
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            このシステムは管理者のみアクセス可能です
          </p>
        </div>
      </div>
    </div>
  );
};