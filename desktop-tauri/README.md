# تطبيق سطح المكتب — نسخة Tauri v2

نقل مستقل لتطبيق الطالب من .NET MAUI. المرجع الوحيد هو
[`../PORT-AUDIT.md`](../PORT-AUDIT.md).

تطبيق MAUI في `../desktop/` **يبقى يعمل كما هو**. لا شيء هنا يشير إليه ولا
يعدّله.

## البناء على هذا الجهاز — قيد مهم

Visual Studio Community المثبّتة هنا **ناقصة**: مجلد `VC\Tools\MSVC\*\lib`
فيها يحوي `onecore` فقط بلا `x64`، فلا يجد الرابط `msvcrt.lib`. وRust يختارها
لأنها الأحدث.

فالبناء يجب أن يمرّ عبر بيئة **Build Tools**:

```bat
"C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
npm run tauri build
```

بدون ذلك يفشل الربط بـ `LNK1104: cannot open file 'msvcrt.lib'` — وهي رسالة
تبدو كأن Rust ناقص بينما العيب في تثبيت Visual Studio.

## التشغيل للتطوير

```bash
npm install
npm run tauri dev
```

## ما تحتاجه المنصّة

- **ويندوز 10 نسخة 2004 (build 19041)** فما فوق — الحماية تحتاج
  `WDA_EXCLUDEFROMCAPTURE` وهي من هذه النسخة
- **WebView2 Evergreen Runtime** حصرًا. لا Fixed Runtime: يثبّت إصدارًا
  ويحرم التطبيق تحديثات الأمان
- **ماك لاحقًا.** البنية تفصل الأسطح الأصلية في وحدات مستقلة تحسّبًا لذلك

## البنية

```
src/            الواجهة — React + TypeScript + Tailwind
src-tauri/
  src/
    main.rs        نقطة الدخول
    lib.rs         التركيب، والفاصل بين المنصّات
    protection.rs  حماية المحتوى، مع تحقّق من النظام لا افتراض
  capabilities/    الصلاحيات، بصيغة TOML لتحمل تعليقًا لكل بند
  tauri.conf.json  النافذة و CSP والحزمة
```

## ما أُنجز

الدفعة ١ فقط: الهيكل، ونافذة تعمل، وحماية محتوى **متحقَّق منها**.
لا مصادقة ولا شاشات ولا مشغّل بعد.
