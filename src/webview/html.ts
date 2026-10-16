export interface WebviewAssets {
  cspSource: string;
  nonce: string;
}

export function getWebviewHtml(assets: WebviewAssets): string {
  const csp = [
    "default-src 'none'",
    "style-src " + assets.cspSource + " 'unsafe-inline'",
    "img-src " + assets.cspSource + ' data:',
    "font-src " + assets.cspSource,
    "script-src 'nonce-" + assets.nonce + "'"
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>إنشاء مشروع Tailwind</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      max-width: 640px;
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
    }
    h2 { margin-bottom: 8px; }
    .hint { opacity: 0.8; font-size: 12px; margin-bottom: 16px; }
    .card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .card h3 { margin: 0 0 10px 0; font-size: 14px; }
    .option { margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
    .row select {
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 6px;
    }
    .row input[type="text"] {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 6px 8px;
      direction: ltr;
      text-align: left;
    }
    button {
      padding: 7px 14px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      border-radius: 4px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn-danger {
      background: transparent;
      color: var(--vscode-errorForeground);
      border: 1px solid var(--vscode-errorForeground);
      padding: 5px 10px;
    }
    .toolbar { display: flex; gap: 8px; margin-bottom: 10px; }
    #createBtn { width: 100%; padding: 10px; font-size: 15px; font-weight: bold; }
    code { direction: ltr; unicode-bidi: embed; }
  </style>
</head>
<body>
  <h2>إنشاء مشروع Tailwind</h2>
  <div class="hint">اختر الإصدار وملفات البدء السريع، وأضف أي عدد من المجلدات والملفات بمسارات متداخلة (مثال: <code>src/components/header.html</code>).</div>

  <div class="card">
    <h3>إصدار Tailwind</h3>
    <div class="option">
      <input type="radio" name="major" id="major4" value="4" checked>
      <label for="major4">Tailwind v4 (مستحسن — <code>@import "tailwindcss"</code>)</label>
    </div>
    <div class="option">
      <input type="radio" name="major" id="major3" value="3">
      <label for="major3">Tailwind v3 (<code>@tailwind base/components/utilities</code>)</label>
    </div>
  </div>

  <div class="card">
    <h3>ملفات البدء السريع</h3>
    <div class="option">
      <input type="checkbox" id="quickSrc" checked>
      <label for="quickSrc">مجلد <code>src/</code></label>
    </div>
    <div class="option">
      <input type="checkbox" id="quickCss" checked>
      <label for="quickCss"><code>input.css</code> بتوجيهات Tailwind</label>
    </div>
    <div class="option">
      <input type="checkbox" id="quickHtml" checked>
      <label for="quickHtml"><code>index.html</code> مربوط بملف CSS</label>
    </div>
    <div class="option">
      <input type="checkbox" id="quickConfig" checked>
      <label for="quickConfig"><code>tailwind.config.js</code> (v3 فقط)</label>
    </div>
    <div class="option">
      <input type="checkbox" id="installTailwind" checked>
      <label for="installTailwind">فحص Tailwind وتثبيته تلقائيا إن لم يكن موجودا</label>
    </div>
    <div class="option">
      <input type="checkbox" id="startWatch" checked>
      <label for="startWatch">تشغيل المراقبة <code>--watch</code> تلقائيا</label>
    </div>
  </div>

  <div class="card">
    <h3>شجرة المجلدات والملفات المخصصة</h3>
    <div class="toolbar">
      <button class="btn-secondary" id="addFolderBtn">+ مجلد</button>
      <button class="btn-secondary" id="addFileBtn">+ ملف</button>
    </div>
    <div id="customList"></div>
    <div class="hint">اكتب المسار كاملا للتداخل، مثال مجلد: <code>assets/images/gallery</code> — مثال ملف: <code>assets/js/main.js</code></div>
  </div>

  <button id="createBtn">إنشاء المشروع</button>

  <script nonce="${assets.nonce}">
    const vscode = acquireVsCodeApi();
    const list = document.getElementById('customList');

    function addItem(type, value) {
      const row = document.createElement('div');
      row.className = 'row';

      const sel = document.createElement('select');
      const optFile = document.createElement('option');
      optFile.value = 'file';
      optFile.textContent = 'ملف';
      const optFolder = document.createElement('option');
      optFolder.value = 'folder';
      optFolder.textContent = 'مجلد';
      sel.appendChild(optFile);
      sel.appendChild(optFolder);
      sel.value = type;

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = type === 'folder' ? 'assets/images/gallery' : 'assets/js/main.js';
      input.value = value || '';
      sel.addEventListener('change', function() {
        input.placeholder = sel.value === 'folder' ? 'assets/images/gallery' : 'assets/js/main.js';
      });

      const del = document.createElement('button');
      del.className = 'btn-danger';
      del.textContent = 'X';
      del.addEventListener('click', function() { row.remove(); });

      row.appendChild(sel);
      row.appendChild(input);
      row.appendChild(del);
      list.appendChild(row);
    }

    document.getElementById('addFolderBtn').addEventListener('click', function() { addItem('folder', ''); });
    document.getElementById('addFileBtn').addEventListener('click', function() { addItem('file', ''); });

    addItem('folder', 'assets/images');
    addItem('file', 'assets/js/main.js');

    function getChecked(id) { return document.getElementById(id).checked; }

    document.getElementById('createBtn').addEventListener('click', function() {
      const items = [];
      const rows = list.querySelectorAll('.row');
      for (let i = 0; i < rows.length; i++) {
        const sel = rows[i].querySelector('select');
        const inp = rows[i].querySelector('input');
        const p = inp.value.trim();
        if (p) { items.push({ type: sel.value, path: p }); }
      }
      const majorEl = document.querySelector('input[name="major"]:checked');
      const data = {
        major: majorEl && majorEl.value === '3' ? 3 : 4,
        quickSrc: getChecked('quickSrc'),
        quickCss: getChecked('quickCss'),
        quickHtml: getChecked('quickHtml'),
        quickConfig: getChecked('quickConfig'),
        installTailwind: getChecked('installTailwind'),
        startWatch: getChecked('startWatch'),
        items: items
      };
      vscode.postMessage({ command: 'createProject', data: data });
    });
  </script>
</body>
</html>`;
}
