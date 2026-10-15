export type PageTemplateId =
  | 'basic'
  | 'hero'
  | 'header'
  | 'footer'
  | 'cards'
  | 'form'
  | 'pricing'
  | 'dashboard'
  | 'notfound';

export interface PageTemplate {
  id: PageTemplateId;
  label: string;
  description: string;
  body(title: string): string;
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const NAV = `  <header class="bg-white shadow">
    <nav class="mx-auto flex max-w-6xl items-center justify-between p-4">
      <a href="#" class="text-xl font-bold text-blue-600">Brand</a>
      <ul class="flex gap-6 text-sm font-medium text-gray-600">
        <li><a href="#" class="hover:text-blue-600">الرئيسية</a></li>
        <li><a href="#" class="hover:text-blue-600">المميزات</a></li>
        <li><a href="#" class="hover:text-blue-600">الأسعار</a></li>
        <li><a href="#" class="hover:text-blue-600">تواصل</a></li>
      </ul>
    </nav>
  </header>`;

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'basic',
    label: 'صفحة أساسية',
    description: 'عنوان وفقرة تمهيدية',
    body: (title) =>
      `  <main class="mx-auto max-w-3xl px-6 py-16">
    <h1 class="mb-4 text-4xl font-bold tracking-tight text-gray-900">${esc(title)}</h1>
    <p class="text-lg leading-relaxed text-gray-600">ابدأ الكتابة هنا. استبدل هذا النص بمحتواك.</p>
  </main>`
  },
  {
    id: 'hero',
    label: 'Hero',
    description: 'قسم ترحيبي بعنوان وأزرار',
    body: (title) =>
      `  <main class="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center">
    <h1 class="mb-6 text-5xl font-extrabold tracking-tight text-gray-900">${esc(title)}</h1>
    <p class="mb-8 max-w-2xl text-xl text-gray-600">حل بسيط وسريع لبناء واجهات جميلة باستخدام Tailwind CSS.</p>
    <div class="flex gap-4">
      <a href="#" class="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">ابدأ الآن</a>
      <a href="#" class="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50">اعرف المزيد</a>
    </div>
  </main>`
  },
  {
    id: 'header',
    label: 'هيدر + نافبار',
    description: 'شريط تنقل علوي جاهز',
    body: (title) =>
      `${NAV}
  <main class="mx-auto max-w-6xl px-6 py-16">
    <h1 class="mb-4 text-3xl font-bold text-gray-900">${esc(title)}</h1>
    <p class="text-gray-600">محتوى الصفحة مع شريط التنقل.</p>
  </main>`
  },
  {
    id: 'footer',
    label: 'فوتر',
    description: 'تذييل بأعمدة وروابط',
    body: (title) =>
      `  <main class="mx-auto max-w-6xl px-6 py-16">
    <h1 class="text-3xl font-bold text-gray-900">${esc(title)}</h1>
  </main>
  <footer class="border-t bg-gray-50">
    <div class="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-3">
      <div>
        <h3 class="mb-3 font-bold text-gray-900">الشركة</h3>
        <p class="text-sm text-gray-600">وصف قصير عن الشركة أو المشروع.</p>
      </div>
      <div>
        <h3 class="mb-3 font-bold text-gray-900">روابط</h3>
        <ul class="space-y-2 text-sm text-gray-600">
          <li><a href="#" class="hover:text-blue-600">من نحن</a></li>
          <li><a href="#" class="hover:text-blue-600">الخدمات</a></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 font-bold text-gray-900">تواصل</h3>
        <p class="text-sm text-gray-600">info@example.com</p>
      </div>
    </div>
  </footer>`
  },
  {
    id: 'cards',
    label: 'بطاقات',
    description: 'شبكة بطاقات متجاوبة',
    body: (title) =>
      `  <main class="mx-auto max-w-6xl px-6 py-16">
    <h1 class="mb-10 text-3xl font-bold text-gray-900">${esc(title)}</h1>
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div class="rounded-xl border bg-white p-6 shadow-sm">
        <h2 class="mb-2 text-lg font-semibold text-gray-900">بطاقة 1</h2>
        <p class="text-sm text-gray-600">وصف مختصر للميزة الأولى.</p>
      </div>
      <div class="rounded-xl border bg-white p-6 shadow-sm">
        <h2 class="mb-2 text-lg font-semibold text-gray-900">بطاقة 2</h2>
        <p class="text-sm text-gray-600">وصف مختصر للميزة الثانية.</p>
      </div>
      <div class="rounded-xl border bg-white p-6 shadow-sm">
        <h2 class="mb-2 text-lg font-semibold text-gray-900">بطاقة 3</h2>
        <p class="text-sm text-gray-600">وصف مختصر للميزة الثالثة.</p>
      </div>
    </div>
  </main>`
  },
  {
    id: 'form',
    label: 'نموذج تواصل',
    description: 'حقول نموذج مع زر إرسال',
    body: (title) =>
      `  <main class="mx-auto max-w-xl px-6 py-16">
    <h1 class="mb-8 text-3xl font-bold text-gray-900">${esc(title)}</h1>
    <form class="space-y-5">
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">الاسم</label>
        <input type="text" class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none">
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">البريد</label>
        <input type="email" class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none">
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium text-gray-700">الرسالة</label>
        <textarea rows="4" class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"></textarea>
      </div>
      <button type="submit" class="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700">إرسال</button>
    </form>
  </main>`
  },
  {
    id: 'pricing',
    label: 'الأسعار',
    description: 'ثلاث خطط اشتراك',
    body: (title) =>
      `  <main class="mx-auto max-w-6xl px-6 py-16">
    <h1 class="mb-10 text-center text-3xl font-bold text-gray-900">${esc(title)}</h1>
    <div class="grid gap-6 md:grid-cols-3">
      <div class="rounded-2xl border p-8">
        <h2 class="text-lg font-semibold text-gray-900">مجاني</h2>
        <p class="my-4 text-4xl font-extrabold text-gray-900">$0</p>
        <a href="#" class="block rounded-lg border border-gray-300 py-3 text-center font-semibold hover:bg-gray-50">ابدأ</a>
      </div>
      <div class="rounded-2xl border-2 border-blue-600 p-8 shadow-lg">
        <h2 class="text-lg font-semibold text-blue-600">احترافي</h2>
        <p class="my-4 text-4xl font-extrabold text-gray-900">$19</p>
        <a href="#" class="block rounded-lg bg-blue-600 py-3 text-center font-semibold text-white hover:bg-blue-700">اشترك</a>
      </div>
      <div class="rounded-2xl border p-8">
        <h2 class="text-lg font-semibold text-gray-900">مؤسسي</h2>
        <p class="my-4 text-4xl font-extrabold text-gray-900">$49</p>
        <a href="#" class="block rounded-lg border border-gray-300 py-3 text-center font-semibold hover:bg-gray-50">تواصل</a>
      </div>
    </div>
  </main>`
  },
  {
    id: 'dashboard',
    label: 'لوحة تحكم',
    description: 'تخطيط شبكي مع شريط جانبي',
    body: (title) =>
      `  <div class="flex min-h-screen">
    <aside class="w-60 bg-gray-900 p-6 text-gray-100">
      <h2 class="mb-6 text-lg font-bold">لوحة التحكم</h2>
      <ul class="space-y-3 text-sm">
        <li><a href="#" class="block rounded px-3 py-2 hover:bg-gray-800">النظرة العامة</a></li>
        <li><a href="#" class="block rounded px-3 py-2 hover:bg-gray-800">الطلبات</a></li>
        <li><a href="#" class="block rounded px-3 py-2 hover:bg-gray-800">الإعدادات</a></li>
      </ul>
    </aside>
    <main class="flex-1 bg-gray-100 p-8">
      <h1 class="mb-6 text-2xl font-bold text-gray-900">${esc(title)}</h1>
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-xl bg-white p-6 shadow-sm"><p class="text-sm text-gray-500">المستخدمون</p><p class="text-2xl font-bold">1,204</p></div>
        <div class="rounded-xl bg-white p-6 shadow-sm"><p class="text-sm text-gray-500">الطلبات</p><p class="text-2xl font-bold">312</p></div>
        <div class="rounded-xl bg-white p-6 shadow-sm"><p class="text-sm text-gray-500">الإيرادات</p><p class="text-2xl font-bold">$8,540</p></div>
      </div>
    </main>
  </div>`
  },
  {
    id: 'notfound',
    label: 'صفحة 404',
    description: 'صفحة خطأ جاهزة',
    body: (title) =>
      `  <main class="mx-auto flex max-w-xl flex-col items-center px-6 py-32 text-center">
    <p class="text-7xl font-extrabold text-blue-600">404</p>
    <h1 class="mt-4 text-2xl font-bold text-gray-900">${esc(title)}</h1>
    <p class="mt-2 text-gray-600">الصفحة التي تبحث عنها غير موجودة.</p>
    <a href="#" class="mt-8 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">العودة للرئيسية</a>
  </main>`
  }
];

export function findTemplate(id: PageTemplateId): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((t) => t.id === id);
}

export interface ComposeOptions {
  template: PageTemplate;
  title: string;
  lang?: string;
  bodyClass?: string;
  sharedHref: string;
  extraHref?: string;
  scriptHref?: string;
}

export function composePage(options: ComposeOptions): string {
  const lang = options.lang || 'en';
  const bodyClass = options.bodyClass || 'bg-gray-100';
  const extra = options.extraHref ? '\n  <link rel="stylesheet" href="' + options.extraHref + '">' : '';
  const script = options.scriptHref ? '\n  <script src="' + options.scriptHref + '" defer></script>' : '';
  const body = options.template.body(options.title);
  return (
    '<!DOCTYPE html>\n<html lang="' +
    lang +
    '">\n<head>\n  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>' +
    esc(options.title) +
    '</title>\n  <link rel="stylesheet" href="' +
    options.sharedHref +
    '">' +
    extra +
    '\n</head>\n<body class="' +
    bodyClass +
    '">\n' +
    body +
    script +
    '\n</body>\n</html>\n'
  );
}
