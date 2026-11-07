(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- メニュー ----------
  const menuBtn = $('.menu-btn'), gnav = $('#gnav');
  if (menuBtn && gnav) {
    const set = open => {
      menuBtn.setAttribute('aria-expanded', String(open));
      gnav.classList.toggle('is-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    menuBtn.addEventListener('click', () => set(menuBtn.getAttribute('aria-expanded') !== 'true'));
    gnav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }

  // ---------- ギャラリー ----------
  $$('[data-gallery]').forEach(g => {
    const main = $('.gallery__main img', g);
    $$('button[data-src]', g).forEach(btn => btn.addEventListener('click', () => {
      main.src = btn.dataset.src;
      $$('button[aria-current]', g).forEach(b => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'true');
    }));
  });

  // ---------- 目次：スマホ・タブレットでは折りたたむ ----------
  const toc = $('[data-toc]');
  if (toc) {
    const mq = window.matchMedia('(max-width: 1000px)');
    const sync = () => { toc.open = !mq.matches; };
    sync();
    mq.addEventListener('change', sync);
    toc.addEventListener('click', e => { if (e.target.closest('a') && mq.matches) toc.open = false; });
    // PCでは常に開いた状態にする
    $('summary', toc).addEventListener('click', e => { if (!mq.matches) e.preventDefault(); });
  }

  // ---------- 表示切替 ----------
  $$('[data-toggle]').forEach(cb => {
    const target = $(cb.dataset.toggle);
    const sync = () => { target.hidden = !cb.checked; };
    cb.addEventListener('change', sync); sync();
  });

  // ---------- 郵便番号 → 住所 ----------
  $$('[data-zip]').forEach(input => {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/[^0-9]/g, '');
      if (digits.length === 7 && window.AjaxZip3) {
        const [pref, city] = input.dataset.zip.split(',');
        window.AjaxZip3.zip2addr(input, '', pref, city);
      }
    });
  });

  // ---------- 予約：選択中の車種 ----------
  const rsvForm = $('#rsv-form');
  if (rsvForm) {
    const upd = () => {
      const r = $('input[name=bike]:checked', rsvForm);
      if (!r) return;
      $('[data-sum-name]').textContent = r.value;
      $('[data-sum-daily]').textContent = r.dataset.daily ? '¥' + r.dataset.daily : '—';
      $('[data-sum-monthly]').textContent = r.dataset.monthly ? '¥' + r.dataset.monthly : '—';
      const box = $('[data-sum-img]');
      box.innerHTML = r.dataset.img ? `<img src="${r.dataset.img}" alt="">` : '<div class="noimg"><span>画像準備中</span></div>';
    };
    $$('input[name=bike]', rsvForm).forEach(r => r.addEventListener('change', upd));
    // 車種ページから来た場合（?bike=slug）はその車種を選択
    const pre = new URLSearchParams(location.search).get('bike');
    const preInput = pre && $$('input[name=bike]', rsvForm).find(r => r.dataset.slug === pre);
    if (preInput) { preInput.checked = true; upd(); }
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    $('#startDate').min = today; $('#endDate').min = today;
    $('#startDate').addEventListener('change', e => { $('#endDate').min = e.target.value || today; });
  }

  // ---------- フォーム共通 ----------
  const LABELS = {
    start: '貸出日', end: '返却日', bike: 'ビジネスバイク', quantity: '台数', accessory: '付属品',
    name: '会社名もしくは個人名', kana: 'フリガナ', zip: '郵便番号', pref: '都道府県', city: '市区町村', street: '番地・建物名',
    email: 'メールアドレス', phone: '携帯電話番号',
    deliveryZip: '納車先 郵便番号', deliveryPref: '納車先 都道府県', deliveryCity: '納車先 市区町村', deliveryStreet: '納車先 番地・建物名',
    note: 'ご要望・備考'
  };

  function collect(form, type) {
    const fd = new FormData(form);
    const d = Object.fromEntries(fd.entries());
    d.agree = !!fd.get('agree');
    if (type === 'reservation') {
      d.start = [d.startDate, d.startTime].filter(Boolean).join(' ');
      d.end = [d.endDate, d.endTime].filter(Boolean).join(' ');
      ['startDate', 'startTime', 'endDate', 'endTime'].forEach(k => delete d[k]);
      const deliv = form.querySelector('[data-toggle]');
      if (deliv && !deliv.checked) ['deliveryZip', 'deliveryPref', 'deliveryCity', 'deliveryStreet'].forEach(k => { d[k] = ''; });
    }
    return d;
  }

  function validate(d, type) {
    const e = {};
    const need = type === 'reservation'
      ? ['start', 'end', 'bike', 'quantity', 'accessory', 'name', 'kana', 'zip', 'pref', 'city', 'street', 'email', 'phone']
      : ['name', 'email', 'message'];
    const lab = type === 'reservation' ? LABELS : { name: 'お名前', email: 'メールアドレス', message: 'お問い合わせ内容' };
    need.forEach(k => { if (!String(d[k] || '').trim()) e[k] = `${lab[k]}を入力してください`; });
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = 'メールアドレスの形式をご確認ください';
    if (type === 'reservation') {
      if (d.email && d.emailConfirm !== d.email) e.emailConfirm = 'メールアドレスが一致しません';
      if (d.zip && !/^\d{3}-?\d{4}$/.test(d.zip.trim())) e.zip = '郵便番号は7桁の数字で入力してください';
      if (d.phone && !/^[0-9\-]{10,14}$/.test(d.phone.trim())) e.phone = '電話番号の形式をご確認ください（例：090-1234-5678）';
      if (d.start && d.end && d.end < d.start) e.end = '返却日は貸出日以降を指定してください';
    }
    if (!d.agree) e.agree = type === 'reservation' ? '貸渡約款・個人情報保護方針への同意が必要です' : '内容確認のチェックを入れてください';
    return e;
  }

  function showErrors(form, errors) {
    $$('[data-field]', form).forEach(f => {
      const msg = errors[f.dataset.field] || '';
      f.classList.toggle('is-error', !!msg);
      const p = $('.f__err', f);
      if (p) p.textContent = msg;
    });
    const first = $('.is-error', form);
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const inp = $('input:not([type=radio]), select, textarea', first);
      if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 350);
    }
    return !first;
  }

  function step(form, name) {
    $$('[data-step]', form).forEach(s => { s.hidden = s.dataset.step !== name; });
    const flow = $('[data-flow]');
    if (flow) {
      const idx = { input: 0, confirm: 1, done: 2 }[name];
      $$('li', flow).forEach((li, i) => li.classList.toggle('is-on', i <= idx));
    }
    const side = $('[data-summary]');
    if (side) side.hidden = name === 'done';
    const top = (flow || form).getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  async function send(form, type, d, btn) {
    const errBox = $$('[data-form-error]', form).find(el => !el.closest('[hidden]'));
    if (errBox) errBox.hidden = true;
    // GitHub Pages の確認用サイトでは送信できない
    if (document.body.dataset.static) {
      if (errBox) { errBox.textContent = 'こちらはデザイン確認用のサイトのため、送信はできません。'; errBox.hidden = false; }
      return;
    }
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.textContent = '送信中…';
    try {
      const res = await fetch(`/api/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      const json = await res.json().catch(() => ({}));
      if (res.ok) { step(form, 'done'); return; }
      if (json.errors) {
        if (type === 'reservation') step(form, 'input');
        showErrors(form, json.errors);
      } else if (errBox) { errBox.textContent = json.error || '送信できませんでした。時間をおいて再度お試しください。'; errBox.hidden = false; }
    } catch {
      if (errBox) { errBox.textContent = '通信エラーが発生しました。電波状況をご確認のうえ再度お試しください。'; errBox.hidden = false; }
    } finally {
      btn.disabled = false; btn.innerHTML = orig;
    }
  }

  $$('form[data-form]').forEach(form => {
    const type = form.dataset.form;
    let data = null;
    // 入力中のエラー解除
    form.addEventListener('input', e => {
      const f = e.target.closest('[data-field]');
      if (f && f.classList.contains('is-error')) { f.classList.remove('is-error'); const p = $('.f__err', f); if (p) p.textContent = ''; }
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      data = collect(form, type);
      if (!showErrors(form, validate(data, type))) return;
      if (type === 'reservation') {
        const rows = ['start', 'end', 'bike', 'quantity', 'accessory', 'name', 'kana', 'zip', 'pref', 'city', 'street', 'email', 'phone', 'deliveryZip', 'deliveryPref', 'deliveryCity', 'deliveryStreet', 'note']
          .filter(k => data[k])
          .map(k => `<div><dt>${LABELS[k]}</dt><dd></dd></div>`);
        const dl = $('[data-confirm]', form);
        dl.innerHTML = rows.join('');
        const keys = ['start', 'end', 'bike', 'quantity', 'accessory', 'name', 'kana', 'zip', 'pref', 'city', 'street', 'email', 'phone', 'deliveryZip', 'deliveryPref', 'deliveryCity', 'deliveryStreet', 'note'].filter(k => data[k]);
        $$('dd', dl).forEach((dd, i) => { dd.textContent = data[keys[i]]; });
        step(form, 'confirm');
      } else {
        send(form, type, data, $('[data-send]', form));
      }
    });
    const back = $('[data-back]', form);
    if (back) back.addEventListener('click', () => step(form, 'input'));
    const sendBtn = $('[data-step=confirm] [data-send]', form);
    if (sendBtn) sendBtn.addEventListener('click', () => send(form, type, data, sendBtn));
  });
})();
