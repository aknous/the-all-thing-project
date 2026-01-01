// Admin authentication utilities

const ADMIN_KEY_STORAGE = 'adminKey';

export const setAdminKey = (key: string): void => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
  }
};

export const getAdminKey = (): string | null => {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE);
  }
  return null;
};

export const clearAdminKey = (): void => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  }
};

export const isAuthenticated = (): boolean => {
  return !!getAdminKey();
};

// Wrapper for admin API calls
export const adminFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const key = getAdminKey();
  if (!key) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'xAdminKey': key,
    },
  });

  // Auto-logout on 401
  if (response.status === 401) {
    clearAdminKey();
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    throw new Error('Unauthorized - please login again');
  }

  return response;
};
