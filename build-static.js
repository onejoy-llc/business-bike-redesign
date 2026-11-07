// GitHub Pages 用に、全ページを静的HTMLとして dist/ に書き出す
// 使い方: BASE=/business-bike-redesign node build-static.js
// ※ 静的版では予約・お問い合わせの送信と管理画面は動作しません（表示確認用）
const fs = require('fs');
const path = require('path');
const views = require('./views');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const repo = (process.env.GITHUB_REPOSITORY || '').split('/')[1];
const BASE = (process.env.BASE ?? (repo ? `/${repo}` : '')).replace(/\/$/, '');
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'content.json'), 'utf8'));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// サイト内の絶対パス（/〜）を公開先のパスに合わせる
function rewrite(html) {
  return html
    .replace(/(href|src|action)="\/(?!\/)/g, `$1="${BASE}/`)
    .replace(/data-src="\/(?!\/)/g, `data-src="${BASE}/`)
    .replace(/data-img="\/(?!\/)/g, `data-img="${BASE}/`)
    .replace('<body class="', `<body data-static="1" data-base="${BASE}" class="`)
    // 本番サイトと検索結果が重複しないよう、確認用サイトは検索エンジンに載せない
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">');
}

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rewrite(html));
}

write('index.html', views.home(content));
for (const p of ['howto', 'price', 'service', 'faq', 'shop', 'contact', 'company', 'covenant', 'privacy', 'sitemap', 'reservation']) {
  write(`${p}/index.html`, views[p](content, {}));
}
for (const b of content.bikes || []) write(`bikes/${b.slug}/index.html`, views.bike(content, b));
write('404.html', views.notFound(content));

copyDir(path.join(ROOT, 'public'), OUT);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

const count = fs.readdirSync(OUT, { recursive: true }).filter(f => String(f).endsWith('.html')).length;
console.log(`dist/ に ${count} ページを書き出しました（BASE="${BASE || '/'}"）`);
