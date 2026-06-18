/*
 * Be Grace ─ 今日の私診断（無料の玄関）
 * 画面遷移と診断の実行
 */

(function () {
  'use strict';

  /* リンクは config.js で管理（書き換える場所はそこ1か所だけ） */
  const CFG = (typeof CONFIG !== 'undefined' && CONFIG) || {};

  /* ---------- アクセス3段階（モード） ----------
   * ①1回(oneshot) / ②14日(trial14) / ③無期限(member)
   * URLの ?plan= で切替。日数・回数は localStorage が覚える（ソフトな鍵）。
   */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  const MODES = {
    oneshot: {
      limit: 'days', max: 1, // 1日（その日は何度でも・翌日からロック）
      inviteLead:
        '今のあなたに合う整え方を、一緒に見つけませんか？🤍<br />この診断を引き続き使える、特別なご案内があります。',
      ctaLabel: 'ご案内を見る',
      ctaUrl: CFG.CONSULT_URL || '#',
      lockLead:
        '無料でのお試しは、ここまで🤍<br />今のあなたに合う整え方を、一緒に見つけませんか？<br />この診断を引き続き使える、特別なご案内があります。',
    },
    trial30: {
      limit: 'days', max: 30, // フロントエンド（ミニ講座）用・30日
      summary: true, // 30日の最後に「あなたの30日まとめ」を出す
      ctaLabel: '🤍 Be Grace を知る', // 30日の最後に、次（会員）への誘導
      ctaUrl: CFG.MEMBER_URL || '#',
    },
    member: { limit: 'none' },
  };

  function getMode() {
    // 通常は自分のURLの ?plan= を見る。固定ページに埋め込まれた場合は
    // 親ページ（begracenao.com/shindan/?plan=14 等）の ?plan= を読む。
    let search = location.search;
    try {
      if (window.parent && window.parent !== window && window.parent.location) {
        search = window.parent.location.search || search;
      }
    } catch (e) {
      /* 別ドメイン埋め込み時はアクセスできないので自分のを使う */
    }
    // この30日アプリは「30日モード」固定。アイコンから開いても必ず30日になる。
    return 'trial30';
  }
  const mode = getMode();
  const cfg = MODES[mode];
  const lsKey = (s) => `bg_${mode}_${s}`;

  function isLocked() {
    if (cfg.limit === 'count') {
      return Number(lsGet(lsKey('count')) || 0) >= cfg.max;
    }
    if (cfg.limit === 'days') {
      const start = Number(lsGet(lsKey('start')) || 0);
      if (!start) return false;
      return Math.floor((Date.now() - start) / 86400000) >= cfg.max;
    }
    return false; // member は無期限
  }

  function recordUse() {
    if (cfg.limit === 'count') {
      lsSet(lsKey('count'), String(Number(lsGet(lsKey('count')) || 0) + 1));
    } else if (cfg.limit === 'days') {
      if (!lsGet(lsKey('start'))) lsSet(lsKey('start'), String(Date.now()));
    }
  }

  /* ---------- 30日の記録（その人のスマホに、1日1件） ---------- */
  function todayStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function logResult(type, mood) {
    try {
      const log = JSON.parse(lsGet('bg_log') || '{}');
      log[todayStr()] = { type: type.id, mood: mood }; // 同じ日は上書き＝1日1件
      lsSet('bg_log', JSON.stringify(log));
    } catch (e) {}
  }
  // 「あなたの30日まとめ」を組み立てる（開始日以降の記録だけ集計）
  function buildSummaryHtml() {
    let log = {};
    try { log = JSON.parse(lsGet('bg_log') || '{}'); } catch (e) {}
    let startStr = '';
    const startMs = Number(lsGet(lsKey('start')) || 0);
    if (startMs) {
      const s = new Date(startMs);
      const pad = (n) => String(n).padStart(2, '0');
      startStr = `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
    }
    const entries = Object.keys(log)
      .filter((d) => !startStr || d >= startStr)
      .map((d) => log[d]);
    if (!entries.length) return '30日間、ほんとうにおつかれさまでした🤍';
    const cnt = {};
    let suf = 0;
    let bea = 0;
    entries.forEach((e) => {
      cnt[e.type] = (cnt[e.type] || 0) + 1;
      if (e.mood === 'beautiful') bea += 1;
      else suf += 1;
    });
    let topId = null;
    let topN = 0;
    Object.keys(cnt).forEach((id) => {
      if (cnt[id] > topN) { topN = cnt[id]; topId = id; }
    });
    const topName = (typeof TYPES !== 'undefined' && TYPES[topId] && TYPES[topId].name) || '';
    let closing;
    if (suf > bea) closing = '立ち止まって、自分を整えることを大切にできた1ヶ月でした。その積み重ねが、これからのあなたを支えていきます🤍';
    else if (bea > suf) closing = '軽やかに、前へ進めた1ヶ月でした。この流れを、これからも大切にしてくださいね🤍';
    else closing = '整える日も、進む日も、どちらも大切にできた1ヶ月でした🤍';
    return (
      '<span style="font-family:\'Cormorant Garamond\',serif;letter-spacing:.22em;font-size:12px;text-transform:uppercase;color:var(--gold-deep);display:block;margin-bottom:18px">Your 30 Days</span>' +
      'この1ヶ月、いちばん多かったのは<br>「<strong>' + topName + '</strong>」でした。<br><br>' +
      '整えながら進む日 <strong>' + suf + '日</strong>　／　進みやすい日 <strong>' + bea + '日</strong><br><br>' +
      closing
    );
  }

  function showLocked() {
    const cta = document.getElementById('lockedCta');
    if (cfg.summary) {
      // 30日モード：最後に「あなたの30日まとめ」＋次（会員）への誘導を出す
      document.getElementById('lockedLead').innerHTML = buildSummaryHtml();
      if (cfg.ctaLabel) {
        cta.textContent = cfg.ctaLabel;
        cta.href = cfg.ctaUrl;
        cta.style.display = '';
      } else {
        cta.style.display = 'none';
      }
      show('locked');
      return;
    }
    document.getElementById('lockedLead').innerHTML = cfg.lockLead || '';
    if (cfg.ctaLabel) {
      cta.textContent = cfg.ctaLabel;
      cta.href = cfg.ctaUrl;
      cta.style.display = '';
    } else {
      cta.style.display = 'none';
    }
    show('locked');
  }

  /* ---------- 状態 ---------- */
  const state = {
    birthdate: '',
    feelings: [], // 選ばれた feeling id（最大3）
    step: 0,
  };

  /* ---------- DOM ---------- */
  const screens = {};
  document.querySelectorAll('.screen').forEach((el) => {
    screens[el.dataset.screen] = el;
  });
  const stepEls = Array.from(document.querySelectorAll('.step'));
  const dots = Array.from(document.querySelectorAll('.dot'));
  const feelingsWrap = document.getElementById('feelings');
  const selectCount = document.getElementById('selectCount');

  /* ---------- 画面切替 ---------- */
  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove('is-active'));
    screens[name].classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showStep(i) {
    state.step = i;
    stepEls.forEach((el) => el.classList.toggle('is-active', Number(el.dataset.step) === i));
    dots.forEach((d) => d.classList.toggle('is-on', Number(d.dataset.step) <= i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- 体調チップ生成 ---------- */
  function buildFeelings() {
    feelingsWrap.innerHTML = '';
    FEELINGS.forEach((f) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = f.label;
      b.dataset.id = f.id;
      b.dataset.tone = f.mood === 'beautiful' ? 'shine' : 'rest';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => toggleFeeling(f.id, b));
      feelingsWrap.appendChild(b);
    });
  }

  function toggleFeeling(id, btn) {
    const i = state.feelings.indexOf(id);
    if (i >= 0) {
      state.feelings.splice(i, 1);
      btn.classList.remove('is-on');
      btn.setAttribute('aria-pressed', 'false');
    } else {
      if (state.feelings.length >= 3) return;
      state.feelings.push(id);
      btn.classList.add('is-on');
      btn.setAttribute('aria-pressed', 'true');
    }
    updateFeelingUI();
  }

  function updateFeelingUI() {
    const n = state.feelings.length;
    selectCount.textContent = `${n} / 3`;
    const full = n >= 3;
    feelingsWrap.querySelectorAll('.chip').forEach((c) => {
      const on = c.classList.contains('is-on');
      c.classList.toggle('is-disabled', full && !on);
    });
    const submit = document.querySelector('.step[data-step="1"] .btn');
    submit.disabled = n !== 3;
  }

  /* ---------- 生年月日（年・月・日のプルダウン。任意） ---------- */
  const birthY = document.getElementById('birthYear');
  const birthM = document.getElementById('birthMonth');
  const birthD = document.getElementById('birthDay');
  const birthPreview = document.getElementById('birthPreview');

  /* プルダウンの選択肢を用意（先頭は「年/月/日」の見出し） */
  (function buildBirthSelects() {
    const opt = (val, label) => `<option value="${val}">${label}</option>`;
    const thisYear = new Date().getFullYear();
    let y = opt('', '年');
    for (let v = thisYear; v >= 1940; v--) y += opt(v, `${v}年`);
    let m = opt('', '月');
    for (let v = 1; v <= 12; v++) m += opt(v, `${v}月`);
    let d = opt('', '日');
    for (let v = 1; v <= 31; v++) d += opt(v, `${v}日`);
    birthY.innerHTML = y;
    birthM.innerHTML = m;
    birthD.innerHTML = d;
  })();

  /* 3つ揃ったら 'YYYY-MM-DD'、揃わなければ '' を返す */
  function currentBirthdate() {
    const y = birthY.value, m = birthM.value, d = birthD.value;
    if (!y || !m || !d) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  function updateBirthPreview() {
    const v = currentBirthdate();
    const r = v ? bornRhythm(v) : null;
    if (!r) {
      birthPreview.hidden = true;
      return;
    }
    birthPreview.querySelector('.rhythm-name').innerHTML = `${r.symbol}&ensp;${r.name}`;
    birthPreview.querySelector('.rhythm-reading').textContent = r.reading;
    birthPreview.hidden = false;
  }
  [birthY, birthM, birthD].forEach((el) => el.addEventListener('change', updateBirthPreview));

  /* ---------- 進む / 戻る ---------- */
  function next(from) {
    if (from === 0) {
      // 生年月日は任意。3つ揃えた人だけ「生まれ持ったあなたのリズム」が届く
      state.birthdate = currentBirthdate();
      showStep(1);
    } else if (from === 1) {
      if (state.feelings.length !== 3) return;
      runDiagnosis();
    }
  }

  function back() {
    if (state.step === 0) {
      show('welcome');
    } else {
      showStep(state.step - 1);
    }
  }

  /* ---------- 診断実行 ---------- */
  function runDiagnosis() {
    show('loading');
    setTimeout(() => {
      const { type, mood } = diagnose(state.feelings);
      recordUse(); // 1日/30日モードの鍵（開始日・回数を記録）
      logResult(type, mood); // 30日まとめ用に、その日の結果を記録
      renderResult(type, mood);
      show('result');
    }, 1700);
  }

  /* 誕生日が近いとき（前後7日以内）のやさしい一言 */
  function birthdayNote() {
    if (!state.birthdate) return '';
    const [, m, d] = state.birthdate.split('-').map(Number);
    const today = new Date();
    const thisYear = new Date(today.getFullYear(), m - 1, d);
    const diff = Math.round((thisYear - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
    if (Math.abs(diff) <= 7) {
      return 'お誕生日のころですね。あなたが生まれてくれて、ありがとう。';
    }
    return '';
  }

  /* 選んだ言葉を「・」でつなぐ */
  function selectedLabels() {
    return state.feelings
      .map((id) => (FEELINGS.find((f) => f.id === id) || {}).label)
      .filter(Boolean)
      .join('・');
  }

  /* 改行を「、。！？の後ろ」だけに限定して、1文字ぼっち改行を防ぐ。
     CSSの word-break:keep-all と組で使う。
     句読点が1つも無い長文は、真ん中に改行候補を入れて"半分ずつ"に割る。 */
  /* 短い・中央ぞろえの言葉用：句読点(、。！？)の後ろに改行候補(<wbr>)を入れ、
     区切りの無い長い区間は真ん中で割る。CSSの word-break:keep-all と組で、
     1文字ぼっち改行を防ぎ、行を"半分ずつ"気持ちよく折り返す。
     （読み応えの本文には使わない＝そちらは自然な禁則処理に任せる） */
  function phr(s) {
    s = String(s);
    let result = '';
    let run = '';
    const flush = () => {
      const chars = [...run];
      if (chars.length > 13) {
        const mid = Math.ceil(chars.length / 2);
        result += chars.slice(0, mid).join('') + '<wbr>' + chars.slice(mid).join('');
      } else {
        result += run;
      }
      run = '';
    };
    for (const ch of s) {
      if (ch === '、' || ch === '。' || ch === '！' || ch === '？') {
        flush();
        result += ch + '<wbr>';
      } else if (ch === '\n') {
        flush();
        result += '\n';
      } else {
        run += ch;
      }
    }
    flush();
    return result;
  }

  function renderResult(type, mood) {
    const root = document.getElementById('resultInner');
    document.documentElement.style.setProperty('--type-accent', type.accent);

    const bday = birthdayNote();
    // 気づき＆アドバイスは"読み応えの本文"なので、自然な改行（禁則処理）に任せる（phrを通さない）
    const awareness = `あなたが選んだ「${selectedLabels()}」から、今日は『${type.name}』とお見受けしました。`;
    const verdictLabel = mood === 'beautiful' ? '今日は進みやすい日' : '今日は整えながら進む日';
    const advList = type.advices || [];
    const advice = advList.length ? advList[Math.floor(Math.random() * advList.length)] : '';

    const rhythm = bornRhythm(state.birthdate);
    const message = phr(beGraceMessage(type)).replace(/\n/g, '<br>');
    // アファメーションは3つの中から毎回ランダムで1つ
    const affList = type.affirmations || [];
    const affirmation = affList.length
      ? phr(affList[Math.floor(Math.random() * affList.length)])
      : '';

    // 締めの誘い：モードで出し分け（無期限は売り込みなし）
    const doorLine = `<p class="door-line">${phr('毎日の小さな選択が、未来を作る。今日のあなたが、どんな状態でも大丈夫。')}</p>`;
    const doorInvite =
      mode === 'member' || mode === 'trial30'
        ? '<p class="door-invite">また明日も、整えにきてくださいね🤍</p>'
        : `<p class="door-invite">${phr(cfg.inviteLead)}</p>
           <a class="btn btn--soft door-cta" href="${cfg.ctaUrl}" target="_blank" rel="noopener">${cfg.ctaLabel}</a>`;
    const doorHtml = `<div class="result-door"><div class="door-mark">❀</div>${doorLine}${doorInvite}</div>`;

    // もう一度：どのモードでも、その日のうちは何度でも診断できる（間違えても安心）
    const restartHtml =
      '<div class="result-actions"><button class="btn btn--ghost" data-action="restart">もう一度、診断する</button></div>';

    root.innerHTML = `
      <p class="result-eyebrow">Today&rsquo;s Diagnosis</p>
      ${bday ? `<p class="result-personal">${bday}</p>` : ''}

      <div class="result-card" style="--type-accent:${type.accent}">
        <div class="result-symbol">${type.symbol}</div>
        <h2 class="result-type">${type.name}</h2>
        <p class="result-tagline">${phr(type.tagline)}</p>
      </div>

      ${
        rhythm
          ? `<div class="result-rhythm" style="animation-delay:.08s">
        <span class="rhythm-label">Your Nature ─ 生まれ持ったあなたのリズム</span>
        <p class="rhythm-name">${rhythm.symbol}&ensp;${rhythm.name}</p>
        <p class="rhythm-reading">${rhythm.reading}</p>
      </div>`
          : ''
      }

      <div class="result-block result-block--today" style="animation-delay:.15s">
        <span class="block-label">Today</span>
        <p class="verdict">${verdictLabel}</p>
        <p class="block-body">${awareness}</p>
        <p class="block-body">${advice}</p>
      </div>

      <div class="result-block result-block--affirm" style="animation-delay:.45s">
        <span class="block-label">Affirmation</span>
        <p class="affirm-quote">${affirmation}</p>
      </div>

      <div class="result-closing result-message" style="animation-delay:.6s">
        <span class="message-label">Be Grace Message</span>
        <div class="closing-mark">⟡</div>
        <p class="message-body">${message}</p>
      </div>

      ${doorHtml}

      ${restartHtml}

      <p class="disclaimer">
        ※ これは医療的な診断ではなく、今日の自分にやさしく気づくためのセルフケアの診断です。
      </p>
    `;
  }

  function restart() {
    state.birthdate = '';
    state.feelings = [];
    birthY.value = '';
    birthM.value = '';
    birthD.value = '';
    birthPreview.hidden = true;
    document.querySelectorAll('#feelings .chip').forEach((x) => {
      x.classList.remove('is-on', 'is-disabled');
      x.setAttribute('aria-pressed', 'false');
    });
    updateFeelingUI();
    showStep(0);
    show('welcome');
  }

  /* ---------- イベント委譲 ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    if (action === 'start') {
      showStep(0);
      show('quiz');
    } else if (action === 'next') {
      next(Number(t.dataset.from));
    } else if (action === 'back') {
      back();
    } else if (action === 'restart') {
      restart();
    }
  });

  /* ---------- 初期化 ---------- */
  buildFeelings();
  updateFeelingUI();
  // 「無料」表記は①無料モードのときだけ（②有料・③無期限では出さない）
  if (mode !== 'oneshot') {
    const hn = document.querySelector('.hero-note');
    if (hn) hn.textContent = '所要 約1分';
  }
  if (isLocked()) showLocked(); // 1回／14日を使い切っていたら、入口の代わりに案内画面
})();
