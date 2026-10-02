'use client';

import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900',
};

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`
        fixed bottom-safe left-1/2 -translate-x-1/2 z-[100]
        px-4 py-3 rounded-lg shadow-lg text-sm font-medium
        transition-all duration-200
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        ${typeStyles[type]}
      `.trim()}
      role="alert"
    >
      {message}
    </div>
  );
}
