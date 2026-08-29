namespace NumberOne.Core.ViewModels;

/// <summary>
/// Arabic copy, taken verbatim from the design handoff
/// ("Number One Desktop v2.dc.html").
///
/// Kept in one place rather than inline in XAML so the wording is reviewable
/// against the design in a single file, and so the view models can be tested
/// without a platform head.
///
/// Server-authored messages are NOT here - those are shown verbatim as the
/// server sent them, and the ones the client has to recognise live in
/// Api/ServerMessages.cs.
/// </summary>
public static class UiText
{
    // ── Brand panel ──────────────────────────────────────────────────────────
    public const string BrandShortName = "نمبر ون";
    public const string BrandName = "مدارس ومعاهد نمبر ون";
    public const string BrandTagline =
        "منصة الطالب على سطح المكتب — محاضراتك وتمارينك واختباراتك ونتائجك في مكان واحد.";

    public const string BrandBulletOne = "محاضرات بجودة عالية دون انقطاع";
    public const string BrandBulletTwo = "تمارين واختبارات مع نتائج فورية";
    public const string BrandBulletThree = "متابعة تقدّمك ورصيدك المالي أولاً بأول";

    // ── Login form ───────────────────────────────────────────────────────────
    public const string LoginTitle = "تسجيل الدخول";
    public const string LoginSubtitle = "منصة الطالب — نسخة سطح المكتب";
    public const string UsernameLabel = "اسم المستخدم";
    public const string PasswordLabel = "كلمة المرور";
    public const string ShowPassword = "إظهار كلمة المرور";
    public const string SignIn = "دخول";
    public const string SigningIn = "جارٍ الدخول…";
    public const string CredentialsRequired = "يرجى إدخال اسم المستخدم وكلمة المرور";

    public const string ThisDevicePrefix = "هذا الجهاز: ";
    public const string ThisDeviceSuffix = " · سيتم ربط حسابك به عند أول دخول";

    // ── Binding confirmation ─────────────────────────────────────────────────
    public const string BindTitle = "تأكيد ربط الجهاز";
    public const string BindBody =
        "سيتم ربط حسابك بهذا الحاسوب بشكل دائم. لن تتمكن من استخدام تطبيق الهاتف أو حاسوب آخر بعد ذلك إلا بمراجعة إدارة المدرسة لفك الارتباط.";
    public const string BindCurrentDevice = "الجهاز الحالي";
    public const string BindConfirm = "متابعة وربط الجهاز";
    public const string BindCancel = "إلغاء";
    public const string BindFootnote = "إجراء نهائي · Esc للإلغاء";

    // ── Blocked: the account lives on another device ─────────────────────────
    public const string BlockedDeviceTitle = "هذا الحساب مرتبط بجهاز آخر";
    public const string BlockedDeviceBody =
        "لا يمكن الدخول من هذا الحاسوب. لفك الارتباط بالجهاز السابق يرجى التواصل مع إدارة المدرسة.";
    public const string BoundDeviceLabel = "الجهاز المرتبط حالياً";
    public const string BoundAtLabel = "تاريخ الربط";

    // ── Blocked: this computer belongs to another student ────────────────────
    public const string BlockedAccountTitle = "هذا الجهاز مرتبط بحساب طالب آخر";
    public const string BlockedAccountBody =
        "لا يمكن تسجيل الدخول بحسابك من هذا الحاسوب لأنه مرتبط بحساب طالب آخر. لفك الارتباط يرجى التواصل مع إدارة المدرسة.";

    // ── Shared by both blocked screens ───────────────────────────────────────
    public const string ThisMachineIdLabel = "معرّف هذا الحاسوب";
    public const string CopyDeviceId = "نسخ المعرّف";
    public const string DeviceIdCopied = "تم نسخ معرّف الجهاز إلى الحافظة.";
    public const string ContactAdministration = "التواصل مع الإدارة";
    public const string PhoneCopied = "تم نسخ رقم الإدارة إلى الحافظة.";
    public const string SignInWithAnotherAccount = "تسجيل الدخول بحساب آخر";

    // ── Session expiry ───────────────────────────────────────────────────────
    public const string SessionExpiredTitle = "انتهت صلاحية الجلسة";
    public const string SessionExpiredBody =
        "انتهت مدة جلستك لأسباب أمنية. سجّل الدخول مرة أخرى للمتابعة — سيعيدك التطبيق إلى نفس الصفحة التي كنت فيها.";
    public const string SessionExpiredContinue = "تسجيل الدخول والمتابعة";
    public const string SessionExpiredBackToLogin = "العودة لشاشة الدخول";

    /// <summary>
    /// Renders a date the way every date in this app renders: year/month/day,
    /// in Arabic-Indic digits. Latin technical values keep Latin digits and sit
    /// in LTR islands; a binding date is content, not a technical value.
    /// </summary>
    public static string FormatDate(DateTimeOffset value)
    {
        var western = value.ToLocalTime().ToString("yyyy/MM/dd");
        return ToArabicIndicDigits(western);
    }

    public static string ToArabicIndicDigits(string value)
    {
        Span<char> buffer = stackalloc char[value.Length];

        for (var i = 0; i < value.Length; i++)
        {
            var c = value[i];
            buffer[i] = c is >= '0' and <= '9' ? (char)('٠' + (c - '0')) : c;
        }

        return new string(buffer);
    }
}
