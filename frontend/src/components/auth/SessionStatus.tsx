import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../common';
import { 
  Clock, 
  LogOut, 
  User, 
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface SessionStatusProps {
  className?: string;
  showDetails?: boolean;
}

export const SessionStatus: React.FC<SessionStatusProps> = ({ 
  className = '',
  showDetails = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [, setCurrentTime] = useState(new Date());

  const { 
    user, 
    logout, 
    getRemainingTime, 
    isTokenExpiringSoon 
  } = useAuthStore();

  const remainingTime = getRemainingTime();
  const isExpiringSoon = isTokenExpiringSoon();

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!user) {
    return null;
  }

  // For development/testing - show fallback when no valid JWT
  const displayTime = remainingTime || { days: 0, hours: 24, minutes: 0, total: 24 * 60 * 60 * 1000 };

  const handleLogout = () => {
    if (confirm('ログアウトしますか？')) {
      logout();
    }
  };

  const formatRemainingTime = () => {
    if (displayTime.days > 0) {
      return `${displayTime.days}日${displayTime.hours}時間`;
    } else if (displayTime.hours > 0) {
      return `${displayTime.hours}時間${displayTime.minutes}分`;
    } else {
      return `${displayTime.minutes}分`;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Mobile View - Compact */}
      <div className="block sm:hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            isExpiringSoon 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          aria-expanded={isExpanded}
          aria-label="セッション情報"
        >
          <User className="w-4 h-4" />
          {isExpiringSoon && <AlertTriangle className="w-4 h-4" />}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {/* Mobile Dropdown */}
        {isExpanded && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600 mb-1">ログイン中:</p>
                <p className="text-sm font-medium text-gray-900">{user.username}</p>
              </div>
              
              <div>
                <p className="text-xs text-gray-600 mb-1">セッション残り時間:</p>
                <p className={`text-sm font-medium ${
                  isExpiringSoon ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {formatRemainingTime()}
                </p>
              </div>

              {isExpiringSoon && remainingTime && (
                <div className="bg-red-50 border border-red-200 rounded p-2">
                  <p className="text-xs text-red-600">
                    セッションの有効期限が近づいています
                  </p>
                </div>
              )}

              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                ログアウト
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop View */}
      <div className="hidden sm:flex items-center space-x-4">
        {/* Session Info */}
        {showDetails && (
          <div className="flex items-center space-x-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <div className="text-gray-600">
              <span className="font-medium">{user.username}</span>
              <span className="mx-2">•</span>
              <span className={isExpiringSoon ? 'text-red-600 font-medium' : ''}>
                残り {formatRemainingTime()}
              </span>
            </div>
            {isExpiringSoon && (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
          </div>
        )}

        {/* Session Time Only */}
        {!showDetails && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center space-x-2 text-sm px-3 py-2 rounded-lg transition-colors ${
              isExpiringSoon 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title="セッション情報"
          >
            <Clock className="w-4 h-4" />
            <span>{formatRemainingTime()}</span>
            {isExpiringSoon && <AlertTriangle className="w-4 h-4" />}
          </button>
        )}

        {/* Session Details Dropdown */}
        {!showDetails && isExpanded && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
            <div className="space-y-2">
              <p className="text-xs text-gray-600">ログイン中:</p>
              <p className="text-sm font-medium text-gray-900">{user.username}</p>
              
              <p className="text-xs text-gray-600 mt-3">セッション残り時間:</p>
              <p className={`text-sm font-medium ${
                isExpiringSoon ? 'text-red-600' : 'text-gray-900'
              }`}>
                {formatRemainingTime()}
              </p>

              {isExpiringSoon && remainingTime && (
                <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
                  <p className="text-xs text-red-600">
                    セッションの有効期限が近づいています
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="outline"
          size="sm"
          className="flex items-center"
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span className="hidden md:inline">ログアウト</span>
        </Button>
      </div>

      {/* Click outside to close dropdown */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};