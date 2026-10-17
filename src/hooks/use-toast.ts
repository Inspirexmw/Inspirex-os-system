import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  action?: { label: string; onClick: () => void };
  duration?: number;
}

export function useToast() {
  const toast = ({ title, description, variant, action, duration }: ToastOptions) => {
    if (variant === 'destructive') {
      sonnerToast.error(title, {
        description,
        action, duration,
      });
    } else {
      sonnerToast.success(title, {
        description,
        action, duration,
      });
    }
  };

  return { toast };
}
