# عميل سطح المكتب للطلاب — .NET MAUI

Student desktop client for **مدارس ومعاهد نمبر ون**, against the Django API in
this repository. Windows first, macOS after. Arabic, RTL, students only.

## Projects

| Project | What it is |
|---|---|
| `NumberOne.Core` | API client, auth, DTOs, view models. **No MAUI reference** — so the refresh handler and the login error classification can be tested without a platform head. |
| `NumberOne.Desktop` | The MAUI app. `net10.0-windows10.0.19041.0` and `net10.0-maccatalyst`. Platform code (registry, ioreg, `SetWindowDisplayAffinity`) lives under `Platforms/`. |
| `NumberOne.Core.Tests` | xUnit. Hermetic by default; the live-API tests skip unless pointed at a server. |

```bash
dotnet build desktop/NumberOne.Desktop.slnx
```

## Testing

```bash
dotnet test desktop/NumberOne.Core.Tests
```

That runs everything except `LiveApiTests`, which needs a real Django server —
mocks only ever agree with whatever you believed when you wrote them. To include
them, seed a **scratch** database and point the tests at it.

```bash
export DB_NAME=/tmp/authtest.sqlite3
export DEBUG=True
python manage.py migrate --noinput
```

Then seed the three fixtures the tests expect:

```python
# python manage.py shell
from accounts.models import CustomUser, StudentProfile

def mk(username, name):
    u, _ = CustomUser.objects.get_or_create(username=username, defaults=dict(role="student"))
    u.role, u.full_name, u.is_active = "student", name, True
    u.set_password("pass1234"); u.save()
    p, _ = StudentProfile.objects.get_or_create(user=u)
    return p

mk("fresh.student",   "طالب جديد").bind_device("hw-win-4f2a91c7d0e51b6a", "Windows")
mk("bound.student",   "طالب مربوط").bind_device("hw-android-GALAXY-A54-TEST")
mk("sibling.student", "طالب شقيق")   # left unbound on purpose
```

Then the content fixtures — a course, lessons, an exercise, an exam covering all
four question types, live sessions and notifications:

```bash
python manage.py shell -c "exec(open('desktop/tools/seed_desktop_fixtures.py', encoding='utf-8').read())"
```

```bash
python manage.py runserver 8077 --noreload
NUMBERONE_TEST_API=http://127.0.0.1:8077/api/ dotnet test desktop/NumberOne.Core.Tests
```

**Never point `NUMBERONE_TEST_API` at production.** The tests bind devices, and
only an administrator can unbind one.

## The two things worth understanding before changing this code

### Device binding is confirmed before it happens, in two phases

The server binds inside `LoginSerializer.validate()`, so a login carrying a
`device_id` binds atomically with no chance to ask first. Binding is a one-way
door — only an administrator can undo it — and the design requires confirmation.

`device_id` is optional and binding is skipped without it, so `SignInAsync`
omits it and reads `student_profile.device_id` off the response:

| probe result | what happens |
|---|---|
| `null` | never bound → hold the session, show the modal, `ConfirmBindAsync` logs in again *with* the id |
| ours | already bound here → proceed, no modal |
| anything else | bound elsewhere → `blockedDevice`, **and** we learn which device and when |

The shared family or lab PC case cannot be detected in advance and surfaces as a
400 on the confirming call. Cost is one extra round-trip, on first bind only; the
probe's token pair is discarded and simply expires.

### One refresh serves every concurrent 401

`ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION` are both on, so two
refreshes racing would leave the loser holding a blacklisted token and the
student signed out mid-lesson. `AuthenticatingHandler` funnels them through a
single shared task. A refresh that fails because the *server was unreachable*
does not sign the student out — a dropped connection must not log them off a
device they cannot re-bind.

## Things the client works around

Found by reading the backend and by exercising a running server. None of them are
client bugs; they shape what the client can do.

- **Login refusals arrive as `non_field_errors`, not `detail`.** They are raised
  inside `validate()`. `LoginSerializer` sets `code="device_mismatch"`, but DRF's
  default renderer discards codes, so the Arabic message text is the only
  discriminator on the wire. Pinned in `ServerMessages` with tests.
- **A suspended account reports "wrong username or password".** Django's
  `ModelBackend` rejects `is_active=False` inside `authenticate()`, so
  `LoginSerializer`'s own `الحساب موقوف` branch is unreachable.
  `LoginFailureReason.AccountSuspended` is kept for when that changes, but no
  screen can rely on it today.
- **`user.id` is a UUID, `student_profile.id` is an integer.** Not
  interchangeable; endpoints taking a student id want the profile one.
- **`/notifications/` is paginated** (`{count, next, previous, results}`, page
  size 10). Every other student endpoint returns a bare array.
- **Exam access follows a different rule than course access.** `MyCoursesView`
  reads `StudentCourseAccess` for everyone; `StudentExamListView` gives `online`
  students every active course in their `enrolled_grade` instead. An exam can
  reference a course that never appears in `my-courses` — key exam rows off the
  `course_name` the exam endpoint returns.
- **There is no server-side exam attempt.** `started_at` is written at submit
  time, alongside `submitted_at`. No start endpoint, no duration enforcement, no
  attempt limit. The timer and the "متابعة المحاولة" banner are client-local, and
  the clock is advisory.
- **A student cannot read their own financial file.**
  `StudentFinancialFileView` is `IsAdminOrManager`. Only `balance` is reachable,
  via `student_profile.balance`. The profile screen shows المتبقي; the payments
  table in the design has no student endpoint.
- **The disabled-device login state has no backend.** There is no
  `device_disabled` field anywhere in the models. The design's "هذا الجهاز معطّل"
  panel has nothing to drive it.
- **The submit endpoint's field names do not match the read shape.**
  `POST /academic/submit/` wants `exercise_id`, `answers[].question_id` and
  `answers[].choice_id`, while the read serializers use `exercise`, `question`
  and `selected_choice`. Mirroring the read names produces `هذا الحقل مطلوب.`
  and a silently lost attempt.
- **`Exam.passing_score` is an absolute mark, not a percentage** — the help text
  says «من إجمالي درجات الاختبار» and the mobile app renders it as
  `passing_score / total_marks`. Worth knowing because the model default is
  `50.0`, so **any exam worth fewer than 50 marks that keeps the default can
  never be passed**, however well the student does. Not a client concern, but a
  trap when seeding or creating exams.
- **Request bodies must carry a `Content-Length`.** Django's development server
  cannot parse a chunked request body — it reads the chunk-size line as a request
  line. `AuthenticatingHandler` buffers every body, and `RefreshEndpoint`
  serialises to a string rather than posting `JsonContent`.

## A backend fault this work uncovered

**Saving an `Exam` raises `AttributeError` and returns 500.**
`notifications/signals.py` has a `post_save` receiver on `Exam` that reads
`instance.is_published` — a field `Exam` does not have and never had. The only
`is_published` in the codebase belongs to `store.App`. The receiver is
registered in `NotificationsConfig.ready()`, so it fires on every save.

Introduced in `b27a536` ("Implement Expo Push Notification system without
Firebase"). Reproduced against unmodified code: creating an exam through the
ORM crashes, which means `/api/exams/create/` and every exam edit do too.

The fix is one word — `is_published` → `is_active` — but it is a production
change and not this client's to make, so it is reported rather than applied.
The seed script disconnects the receiver locally instead of patching it.

## Not done yet

- Fonts. The design calls for Cairo and Tajawal at 400/500/700, bundled rather
  than fetched at runtime. `MauiProgram` still registers the template's OpenSans
  faces, because registering a font file that is not present fails at startup.
- Screens. Only the auth layer and the platform seams exist so far.
- `MacDeviceIdentityProvider` reads `IOPlatformUUID` by shelling out to `ioreg`,
  which the Mac Catalyst sandbox may block. Unverified on hardware. The fallback
  is IOKit P/Invoke, which is sandbox-safe.
