/**
 * App.jsx — Router الرئيسي الكامل مع كل الصفحات
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Loader2 } from 'lucide-react'
import { lazy, Suspense } from 'react'

// Public (غير lazy — تحميل فوري)
import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/public/LoginPage'
import StudentRegistrationPage from './pages/public/StudentRegistrationPage'

// Dashboard Layout
import DashboardLayout from './components/layout/DashboardLayout'

// Dashboard Pages — Lazy loaded
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'))
const StudentsPage = lazy(() => import('./pages/dashboard/StudentsPage'))
const TeachersPage = lazy(() => import('./pages/dashboard/TeachersPage'))
const SupervisorsPage = lazy(() => import('./pages/dashboard/SupervisorsPage'))
const SupervisorDetailPage = lazy(() => import('./pages/dashboard/SupervisorDetailPage'))
const StudentRequestsPage = lazy(() => import('./pages/dashboard/StudentRequestsPage'))
const FinancePage = lazy(() => import('./pages/dashboard/FinancePage'))
const ReportsPage = lazy(() => import('./pages/dashboard/ReportsPage'))
const LevelsGradesPage = lazy(() => import('./pages/dashboard/LevelsGradesPage'))
const GradeDetailsPage = lazy(() => import('./pages/dashboard/GradeDetailsPage'))
const CoursesUnitsPage = lazy(() => import('./pages/dashboard/CoursesUnitsPage'))
const CourseDetailsPage = lazy(() => import('./pages/dashboard/CourseDetailsPage'))
const UnitDetailsPage = lazy(() => import('./pages/dashboard/UnitDetailsPage'))
const LessonsExercisesPage = lazy(() => import('./pages/dashboard/LessonsExercisesPage'))
const LectureDetailsPage = lazy(() => import('./pages/dashboard/LectureDetailsPage'))
const AllSubmissionsPage = lazy(() => import('./pages/dashboard/AllSubmissionsPage'))
const InboxPage = lazy(() => import('./pages/dashboard/InboxPage'))
const AnnouncementsPage = lazy(() => import('./pages/dashboard/AnnouncementsPage'))
const SiteSettingsPage = lazy(() => import('./pages/dashboard/SiteSettingsPage'))
const ContactToolsPage = lazy(() => import('./pages/dashboard/ContactToolsPage'))
const StaffPage = lazy(() => import('./pages/dashboard/StaffPage'))
const ExchangeRatePage = lazy(() => import('./pages/dashboard/ExchangeRatePage'))
const StudentCourseAccessPage = lazy(() => import('./pages/dashboard/StudentCourseAccessPage'))
// Exam pages
const ExamListPage = lazy(() => import('./pages/dashboard/ExamListPage'))
const ExamCreatePage = lazy(() => import('./pages/dashboard/ExamCreatePage'))
const ExamSubmissionsPage = lazy(() => import('./pages/dashboard/ExamSubmissionsPage'))
const AttemptDetailPage = lazy(() => import('./pages/dashboard/AttemptDetailPage'))
// Student pages
const MyCoursesPage = lazy(() => import('./pages/dashboard/MyCoursesPage'))
const MySubmissionsPage = lazy(() => import('./pages/dashboard/MySubmissionsPage'))
const BackupPage = lazy(() => import('./pages/dashboard/BackupPage'))
const StudentPhoneDataPage = lazy(() => import('./pages/dashboard/StudentPhoneDataPage'))
const RegistrationRequestDetailPage = lazy(() => import('./pages/dashboard/RegistrationRequestDetailPage'))
const RegistrationConditionsPage = lazy(() => import('./pages/dashboard/RegistrationConditionsPage'))
const LectureSupervisorsPage      = lazy(() => import('./pages/dashboard/LectureSupervisorsPage'))
const LectureSupervisorDetailPage = lazy(() => import('./pages/dashboard/LectureSupervisorDetailPage'))
const ProfilePage                 = lazy(() => import('./pages/dashboard/ProfilePage'))
const PasswordManagementPage      = lazy(() => import('./pages/dashboard/PasswordManagementPage'))

/* ── Page Loader ──────────────────────────────────────────────── */
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-64">
    <Loader2 size={28} className="animate-spin text-brand-blue" />
  </div>
)

/* ── حارس المسارات الخاصة ─────────────────────────────────────── */
function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}

/* ── محوّل المسجَّل لـ Dashboard ─────────────────────────────── */
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

/* ── غلاف Dashboard مع Suspense ──────────────────────────────── */
function DPage({ component: Component, roles }) {
  return (
    <PrivateRoute roles={roles}>
      <DashboardLayout>
        <Suspense fallback={<PageLoader />}>
          <Component />
        </Suspense>
      </DashboardLayout>
    </PrivateRoute>
  )
}

/* ── الأدوار ─────────────────────────────────────────────────── */
const ADMIN_ROLES              = ['admin', 'manager']
const ALL_STAFF                = ['admin', 'manager', 'teacher']
const LECTURE_CONTENT_ROLES    = ['admin', 'manager', 'teacher', 'lecture_supervisor']
const COURSES_SUPERVISOR_ROLES = ['lecture_supervisor']
const STUDENT_ONLY             = ['student']

function AppRoutes() {
  return (
    <Routes>

      {/* ── صفحات Public ───────────────────────────────────────── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<StudentRegistrationPage />} />
      <Route path="/login" element={
        <PublicRoute><LoginPage /></PublicRoute>
      } />

      {/* ── Dashboard — الرئيسية ───────────────────────────────── */}
      <Route path="/dashboard"
        element={<DPage component={DashboardHome} />}
      />

      {/* ── إدارة الحسابات ────────────────────────────────────── */}
      <Route path="/dashboard/students"
        element={<DPage component={StudentsPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/students/:id"
        element={<DPage component={lazy(() => import('./pages/dashboard/StudentDetailsPage'))} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/teachers"
        element={<DPage component={TeachersPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/supervisors"
        element={<DPage component={SupervisorsPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/supervisors/:id"
        element={<DPage component={SupervisorDetailPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/student-requests"
        element={<DPage component={StudentRequestsPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/student-requests/:id"
        element={<DPage component={RegistrationRequestDetailPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/students/:id/phone"
        element={<DPage component={StudentPhoneDataPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/registration-conditions"
        element={<DPage component={RegistrationConditionsPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/profile"
        element={<DPage component={ProfilePage} />}
      />
      <Route path="/dashboard/password-management"
        element={<DPage component={PasswordManagementPage} roles={ADMIN_ROLES} />}
      />

      {/* ── مشرفو المحاضرات (إدارة المدير) ────────────────────── */}
      <Route path="/dashboard/lecture-supervisors"
        element={<DPage component={LectureSupervisorsPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/lecture-supervisors/:id"
        element={<DPage component={LectureSupervisorDetailPage} roles={ADMIN_ROLES} />}
      />

      {/* ── المالية والتقارير ─────────────────────────────────── */}
      <Route path="/dashboard/finance"
        element={<DPage component={FinancePage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/reports"
        element={<DPage component={ReportsPage} roles={ADMIN_ROLES} />}
      />

      {/* ── إدارة الأكاديمية ────────────────────────────────────── */}
      <Route path="/dashboard/academic/levels"
        element={<DPage component={LevelsGradesPage} roles={ALL_STAFF} />}
      />
      <Route path="/dashboard/academic/grades/:id"
        element={<DPage component={GradeDetailsPage} roles={ALL_STAFF} />}
      />
      <Route path="/dashboard/academic/courses"
        element={<DPage component={CoursesUnitsPage} roles={LECTURE_CONTENT_ROLES} />}
      />
      <Route path="/dashboard/academic/courses/:id"
        element={<DPage component={CourseDetailsPage} roles={LECTURE_CONTENT_ROLES} />}
      />
      <Route path="/dashboard/academic/units/:id"
        element={<DPage component={UnitDetailsPage} roles={LECTURE_CONTENT_ROLES} />}
      />
      <Route path="/dashboard/academic/lessons"
        element={<DPage component={LessonsExercisesPage} roles={LECTURE_CONTENT_ROLES} />}
      />
      <Route path="/dashboard/academic/lessons/:id"
        element={<DPage component={LectureDetailsPage} roles={LECTURE_CONTENT_ROLES} />}
      />
      <Route path="/dashboard/academic/submissions"
        element={<DPage component={AllSubmissionsPage} roles={ALL_STAFF} />}
      />

      {/* ── إدارة الاختبارات ─────────────────────────────────────── */}
      <Route path="/dashboard/exams"
        element={<DPage component={ExamListPage} roles={ALL_STAFF} />}
      />
      <Route path="/dashboard/exams/create"
        element={<DPage component={ExamCreatePage} roles={ALL_STAFF} />}
      />
      <Route path="/dashboard/exams/:id/edit"
        element={<DPage component={ExamCreatePage} roles={ALL_STAFF} />}
      />
      <Route path="/dashboard/exams/:id/submissions"
        element={<DPage component={ExamSubmissionsPage} roles={ALL_STAFF} />}
      />
      <Route path="/dashboard/exams/attempts/:id"
        element={<DPage component={AttemptDetailPage} roles={ALL_STAFF} />}
      />

      {/* ── إدارة الموقع ──────────────────────────────────────── */}
      <Route path="/dashboard/announcements"
        element={<DPage component={AnnouncementsPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/inbox"
        element={<DPage component={InboxPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/settings"
        element={<DPage component={SiteSettingsPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/contact-tools"
        element={<DPage component={ContactToolsPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/staff"
        element={<DPage component={StaffPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/exchange-rates"
        element={<DPage component={ExchangeRatePage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/course-access"
        element={<DPage component={StudentCourseAccessPage} roles={ADMIN_ROLES} />}
      />
      <Route path="/dashboard/backups"
        element={<DPage component={BackupPage} roles={ADMIN_ROLES} />}
      />

      {/* ── واجهات الطالب ─────────────────────────────────────── */}
      <Route path="/dashboard/my-courses"
        element={<DPage component={MyCoursesPage} roles={STUDENT_ONLY} />}
      />
      <Route path="/dashboard/my-submissions"
        element={<DPage component={MySubmissionsPage} roles={STUDENT_ONLY} />}
      />

      {/* ── Fallback ──────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  )
}
