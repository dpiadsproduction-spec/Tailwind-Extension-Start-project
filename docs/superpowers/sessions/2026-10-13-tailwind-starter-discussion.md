# سجل المناقشة — تطوير Tailwind Starter (v0.1.0)

- التاريخ: 2026-10-13
- الموضوع: تطوير شامل لإضافة `tailwind-starter` من 0.0.16 إلى 0.1.0
- الحالة: مناقشة مكتملة، التصميم معتمد، التنفيذ بدأ.

## 1) طلب المستخدم الأولي

تقرير كامل عن الإضافة الحالية (v0.0.16) يشرح:
- Create Project (`Ctrl+Alt+T`)، Create Page (`Ctrl+Alt+P`، ثلاثة أنواع CSS)، Link File to Page، Check & Fix Project (`Ctrl+Alt+F`)، Rebuild Now (`Ctrl+Alt+B`)، Clean Explorer، Auto Mode.
- كيف تعمل داخليًا: استيرادات مُدارة في `input.css`، وسم `page-scoped`، ملفات مُولَّدة، حساب المسارات النسبية.
- التحديات المحلولة: `kind` محجوز في `QuickPickItem`، `@apply` في ملف خاص، المسارات العميقة، النقل/الحذف، 403 على GitHub.
- أفكار للتطوير: دعم v4، معاينة أخطاء `@apply`، Unlink، قوالب جاهزة، content أذكى.

طلب: دراسة المستودع وإخباره بتقرير عنه.

## 2) نتيجة الدراسة (فحص كود فعلي + بناء)

- `src/extension.ts` = 2199 سطرًا في ملف واحد.
- `npm install` ثم `npx tsc -p ./ --noEmit` → نجح (`EXIT=0`).
- ملاحظات مؤكدة:
  1. خيار `startWatch` وهمي: ينفّذ `buildNow` لمرة واحدة؛ والدالة `getWatchTerminal` معرّفة ولا تُستدعى (كود ميت).
  2. تعارض إصدار: `package-lock.json` = 0.0.1 مقابل `package.json` = 0.0.16.
  3. سطح حقن أوامر: `exec` مع shell؛ `sanitizeRelPath` لا ينقّي محارف shell و`targets` قابلة للتعديل من مستودع مستنسخ.
  4. `ensureWatchScript` يضمن وجود السكربت لا صلاحيته.
  5. شريط الحالة يظهر دائمًا حتى خارج مشروع Tailwind.
  6. Webview بلا CSP.
  7. مقارنات مسارات حساسة لحالة الأحرف في `relativeHref`.

## 3) أسئلة التوضيح وأجوبة المستخدم

| # | السؤال | الجواب |
|---|---|---|
| 1 | إستراتيجية إصدار Tailwind | دعم v3 وv4 مع كشف تلقائي |
| 2 | الميزات المطلوبة | Multi-root، content ذكي حسب الإطار، تشخيص لحظي، مكتبة قوالب، Unlink، watch حقيقي، إعادة هيكلة إلى وحدات |
| 3 | ضمان الجودة | اختبارات وحدة للمنطق النقي فقط |
| 4 | سياسة الترقية v3→v4 | بأمر صريح فقط + نسخة احتياطية |
| 5 | الإصدار والمخرجات | 0.1.0 + VSIX محلي فقط (لا رفع GitHub آنذاك) |

## 4) دراسة البدائل (اختيار المعمار)

- أ) ترقيع في المكان: يزيد تشعّب الملف الضخم — مرفوض.
- ب) إعادة كتابة كاملة: خطر انحدار مرتفع على نسخة عاملة — مرفوض.
- ج) **Adapter + تفكيك موجّه** (المعتمد): حفظ السلوك العامل + عزل فرق v3/v4 خلف واجهة `TailwindAdapter` + وحدات منفصلة قابلة للاختبار.

## 5) بحث الوثائق الرسمية (Tailwind v4.3)

مصادر: upgrade-guide، functions-and-directives، detecting-classes-in-source-files.

حقائق مؤكدة:
- CLI في v4 = `@tailwindcss/cli`؛ الأمر `npx @tailwindcss/cli -i ... -o ...`.
- v4: `@import "tailwindcss";` بدل `@tailwind base/components/utilities`.
- v4 تكشف الملفات تلقائيًا (تتجاهل node_modules/.gitignore/CSS/lock)؛ `content` غير مطلوب.
- v4 تدعم `@config` (توافق) و`@theme`/`@utility`/`@source`.
- أداة الترقية الرسمية: `npx @tailwindcss/upgrade`.

تصحيح قرار: `@reference` تُطلب فقط للأنماط المُحزَّمة منفصلة (CSS modules، `<style>` في Vue/Svelte/Astro)، **لا** لملف يُستورد عبر `@import` داخل `input.css`. لذلك:
- لا نضيف `@reference` تلقائيًا.
- نجعله **إصلاحًا ذكيًا عند فشل البناء فقط**.

## 6) قرارات التصميم المعتمدة

- معمار Adapter + وحدات (~21 ملفًا تحت `src/`).
- أمان: `spawn` بلا shell، تنقية صارمة، Workspace Trust، CSP، شريط حالة مشروط.
- الميزات السبع المدرجة كوحدات قابلة للاختبار.
- اختبارات وحدة لِـ paths/imports/detect/plan/adapter/framework.
- الترقية بأمر صريح + نسخة احتياطية.
- الإصدار 0.1.0، VSIX محلي.

## 7) المخرجات

- وثيقة التصميم: `docs/superpowers/specs/2026-10-13-tailwind-starter-overhaul-design.md` (كوميت `6ee1fb5`).
- خطة التنفيذ: `docs/superpowers/plans/2026-10-13-tailwind-starter-overhaul.md`.
- هذا السجل.
