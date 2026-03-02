import { create } from 'zustand';

type ToastVariant = 'success' | 'error';

interface ToastState {
  visible: boolean;
  message: string;
  variant: ToastVariant;
  duration: number;
  show: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  message: '',
  variant: 'success',
  duration: 3000,
  show: (message, variant = 'success', duration = 3000) =>
    set({ visible: true, message, variant, duration }),
  dismiss: () => set({ visible: false }),
}));

/** Shorthand to show a toast from anywhere (no hook needed) */
export const showToast = (message: string, variant: ToastVariant = 'success', duration = 3000) =>
  useToastStore.getState().show(message, variant, duration);
