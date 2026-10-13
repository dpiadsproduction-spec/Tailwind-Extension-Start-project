# Tailwind Starter — تطوير شامل (v0.1.0) — وثيقة التصميم

- التاريخ: 2026-10-13
- الحالة: معتمدة (بانتظار مراجعة المستخدم النهائية)
- النطاق: تطوير شامل لإضافة VS Code / Void الحالية `tailwind-starter` من الإصدار 0.0.16 إلى 0.1.0.

## 1) الهدف والخلفية

الإضافة الحالية تعمل بكفاءة، لكنها:
- مبنية في ملف واحد ضخم (`src/extension.ts`، 2199 سطرًا) يصعب صيانته وتوسيعه.
- تدعم Tailwind v3 فقط، بينما الإصدار الأخير v4 غيّر المعمار جذريًا.
- تحتوي مشاكل موثّقة (زر watch وهمي وكود ميت، تعارض إصدار `package-lock.json`، غياب تنقية أوامر shell، ظهور شريط الحالة دائمًا، غياب CSP).

الهدف: ترقية الإضافة إلى معمارية وحدات نظيفة، تدعم v3 وv4 مع كشف تلقائي، وتضيف سبع ميزات مطلوبة مع رفع مستوى الأمان والموثوقية، دون كسر السلوك العامل الحالي.

### قرارات المستخدم المعتمدة
1. دعم v3 وv4 مع كشف تلقائي.
2. الميزات المطلوبة: Multi-root، content ذكي حسب الإطار، تشخيص لحظي، مكتبة قوالب، Unlink، watch حقيقي، إعادة هيكلة إلى وحدات.
3. اختبارات وحدة للمنطق النقي فقط (بلا تشغيل VSCode).
4. الترقية v3→v4 بأمر صريح فقط + نسخة احتياطية.
5. الإصدار النهائي 0.1.0، بناء VSIX محلي فقط (لا رفع GitHub في هذه المرحلة).

## 2) قرار المعمار

المعمار المعتمد: **Adapter + تفكيك موجّه** (الطريقة ج).

- نحافظ على السلوك العامل ولا نعيد كتابة ما يعمل؛ نعيد ترتيبه في وحدات.
- فرق v3/v4 معزول خلف واجهة `TailwindAdapter` واحدة، فلا تتكرر شروط `if` في كل وحدة.
- كل ميزة جديدة تصبح وحدة قائمة بذاتها قابلة للاختبار والاستبدال.

البديلان المرفوضان: الترقيع في المكان (يزيد تعقيد الملف الضخم)، وإعادة الكتابة من الصفر (خطر انحدار مرتفع).

## 3) بنية الوحدات

```
src/
  extension.ts              # activate/deactivate + تسجيل الأوامر والخدمات فقط
  core/
    state.ts                # OutputChannel, StatusBar, الأعلام (building/scaffolding/...)
    paths.ts                # sanitizeRelPath, relativeHref, resolveHref, dirOf, relOf
    fs-util.ts              # fileExists, writeFile, createFileIfMissing
    result.ts               # نوع موحّد للنتائج/الأخطاء
  workspace/
    workspace.ts            # اختيار الجذر، المطابقة، دعم Multi-root
  tailwind/
    adapter.ts              # الواجهة + مصنع الاختيار حسب الإصدار
    adapter-v3.ts
    adapter-v4.ts
    detect.ts               # كشف الإصدار + كشف الإطار + isTailwindProject
    framework.ts            # كشف Vite/Next/Nuxt/Angular/... وتوليد content
    plan.ts                 # getBuildPlan / targets / isGeneratedCss
    build.ts                # buildNow عبر spawn
    watch.ts                # watch حقيقي مُدار
    imports.ts              # managed imports, page-scoped, add/remove import
    templates.ts            # قوالب HTML/CSS/JS الأساسية
    pages-library.ts        # مكتبة قوالب الصفحات الجاهزة
  explorer/
    entry.ts                # CleanEntry
    provider.ts             # CleanExplorerProvider
    dnd.ts                  # السحب والإفلات
    actions.ts              # new/rename/delete/move + resync
  commands/
    create-project.ts       # webview + scaffolding
    create-page.ts          # + اختيار قالب
    check-project.ts
    link-asset.ts           # Link + Unlink
    upgrade.ts              # ترقية v3 -> v4 بأمر صريح + backup
  diagnostics/
    provider.ts             # تشخيص لحظي أثناء الكتابة + Code Actions
    build-diagnostics.ts    # أخطاء مخرجات البناء
  webview/
    panel.ts                # إنشاء اللوحة + CSP
    html.ts                 # HTML/JS للواجهة
```

قواعد ملزمة:
- كل وحدة < ~300 سطر ومسؤولية واحدة.
- `extension.ts` بلا منطق، تسجيل فقط.
- الوحدات النقية (`paths`, `plan`, `imports`, `detect`, `adapter.*`) لا تستورد `vscode` قدر الإمكان لتكون قابلة للاختبار بـ node.

## 4) طبقة Tailwind (v3 / v4)

### الكشف (`detect.ts`) بالترتيب
1. وجود `node_modules/@tailwindcss/cli` → v4.
2. وجود `node_modules/tailwindcss` مع فحص الإصدار الرئيسي من `package.json` → 3 أو 4.
3. استنتاج من محتوى CSS: `@import "tailwindcss"` → v4، `@tailwind base` → v3.
4. الافتراضي: اختيار المستخدم عند الإنشاء (v4 للأحدث، v3 للتوافق).

### واجهة الـ Adapter
```
interface TailwindAdapter {
  major(): 3 | 4;
  cliPackage(): string;                   // tailwindcss | @tailwindcss/cli
  buildArgs(input, output): string[];     // مصفوفة وسائط آمنة بلا shell
  entryDirectives(): string;              // @tailwind base/components/utilities | @import "tailwindcss";
  usesJsConfig(): boolean;                // v3: true | v4: false (إلا لو @config صريح)
  contentDetection(): 'config' | 'auto';  // v3: config | v4: auto
  detectApplyErrorNeedsReference(text): boolean;
}
```

### فروق مؤكدة من الوثائق الرسمية (v4.3)
| القدرة | v3 | v4 |
|---|---|---|
| حزمة CLI | `tailwindcss` | `@tailwindcss/cli` |
| الإدخال | `@tailwind base/components/utilities;` | `@import "tailwindcss";` |
| config | `tailwind.config.js` (content) | لا ملف؛ `@theme`/`@source` في CSS |
| كشف المحتوى | من config | تلقائي (يتجاهل node_modules/.gitignore/CSS/lock) |
| `@apply` في ملف مستورد عبر `@import` داخل input.css | يعمل | يعمل (نفس الحزمة) |

### قرار `@reference` (مبني على البحث)
`@reference` **لا تُطلب** لملف يُستورد عبر `@import` داخل `input.css` (نفس الحزمة). تُطلب فقط للأنماط المُحزَّمة منفصلة (CSS modules، كتل `<style>` في Vue/Svelte/Astro).
الحل: **لا نضيف `@reference` تلقائيًا**. بل نجعله **إصلاحًا ذكيًا عند الفشل فقط**: إذا فشل البناء بخطأ `@apply` في v4، تعرض الأداة Code Action/إصلاحًا بضغطة يضيف `@reference` للملف المعني. يخدم الحالات النادرة دون إثقال المشاريع العادية.

### تأثير v4 على المنطق القائم
- `ensureTailwindConfig`: v3 ينشئ/يحدّث `tailwind.config.js`؛ v4 يتخطى (config اختياري فقط لو `@config` صريح).
- `checkProjectFlow` (v4): يصلح `@import "tailwindcss"` الناقص، لا يفحص content.
- أوامر البناء تُبنى عبر الـ Adapter لا نص ثابت.

## 5) الميزات السبع

1. **Multi-root workspace** — خدمة `workspace.ts`:
   - عند تنفيذ أمر مع أكثر من جذر: قائمة سريعة لاختيار المشروع (يتذكر آخر اختيار).
   - للحفظ/المراقبة: مطابقة الملف مع الجذر الذي يحتويه (`getWorkspaceFolder`).
   - يمنع فساد مشروع بآخر.

2. **content أذكى حسب الإطار** — `framework.ts`:
   - الكشف من `package.json` + ملفات الإعداد: Vite/Next/Nuxt/Angular/Vue-CLI/Astro/SvelteKit.
   - v3: توليد `content` مناسب (مثال Next: `./app`, `./pages`, `./components`؛ Vite: `./index.html`, `./src/**`؛ Angular: `./src/**`).
   - v4: بلا config؛ إضافة `@source` فقط عند الحاجة لمسار خارج الكشف التلقائي.

3. **تشخيص لحظي أثناء الكتابة** — `diagnostics/provider.ts` يستمع لـ`onDidChangeTextDocument`:
   - تنبيه `@apply` داخل ملف `page-scoped` فورًا.
   - تنبيه `@apply` في v4 في سياق يحتاج `@reference` + Code Action يضيفه.
   - تنبيه `@tailwind` في مشروع v4 أو `@import "tailwindcss"` في مشروع v3.

4. **مكتبة قوالب جاهزة** — `pages-library.ts` + أمر فرعي داخل Create Page:
   - قوالب: أساسية، Hero، Header+نافبار، Footer، Cards، Form/Contact، Pricing، Dashboard grid، 404.
   - كل قالب HTML بكلاسات Tailwind، مع CSS/JS اختياريين مربوطين صحيحًا.

5. **Unlink** — عكس Link File to Page:
   - إزالة `<link>`/`<script>` المطابق من HTML، وتصفير `@import` إن وُجد.
   - يظهر في سياق المستكشف النظيف بنفس منطق Link.

6. **watch حقيقي** — `build/watch.ts` عبر `child_process.spawn` مُدار (قابل للإلغاء، مربوط بعمر النافذة والجذر الصحيح)، يدعم أهداف `targets` المتعددة. يسدّ الكود الميت `getWatchTerminal`.

7. **إعادة الهيكلة إلى وحدات** — كما في القسم 3.

## 6) الأمان والموثوقية (ملزم)

- استبدال `exec` ذي الـshell بـ `spawn(cmd, args)` بلا shell → يستحيل حقن الأوامر عبر `targets` من مستودع مستنسخ.
- تنقية صارمة للمسارات في `sanitizeRelPath` + رفض المحارف الخطرة.
- Workspace Trust: منع الأوامر المدمّرة/التثبيت في وضع Untrusted.
- زر watch: يعمل فعليًا أو يُحذف — لا كود ميت.
- شريط الحالة مشروط بـ`isTailwindProject`.
- CSP لِلـwebview.
- توحيد الإصدار في `package-lock.json` مع `package.json`.
- مصدر واحد للأخطاء من البناء بلا ازدواج.

## 7) الترقية v3 → v4

- كشف الإصدار فورًا، ولا تغيير تلقائي لمشاريع v3.
- أمر صريح `Tailwind Starter: Upgrade to v4`:
  - ينشئ نسخة احتياطية (مجلد `.tailwind-starter-backup/<timestamp>/`) لـ`input.css` و`tailwind.config.js`.
  - يحدّث التبعيات إلى `tailwindcss@4` + `@tailwindcss/cli@4`.
  - يحوّل `input.css` إلى `@import "tailwindcss";`.
  - ينقل إعدادات theme من config إلى `@theme` (قدر الإمكان).
  - يبلّغ المستخدم بمراجعة الفروق يدويًا (كأداة Tailwind الرسمية).

## 8) الاختبارات والتحزيم

- اختبارات وحدة (node:test) للمنطق النقي: `paths`, `imports`, `detect`, `plan`, `adapter`, `framework`. لا تشغيل VSCode.
- سكربتات `package.json`: `compile` (tsc)، `test`، `package` (vsce).
- الإصدار النهائي 0.1.0؛ الناتج `tailwind-starter-0.1.0.vsix` محليًا.
- التوافق: `engines.vscode ^1.74.0` (Void مبني على VS Code)، وتجنّب APIs أحدث من ذلك.

## 9) معايير القبول

- `npm run compile` ينجح بلا أخطاء.
- اختبارات الوحدة تمر.
- إنشاء مشروع v4 جديد يعمل، وإنشاء مشروع v3 يعمل، والكشف التلقائي صحيح.
- Create Page بالأنواع الثلاثة يعمل في v3 وv4.
- Link وUnlink يعملان.
- watch حقيقي يعمل ويُلغى بنظافة.
- التشخيص اللحظي يظهر `@apply` الخاطئ قبل الحفظ.
- Multi-root يوجه الأوامر للجذر الصحيح.
- لا كود ميت، ولا شريط حالة في غير مشروع Tailwind.
- بناء VSIX ناجح وقابل للتثبيت.

## 10) خارج النطاق (خارج هذه المرحلة)

- معاينة الصفحة داخل المحرر.
- رفع الكود/الـVSIX إلى GitHub أو Marketplace.
- دعم preprocessors (Sass/Less) — غير مدعوم في v4 أصلاً.
