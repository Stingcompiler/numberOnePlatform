import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// --- API URL CONFIGURATION ---
// Local Development API (Android emulator uses 10.0.2.2, iOS simulator uses localhost)
const LOCAL_API_URL = 'http://10.0.2.2:8000/api'; // Change to computer's local IP (e.g. 192.168.1.X) if testing on physical device
const PRODUCTION_API_URL = 'https://numberoneschools.com/api';

const apiClient = axios.create({
  baseURL: PRODUCTION_API_URL, // CHANGE THIS to LOCAL_API_URL when testing locally with SQLite
  timeout: 15000,
  withCredentials: true,
});

// نقاط لا تحتاج هوية سابقة — يجب ألا تحمل ترويسة Authorization إطلاقاً.
// إرسال توكن منتهٍ إلى /auth/login/ كان يُرجع 401 قبل الوصول لمنطق الدخول،
// فيبقى المستخدم عاجزاً عن الدخول لأن كل محاولة تُرسل نفس التوكن الفاسد.
const NO_AUTH_PATHS = ['/auth/login/', '/auth/refresh/'];

apiClient.interceptors.request.use(
  async (config) => {
    try {
      const url = config.url || '';
      if (NO_AUTH_PATHS.some((p) => url.includes(p))) {
        delete config.headers['Authorization'];
        return config;
      }
      const token = await SecureStore.getItemAsync('student_access_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('[apiClient Request Interceptor Error]:', e, e?.stack);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 Unauthorized and not already retried
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('student_refresh_token');

        // Call the refresh API. In production, refreshToken might not exist in SecureStore,
        // so we pass withCredentials: true to send the refresh cookie instead.
        const response = await axios.post(
          `${apiClient.defaults.baseURL || 'https://numberoneschools.com/api'}/auth/refresh/`,
          refreshToken ? { refresh: refreshToken } : {},
          {
            withCredentials: true,
          }
        );

        const { access, refresh: newRefresh } = response.data;

        if (access) {
          await SecureStore.setItemAsync('student_access_token', String(access));
        }
        if (newRefresh) {
          await SecureStore.setItemAsync('student_refresh_token', String(newRefresh));
        }

        apiClient.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        originalRequest.headers['Authorization'] = `Bearer ${access}`;

        processQueue(null, access);
        isRefreshing = false;

        return apiClient(originalRequest);
      } catch (refreshError) {
        console.error('[apiClient Token Refresh Error]:', refreshError, refreshError?.stack);
        processQueue(refreshError, null);
        isRefreshing = false;

        // Session expired, clear tokens
        await SecureStore.deleteItemAsync('student_access_token');
        await SecureStore.deleteItemAsync('student_refresh_token');

        // Let the application know the session expired
        if (global.onSessionExpired) {
          global.onSessionExpired();
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
