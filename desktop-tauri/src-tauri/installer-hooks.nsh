; يمنع التثبيت على جهاز افتراضي.
;
; يعمل قبل نسخ أي ملف (NSIS_HOOK_PREINSTALL)، فلا يبقى شيء على القرص عند الرفض.
;
; السبب نفسه الذي يرفض التشغيل: حماية الالتقاط تُطبَّق داخل النظام الضيف وتقرأ
; ناجحة، بينما يسجّل المضيف نافذة الضيف كاملة. فالتطبيق يعِد بما لا يستطيع
; الوفاء به هناك.
;
; ولماذا هنا وفي التطبيق معاً: التثبيت قد يجري على جهاز حقيقي ثم يُنسخ المجلد
; إلى جهاز افتراضي — مجلد من ملفين، وهو نسخٌ سهل. الفحص عند كل إقلاع هو الذي
; يمسك تلك الحالة، وهذا يمسك التثبيت المباشر.
;
; ملاحظة صريحة: هذه ليست حاجزاً أمام من يعرف كيف يخفي معالم جهازه الافتراضي.
; ترفع الأرضية، والعلامة المائية هي ما يبقى بعدها.
;
; ولا تُفحص البرامج المثبَّتة. نسخة أولى كانت ترفض عند وجود مفتاح خدمة تعريف
; ضيف — VBoxGuest وvmci وvmhgfs وvmmouse وprl_fs وnetkvm — فرفضت العملَ على
; حاسوب Lenovo فيزيائي يحمل تلك المفاتيح كلها لأن VirtualBox وVMware وQEMU
; مثبَّتة عليه كمُضيفات. مفتاحُ تعريف يصف ما ثبّته أحدهم، لا ما هو الجهاز.
; وأجهزة قسم تقنية المعلومات في المدارس هي بالضبط حيث تعيش تلك البرامج.
; لا تُعِدها.
;
; البحث عن النصّ مكتوب هنا يدوياً ولا يعتمد على StrFunc: تلك تتطلّب إعلاناً في
; المستوى الأعلى قبل الاستعمال، وهذا الملف يُضمَّن في موضع لا يضمنه. و‏StrCmp
; في NSIS غير حسّاسة لحالة الأحرف أصلاً، فالمقارنة تأتي مجاناً.

!macro NSIS_HOOK_PREINSTALL

  ; ── هوية العتاد ────────────────────────────────────────────────────────
  ; الضيف يكتب اسم مُصنّعه هنا.
  ReadRegStr $R0 HKLM "HARDWARE\DESCRIPTION\System\BIOS" "SystemManufacturer"
  Call CheckVirtualString

  ReadRegStr $R0 HKLM "HARDWARE\DESCRIPTION\System\BIOS" "SystemProductName"
  Call CheckVirtualString

  ReadRegStr $R0 HKLM "HARDWARE\DESCRIPTION\System\BIOS" "BaseBoardManufacturer"
  Call CheckVirtualString

  ; ── القرص المُحاكى ─────────────────────────────────────────────────────
  ReadRegStr $R0 HKLM "SYSTEM\CurrentControlSet\Services\Disk\Enum" "0"
  Call CheckVirtualString

!macroend

; يرفض إن حملت السلسلة في $R0 اسم مُحاكٍ.
;
; "Virtual Machine" هي ما يكتبه Hyper-V في اسم المنتج داخل الضيف. الجهاز
; الفيزيائي الذي يشغّل Hyper-V لا يكتبها عن نفسه — يكتب اسم مُصنّعه الحقيقي.
Function CheckVirtualString
  StrCmp $R0 "" done

  StrCpy $R3 "VMware"
  Call ContainsOrRefuse
  StrCpy $R3 "VirtualBox"
  Call ContainsOrRefuse
  StrCpy $R3 "innotek"
  Call ContainsOrRefuse
  StrCpy $R3 "QEMU"
  Call ContainsOrRefuse
  StrCpy $R3 "Bochs"
  Call ContainsOrRefuse
  StrCpy $R3 "Parallels"
  Call ContainsOrRefuse
  StrCpy $R3 "Virtual Machine"
  Call ContainsOrRefuse
  StrCpy $R3 "Virtual Platform"
  Call ContainsOrRefuse

  done:
FunctionEnd

; يرفض إن احتوى $R0 على $R3. المقارنة غير حسّاسة لحالة الأحرف.
Function ContainsOrRefuse
  Push $0   ; طول الإبرة
  Push $1   ; طول القشّ
  Push $2   ; الموضع
  Push $3   ; المقطع المستخرج

  StrLen $0 $R3
  StrLen $1 $R0
  StrCpy $2 0

  loop:
    IntCmp $2 $1 notfound notfound 0        ; تجاوزنا نهاية النصّ
    IntOp $3 $2 + $0
    IntCmp $3 $1 0 0 notfound               ; لم يبقَ ما يكفي لمطابقة الإبرة

    StrCpy $3 $R0 $0 $2
    StrCmp $3 $R3 found 0                   ; StrCmp غير حسّاسة للحالة

    IntOp $2 $2 + 1
    Goto loop

  found:
    Pop $3
    Pop $2
    Pop $1
    Pop $0
    Call RefuseVirtual
    Return

  notfound:
    Pop $3
    Pop $2
    Pop $1
    Pop $0
FunctionEnd

Function RefuseVirtual
  ; صامت أثناء التثبيت الصامت: صندوق حوار لا أحد أمامه يعلّق نشر معمل كامل.
  IfSilent +2
    MessageBox MB_ICONSTOP|MB_OK "لا يمكن تثبيت التطبيق على جهاز افتراضي.$\r$\n$\r$\nيُشغَّل هذا التطبيق على الأجهزة الحقيقية فقط، لأن حماية المحاضرات من التسجيل لا تعمل داخل جهاز افتراضي.$\r$\n$\r$\nإن كنت تستخدم حاسوب المدرسة، يرجى التواصل مع إدارة المدرسة."

  SetErrorLevel 1
  Abort
FunctionEnd
