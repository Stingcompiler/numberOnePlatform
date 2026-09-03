"""
================================================================================
academic/tests_lesson_player.py
================================================================================
صفحة المشغّل: تعطيل واجهة يوتيوب، والاتجاه، والتحقق من معرّف الفيديو.

ثلاث شكاوى من الاستخدام الفعلي:

  - أيقونات يوتيوب تعمل. شعار «مشاهدة على YouTube» يفتح الموقع، والمشاركة
    والحفظ لوقت لاحق وبطاقة القناة كلها قابلة للنقر — أي أن الطالب يخرج من
    المحاضرة إلى يوتيوب بنقرة، وإلى فيديوهات مقترحة عند الإيقاف.

  - النصوص تظهر معكوسة. نافذة التطبيق RTL، وويندوز يعكس محتوى WebView2 الوارث
    للاتجاه، فتُقرأ الكتابة على السبورة من اليسار.

الـ iframe عبر أصل مختلف فلا يمكن إخفاء أزرار يوتيوب بـ CSS؛ الوسيلة الوحيدة
هي تعطيل ما يمكن تعطيله بمعاملات المشغّل، وتغطية الباقي بطبقة تبتلع النقر،
وقيادة التشغيل عبر IFrame API الذي يعمل بـ postMessage لا بالنقر.

هذه الاختبارات تحرس ذلك: أي تعديل يعيد شريط يوتيوب أو يسقط الدرع يسقط هنا.
================================================================================
"""

from django.test import TestCase


class LessonPlayerTests(TestCase):

    URL = "/api/academic/player/"

    def _page(self, video_id="dQw4w9WgXcQ"):
        res = self.client.get(self.URL, {"v": video_id})
        self.assertEqual(res.status_code, 200)
        return res.content.decode("utf-8")

    # ── تعطيل واجهة يوتيوب ───────────────────────────────────────────────────

    def test_the_player_is_created_without_youtube_controls(self):
        """
        ‎controls=0‎ يُسقط شريط يوتيوب كله — وهو ما يحمل الشعار والمشاركة
        و«الحفظ لوقت لاحق».
        """
        page = self._page()

        self.assertIn("controls: 0", page)

    def test_keyboard_shortcuts_and_fullscreen_are_off(self):
        """
        اختصارات يوتيوب تفتح قوائم وتنقل بين الفيديوهات، وملء الشاشة يكسر
        سطح العرض المثبّت عند ٩٢٠×٥١٨.
        """
        page = self._page()

        self.assertIn("disablekb: 1", page)
        self.assertIn("fs: 0", page)

    def test_related_videos_and_annotations_are_off(self):
        """
        بدون ‎rel: 0‎ يعرض يوتيوب شبكة فيديوهات من قنوات أخرى عند الإيقاف،
        داخل محاضرة مدرسية.
        """
        page = self._page()

        self.assertIn("rel: 0", page)
        self.assertIn("iv_load_policy: 3", page)
        self.assertIn("modestbranding: 1", page)

    def test_a_shield_covers_the_frame_so_nothing_of_youtube_is_clickable(self):
        """
        الحارس الأهم. المعاملات وحدها لا تكفي: يوتيوب يعيد إظهار العنوان
        والشعار في حالات (الإيقاف، تمرير المؤشر)، ولا يمكن إخفاؤها بـ CSS عبر
        أصل مختلف. الطبقة هي ما يجعلها غير قابلة للوصول فعلياً.
        """
        page = self._page()

        self.assertIn('id="shield"', page)
        self.assertIn("#shield { position: absolute; inset: 0;", page)

    def test_playback_is_driven_through_the_api_not_through_clicks(self):
        """
        بما أن الدرع يبتلع النقر، لا بد أن يكون التشغيل عبر الـ API — وإلا
        صار الفيديو غير قابل للتشغيل أصلاً.
        """
        page = self._page()

        self.assertIn("iframe_api", page)
        self.assertIn("playVideo", page)
        self.assertIn("pauseVideo", page)

    def test_the_page_never_links_out_to_youtube(self):
        """لا رابط خروج: لا anchor إلى يوتيوب في الصفحة إطلاقاً."""
        page = self._page()

        self.assertNotIn("<a ", page)
        self.assertNotIn("youtube.com/watch", page)

    def test_the_context_menu_is_blocked(self):
        """قائمة يوتيوب بالزر الأيمن تحمل «نسخ رابط الفيديو»."""
        page = self._page()

        self.assertIn('oncontextmenu="return false"', page)

    # ── الاتجاه ──────────────────────────────────────────────────────────────

    def test_the_document_is_explicitly_left_to_right(self):
        """
        سبب ظهور النص معكوساً. النافذة RTL، وWebView2 يرث الاتجاه ويعكس ما
        يرسمه — بما فيه صورة الفيديو. محاضرة رياضيات بمعادلات مقلوبة غير
        قابلة للقراءة، فهذا ليس أمراً شكلياً.
        """
        page = self._page()

        self.assertIn('<html dir="ltr"', page)
        self.assertIn("direction: ltr", page)

    # ── التحقق من المعرّف ────────────────────────────────────────────────────

    def test_a_valid_id_reaches_the_player(self):
        page = self._page("abc123XYZ_-")

        self.assertIn('VIDEO_ID = "abc123XYZ_-"', page)

    def test_a_malformed_id_is_refused_rather_than_printed(self):
        for bad in ('"; alert(1); //', "../../etc/passwd", "<script>", "", "ab"):
            with self.subTest(bad=bad):
                res = self.client.get(self.URL, {"v": bad})
                self.assertEqual(res.status_code, 400)

    def test_the_page_cannot_be_framed_elsewhere(self):
        res = self.client.get(self.URL, {"v": "dQw4w9WgXcQ"})

        self.assertEqual(res["X-Frame-Options"], "SAMEORIGIN")

    def test_the_page_needs_no_session(self):
        """
        لا تكشف شيئاً: المعرّف يصل العميل أصلاً، والصفحة لا تقرأ قاعدة
        البيانات. اشتراط المصادقة كان سيمنع الـ WebView الذي لا يحمل الترويسة.
        """
        res = self.client.get(self.URL, {"v": "dQw4w9WgXcQ"})

        self.assertEqual(res.status_code, 200)
