export type ToastKind = 'info' |'success' | 'error';

export type ToastPayload = {
  title: string;
  description?: string;
  kind?: ToastKind;
};
