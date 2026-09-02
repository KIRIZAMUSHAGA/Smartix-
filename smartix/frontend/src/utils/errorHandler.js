import { toast } from 'sonner';

export function showErrorToast(message, options = {}) {
  toast.error(message || 'Une erreur est survenue', options);
}

export function showSuccessToast(message, options = {}) {
  toast.success(message || 'Succès', options);
}

export function handleApiError(error, defaultMessage = 'Une erreur est survenue') {
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message) {
    return error.message;
  }
  return defaultMessage;
}

export function getErrorMessage(error) {
  return handleApiError(error);
}

export default { handleApiError, getErrorMessage };
