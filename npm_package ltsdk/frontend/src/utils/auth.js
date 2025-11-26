/**
 * Custom auth status checker that handles 401 responses gracefully
 * Note: Browser console may still show 401 errors, but these are expected
 * when checking authentication status for unauthenticated users.
 * The application handles these correctly and they don't indicate actual errors.
 */

export const checkAuthStatus = async () => {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://localhost:5002/auth/session', true);
    xhr.withCredentials = true;

    xhr.onload = () => {
      if (xhr.status === 401) {
        // 401 is expected when not authenticated - this is normal behavior
        resolve({ authenticated: false, error: null });
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve({
            authenticated: json && json.authenticated === true,
            session: json.session || null,
            error: null
          });
        } catch (e) {
          resolve({ authenticated: false, error: 'Parse error' });
        }
      } else {
        resolve({ authenticated: false, error: `HTTP ${xhr.status}` });
      }
    };

    xhr.onerror = () => {
      // Network errors - assume not authenticated
      resolve({ authenticated: false, error: 'Network error' });
    };

    // Set a custom error handler to prevent default error logging for 401s
    // Note: Browser dev tools may still show 401 in network tab, which is expected
    xhr.addEventListener('error', () => {
      resolve({ authenticated: false, error: 'Request failed' });
    }, { once: true });

    xhr.send();
  });
};

