(() => {
  'use strict';
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 状態 ----------
  let content = null, saved = '', session = {}, records = { reservations: null, contacts: null };
  const open = new Set();

  // ---------- API ----------
  async function api(path, opts = {}) {
    const res = await fetch('/api/admin/' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin'
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== 'login') { renderLogin(); throw new Error('auth'); }
    if (!res.ok) throw new Error(data.error || '処理に失敗しました');
    return data;
  }
  let toastTimer;
  function toast(msg, err = false) {
    toastEl.textContent = msg; toastEl.hidden = false; toastEl.classList.toggle('is-err', err);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, err ? 5000 : 2400);
  }

  // ---------- パス操作 ----------
  const parts = p => p.split('.').map(k => (/^\d+$/.test(k) ? Number(k) : k));
  function get(obj, p) { return parts(p).reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function set(obj, p, v) {
    const ks = parts(p); let o = obj;
    ks.slice(0, -1).forEach((k, i) => { if (o[k] == null) o[k] = typeof ks[i + 1] === 'number' ? [] : {}; o = o[k]; });
    o[ks[ks.length - 1]] = v;
  }
  const isDirty = () => content && JSON.stringify(content) !== saved;

  // ---------- 入力スキーマ ----------
  const T = (key, label, o = {}) => ({ t: 'text', key, label, ...o });
  const A = (key, label, o = {}) => ({ t: 'textarea', key, label, ...o });
  const IMG = (key, label, o = {}) => ({ t: 'image', key, label, ...o });
  const G = (cols, fields) => ({ t: 'grid', cols, fields });
  const P = (title, fields, help = '') => ({ t: 'panel', title, fields, help });
  const L = (key, label, fields, o = {}) => ({ t: 'list', key, label, fields, ...o });
  const S = (key, label, o = {}) => ({ t: 'strings', key, label, ...o });

  const SECTIONS = [
    { id: 'dashboard', label: 'ダッシュボード', group: '' },
    { id: 'reservations', label: '予約一覧', group: '受付', records: true },
    { id: 'contacts', label: 'お問い合わせ一覧', group: '受付', records: true },
    { id: 'site', label: '基本情報', group: 'サイト内容', sub: '店名・電話番号・住所・お知らせなど', fields: [
      P('お知らせバナー', [A('site.notice', 'お知らせ文', { rows: 2, hint: '例：12月29日〜1月5日は冬季休業期間です。空欄にするとサイトに表示されません。' })], 'サイト最上部に表示される帯です。休業日のお知らせなどに使えます。'),
      P('店舗情報', [
        G(2, [T('site.name', '店名'), T('site.tagline', 'キャッチフレーズ')]),
        G(2, [T('site.phone', '電話番号'), T('site.hours', 'お電話受付時間')]),
        G(2, [T('site.zip', '郵便番号'), T('site.address', '住所')]),
        T('site.area', '使用可能エリア'),
        T('site.mapQuery', '地図に表示する住所', { hint: 'Googleマップで検索される住所です。' })
      ]),
      P('検索エンジン向け設定（SEO）', [
        T('site.title', 'サイトタイトル', { hint: 'ブラウザのタブや検索結果に表示されます。' }),
        A('site.description', 'サイトの説明文', { rows: 3 }),
        T('site.keywords', 'キーワード', { hint: 'カンマ区切り' })
      ]),
      P('フッターのリンク', [L('site.links', '', [G(2, [T('label', '表示名'), T('url', 'URL')])], { title: x => x.label, make: () => ({ label: '', url: 'https://' }), addLabel: 'リンクを追加' })])
    ] },
    { id: 'home', label: 'トップページ', group: 'サイト内容', sub: 'メインビジュアル・数字・お問い合わせ帯', fields: [
      P('メインビジュアル', [
        T('home.eyebrow', '英字の小見出し'),
        A('home.heroTitle', '大見出し', { rows: 3, hint: '改行した位置で行が分かれます。最後の行が赤字になります。' }),
        A('home.heroLead', 'リード文', { rows: 3 }),
        { t: 'gallery', key: 'home.heroImages', label: '写真（3枚）', max: 3, hint: '1枚目が大きく、2・3枚目が下に並びます。' }
      ]),
      P('数字で見るポイント', [L('home.facts', '', [G(2, [T('value', '大きな文字'), T('label', '説明')])], { title: x => `${x.value}｜${x.label}`, make: () => ({ value: '', label: '' }), addLabel: '項目を追加' })]),
      P('見出し・お問い合わせ帯', [
        T('home.lineupTitle', '車種一覧の見出し'),
        G(2, [T('home.ctaTitle', 'お問い合わせ帯の見出し'), T('home.ctaText', 'お問い合わせ帯の説明文')])
      ])
    ] },
    { id: 'bikes', label: '車種・料金', group: 'サイト内容', sub: '取り扱いバイクの写真・料金。上から順に表示されます。', fields: [
      L('bikes', '', [
        G(2, [T('name', '車種名'), T('slug', 'URL名（半角英数字）', { hint: 'ページのURLになります（例：canopy → /bikes/canopy/）' })]),
        G(3, [T('wheels', 'タイプ', { hint: '例：3輪' }), T('engine', 'エンジン', { hint: '例：4サイクル' }), T('cc', '排気量', { hint: '例：50cc' })]),
        { t: 'check', key: 'top', label: 'トップページの車種一覧に表示する' },
        IMG('image', '一覧用の写真'),
        A('description', '紹介文（任意）', { rows: 3 }),
        { t: 'sub', title: '料金', fields: [L('variants', '', [T('label', '料金表での表示名'), G(2, [T('daily', '日額（短期契約）', { hint: '数字とカンマ。空欄は「なし」' }), T('monthly', '月額（年間契約）', { hint: '例：33,000' })])], { title: x => `${x.label}　日額 ${x.daily || 'なし'} / 月額 ${x.monthly || 'なし'}`, make: () => ({ label: '', daily: '', monthly: '' }), addLabel: '料金プランを追加' })] },
        { t: 'gallery', key: 'gallery', label: '詳細ページの写真', hint: '1枚目が最初に大きく表示されます。' }
      ], { title: x => x.name, thumb: x => x.image, make: () => ({ slug: 'new-bike', name: '新しい車種', wheels: '2輪', engine: '4サイクル', cc: '50cc', top: true, image: '', gallery: [], description: '', variants: [{ label: '', daily: '', monthly: '' }] }), addLabel: '車種を追加' }),
      P('料金表ページの注記', [S('priceNotes', '', { addLabel: '注記を追加' })])
    ] },
    { id: 'howto', label: 'ご利用案内', group: 'サイト内容', sub: 'ご予約からレンタル開始までの流れ', fields: [
      P('見出し', [G(2, [T('howto.title', '見出し'), T('howto.subtitle', '小見出し')])]),
      P('ステップ', [L('howto.steps', '', [T('title', 'タイトル'), A('text', '説明', { rows: 3 })], { title: x => x.title, make: () => ({ title: '', text: '' }), addLabel: 'ステップを追加' })])
    ] },
    { id: 'service', label: 'サービス概要', group: 'サイト内容', fields: [
      P('サービス項目', [L('service', '', [T('title', '項目名'), S('items', '説明文', { addLabel: '行を追加', multiline: true })], { title: x => x.title, make: () => ({ title: '', items: [''] }), addLabel: '項目を追加' })], 'トップページには先頭8項目の1行目が表示されます。'),
      P('保険・補償', [
        T('insurance.title', '見出し'), A('insurance.lead', '説明', { rows: 2 }),
        L('insurance.rows', '補償内容', [G(2, [T('label', '項目'), T('value', '内容')])], { title: x => `${x.label}｜${x.value}`, make: () => ({ label: '', value: '' }), addLabel: '補償を追加' }),
        A('insurance.note', '補足', { rows: 3 })
      ])
    ] },
    { id: 'faq', label: 'よくある質問', group: 'サイト内容', fields: [
      P('質問と回答', [L('faq', '', [T('q', '質問'), A('a', '回答', { rows: 3 })], { title: x => 'Q. ' + x.q, make: () => ({ q: '', a: '' }), addLabel: '質問を追加' })])
    ] },
    { id: 'company', label: '会社概要', group: 'サイト内容', fields: [
      P('会社情報', [L('company', '', [T('label', '項目名'), A('value', '内容', { rows: 2 })], { title: x => `${x.label}｜${String(x.value || '').split('\n')[0]}`, make: () => ({ label: '', value: '' }), addLabel: '項目を追加' })])
    ] },
    { id: 'forms', label: '予約・問い合わせ設定', group: 'サイト内容', sub: 'フォームの説明文と選択肢', fields: [
      P('Web予約ページ', [
        A('reservation.lead', '説明文', { rows: 3 }),
        G(2, [S('reservation.quantities', '台数の選択肢', { addLabel: '選択肢を追加' }), S('reservation.accessories', '付属品の選択肢', { addLabel: '選択肢を追加' })]),
        A('reservation.thanks', '送信完了メッセージ', { rows: 3 })
      ], '車種の選択肢は「車種・料金」に登録された車種が自動で表示されます。'),
      P('お問い合わせページ', [A('contact.lead', '説明文', { rows: 3 }), A('contact.thanks', '送信完了メッセージ', { rows: 3 })])
    ] },
    { id: 'covenant', label: '貸渡約款', group: '規約', fields: [
      P('本文', [A('covenant', '', { cls: 'tall' })], '行頭に「## 」を付けると章の見出し（目次に表示）、「### 」で小見出しになります。')
    ] },
    { id: 'privacy', label: '個人情報保護方針', group: '規約', fields: [
      P('本文', [A('privacy', '', { cls: 'tall' })], '行頭に「## 」を付けると見出し、「### 」で小見出しになります。')
    ] },
    { id: 'password', label: 'パスワード変更', group: '設定' }
  ];

  // ---------- アイコン ----------
  const I = {
    up: '<svg class="i" viewBox="0 0 16 16"><path d="M8 3v10M4 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    down: '<svg class="i" viewBox="0 0 16 16"><path d="M8 13V3M4 9l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    del: '<svg class="i" viewBox="0 0 16 16"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    chev: '<svg class="i" viewBox="0 0 16 16"><path d="m5 6 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
    ext: '<svg class="i" viewBox="0 0 16 16"><path d="M9 3h4v4M13 3 7 9M11 9.5V13H3V5h3.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    menu: '<svg class="i" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5"/></svg>'
  };

  // ---------- フィールド描画 ----------
  function field(f, base = '') {
    const path = f.key ? (base ? `${base}.${f.key}` : f.key) : base;
    const v = f.key ? get(content, path) : undefined;
    const hint = f.hint ? `<p class="fld__hint">${esc(f.hint)}</p>` : '';
    const lab = f.label ? `<label for="f-${esc(path)}">${esc(f.label)}</label>` : '';
    switch (f.t) {
      case 'panel':
        return `<section class="panel">${f.title ? `<div class="panel__h"><h2>${esc(f.title)}</h2></div>` : ''}${f.help ? `<p class="help">${esc(f.help)}</p>` : ''}${f.fields.map(x => field(x, base)).join('')}</section>`;
      case 'grid':
        return `<div class="grid${f.cols}">${f.fields.map(x => field(x, base)).join('')}</div>`;
      case 'sub':
        return `<div class="fld"><p class="fld__l">${esc(f.title)}</p><div class="sub">${f.fields.map(x => field(x, base)).join('')}</div></div>`;
      case 'text':
        return `<div class="fld">${lab}<input type="text" id="f-${esc(path)}" data-path="${esc(path)}" value="${esc(v)}">${hint}</div>`;
      case 'textarea':
        return `<div class="fld">${lab}<textarea id="f-${esc(path)}" data-path="${esc(path)}" rows="${f.rows || 4}" class="${f.cls || ''}">${esc(v)}</textarea>${hint}</div>`;
      case 'check':
        return `<div class="fld"><label class="chk"><input type="checkbox" data-path="${esc(path)}" data-bool${v !== false ? ' checked' : ''}>${esc(f.label)}</label></div>`;
      case 'image':
        return `<div class="fld">${lab}<div class="img">
          <div class="img__pv">${v ? `<img src="${esc(v)}" alt="">` : '未設定'}</div>
          <div class="img__ctl">
            <div class="img__btns"><button type="button" class="btn btn--sm" data-act="upload" data-path="${esc(path)}">画像をアップロード</button>${v ? `<button type="button" class="btn btn--sm btn--ghost" data-act="clear" data-path="${esc(path)}">削除</button>` : ''}</div>
            <input type="text" id="f-${esc(path)}" data-path="${esc(path)}" data-rerender value="${esc(v)}" placeholder="画像のURL">
            ${hint}
          </div></div></div>`;
      case 'gallery': {
        const arr = Array.isArray(v) ? v : [];
        const canAdd = !f.max || arr.length < f.max;
        return `<div class="fld"><p class="fld__l">${esc(f.label)}</p><div class="gal">
          ${arr.map((u, i) => `<div class="gal__it"><img src="${esc(u)}" alt="" loading="lazy"><div class="gal__ops">
            <button type="button" data-act="gup" data-path="${esc(path)}" data-i="${i}" aria-label="前へ">←</button>
            <button type="button" data-act="gdel" data-path="${esc(path)}" data-i="${i}">削除</button>
            <button type="button" data-act="gdown" data-path="${esc(path)}" data-i="${i}" aria-label="後ろへ">→</button>
          </div></div>`).join('')}
          ${canAdd ? `<button type="button" class="gal__add" data-act="gadd" data-path="${esc(path)}" data-max="${f.max || ''}">＋ 写真を追加</button>` : ''}
        </div>${hint}</div>`;
      }
      case 'strings': {
        const arr = Array.isArray(v) ? v : [];
        return `<div class="fld">${f.label ? `<p class="fld__l">${esc(f.label)}</p>` : ''}<div class="items">
          ${arr.map((s, i) => `<div class="row">${f.multiline ? `<textarea rows="2" data-path="${esc(path)}.${i}">${esc(s)}</textarea>` : `<input type="text" data-path="${esc(path)}.${i}" value="${esc(s)}">`}
            <button type="button" class="iconbtn" data-act="up" data-path="${esc(path)}" data-i="${i}" aria-label="上へ">${I.up}</button>
            <button type="button" class="iconbtn" data-act="down" data-path="${esc(path)}" data-i="${i}" aria-label="下へ">${I.down}</button>
            <button type="button" class="iconbtn del" data-act="del" data-path="${esc(path)}" data-i="${i}" aria-label="削除">${I.del}</button></div>`).join('')}
        </div><button type="button" class="btn btn--sm add" data-act="addstr" data-path="${esc(path)}">＋ ${esc(f.addLabel || '追加')}</button>${hint}</div>`;
      }
      case 'list': {
        const arr = Array.isArray(v) ? v : [];
        return `<div class="fld">${f.label ? `<p class="fld__l">${esc(f.label)}</p>` : ''}<div class="items">
          ${arr.map((it, i) => {
            const ip = `${path}.${i}`;
            const isOpen = open.has(ip);
            const th = f.thumb ? f.thumb(it) : '';
            return `<div class="item${isOpen ? ' is-open' : ''}" data-item="${esc(ip)}">
              <div class="item__h">
                <button type="button" class="item__t" data-act="toggle" data-path="${esc(ip)}" aria-expanded="${isOpen}"><span class="item__no">${i + 1}</span>${f.thumb ? (th ? `<img src="${esc(th)}" alt="">` : '<span class="img__pv" style="width:48px">—</span>') : ''}<span data-title>${esc(f.title(it) || '（未入力）')}</span></button>
                <button type="button" class="iconbtn" data-act="up" data-path="${esc(path)}" data-i="${i}" aria-label="上へ">${I.up}</button>
                <button type="button" class="iconbtn" data-act="down" data-path="${esc(path)}" data-i="${i}" aria-label="下へ">${I.down}</button>
                <button type="button" class="iconbtn del" data-act="del" data-path="${esc(path)}" data-i="${i}" aria-label="削除">${I.del}</button>
                <button type="button" class="iconbtn" data-act="toggle" data-path="${esc(ip)}" aria-label="開閉">${I.chev}</button>
              </div>
              <div class="item__b">${f.fields.map(x => field(x, ip)).join('')}</div>
            </div>`;
          }).join('')}
        </div><button type="button" class="btn btn--sm add" data-act="additem" data-path="${esc(path)}">＋ ${esc(f.addLabel || '追加')}</button></div>`;
      }
    }
    return '';
  }

  // 一覧の見出し更新のため、パスから list 定義を探す
  function findList(fields, path, base = '') {
    for (const f of fields || []) {
      if (f.t === 'list') {
        const p = base ? `${base}.${f.key}` : f.key;
        if (p === path) return f;
        const arr = get(content, p) || [];
        for (let i = 0; i < arr.length; i++) { const r = findList(f.fields, path, `${p}.${i}`); if (r) return r; }
      } else if (f.fields) { const r = findList(f.fields, path, base); if (r) return r; }
    }
    return null;
  }

  // ---------- 画面 ----------
  const current = () => (location.hash.replace(/^#\/?/, '') || 'dashboard');

  function renderLogin() {
    app.innerHTML = `<div class="login"><form class="login__box" id="login">
      <div class="login__brand"><span class="lamp" aria-hidden="true"><span class="lamp__txt">GoGo!</span></span><b>サイト管理画面</b></div>
      <h1>管理画面ログイン</h1>
      <div class="fld"><label for="pw">パスワード</label><input type="password" id="pw" autocomplete="current-password" required autofocus></div>
      <button class="btn btn--red" type="submit">ログイン</button>
      <p class="login__err" id="lerr"></p>
    </form></div>`;
    document.getElementById('login').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await api('login', { method: 'POST', body: { password: document.getElementById('pw').value } });
        boot();
      } catch (err) { document.getElementById('lerr').textContent = err.message; }
    });
  }

  function shell() {
    const id = current();
    const sec = SECTIONS.find(s => s.id === id) || SECTIONS[0];
    const newR = (records.reservations || []).filter(r => r.status === '新規').length;
    const newC = (records.contacts || []).filter(r => r.status === '新規').length;
    let lastG = null;
    const nav = SECTIONS.map(s => {
      const g = s.group !== lastG && s.group ? `<p class="side__g">${esc(s.group)}</p>` : '';
      lastG = s.group;
      const b = s.id === 'reservations' && newR ? `<span class="badge">${newR}</span>` : s.id === 'contacts' && newC ? `<span class="badge">${newC}</span>` : '';
      return `${g}<a class="nav${s.id === sec.id ? ' is-on' : ''}" href="#/${s.id}">${esc(s.label)}${b}</a>`;
    }).join('');
    const editable = !!sec.fields;
    app.innerHTML = `<div class="shell">
      <aside class="side" id="side">
        <a class="side__brand" href="#/dashboard"><span class="lamp" aria-hidden="true"><span class="lamp__txt">GoGo!</span></span><b>${esc(content.site?.name || '')}<small>サイト管理</small></b></a>
        ${nav}
        <div class="side__foot"><a href="/" target="_blank">サイトを表示 ↗</a><button type="button" data-act="logout">ログアウト</button></div>
      </aside>
      <div class="main">
        <header class="top">
          <button type="button" class="btn btn--sm menu-t" data-act="menu" aria-label="メニュー">${I.menu}</button>
          <div><h1>${esc(sec.label)}</h1>${sec.sub ? `<p class="top__sub">${esc(sec.sub)}</p>` : ''}</div>
          <div class="top__act">
            <span class="dirty" id="dirty" ${isDirty() ? '' : 'hidden'}>未保存の変更があります</span>
            ${editable ? `<a class="btn btn--ghost btn--sm" href="${previewUrl(sec.id)}" target="_blank" aria-label="ページを確認">${I.ext}<span>ページを確認</span></a><button type="button" class="btn btn--red" data-act="save" id="save" ${isDirty() ? '' : 'disabled'}>保存する</button>` : ''}
          </div>
        </header>
        <div class="body" id="body"></div>
      </div>
    </div>`;
    renderBody(sec);
  }

  const previewUrl = id => ({ site: '/', home: '/', bikes: '/price/', howto: '/howto/', service: '/service/', faq: '/faq/', company: '/company/', forms: '/reservation/', covenant: '/covenant/', privacy: '/privacy/' }[id] || '/');

  function renderBody(sec) {
    const body = document.getElementById('body');
    if (sec.fields) body.innerHTML = sec.fields.map(f => (f.t === 'list' ? `<section class="panel">${field(f)}</section>` : field(f))).join('');
    else if (sec.records) renderRecords(sec.id, body);
    else if (sec.id === 'password') renderPassword(body);
    else renderDashboard(body);
  }
  function rerender() {
    const y = window.scrollY;
    renderBody(SECTIONS.find(s => s.id === current()) || SECTIONS[0]);
    window.scrollTo(0, y);
    updateDirty();
  }
  function updateDirty() {
    const d = isDirty();
    const el = document.getElementById('dirty'); if (el) el.hidden = !d;
    const sv = document.getElementById('save'); if (sv) sv.disabled = !d;
  }

  // ---------- ダッシュボード ----------
  function renderDashboard(body) {
    const R = records.reservations || [], C = records.contacts || [];
    const nR = R.filter(r => r.status === '新規').length, nC = C.filter(r => r.status === '新規').length;
    const wR = R.filter(r => r.status === '対応中').length;
    body.innerHTML = `
      ${session.initialPassword ? `<div class="alert">初期パスワードのままです。安全のため変更してください。<a class="btn btn--sm" href="#/password">パスワードを変更</a></div>` : ''}
      <div class="stats">
        <a class="stat${nR ? ' is-hot' : ''}" href="#/reservations"><p>新規の予約</p><b>${nR}<small>件</small></b></a>
        <a class="stat" href="#/reservations"><p>対応中の予約</p><b>${wR}<small>件</small></b></a>
        <a class="stat${nC ? ' is-hot' : ''}" href="#/contacts"><p>新規のお問い合わせ</p><b>${nC}<small>件</small></b></a>
      </div>
      <section class="panel"><div class="panel__h"><h2>最近の予約</h2><a class="btn btn--sm" href="#/reservations">すべて見る</a></div>
        ${R.length ? recordTable('reservations', R.slice(0, 5)) : '<p class="help" style="margin:0">まだ予約はありません。</p>'}
      </section>
      <section class="panel"><div class="panel__h"><h2>よく使う編集</h2></div>
        <div class="quick">
          <a href="#/site">お知らせバナー</a><a href="#/bikes">車種・料金</a><a href="#/faq">よくある質問</a><a href="#/home">トップページ</a>
        </div>
      </section>`;
  }

  // ---------- 受付一覧 ----------
  const RLABEL = {
    reservations: [['createdAt', '受付日時'], ['status', '状況'], ['start', '貸出日'], ['end', '返却日'], ['bike', '車種'], ['quantity', '台数'], ['accessory', '付属品'],
      ['name', '会社名・お名前'], ['kana', 'フリガナ'], ['zip', '郵便番号'], ['pref', '都道府県'], ['city', '市区町村'], ['street', '番地'], ['email', 'メール'], ['phone', '携帯電話'],
      ['deliveryZip', '納車先 郵便番号'], ['deliveryPref', '納車先 都道府県'], ['deliveryCity', '納車先 市区町村'], ['deliveryStreet', '納車先 番地'], ['note', '備考'], ['memo', '社内メモ']],
    contacts: [['createdAt', '受付日時'], ['status', '状況'], ['name', 'お名前'], ['email', 'メール'], ['subject', '題名'], ['message', 'お問い合わせ内容'], ['memo', '社内メモ']]
  };
  const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const filters = { reservations: { q: '', st: '' }, contacts: { q: '', st: '' } };

  function recordTable(type, list) {
    const head = type === 'reservations'
      ? '<tr><th>受付日時</th><th>状況</th><th>お名前</th><th class="hide-sp">車種</th><th class="hide-sp">貸出日</th></tr>'
      : '<tr><th>受付日時</th><th>状況</th><th>お名前</th><th class="hide-sp">題名</th></tr>';
    const rows = list.map(r => type === 'reservations'
      ? `<tr data-open="${type}:${r.id}" class="${r.status === '新規' ? 'is-new' : ''}"><td class="num">${fmtDate(r.createdAt)}</td><td><span class="st st--${esc(r.status)}">${esc(r.status)}</span></td><td>${esc(r.name)}</td><td class="hide-sp">${esc(r.bike)}（${esc(r.quantity)}）</td><td class="hide-sp num">${esc(r.start)}</td></tr>`
      : `<tr data-open="${type}:${r.id}" class="${r.status === '新規' ? 'is-new' : ''}"><td class="num">${fmtDate(r.createdAt)}</td><td><span class="st st--${esc(r.status)}">${esc(r.status)}</span></td><td>${esc(r.name)}</td><td class="hide-sp">${esc(r.subject || String(r.message || '').slice(0, 30))}</td></tr>`).join('');
    return `<table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
  }

  function renderRecords(type, body) {
    const all = records[type] || [];
    const f = filters[type];
    const list = all.filter(r => (!f.st || r.status === f.st) && (!f.q || JSON.stringify(r).includes(f.q)));
    body.innerHTML = `<div class="tools">
        <input type="search" placeholder="名前・電話番号などで検索" value="${esc(f.q)}" data-filter="q" data-type="${type}">
        <select data-filter="st" data-type="${type}"><option value="">すべての状況</option>${['新規', '対応中', '完了'].map(s => `<option${f.st === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
        <span class="sp"></span>
        <button type="button" class="btn btn--sm" data-act="reload" data-type="${type}">最新に更新</button>
        <button type="button" class="btn btn--sm" data-act="csv" data-type="${type}" ${all.length ? '' : 'disabled'}>CSVダウンロード</button>
      </div>
      ${list.length ? recordTable(type, list) : `<div class="empty">${all.length ? '条件に合うデータがありません' : (type === 'reservations' ? 'まだ予約はありません。Web予約ページから送信されるとここに表示されます。' : 'まだお問い合わせはありません。')}</div>`}`;
  }

  function openRecord(type, id) {
    const r = (records[type] || []).find(x => x.id === id);
    if (!r) return;
    const rows = RLABEL[type].filter(([k]) => !['status', 'memo'].includes(k) && r[k]).map(([k, l]) => `<div><dt>${esc(l)}</dt><dd>${esc(k === 'createdAt' ? fmtDate(r[k]) : r[k])}</dd></div>`).join('');
    const mail = r.email ? `<a class="btn btn--sm" href="mailto:${encodeURIComponent(r.email)}">メールを作成</a>` : '';
    const telb = r.phone ? `<a class="btn btn--sm" href="tel:${esc(String(r.phone).replace(/[^0-9]/g, ''))}">電話をかける</a>` : '';
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="drawer-bg" data-act="close"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="詳細">
        <div class="drawer__h"><h2>${type === 'reservations' ? '予約の詳細' : 'お問い合わせの詳細'}</h2><button type="button" class="btn btn--sm btn--ghost" data-act="close">閉じる</button></div>
        <div class="drawer__b">
          <div class="grid2">
            <div class="fld"><label for="d-st">対応状況</label><select id="d-st">${['新規', '対応中', '完了'].map(s => `<option${r.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
            <div class="fld"><span class="fld__l">連絡</span><div class="img__btns">${telb}${mail}</div></div>
          </div>
          <div class="fld"><label for="d-memo">社内メモ</label><textarea id="d-memo" rows="3" placeholder="対応内容などを記録できます（お客様には表示されません）">${esc(r.memo)}</textarea></div>
          <dl class="dl">${rows}</dl>
        </div>
        <div class="drawer__f"><button type="button" class="btn btn--danger btn--sm" data-act="rdel">削除</button><button type="button" class="btn btn--red" data-act="rsave">保存する</button></div>
      </aside>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', async e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'close') close();
      if (a.dataset.act === 'rsave') {
        try {
          const upd = await api(`${type}/${id}`, { method: 'PATCH', body: { status: wrap.querySelector('#d-st').value, memo: wrap.querySelector('#d-memo').value } });
          Object.assign(r, upd); close(); shell(); toast('保存しました');
        } catch (err) { if (err.message !== 'auth') toast(err.message, true); }
      }
      if (a.dataset.act === 'rdel') {
        if (!confirm('このデータを削除します。元に戻せませんがよろしいですか？')) return;
        try {
          await api(`${type}/${id}`, { method: 'DELETE' });
          records[type] = records[type].filter(x => x.id !== id); close(); shell(); toast('削除しました');
        } catch (err) { if (err.message !== 'auth') toast(err.message, true); }
      }
    });
    wrap.querySelector('#d-st').focus();
  }

  function csv(type) {
    const cols = RLABEL[type];
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.map(c => q(c[1])).join(',')].concat((records[type] || []).map(r => cols.map(([k]) => q(k === 'createdAt' ? fmtDate(r[k]) : r[k])).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${type === 'reservations' ? '予約一覧' : 'お問い合わせ一覧'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- パスワード ----------
  function renderPassword(body) {
    body.innerHTML = `<form class="panel" id="pwf" style="max-width:520px">
      <div class="fld"><label for="p1">現在のパスワード</label><input type="password" id="p1" autocomplete="current-password" required></div>
      <div class="fld"><label for="p2">新しいパスワード（8文字以上）</label><input type="password" id="p2" autocomplete="new-password" minlength="8" required></div>
      <div class="fld"><label for="p3">新しいパスワード（確認）</label><input type="password" id="p3" autocomplete="new-password" required></div>
      <button class="btn btn--red" type="submit">変更する</button>
    </form>`;
    document.getElementById('pwf').addEventListener('submit', async e => {
      e.preventDefault();
      const [a, b, c] = ['p1', 'p2', 'p3'].map(id => document.getElementById(id).value);
      if (b !== c) return toast('新しいパスワードが一致しません', true);
      try { await api('password', { method: 'POST', body: { current: a, next: b } }); session.initialPassword = false; e.target.reset(); toast('パスワードを変更しました'); }
      catch (err) { if (err.message !== 'auth') toast(err.message, true); }
    });
  }

  // ---------- 画像アップロード ----------
  function pickFiles(multiple) {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/jpeg,image/png,image/webp,image/gif'; inp.multiple = multiple;
      inp.onchange = () => resolve(Array.from(inp.files || []));
      inp.click();
    });
  }
  function resize(file) {
    return new Promise((resolve, reject) => {
      if (file.type === 'image/gif') { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(file); return; }
      const img = new Image();
      img.onload = () => {
        const max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        const ctx = cv.getContext('2d');
        const png = file.type === 'image/png';
        if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        resolve(cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86));
      };
      img.onerror = () => reject(new Error('画像を読み込めませんでした'));
      img.src = URL.createObjectURL(file);
    });
  }
  async function upload(files) {
    const urls = [];
    for (const f of files) {
      toast(`アップロード中… ${urls.length + 1}/${files.length}`);
      const data = await resize(f);
      const r = await api('upload', { method: 'POST', body: { data } });
      urls.push(r.url);
    }
    return urls;
  }

  // ---------- イベント ----------
  app.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.filter) { filters[el.dataset.type][el.dataset.filter] = el.value; const pos = el.selectionStart; renderRecords(el.dataset.type, document.getElementById('body')); const n = document.querySelector(`[data-filter="${el.dataset.filter}"]`); if (n && n.type === 'search') { n.focus(); n.setSelectionRange(pos, pos); } return; }
    if (!el.dataset.path || el.type === 'checkbox') return;
    set(content, el.dataset.path, el.value);
    // 一覧の見出しを更新
    const item = el.closest('[data-item]');
    if (item) {
      const ip = item.dataset.item; const lp = ip.replace(/\.\d+$/, '');
      const sec = SECTIONS.find(s => s.id === current());
      const def = sec && findList(sec.fields, lp);
      const t = item.querySelector(':scope > .item__h [data-title]');
      if (def && t) t.textContent = def.title(get(content, ip)) || '（未入力）';
    }
    updateDirty();
  });
  app.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.filter) { filters[el.dataset.type][el.dataset.filter] = el.value; renderRecords(el.dataset.type, document.getElementById('body')); return; }
    if (!el.dataset.path) return;
    if (el.type === 'checkbox') set(content, el.dataset.path, el.checked);
    if (el.hasAttribute('data-rerender')) rerender();
    updateDirty();
  });

  app.addEventListener('click', async e => {
    const tr = e.target.closest('tr[data-open]');
    if (tr) { const [t, id] = tr.dataset.open.split(':'); return openRecord(t, id); }
    const a = e.target.closest('[data-act]');
    if (!a) {
      if (e.target.closest('a.nav') || (e.target.closest('.shell.menu-open') && !e.target.closest('.side'))) { document.getElementById('side')?.classList.remove('is-open'); document.querySelector('.shell')?.classList.remove('menu-open'); }
      return;
    }
    const act = a.dataset.act, path = a.dataset.path, i = Number(a.dataset.i);
    const arr = path ? get(content, path) : null;
    const swap = (x, y) => { if (y < 0 || y >= arr.length) return; [arr[x], arr[y]] = [arr[y], arr[x]]; };
    try {
      switch (act) {
        case 'menu': { const o = document.getElementById('side').classList.toggle('is-open'); document.querySelector('.shell').classList.toggle('menu-open', o); return; }
        case 'logout': if (isDirty() && !confirm('保存していない変更があります。ログアウトしますか？')) return; await api('logout', { method: 'POST' }); saved = JSON.stringify(content); renderLogin(); return;
        case 'save': return save();
        case 'toggle': open.has(path) ? open.delete(path) : open.add(path); return rerender();
        case 'up': swap(i, i - 1); break;
        case 'down': swap(i, i + 1); break;
        case 'del': {
          const label = typeof arr[i] === 'object' ? 'この項目' : `「${String(arr[i]).slice(0, 20)}」`;
          if (!confirm(`${label}を削除しますか？（保存するまでサイトには反映されません）`)) return;
          arr.splice(i, 1); break;
        }
        case 'addstr': set(content, path, [...(arr || []), '']); break;
        case 'additem': {
          const sec = SECTIONS.find(s => s.id === current());
          const def = findList(sec.fields, path);
          const list = arr || []; list.push(def.make()); set(content, path, list);
          open.add(`${path}.${list.length - 1}`); break;
        }
        case 'clear': set(content, path, ''); break;
        case 'upload': { const files = await pickFiles(false); if (!files.length) return; const [u] = await upload(files); set(content, path, u); toast('画像をアップロードしました'); break; }
        case 'gadd': {
          const files = await pickFiles(true); if (!files.length) return;
          const max = Number(a.dataset.max) || Infinity;
          const list = arr || [];
          const urls = await upload(files.slice(0, Math.max(0, max - list.length)));
          set(content, path, list.concat(urls)); toast('写真を追加しました'); break;
        }
        case 'gdel': if (!confirm('この写真を外しますか？')) return; arr.splice(i, 1); break;
        case 'gup': swap(i, i - 1); break;
        case 'gdown': swap(i, i + 1); break;
        case 'reload': await loadRecords(); shell(); toast('最新の状態に更新しました'); return;
        case 'csv': csv(a.dataset.type); return;
        default: return;
      }
      rerender();
    } catch (err) { if (err.message !== 'auth') toast(err.message, true); }
  });

  async function save() {
    const btn = document.getElementById('save');
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    try {
      await api('content', { method: 'PUT', body: content });
      saved = JSON.stringify(content);
      toast('保存しました。サイトに反映されています。');
    } catch (err) { if (err.message !== 'auth') toast(err.message, true); }
    if (btn) btn.textContent = '保存する';
    updateDirty();
  }

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (isDirty()) save(); }
  });
  window.addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', () => { if (content) { open.clear(); shell(); window.scrollTo(0, 0); } });

  async function loadRecords() {
    const [r, c] = await Promise.all([api('reservations'), api('contacts')]);
    records.reservations = r; records.contacts = c;
  }

  async function boot() {
    try {
      session = await api('session');
      content = await api('content');
      saved = JSON.stringify(content);
      await loadRecords();
      shell();
    } catch (err) { if (err.message !== 'auth') app.innerHTML = `<p style="padding:40px">${esc(err.message)}</p>`; }
  }
  boot();
})();
