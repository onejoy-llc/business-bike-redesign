// ページテンプレート（サーバー側でHTMLを生成）
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const br = v => esc(v).replace(/\n/g, '<br>');
const tel = v => String(v || '').replace(/[^0-9]/g, '');
const yen = v => (v ? `¥${esc(v)}` : '—');
const num = v => Number(String(v || '').replace(/[^0-9]/g, '')) || 0;
const year = () => new Date().getFullYear();
const fs = require('fs');
const path = require('path');
const ver = f => { try { return Math.floor(fs.statSync(path.join(__dirname, 'public', f)).mtimeMs / 1000).toString(36); } catch { return '1'; } };

const NAV = [
  ['howto', 'ご利用案内'], ['price', '料金表'], ['service', 'サービス概要'],
  ['faq', 'よくある質問'], ['shop', '店舗情報'], ['contact', 'お問い合わせ']
];

const icon = {
  arrow: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>',
  phone: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.6 2.5 8.4 6.2 6.9 7.7a10.3 10.3 0 0 0 5.4 5.4l1.5-1.5 3.7 1.8-.6 3a1.4 1.4 0 0 1-1.5 1.1A14.4 14.4 0 0 1 2.5 4.6 1.4 1.4 0 0 1 3.6 3.1Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  cal: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4" stroke="currentColor" stroke-width="1.6"/></svg>',
  plus: '<svg class="i" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.6"/></svg>'
};

function minPrice(bike, key) {
  const vals = (bike.variants || []).map(v => num(v[key])).filter(Boolean);
  if (!vals.length) return '';
  const m = Math.min(...vals);
  return m.toLocaleString('ja-JP') + (vals.length > 1 ? '〜' : '');
}

function bikeImage(bike, cls = '') {
  if (!bike.image) return `<div class="noimg ${cls}"><span>画像準備中</span></div>`;
  return `<img class="${cls}" src="${esc(bike.image)}" alt="${esc(bike.name)}" loading="lazy" width="400" height="300">`;
}

function layout(c, { title, description, body, current = '', bodyClass = '' }) {
  const s = c.site || {};
  const pageTitle = title ? `${title}｜${s.name}` : s.title;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description || s.description)}">
<meta name="keywords" content="${esc(s.keywords)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(s.name)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(description || s.description)}">
<meta name="theme-color" content="#e21513">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/site.css?v=${ver('css/site.css')}">
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">本文へスキップ</a>
${s.notice ? `<div class="notice"><div class="wrap">${br(s.notice)}</div></div>` : ''}
<header class="hd" id="top">
  <div class="hd__in wrap">
    <a class="brand" href="/" aria-label="${esc(s.name)} トップページ">
      <span class="brand__mark"><img src="/img/logo.jpg" alt="" width="1171" height="140"></span>
      <span class="brand__txt"><b>${esc(s.name)}</b><small>${esc(s.tagline)}</small></span>
    </a>
    <nav class="gnav" id="gnav" aria-label="メインメニュー">
      <ul>${NAV.map(([k, l]) => `<li><a href="/${k}/"${current === k ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul>
      <div class="gnav__sp">
        <a class="gnav__tel" href="tel:${tel(s.phone)}">${icon.phone}<span>${esc(s.phone)}</span><small>受付 ${esc(s.hours)}</small></a>
      </div>
    </nav>
    <div class="hd__cta">
      <a class="hd__tel" href="tel:${tel(s.phone)}"><small>お電話受付 ${esc(s.hours)}</small><span>${esc(s.phone)}</span></a>
      <a class="btn btn--red btn--sm" href="/reservation/">Web予約</a>
    </div>
    <button class="menu-btn" type="button" aria-controls="gnav" aria-expanded="false"><span></span><span></span><b>MENU</b></button>
  </div>
</header>
<main id="main">
${body}
</main>
${footer(c)}
<div class="spbar">
  <a href="tel:${tel(s.phone)}">${icon.phone}電話する</a>
  <a href="/reservation/" class="is-red">${icon.cal}Web予約</a>
</div>
<script src="/js/site.js?v=${ver('js/site.js')}" defer></script>
</body>
</html>`;
}

function footer(c) {
  const s = c.site || {};
  return `<footer class="ft">
  <div class="wrap ft__grid">
    <div class="ft__brand">
      <p class="ft__name">${esc(s.name)}</p>
      <p class="ft__addr">〒${esc(s.zip)}<br>${esc(s.address)}</p>
      <a class="ft__tel" href="tel:${tel(s.phone)}">${esc(s.phone)}</a>
      <p class="ft__hours">お電話受付時間 ${esc(s.hours)}</p>
    </div>
    <nav class="ft__nav" aria-label="フッターメニュー">
      <p class="ft__h">Menu</p>
      <ul>
        <li><a href="/howto/">ご利用案内</a></li><li><a href="/price/">料金表</a></li>
        <li><a href="/service/">サービス概要</a></li><li><a href="/faq/">よくある質問</a></li>
        <li><a href="/shop/">店舗情報</a></li><li><a href="/reservation/">Web予約</a></li>
      </ul>
    </nav>
    <nav class="ft__nav" aria-label="会社情報">
      <p class="ft__h">Company</p>
      <ul>
        <li><a href="/company/">会社概要</a></li><li><a href="/covenant/">貸渡約款</a></li>
        <li><a href="/privacy/">個人情報保護方針</a></li><li><a href="/contact/">お問い合わせ</a></li>
        <li><a href="/sitemap/">サイトマップ</a></li>
      </ul>
    </nav>
    <div class="ft__nav">
      <p class="ft__h">Group</p>
      <ul>${(s.links || []).map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}<span class="ext">↗</span></a></li>`).join('')}</ul>
    </div>
  </div>
  <div class="wrap ft__bottom">
    <small>&copy; ${year()} ${esc(s.name)} All Rights Reserved.</small>
    <a href="#top" class="ft__totop">Page top</a>
  </div>
</footer>`;
}

function pageHead(en, ja, crumbs = [], lead = '') {
  const items = [['/', 'トップ'], ...crumbs];
  return `<section class="phead">
  <div class="wrap">
    <ol class="crumb">${items.map(([h, l]) => `<li>${h ? `<a href="${h}">${esc(l)}</a>` : esc(l)}</li>`).join('')}<li aria-current="page">${esc(ja)}</li></ol>
    <p class="phead__en">${esc(en)}</p>
    <h1>${esc(ja)}</h1>
    ${lead ? `<p class="phead__lead">${br(lead)}</p>` : ''}
  </div>
</section>`;
}

function secHead(no, en, title, extra = '') {
  return `<div class="sechead">
    <p class="label"><span>${no}</span>${esc(en)}</p>
    <h2>${br(title)}</h2>
    ${extra}
  </div>`;
}

function cta(c) {
  const s = c.site || {}, h = c.home || {};
  return `<section class="cta">
  <div class="wrap cta__in">
    <div>
      <p class="cta__en">Contact &amp; Reservation</p>
      <h2>${br(h.ctaTitle)}</h2>
      <p>${br(h.ctaText)}</p>
    </div>
    <div class="cta__act">
      <a class="cta__tel" href="tel:${tel(s.phone)}">${icon.phone}<span>${esc(s.phone)}</span></a>
      <p class="cta__hours">受付時間 ${esc(s.hours)}</p>
      <a class="btn btn--white" href="/reservation/">Webで予約する${icon.arrow}</a>
    </div>
  </div>
</section>`;
}

function bikeCard(b) {
  const d = minPrice(b, 'daily'), m = minPrice(b, 'monthly');
  return `<li class="card">
  <a href="/bikes/${esc(b.slug)}/">
    <div class="card__img">${bikeImage(b)}</div>
    <div class="card__body">
      <p class="card__meta">${esc(b.wheels)}<i></i>${esc(b.engine)}<i></i>${esc(b.cc)}</p>
      <h3>${esc(b.name)}</h3>
      <dl class="card__price">
        <div><dt>日額</dt><dd>${d ? `<span>¥</span>${d}` : '—'}</dd></div>
        <div><dt>月額</dt><dd>${m ? `<span>¥</span>${m}` : '—'}</dd></div>
      </dl>
      <span class="card__go">${icon.arrow}</span>
    </div>
  </a>
</li>`;
}

function steps(c, big = false) {
  const h = c.howto || {};
  return `<ol class="steps${big ? ' steps--big' : ''}">${(h.steps || []).map((s, i) => `<li>
    <p class="steps__no"><small>Step</small>${String(i + 1).padStart(2, '0')}</p>
    <h3>${esc(s.title)}</h3>
    <p>${br(s.text)}</p>
  </li>`).join('')}</ol>`;
}

function mapEmbed(s) {
  return `<div class="map"><iframe title="${esc(s.name)} 地図" src="https://maps.google.com/maps?q=${encodeURIComponent(s.mapQuery || s.address)}&z=16&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;
}

function shopInfo(s) {
  return `<dl class="info">
    <div><dt>店舗名</dt><dd>${esc(s.name)}</dd></div>
    <div><dt>住所</dt><dd>〒${esc(s.zip)}<br>${esc(s.address)}</dd></div>
    <div><dt>営業時間</dt><dd>${esc(s.hours)}</dd></div>
    <div><dt>電話番号</dt><dd><a href="tel:${tel(s.phone)}">${esc(s.phone)}</a></dd></div>
    <div><dt>使用可能エリア</dt><dd>${esc(s.area)}</dd></div>
  </dl>`;
}

// ---------- 各ページ ----------
exports.home = c => {
  const s = c.site || {}, h = c.home || {};
  const imgs = h.heroImages || [];
  const lines = String(h.heroTitle || '').split('\n');
  const bikes = (c.bikes || []).filter(b => b.top !== false);
  const svc = (c.service || []).slice(0, 8);
  const body = `
<section class="hero">
  <div class="wrap hero__grid">
    <div class="hero__txt">
      <p class="hero__eyebrow">${esc(h.eyebrow)}</p>
      <h1 class="hero__title">${lines.map((l, i) => `<span${i === lines.length - 1 ? ' class="em"' : ''}>${esc(l)}</span>`).join('')}</h1>
      <p class="hero__lead">${br(h.heroLead)}</p>
      <div class="hero__btns">
        <a class="btn btn--red" href="/reservation/">ビジネスバイクを予約する${icon.arrow}</a>
        <a class="btn btn--line" href="/price/">料金表を見る</a>
      </div>
    </div>
    <div class="hero__pics">
      ${imgs[0] ? `<figure class="p1"><img src="${esc(imgs[0])}" alt="ジャイロキャノピー" width="400" height="300"></figure>` : ''}
      ${imgs[1] ? `<figure class="p2"><img src="${esc(imgs[1])}" alt="" width="400" height="300"></figure>` : ''}
      ${imgs[2] ? `<figure class="p3"><img src="${esc(imgs[2])}" alt="" width="400" height="300"></figure>` : ''}
      <p class="hero__tag"><span>Since 2009</span>FUKUOKA / HAKATA</p>
    </div>
  </div>
  <div class="wrap">
    <ul class="facts">${(h.facts || []).map(f => `<li><b>${esc(f.value)}</b><span>${esc(f.label)}</span></li>`).join('')}</ul>
  </div>
</section>

<section class="sec" id="lineup">
  <div class="wrap">
    ${secHead('01', 'Line up', h.lineupTitle, '<a class="more" href="/price/">料金表を見る' + icon.arrow + '</a>')}
    <ul class="cards">${bikes.map(bikeCard).join('')}</ul>
    <p class="tax">表示料金はすべて税込です。日額は短期契約、月額は年間契約の料金です。</p>
  </div>
</section>

<section class="sec sec--paper">
  <div class="wrap">
    ${secHead('02', 'How to', `${(c.howto || {}).title}\n${(c.howto || {}).subtitle}`, '<a class="more" href="/howto/">ご利用案内を見る' + icon.arrow + '</a>')}
    ${steps(c)}
  </div>
</section>

<section class="sec sec--ink">
  <div class="wrap">
    ${secHead('03', 'Service', 'サービス概要', '<a class="more" href="/service/">詳しく見る' + icon.arrow + '</a>')}
    <ul class="svc">${svc.map(x => `<li><h3>${esc(x.title)}</h3><p>${esc((x.items || [])[0] || '')}</p></li>`).join('')}</ul>
    <div class="ins">
      <p class="ins__h">${esc((c.insurance || {}).title)}</p>
      <ul>${((c.insurance || {}).rows || []).map(r => `<li><span>${esc(r.label)}</span><b>${esc(r.value)}</b></li>`).join('')}</ul>
    </div>
  </div>
</section>

<section class="sec" id="shop">
  <div class="wrap">
    ${secHead('04', 'Shop', '店舗情報・アクセス')}
    <div class="shop">
      ${shopInfo(s)}
      ${mapEmbed(s)}
    </div>
  </div>
</section>
${cta(c)}`;
  return layout(c, { body, bodyClass: 'is-home' });
};

exports.howto = c => {
  const s = c.site || {}, h = c.howto || {};
  const body = `${pageHead('How to use', 'ご利用案内')}
<section class="sec">
  <div class="wrap">
    ${secHead('01', 'Flow', `${h.title}\n${h.subtitle}`)}
    ${steps(c, true)}
    <p class="center"><a class="btn btn--red" href="/reservation/">ビジネスバイクを予約する${icon.arrow}</a></p>
  </div>
</section>
<section class="sec sec--paper">
  <div class="wrap">
    ${secHead('02', 'Area & Access', '使用可能エリア・アクセス')}
    <div class="shop">${shopInfo(s)}${mapEmbed(s)}</div>
  </div>
</section>
${cta(c)}`;
  return layout(c, { title: 'ご利用案内', body, current: 'howto' });
};

exports.price = c => {
  const rows = [];
  (c.bikes || []).forEach(b => (b.variants || []).forEach((v, i) => rows.push({ b, v, first: i === 0 })));
  const body = `${pageHead('Price', '料金表', [], 'ビジネスバイク料金と付属品')}
<section class="sec">
  <div class="wrap">
    ${secHead('01', 'Price list', '車種と料金')}
    <div class="ptable" role="table" aria-label="車種と料金">
      <div class="ptable__head" role="row"><span role="columnheader">車種</span><span role="columnheader">タイプ</span><span role="columnheader">エンジン</span><span role="columnheader">日額<small>短期契約</small></span><span role="columnheader">月額<small>年間契約</small></span></div>
      ${rows.map(({ b, v }) => `<a class="ptable__row" role="row" href="/bikes/${esc(b.slug)}/">
        <span class="ptable__name" role="cell"><span class="ptable__thumb">${bikeImage(b)}</span><b>${esc(v.label)}</b></span>
        <span role="cell" data-l="タイプ">${esc(b.wheels)} / ${esc(b.cc)}</span>
        <span role="cell" data-l="エンジン">${esc(b.engine)}</span>
        <span role="cell" class="ptable__yen" data-l="日額">${v.daily ? yen(v.daily) : 'なし'}</span>
        <span role="cell" class="ptable__yen" data-l="月額">${v.monthly ? yen(v.monthly) : 'なし'}</span>
      </a>`).join('')}
    </div>
    <ul class="notes">${(c.priceNotes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul>
    <p class="center"><a class="btn btn--red" href="/reservation/">ビジネスバイクを予約する${icon.arrow}</a> <a class="btn btn--line" href="/service/">サービス概要を見る</a></p>
  </div>
</section>
${cta(c)}`;
  return layout(c, { title: '料金表', body, current: 'price' });
};

exports.bike = (c, b) => {
  const gallery = (b.gallery && b.gallery.length) ? b.gallery : (b.image ? [b.image] : []);
  const others = (c.bikes || []).filter(x => x.slug !== b.slug && x.top !== false).slice(0, 3);
  const body = `${pageHead('Line up', b.name, [['/price/', '料金表']])}
<section class="sec">
  <div class="wrap bike">
    <div class="gallery" data-gallery>
      <div class="gallery__main">${gallery.length ? `<img src="${esc(gallery[0])}" alt="${esc(b.name)}" width="400" height="300">` : '<div class="noimg"><span>画像準備中</span></div>'}</div>
      ${gallery.length > 1 ? `<ul class="gallery__thumbs">${gallery.map((g, i) => `<li><button type="button" data-src="${esc(g)}"${i === 0 ? ' aria-current="true"' : ''} aria-label="写真${i + 1}を表示"><img src="${esc(g)}" alt="" loading="lazy" width="400" height="300"></button></li>`).join('')}</ul>` : ''}
    </div>
    <div class="bike__info">
      <p class="label"><span>Spec</span>${esc(b.name)}</p>
      <dl class="spec">
        <div><dt>タイプ</dt><dd>${esc(b.wheels)}</dd></div>
        <div><dt>エンジン</dt><dd>${esc(b.engine)}</dd></div>
        <div><dt>排気量</dt><dd>${esc(b.cc)}</dd></div>
      </dl>
      ${b.description ? `<p class="bike__desc">${br(b.description)}</p>` : ''}
      <div class="vprice">${(b.variants || []).map(v => `<div class="vprice__item">
        <p class="vprice__name">${esc(v.label)}</p>
        <dl>
          <div><dt>日額<small>短期契約</small></dt><dd>${v.daily ? yen(v.daily) : 'なし'}</dd></div>
          <div><dt>月額<small>年間契約</small></dt><dd>${v.monthly ? yen(v.monthly) : 'なし'}</dd></div>
        </dl>
      </div>`).join('')}</div>
      <p class="tax">表示料金は税込です。BOX・出前機などの付属品は無料で貸出しております。</p>
      <div class="bike__btns">
        <a class="btn btn--red" href="/reservation/?bike=${encodeURIComponent(b.slug)}">この車種を予約する${icon.arrow}</a>
        <a class="btn btn--line" href="tel:${tel((c.site || {}).phone)}">${icon.phone}電話で相談する</a>
      </div>
    </div>
  </div>
</section>
${others.length ? `<section class="sec sec--paper">
  <div class="wrap">
    ${secHead('', 'Other bikes', 'その他の車種', '<a class="more" href="/price/">すべての車種を見る' + icon.arrow + '</a>')}
    <ul class="cards">${others.map(bikeCard).join('')}</ul>
  </div>
</section>` : ''}
${cta(c)}`;
  return layout(c, { title: `${b.name}のレンタル料金`, description: `${b.name}（${b.wheels}・${b.cc}）のレンタル料金。${(c.site || {}).description || ''}`, body, current: 'price' });
};

exports.service = c => {
  const ins = c.insurance || {};
  const body = `${pageHead('Service', 'サービス概要')}
<section class="sec">
  <div class="wrap">
    <div class="svc-list">${(c.service || []).map((x, i) => `<article class="svc-item">
      <p class="svc-item__no">${String(i + 1).padStart(2, '0')}</p>
      <h2>${esc(x.title)}</h2>
      <ul>${(x.items || []).map(t => `<li${/^※/.test(t) ? ' class="note"' : ''}>${esc(t)}</li>`).join('')}</ul>
    </article>`).join('')}</div>
  </div>
</section>
<section class="sec sec--paper">
  <div class="wrap narrow">
    ${secHead('', 'Insurance', ins.title)}
    <p class="lead">${br(ins.lead)}</p>
    <table class="tbl">${(ins.rows || []).map(r => `<tr><th scope="row">${esc(r.label)}</th><td>${esc(r.value)}</td></tr>`).join('')}</table>
    <p class="small">${br(ins.note)}</p>
    <p class="center"><a class="btn btn--line" href="/price/">料金表を見る</a> <a class="btn btn--line" href="/howto/">ご利用方法を見る</a></p>
  </div>
</section>
${cta(c)}`;
  return layout(c, { title: 'サービス概要', body, current: 'service' });
};

exports.faq = c => {
  const body = `${pageHead('FAQ', 'よくある質問')}
<section class="sec">
  <div class="wrap narrow">
    <div class="faq">${(c.faq || []).map((f, i) => `<details${i === 0 ? ' open' : ''}>
      <summary><span class="faq__q">Q</span><span class="faq__t">${esc(f.q)}</span>${icon.plus}</summary>
      <div class="faq__a"><span class="faq__q">A</span><p>${br(f.a)}</p></div>
    </details>`).join('')}</div>
  </div>
</section>
${cta(c)}`;
  return layout(c, { title: 'よくある質問', body, current: 'faq' });
};

exports.shop = c => {
  const s = c.site || {};
  const body = `${pageHead('Shop', '店舗情報')}
<section class="sec">
  <div class="wrap">
    <div class="shop">${shopInfo(s)}${mapEmbed(s)}</div>
  </div>
</section>
${cta(c)}`;
  return layout(c, { title: '店舗情報', body, current: 'shop' });
};

exports.company = c => {
  const body = `${pageHead('Company', '会社概要')}
<section class="sec">
  <div class="wrap narrow">
    <dl class="info info--wide">${(c.company || []).map(r => `<div><dt>${esc(r.label)}</dt><dd>${br(r.value)}</dd></div>`).join('')}</dl>
  </div>
</section>`;
  return layout(c, { title: '会社概要', body });
};

function legalHtml(text) {
  const out = []; const toc = []; let n = 0;
  String(text || '').split('\n').forEach(raw => {
    const l = raw.trim();
    if (!l) return;
    if (l.startsWith('## ')) { const id = 'c' + (++n); toc.push([id, l.slice(3)]); out.push(`<h2 id="${id}">${esc(l.slice(3))}</h2>`); }
    else if (l.startsWith('### ')) out.push(`<h3>${esc(l.slice(4))}</h3>`);
    else out.push(`<p${/^[（(][０-９0-9]+[）)]|^◎/.test(l) ? ' class="item"' : ''}>${esc(l)}</p>`);
  });
  return { html: out.join('\n'), toc };
}
function legalPage(c, key, en, ja) {
  const { html, toc } = legalHtml(c[key]);
  const body = `${pageHead(en, ja)}
<section class="sec">
  <div class="wrap legal-wrap${toc.length > 3 ? '' : ' legal-wrap--single'}">
    ${toc.length > 3 ? `<nav class="toc" aria-label="目次"><p>目次</p><ol>${toc.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}</ol></nav>` : ''}
    <div class="legal">${html}</div>
  </div>
</section>`;
  return layout(c, { title: ja, body });
}
exports.covenant = c => legalPage(c, 'covenant', 'Terms', '貸渡約款');
exports.privacy = c => legalPage(c, 'privacy', 'Privacy policy', '個人情報保護方針');

exports.sitemap = c => {
  const groups = [
    ['メインページ', [['/', 'トップページ'], ['/howto/', 'ご利用案内'], ['/price/', '料金表'], ['/service/', 'サービス概要'], ['/faq/', 'よくある質問'], ['/shop/', '店舗情報'], ['/reservation/', 'Web予約'], ['/contact/', 'お問い合わせ']]],
    ['取り扱い車種', (c.bikes || []).map(b => [`/bikes/${b.slug}/`, b.name])],
    ['会社情報', [['/company/', '会社概要'], ['/covenant/', '貸渡約款'], ['/privacy/', '個人情報保護方針']]]
  ];
  const body = `${pageHead('Sitemap', 'サイトマップ')}
<section class="sec"><div class="wrap sitemap">${groups.map(([h, ls]) => `<div><h2>${h}</h2><ul>${ls.map(([u, l]) => `<li><a href="${esc(u)}">${esc(l)}${icon.arrow}</a></li>`).join('')}</ul></div>`).join('')}</div></section>`;
  return layout(c, { title: 'サイトマップ', body });
};

const PREFS = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
const prefSelect = (name, req) => `<select name="${name}" id="${name}"${req ? ' required' : ''}><option value="">選択してください</option>${PREFS.map(p => `<option>${p}</option>`).join('')}</select>`;
const field = (label, name, input, { req = false, half = false, hint = '' } = {}) => `<div class="f${half ? ' f--half' : ''}" data-field="${name}">
  <label for="${name}">${esc(label)}${req ? '<em>必須</em>' : '<i>任意</i>'}</label>
  ${input}
  ${hint ? `<p class="f__hint">${esc(hint)}</p>` : ''}
  <p class="f__err" aria-live="polite"></p>
</div>`;
const text = (name, attrs = '') => `<input type="text" name="${name}" id="${name}" ${attrs}>`;
const TIMES = ['', '9:00', '9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
const timeSelect = name => `<select name="${name}" id="${name}" aria-label="希望時間">${TIMES.map(t => `<option value="${t}">${t || '時間指定なし'}</option>`).join('')}</select>`;

exports.reservation = (c, q = {}) => {
  const s = c.site || {}, r = c.reservation || {};
  const bikes = c.bikes || [];
  const pre = bikes.find(b => b.slug === q.bike) || bikes[0] || {};
  const body = `${pageHead('Web reservation', 'Web予約', [], r.lead)}
<section class="sec sec--form">
  <div class="wrap">
    <ol class="flow" data-flow>
      <li class="is-on"><span>1</span>入力</li><li><span>2</span>確認</li><li><span>3</span>完了</li>
    </ol>
    <div class="rsv">
      <form class="form" id="rsv-form" data-form="reservation" novalidate>
        <div data-step="input">
        <fieldset class="fs">
          <legend><span>01</span>ご利用内容</legend>
          <div class="f-row">
            <div class="f f--half" data-field="start">
              <label for="startDate">貸出日<em>必須</em></label>
              <div class="dt"><input type="date" id="startDate" name="startDate" required>${timeSelect('startTime')}</div>
              <p class="f__err" aria-live="polite"></p>
            </div>
            <div class="f f--half" data-field="end">
              <label for="endDate">返却日<em>必須</em></label>
              <div class="dt"><input type="date" id="endDate" name="endDate" required>${timeSelect('endTime')}</div>
              <p class="f__err" aria-live="polite"></p>
            </div>
          </div>
          <div class="f" data-field="bike">
            <p class="f__label">ビジネスバイク<em>必須</em><a class="f__link" href="/price/" target="_blank">料金表を見る ↗</a></p>
            <div class="bikepick">${bikes.map(b => `<label class="bikepick__item">
              <input type="radio" name="bike" value="${esc(b.name)}" data-slug="${esc(b.slug)}" data-img="${esc(b.image || '')}" data-daily="${esc(minPrice(b, 'daily'))}" data-monthly="${esc(minPrice(b, 'monthly'))}"${b.slug === pre.slug ? ' checked' : ''}>
              <span class="bikepick__img">${bikeImage(b)}</span>
              <span class="bikepick__name">${esc(b.name)}</span>
              <span class="bikepick__meta">${esc(b.wheels)} / ${esc(b.cc)}</span>
            </label>`).join('')}</div>
            <p class="f__err" aria-live="polite"></p>
          </div>
          <div class="f-row">
            <div class="f f--half" data-field="quantity">
              <p class="f__label">台数<em>必須</em></p>
              <div class="seg">${(r.quantities || []).map((v, i) => `<label><input type="radio" name="quantity" value="${esc(v)}"${i === 0 ? ' checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div>
              <p class="f__err" aria-live="polite"></p>
            </div>
            <div class="f f--half" data-field="accessory">
              <p class="f__label">付属品（無料）<em>必須</em></p>
              <div class="seg">${(r.accessories || []).map((v, i) => `<label><input type="radio" name="accessory" value="${esc(v)}"${i === 0 ? ' checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div>
              <p class="f__err" aria-live="polite"></p>
            </div>
          </div>
        </fieldset>

        <fieldset class="fs">
          <legend><span>02</span>お客様情報</legend>
          ${field('会社名もしくは個人名（漢字）', 'name', text('name', 'autocomplete="organization" required'), { req: true })}
          ${field('会社名もしくは個人名（フリガナ）', 'kana', text('kana', 'required'), { req: true })}
          <div class="f-row">
            ${field('郵便番号', 'zip', text('zip', 'inputmode="numeric" autocomplete="postal-code" placeholder="812-0011" maxlength="8" required data-zip="pref,city"'), { req: true, half: true, hint: '入力すると住所が自動で入ります' })}
            ${field('都道府県', 'pref', prefSelect('pref', true), { req: true, half: true })}
          </div>
          ${field('市区町村', 'city', text('city', 'autocomplete="address-level2" required'), { req: true })}
          ${field('番地・建物名', 'street', text('street', 'autocomplete="address-line1" required'), { req: true })}
          <div class="f-row">
            ${field('メールアドレス', 'email', '<input type="email" name="email" id="email" autocomplete="email" required>', { req: true, half: true })}
            ${field('メールアドレス（確認）', 'emailConfirm', '<input type="email" name="emailConfirm" id="emailConfirm" autocomplete="off" placeholder="確認のため再度ご入力ください" required>', { req: true, half: true })}
          </div>
          ${field('携帯電話番号', 'phone', '<input type="tel" name="phone" id="phone" autocomplete="tel" placeholder="000-0000-0000" required>', { req: true, half: true })}
        </fieldset>

        <fieldset class="fs">
          <legend><span>03</span>納車予定住所</legend>
          <label class="check"><input type="checkbox" data-toggle="#delivery"><span>上記住所と異なる場所への納車を希望する</span></label>
          <div id="delivery" hidden>
            <div class="f-row">
              ${field('郵便番号', 'deliveryZip', text('deliveryZip', 'inputmode="numeric" maxlength="8" data-zip="deliveryPref,deliveryCity"'), { half: true })}
              ${field('都道府県', 'deliveryPref', prefSelect('deliveryPref', false), { half: true })}
            </div>
            ${field('市区町村', 'deliveryCity', text('deliveryCity'))}
            ${field('番地・建物名', 'deliveryStreet', text('deliveryStreet'))}
          </div>
          ${field('ご要望・備考', 'note', '<textarea name="note" id="note" rows="4" placeholder="納車時間のご希望などがあればご記入ください"></textarea>')}
        </fieldset>

        <div class="agree" data-field="agree">
          <label class="check"><input type="checkbox" name="agree" value="1"><span><a href="/covenant/" target="_blank">貸渡約款</a>・<a href="/privacy/" target="_blank">個人情報保護方針</a>に同意のうえ、記入内容を確認しました</span></label>
          <p class="f__err" aria-live="polite"></p>
        </div>
        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="form__act"><button class="btn btn--red btn--lg" type="submit" data-to="confirm">入力内容を確認する${icon.arrow}</button></div>
        </div>

        <div data-step="confirm" hidden>
          <h2 class="form__h">入力内容のご確認</h2>
          <p class="form__p">以下の内容でよろしければ「この内容で予約を申し込む」を押してください。</p>
          <dl class="confirm" data-confirm></dl>
          <p class="form__error" data-form-error hidden></p>
          <div class="form__act form__act--2">
            <button class="btn btn--line" type="button" data-back>入力画面に戻る</button>
            <button class="btn btn--red btn--lg" type="button" data-send>この内容で予約を申し込む${icon.arrow}</button>
          </div>
        </div>

        <div data-step="done" hidden class="done">
          <p class="done__en">Thank you</p>
          <h2>お申し込みありがとうございました</h2>
          <p>${br(r.thanks)}</p>
          <p class="small">お急ぎの場合はお電話（<a href="tel:${tel(s.phone)}">${esc(s.phone)}</a> / 受付 ${esc(s.hours)}）でもご連絡いただけます。</p>
          <a class="btn btn--line" href="/">トップページへ戻る</a>
        </div>
      </form>

      <aside class="rsv__side" data-summary>
        <div class="sum">
          <p class="sum__h">選択中の車種</p>
          <div class="sum__img" data-sum-img>${bikeImage(pre)}</div>
          <p class="sum__name" data-sum-name>${esc(pre.name)}</p>
          <dl class="sum__price">
            <div><dt>日額</dt><dd data-sum-daily>${minPrice(pre, 'daily') ? '¥' + minPrice(pre, 'daily') : '—'}</dd></div>
            <div><dt>月額</dt><dd data-sum-monthly>${minPrice(pre, 'monthly') ? '¥' + minPrice(pre, 'monthly') : '—'}</dd></div>
          </dl>
          <p class="sum__note">税込・参考料金です。納車費用等は別途となります。</p>
        </div>
        <div class="sum sum--tel">
          <p class="sum__h">お電話でのご予約</p>
          <a href="tel:${tel(s.phone)}">${esc(s.phone)}</a>
          <p>受付時間 ${esc(s.hours)}</p>
        </div>
      </aside>
    </div>
  </div>
</section>
<script src="https://ajaxzip3.github.io/ajaxzip3.js" defer></script>`;
  return layout(c, { title: 'Web予約', body, bodyClass: 'is-form' });
};

exports.contact = c => {
  const s = c.site || {}, ct = c.contact || {};
  const body = `${pageHead('Contact', 'お問い合わせ', [], ct.lead)}
<section class="sec sec--form">
  <div class="wrap narrow">
    <div class="contact-tel">
      <p>お電話でのお問い合わせ</p>
      <a href="tel:${tel(s.phone)}">${icon.phone}${esc(s.phone)}</a>
      <small>受付時間 ${esc(s.hours)}</small>
    </div>
    <form class="form" data-form="contact" novalidate>
      <div data-step="input">
        <fieldset class="fs">
          <legend><span>Form</span>お問い合わせフォーム</legend>
          ${field('お名前', 'name', text('name', 'autocomplete="name" required'), { req: true })}
          ${field('メールアドレス', 'email', '<input type="email" name="email" id="email" autocomplete="email" required>', { req: true })}
          ${field('題名', 'subject', text('subject'))}
          ${field('お問い合わせ内容', 'message', '<textarea name="message" id="message" rows="7" required></textarea>', { req: true })}
        </fieldset>
        <div class="agree" data-field="agree">
          <label class="check"><input type="checkbox" name="agree" value="1"><span>上記内容でよろしければチェックを入れて送信ボタンを押してください（<a href="/privacy/" target="_blank">個人情報保護方針</a>）</span></label>
          <p class="f__err" aria-live="polite"></p>
        </div>
        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="form__error" data-form-error hidden></p>
        <div class="form__act"><button class="btn btn--red btn--lg" type="submit" data-send>送信する${icon.arrow}</button></div>
      </div>
      <div data-step="done" hidden class="done">
        <p class="done__en">Thank you</p>
        <h2>送信が完了しました</h2>
        <p>${br(ct.thanks)}</p>
        <a class="btn btn--line" href="/">トップページへ戻る</a>
      </div>
    </form>
  </div>
</section>`;
  return layout(c, { title: 'お問い合わせ', body, current: 'contact', bodyClass: 'is-form' });
};

exports.notFound = c => layout(c, {
  title: 'ページが見つかりません',
  body: `${pageHead('404 Not found', 'ページが見つかりません')}<section class="sec"><div class="wrap narrow center"><p>お探しのページは移動または削除された可能性があります。</p><p><a class="btn btn--red" href="/">トップページへ${icon.arrow}</a></p></div></section>`
});
