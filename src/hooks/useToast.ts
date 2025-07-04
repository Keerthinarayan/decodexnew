import { useState, useCallback } from 'react';
import { Toast } from '../components/ToastNotification';

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString();
    const newToast: Toast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
    
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((title: string, message: string, duration?: number) => {
    return addToast({ type: 'success', title, message, duration });
  }, [addToast]);

  const showError = useCallback((title: string, message: string, duration?: number) => {
    return addToast({ type: 'error', title, message, duration });
  }, [addToast]);

  const showInfo = useCallback((title: string, message: string, duration?: number) => {
    return addToast({ type: 'info', title, message, duration });
  }, [addToast]);

  const showPowerUp = useCallback((title: string, message: string, powerUpType: 'brainBoost' | 'hint' | 'skip', duration?: number) => {
    return addToast({ type: 'powerup', title, message, powerUpType, duration });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showPowerUp
  };
};