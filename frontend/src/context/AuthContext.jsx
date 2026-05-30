/**
 * context/AuthContext.jsx
 * ─────────────────────────────────────────────────────────────────
 * إدارة حالة المصادقة الموحّدة للتطبيق.
 * يُشغِّل /auth/me/ عند التحميل لاستعادة الجلسة من الـ Cookie.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axiosInstance'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)   // جلب الجلسة عند التشغيل

  // ── جلب بيانات المستخدم الحالي من الـ Cookie ──────────────────────
  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me/')
      setUser(data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMe() }, [fetchMe])

  // ── تسجيل الدخول ────────────────────────────────────────────────
  const login = async (username, password, deviceId = '') => {
    const payload = { username, password }
    if (deviceId) payload.device_id = deviceId

    const { data } = await api.post('/auth/login/', payload)
    setUser(data.user)
    return data.user
  }

  // ── تسجيل الخروج ────────────────────────────────────────────────
  const logout = async () => {
    try {
      await api.post('/auth/logout/')
    } finally {
      setUser(null)
    }
  }

  // ── تحديث بيانات المستخدم (بعد تعديل الملف الشخصي) ────────────
  const updateUser = (partial) => setUser((prev) => ({ ...prev, ...partial }))

  // ── مساعدات الدور ────────────────────────────────────────────────
  const isAdmin             = user?.role === 'admin'
  const isManager           = user?.role === 'manager'
  const isTeacher           = user?.role === 'teacher'
  const isStudent           = user?.role === 'student'
  const isLectureSupervisor = user?.role === 'lecture_supervisor'
  const canManage           = isAdmin || isManager
  const canManageLectures   = isAdmin || isManager || isLectureSupervisor

  return (
    <AuthContext.Provider
      value={{
        user, loading, login, logout, updateUser,
        isAdmin, isManager, isTeacher, isStudent,
        isLectureSupervisor, canManage, canManageLectures,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
