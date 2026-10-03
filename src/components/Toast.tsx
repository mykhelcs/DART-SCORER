import React from 'react';

interface ToastProps {
  message: string | null;
  type?: 'good' | 'bad' | 'neutral';
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'bad' }) => {
  if (!message) return null;

  return (
    <div
      className={`toast-notice show ${type === 'good' ? 'good' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
};
