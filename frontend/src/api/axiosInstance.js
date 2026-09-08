/**
 * api/axiosInstance.js
 * ─────────────────────────────────────────────────────────────────
 * Axios Instance مهيَّأ بـ:
 *   - withCredentials: true  → لإرسال HttpOnly Cookies تلقائياً
 *   - Request Interceptor    → لا يحتاج إضافة Token يدوياً (يأتي من Cookie)
 *   - Response Interceptor   → عند 401 يحاول تجديد التوكن ثم يُعيد الطلب
 *     وإن فشل يُحوِّل للصفحة الرئيسية
 */

import axios from 'axios'

const api = axios.create({
  // مسار نسبي: الواجهة والـ API يخدمهما نفس الأصل في الإنتاج (Django يخدم
  // الـ SPA)، فيصير النداء same-origin بلا حاجة CORS أصلاً. ومحلياً يمرّره
  // proxy الموجود في vite.config.js إلى 127.0.0.1:8000 — وكان معطّلاً لأن
  // العنوان المطلق يتجاوزه، فكان كل تطوير محلي يضرب قاعدة الإنتاج.
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,          // ضروري لإرسال HttpOnly Cookies
  // ── CSRF: axios يقرأ كوكي csrftoken ويُرسله كترويسة X-CSRFToken تلقائياً ──
  // في الطلبات المُغيِّرة للحالة (same-origin في الإنتاج). Django يتحقق منها.
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
})

// ── تمهيد كوكي CSRF ──────────────────────────────────────────────────────────
// يُستدعى مرة عند إقلاع التطبيق وبعد تسجيل الدخول لضمان توفّر كوكي csrftoken
// قبل أي طلب POST/PUT/PATCH/DELETE. طلب GET مُعفى من CSRF فلا يُحجب.
export const ensureCsrfToken = () =>
  api.get('/auth/csrf/').catch(() => {})

// ── متغير لمنع تكرار طلبات Refresh المتزامنة ──────────────────────
let isRefreshing = false
let failedQueue = []

const processQueue = (error) => {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve()
  )
  failedQueue = []
}

// ── Request Interceptor ────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // If the payload is FormData, let axios set the correct
    // multipart/form-data Content-Type (with boundary) automatically.
    // The hardcoded default 'application/json' would break file uploads.
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response Interceptor ───────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,    // الاستجابة الناجحة تمر مباشرة

  async (error) => {
    const originalRequest = error.config

    // تجاهل أخطاء تسجيل الدخول وتجديد التوكن (لمنع الحلقات اللانهائية)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/login/') &&
      !originalRequest.url.includes('/auth/refresh/')
    ) {
      originalRequest._retry = true

      if (isRefreshing) {
        // إضافة الطلب لقائمة الانتظار حتى ينتهي Refresh جارٍ
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => api(originalRequest))
      }

      isRefreshing = true

      try {
        await api.post('/auth/refresh/')       // تجديد التوكن من Cookie
        processQueue(null)
        return api(originalRequest)            // إعادة الطلب الأصلي
      } catch (refreshError) {
        processQueue(refreshError)
        // انتهت الجلسة — توجيه للصفحة الرئيسية
        //window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
