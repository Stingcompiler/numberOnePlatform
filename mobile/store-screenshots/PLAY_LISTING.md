# نصوص Google Play Console — جاهزة للنسخ

> مبنية على ما يجمعه التطبيق **فعلاً** (تُحقِّق من الكود، لا تخميناً).
> راجعها قبل الإرسال — أنت المسؤول عن دقة إقرار Data Safety أمام Google.

---

## ١. Store Listing

### اسم التطبيق (30 حرفاً كحد أقصى)
```
نمبر ون — بوابة الطالب
```
*(22 حرفاً)*

### الوصف المختصر (80 حرفاً كحد أقصى)
```
منصة مدارس ومعاهد نمبر ون: محاضراتك واختباراتك ونتائجك في مكان واحد.
```
*(68 حرفاً)*

### الوصف الكامل (4000 حرف كحد أقصى)
```
بوابة الطالب من مدارس ومعاهد نمبر ون — تطبيق رسمي يتيح لطلاب المؤسسة متابعة
دراستهم من الهاتف بسهولة وأمان.

━━━━━━━━━━━━━━━━━━━━━━━━
ماذا يقدّم التطبيق؟
━━━━━━━━━━━━━━━━━━━━━━━━

■ مقرراتك الدراسية
اطّلع على جميع المواد المسجَّل فيها، مرتّبة حسب مرحلتك الدراسية، مع متابعة
نسبة تقدّمك في كل مقرر.

■ المحاضرات المرئية
شاهد شرح المعلمين داخل التطبيق، وتابع ما أكملته وما تبقّى لك. مشغّل مريح
يدعم التقديم والإرجاع وملء الشاشة.

■ الاختبارات الإلكترونية
أدِّ اختباراتك في وقتها المحدد، وشاهد نتيجتك ودرجتك فور التسليم.

■ التمارين والواجبات
حلّ التمارين المرفقة بالمحاضرات واعرف إجاباتك الصحيحة والخاطئة.

■ النتائج والتقدّم
تابع درجاتك ومحاولاتك السابقة، واعرف موقعك من كل مقرر.

■ البث المباشر
احضر الحصص المباشرة مع معلميك في مواعيدها.

■ الإشعارات
تنبيهات فورية بالمحاضرات الجديدة والاختبارات القادمة والنتائج.

━━━━━━━━━━━━━━━━━━━━━━━━
أمان حسابك
━━━━━━━━━━━━━━━━━━━━━━━━

• يُربط حسابك بجهاز واحد لحماية اشتراكك من الاستخدام غير المصرّح به.
• المحتوى التعليمي محمي داخل التطبيق.
• جميع الاتصالات مشفَّرة.
• لا نعرض أي إعلانات، ولا نبيع بياناتك.

━━━━━━━━━━━━━━━━━━━━━━━━
ملاحظة مهمة
━━━━━━━━━━━━━━━━━━━━━━━━

هذا التطبيق مخصّص لطلاب مدارس ومعاهد نمبر ون المسجَّلين فقط. تُصدر بيانات
الدخول من إدارة المؤسسة، ولا يتوفّر تسجيل ذاتي داخل التطبيق.

للاستفسار أو الدعم، تواصل مع إدارة المؤسسة.
```

### فئة التطبيق
- **Category:** Education
- **Tags:** التعليم · المدارس · التعلّم الإلكتروني

### بيانات التواصل
- **Email:** (بريد المؤسسة الرسمي)
- **Website:** `https://numberoneschools.com`
- **Privacy Policy:** `https://numberoneschools.com/privacy`

---

## ٢. Data Safety — إجابات النموذج

> ⚠️ هذه الإجابات تخصّ **تطبيق الهاتف** لا لوحة الويب.
> تحقّقت من الكود: التطبيق **لا يرفع أي ملفات أو صور**، ولا يصل إلى
> الموقع الجغرافي أو الكاميرا أو الميكروفون أو جهات الاتصال.
> استمارة التسجيل التي ترفع المستندات موجودة على الموقع لا في التطبيق.

### أسئلة عامة
| السؤال | الإجابة |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — عبر التواصل مع الإدارة (اذكر بريد المؤسسة) |

### البيانات المُجمَّعة

**Personal info → Name**
- Collected: ✅ · Shared: ❌
- Processed ephemerally: ❌ · Required: ✅
- Purpose: **App functionality, Account management**

**Personal info → Phone number**
- Collected: ✅ · Shared: ❌ · Required: ✅
- Purpose: **App functionality, Account management**
- *(رقم الطالب وولي الأمر — للتواصل الإداري)*

**Personal info → Other info** *(العنوان، اسم ولي الأمر)*
- Collected: ✅ · Shared: ❌ · Required: ✅
- Purpose: **App functionality, Account management**

**Financial info → Purchase history**
- Collected: ✅ · Shared: ❌ · Required: ✅
- Purpose: **App functionality**
- *(سجل الرسوم الدراسية المسجَّل من الإدارة. لا تتم أي عملية دفع داخل
  التطبيق، ولا نجمع بيانات بطاقات إطلاقاً.)*

**App activity → Other actions**
- Collected: ✅ · Shared: ❌ · Required: ✅
- Purpose: **App functionality, Analytics**
- *(المحاضرات المُشاهَدة، إجابات التمارين، محاولات الاختبارات ودرجاتها)*

**Device or other IDs → Device or other IDs**
- Collected: ✅ · Shared: ❌ · Required: ✅
- Purpose: **App functionality, Fraud prevention and security**
- *(معرّف الجهاز لربط الحساب بجهاز واحد + رمز الإشعارات)*

### ما **لا** تُحدَّده (تحقّقت منه في الكود)
❌ Location ❌ Contacts ❌ Photos & videos ❌ Files & docs
❌ Calendar ❌ Messages ❌ Audio ❌ Health & fitness
❌ Web browsing ❌ Payment info ❌ Race/ethnicity ❌ Political/religious beliefs

---

## ٣. App Content — بقية النماذج

| النموذج | الإجابة |
|---|---|
| **Privacy policy** | `https://numberoneschools.com/privacy` |
| **Ads** | **No** — التطبيق لا يعرض إعلانات |
| **App access** | **All functionality is restricted** → أدخل بيانات `play_reviewer` |
| **Content rating** | املأ الاستبيان: لا عنف · لا محتوى جنسي · لا ألفاظ · لا مقامرة · لا مواد خاضعة للرقابة ⇒ النتيجة المتوقّعة **Everyone / 3+** |
| **Target audience** | **13+** فقط — لا تختر فئات أصغر لتفادي Families Policy |
| **News app** | **No** |
| **COVID-19 apps** | **No** |
| **Data safety** | حسب القسم ٢ أعلاه |
| **Government apps** | **No** |
| **Financial features** | **No** — لا معاملات مالية داخل التطبيق |
| **Health** | **No** |

### ملاحظة App Access (مهمة)
اكتب في حقل الإرشادات:
```
Educational platform for students enrolled at Number One Schools & Institutes.
Self-registration is not available in the app; credentials are issued by the
institution. Use the credentials above to sign in and access courses,
lectures, exams and results.
```

---

## ٤. الأصول الرسومية

| الأصل | الملف | المقاس |
|---|---|---|
| App icon | يُؤخذ من الحزمة تلقائياً | 512×512 |
| Feature graphic | `feature-graphic.png` | 1024×500 |
| Screenshots | `01-login` … `04-course` | 1200×2400 |

الحد الأدنى المطلوب: **صورتان**؛ لديك **أربع**.

---

## ٥. قبل الضغط على Submit

- [ ] `REVIEW_ACCOUNT_USERNAME=play_reviewer` مضبوط في Render
- [ ] كلمة مرور حساب المراجعة **قوية وعشوائية** (لا النص التوضيحي)
- [ ] حساب المراجعة يرى محتوى فعلياً (تحقّق: 12 كورساً)
- [ ] `https://numberoneschools.com/privacy` يفتح بلا تسجيل دخول
- [ ] ملف الـ keystore محفوظ في مكان آمن **خارج** مجلد المشروع
- [ ] ارفع في **Internal testing** أولاً وثبّت من Play قبل Production
