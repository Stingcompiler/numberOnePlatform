/**
 * api/fetchAll.js
 * ─────────────────────────────────────────────────────────────────
 * جلب كامل السجلات من نقاط النهاية المُجزَّأة (DRF Pagination).
 *
 * الـ Backend يُعيد { count, next, results } مع 10 سجلات افتراضياً،
 * ممّا يجعل القوائم المنسدلة تعرض أول 10 نتائج فقط. هذه الدالة تطلب
 * أكبر صفحة يسمح بها الـ Backend (page_size) ثم تُكمل الصفحات المتبقية
 * فقط عند وجودها فعلاً — أي طلب واحد في الحالات الطبيعية بدون تكرار.
 *
 * تُعيد نفس شكل البيانات المتوقَّع سابقاً (`data.results || data`):
 *   - مصفوفة السجلات لنقاط النهاية المُجزَّأة وغير المُجزَّأة
 *   - البيانات كما هي إن لم تكن مُجزَّأة ولا مصفوفة
 *
 * مثال:
 *   fetchAll('/supervisors/').then(setSupervisors).catch(() => {})
 */

import api from './axiosInstance'

// = accounts.pagination.StandardPagination.max_page_size
const MAX_PAGE_SIZE = 1000

// حدّ أمان لمنع أي حلقة طلبات غير متوقّعة (1000 × 50 = 50٬000 سجل)
const MAX_EXTRA_PAGES = 50

export default async function fetchAll(url, params = {}) {
  const query = { ...params, page_size: MAX_PAGE_SIZE }
  const { data } = await api.get(url, { params: query })

  // نقاط النهاية غير المُجزَّأة (pagination_class = None) تُعيد مصفوفة مباشرة
  if (!data || !Array.isArray(data.results)) return data

  const items = data.results
  const count = data.count ?? items.length
  // نعتمد على طول الصفحة الفعلي لا على page_size المطلوب،
  // حتى يعمل الأمر حتى لو تجاهل الـ Backend المعامل
  const pageSize = items.length

  if (!pageSize || count <= pageSize) return items

  const extraPages = Math.min(Math.ceil(count / pageSize) - 1, MAX_EXTRA_PAGES)
  const rest = await Promise.all(
    Array.from({ length: extraPages }, (_, i) =>
      api.get(url, { params: { ...query, page: i + 2 } })
        .then((r) => r.data?.results || [])
        .catch(() => [])
    )
  )

  return items.concat(...rest)
}
