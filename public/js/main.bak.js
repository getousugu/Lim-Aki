// ============================================================
// State
// ============================================================
let gameData = null;
let activePool = [];
let targetIdentity = null;
let questionCount = 0;
let currentQuestion = null;
let selectedAnswerId = null;
let acIndex = -1;

// ============================================================
// Question Definitions
//
// type:
//   'list'   … 候補一覧からサジェスト付きフリー入力
//   'number' … 数値入力
//   'todo'   … データ未整備（選択不可・グレーアウト表示）
//
// implemented: false にするとグレーアウトで選択不可（表示はする）
// ============================================================
const QUESTIONS = [
    // ====================== 囚人 ======================
    {
        section: '囚人',
        id: 'prisoner_name',
        label: 'その囚人は…？',
        inputLabel: '囚人名',
        type: 'list',
        hint: '例: イサン、ファウスト、ムルソー…',
        getValues: id => [id.character_name],
        getKnown:  pool => [...new Set(pool.map(id => id.character_name))]
    },
    {
        section: '囚人',
        id: 'prisoner_num',
        label: 'その囚人の囚人番号は？（数値）',
        inputLabel: '囚人番号',
        type: 'number',
        hint: '1〜13（10を除く）',
        judge: (id, n) => id.prisoner_num === n,
        getKnown: () => null
    },
    {
        section: '囚人',
        id: 'prisoner_num_gte',
        label: '囚人番号は N 以上？（数値）',
        inputLabel: '囚人番号（N以上）',
        type: 'number',
        hint: '例: 5',
        judge: (id, n) => id.prisoner_num >= n,
        getKnown: () => null
    },
    {
        section: '囚人',
        id: 'prisoner_num_lte',
        label: '囚人番号は N 以下？（数値）',
        inputLabel: '囚人番号（N以下）',
        type: 'number',
        hint: '例: 8',
        judge: (id, n) => id.prisoner_num <= n,
        getKnown: () => null
    },
    {
        section: '囚人',
        id: 'gender',
        label: 'その囚人は〔男性・女性〕？',
        inputLabel: '性別',
        type: 'todo',
        hint: 'データ未整備',
        getValues: () => [],
        getKnown:  () => []
    },

    // ====================== スキル ======================
    {
        section: 'スキル（通常）',
        id: 'has_sin',
        label: '(スキル1〜守備) 罪悪属性は？',
        inputLabel: '罪悪属性',
        type: 'list',
        hint: '怠惰 / 傲慢 / 憤怒 / 暴食 / 色欲 / 憂鬱 / 嫉妬',
        getValues: id => id.sin_types,
        getKnown:  pool => [...new Set(pool.flatMap(id => id.sin_types))]
    },
    {
        section: 'スキル（通常）',
        id: 'has_attack',
        label: '(スキル1〜守備) 物理属性は？',
        inputLabel: '物理属性',
        type: 'list',
        hint: '斬 / 貫 / 打',
        getValues: id => id.attack_types,
        getKnown:  pool => [...new Set(pool.flatMap(id => id.attack_types))]
    },
    {
        section: 'スキル（通常）',
        id: 'defense_type',
        label: '守備スキルの種類は？',
        inputLabel: '守備スキル',
        type: 'list',
        hint: '防御 / 回避 / 反撃',
        getValues: id => id.defense_types || [],
        getKnown:  () => ['防御', '回避', '反撃']
    },
    {
        section: 'スキル（通常）',
        id: 'coin_count',
        label: '(スキル1〜守備) コイン枚数は？（数値）',
        inputLabel: 'コイン枚数',
        type: 'todo',
        hint: 'データ未整備',
        getValues: () => [],
        getKnown:  () => null
    },
    {
        section: 'スキル（通常）',
        id: 'skill_keyword',
        label: 'スキルに特定キーワードがある？',
        inputLabel: 'スキルキーワード',
        type: 'list',
        hint: 'データ未整備（全キーワードから検索）',
        getValues: () => [],
        getKnown:  () => gameData?.metadata?.all_keywords || []
    },

    // スキル詳細（2つ目以降・未整備）
    {
        section: 'スキル（詳細）',
        id: 'sin_detail',
        label: '各スキル 2つ目以降の罪悪属性は？',
        inputLabel: '罪悪属性（詳細）',
        type: 'todo',
        hint: 'データ未整備',
        getValues: () => [],
        getKnown:  () => []
    },
    {
        section: 'スキル（詳細）',
        id: 'attack_detail',
        label: '各スキル 2つ目以降の物理属性は？',
        inputLabel: '物理属性（詳細）',
        type: 'todo',
        hint: 'データ未整備',
        getValues: () => [],
        getKnown:  () => []
    },
    {
        section: 'スキル（詳細）',
        id: 'coin_detail',
        label: '各スキル 2つ目以降のコイン枚数は？',
        inputLabel: 'コイン枚数（詳細）',
        type: 'todo',
        hint: 'データ未整備',
        getValues: () => [],
        getKnown:  () => null
    },
    {
        section: 'スキル（詳細）',
        id: 'keyword_detail',
        label: '各スキル 2つ目以降のキーワードは？',
        inputLabel: 'スキルキーワード（詳細）',
        type: 'list',
        hint: 'データ未整備（全キーワードから検索）',
        getValues: () => [],
        getKnown:  () => gameData?.metadata?.all_keywords || []
    },

    // ====================== キーワード ======================
    {
        section: 'キーワード',
        id: 'battle_keyword',
        label: '戦闘キーワードを持つ？',
        inputLabel: '戦闘キーワード',
        type: 'list',
        hint: '火傷 / 出血 / 振動 / 破裂 / 沈潜 / 呼吸 / 充電 ...',
        getValues: id => id.battle_keywords,
        getKnown:  () => gameData?.metadata?.all_keywords || ['火傷', '出血', '振動', '破裂', '沈潜', '呼吸', '充電']
    },
    {
        section: 'キーワード',
        id: 'kw_apply_enemy',
        label: 'キーワードを敵に付与する？',
        inputLabel: 'キーワード（敵付与）',
        type: 'list',
        hint: 'データ未整備（全キーワードから検索）',
        getValues: () => [],
        getKnown:  () => gameData?.metadata?.all_keywords || []
    },
    {
        section: 'キーワード',
        id: 'kw_apply_self',
        label: 'キーワードを自身に付与する？',
        inputLabel: 'キーワード（自己付与）',
        type: 'list',
        hint: 'データ未整備（全キーワードから検索）',
        getValues: () => [],
        getKnown:  () => gameData?.metadata?.all_keywords || []
    },
    {
        section: 'キーワード',
        id: 'kw_apply_ally',
        label: 'キーワードを味方に付与する？',
        inputLabel: 'キーワード（味方付与）',
        type: 'list',
        hint: 'データ未整備（全キーワードから検索）',
        getValues: () => [],
        getKnown:  () => gameData?.metadata?.all_keywords || []
    },
    {
        section: 'キーワード',
        id: 'ego_kw_any',
        label: 'E.G.O外部効果でキーワードを利用可能になる？（特あり）',
        inputLabel: 'EGO外部キーワード有無',
        type: 'list',
        hint: 'データ未整備（全キーワードから検索）',
        getValues: () => [],
        getKnown:  () => gameData?.metadata?.all_keywords || []
    },
    {
        section: 'キーワード',
        id: 'ego_kw_specific',
        label: 'E.G.O外部効果で特定キーワードを利用可能になる？',
        inputLabel: 'EGO外部キーワード（指定）',
        type: 'list',
        hint: 'データ未整備（全キーワードから検索）',
        getValues: () => [],
        getKnown:  () => gameData?.metadata?.all_keywords || []
    },

    // ====================== 所属 ======================
    {
        section: '所属',
        id: 'affiliation',
        label: '所属は？',
        inputLabel: '所属',
        type: 'list',
        hint: '例: LCB囚人、剣契、W社、ピークォド号…',
        getValues: id => id.affiliations,
        getKnown:  pool => [...new Set(pool.flatMap(id => id.affiliations))]
    },
    {
        section: '所属',
        id: 'is_association',
        label: '協会所属（〇協会に所属）？',
        inputLabel: '所属（協会名）',
        type: 'list',
        hint: '例: セブン協会、リウ協会…',
        getValues: id => id.affiliations.filter(a => a && a.includes('協会')),
        getKnown:  pool => [...new Set(pool.flatMap(id => id.affiliations.filter(a => a && a.includes('協会'))))]
    },
    {
        section: '所属',
        id: 'is_wing',
        label: '翼（〇社）所属？',
        inputLabel: '翼（アルファベット社）',
        type: 'list',
        hint: '例: W社、N社、R社…',
        getValues: id => id.affiliations.filter(a => a && /^[A-Z]社/.test(a)),
        getKnown:  pool => [...new Set(pool.flatMap(id => id.affiliations.filter(a => a && /^[A-Z]社/.test(a))))]
    },
    {
        section: '所属',
        id: 'is_fixer',
        label: 'フィクサー特性がある？',
        inputLabel: 'フィクサー',
        type: 'todo',
        hint: 'データ未整備（特性キーワードが必要）',
        getValues: () => [],
        getKnown:  () => []
    },
    {
        section: '所属',
        id: 'characteristic_kw',
        label: '特性キーワードは？',
        inputLabel: '特性キーワード',
        type: 'todo',
        hint: 'データ未整備',
        getValues: () => [],
        getKnown:  () => []
    },

    // ====================== 情報 ======================
    {
        section: '情報',
        id: 'impl_year',
        label: '実装された年は？',
        inputLabel: '実装年',
        type: 'list',
        hint: '2023 / 2024 / 2025 / 2026',
        getValues: id => id.impl_year ? [String(id.impl_year)] : [],
        getKnown:  pool => [...new Set(pool.map(id => id.impl_year).filter(Boolean).map(String))].sort()
    },
    {
        section: '情報',
        id: 'season',
        label: '実装シーズンは？',
        inputLabel: 'シーズン',
        type: 'list',
        hint: '恒常 / シーズン1〜7 / ヴァルプルギスの夜',
        getValues: id => [id.season],
        getKnown:  pool => [...new Set(pool.map(id => id.season))]
    },
    {
        section: '情報',
        id: 'hp_exact',
        label: '体力は N ？（数値・完全一致）',
        inputLabel: '体力（完全一致）',
        type: 'number',
        hint: '例: 251',
        judge: (id, n) => id.hp === n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'hp_gte',
        label: '体力は N 以上？（数値）',
        inputLabel: '体力（N以上）',
        type: 'number',
        hint: '例: 250',
        judge: (id, n) => id.hp >= n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'hp_lte',
        label: '体力は N 以下？（数値）',
        inputLabel: '体力（N以下）',
        type: 'number',
        hint: '例: 250',
        judge: (id, n) => id.hp <= n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'defense_level',
        label: '防御レベルは N ？（数値）',
        inputLabel: '防御レベル',
        type: 'number',
        hint: '例: 62（-5〜+5 補正値）',
        judge: (id, n) => id.defense_level === n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'speed_min_exact',
        label: '速度最小値は N ？（数値）',
        inputLabel: '速度最小（完全一致）',
        type: 'number',
        hint: '例: 3',
        judge: (id, n) => id.speed_min === n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'speed_min_gte',
        label: '速度最小値は N 以上？（数値）',
        inputLabel: '速度最小（N以上）',
        type: 'number',
        hint: '例: 4',
        judge: (id, n) => id.speed_min >= n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'speed_min_lte',
        label: '速度最小値は N 以下？（数値）',
        inputLabel: '速度最小（N以下）',
        type: 'number',
        hint: '例: 4',
        judge: (id, n) => id.speed_min <= n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'speed_max_exact',
        label: '速度最大値は N ？（数値）',
        inputLabel: '速度最大（完全一致）',
        type: 'number',
        hint: '例: 8',
        judge: (id, n) => id.speed_max === n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'speed_max_gte',
        label: '速度最大値は N 以上？（数値）',
        inputLabel: '速度最大（N以上）',
        type: 'number',
        hint: '例: 7',
        judge: (id, n) => id.speed_max >= n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'speed_max_lte',
        label: '速度最大値は N 以下？（数値）',
        inputLabel: '速度最大（N以下）',
        type: 'number',
        hint: '例: 7',
        judge: (id, n) => id.speed_max <= n,
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'speed_range',
        label: '速度範囲は N〜M ？（ハイフン区切り）',
        inputLabel: '速度範囲（例: 4-8）',
        type: 'range',
        hint: '例: 4-8',
        judge: (id, raw) => {
            const m = raw.match(/(\d+)-(\d+)/);
            if (!m) return null; // 不明
            return id.speed_min === parseInt(m[1]) && id.speed_max === parseInt(m[2]);
        },
        getKnown: () => null
    },
    {
        section: '情報',
        id: 'confusion_count',
        label: '混乱区間は N 個？（数値）',
        inputLabel: '混乱区間',
        type: 'todo',
        hint: 'データ未整備',
        judge: () => false,
        getKnown: () => null
    },

    // ====================== 耐性 ======================
    {
        section: '耐性',
        id: 'res_slash',
        label: '斬撃耐性は？',
        inputLabel: '斬撃耐性',
        type: 'list',
        hint: '耐性 / 普通 / 脆弱',
        getValues: id => [id.resistances.find(r => r.type === '斬撃')?.label].filter(Boolean),
        getKnown:  () => ['耐性', '普通', '脆弱']
    },
    {
        section: '耐性',
        id: 'res_pierce',
        label: '貫通耐性は？',
        inputLabel: '貫通耐性',
        type: 'list',
        hint: '耐性 / 普通 / 脆弱',
        getValues: id => [id.resistances.find(r => r.type === '貫通')?.label].filter(Boolean),
        getKnown:  () => ['耐性', '普通', '脆弱']
    },
    {
        section: '耐性',
        id: 'res_blunt',
        label: '打撃耐性は？',
        inputLabel: '打撃耐性',
        type: 'list',
        hint: '耐性 / 普通 / 脆弱',
        getValues: id => [id.resistances.find(r => r.type === '打撃')?.label].filter(Boolean),
        getKnown:  () => ['耐性', '普通', '脆弱']
    }
];

// ============================================================
// DOM refs
// ============================================================
const $ = id => document.getElementById(id);
const el = {
    screens: {
        title:     $('title-screen'),
        selection: $('selection-screen'),
        game:      $('game-screen')
    },
    btnToSelect:     $('btn-to-select'),
    btnSelectAll:    $('btn-select-all'),
    btnDeselectAll:  $('btn-deselect-all'),
    identityList:    $('identity-list-container'),
    btnStartGame:    $('btn-start-game'),
    btnBackToSelect: $('btn-back-to-select'),
    btnNewGame:      $('btn-new-game'),
    chatLog:         $('chat-log'),
    questionList:    $('question-list'),
    activeQLabel:    $('active-q-label'),
    questionInput:   $('question-input'),
    autocompleteList:$('autocomplete-list'),
    btnSend:         $('btn-send'),
    answerSearch:    $('answer-search'),
    answerDropdown:  $('answer-dropdown'),
    selectedAnswerLabel: $('selected-answer-label'),
    btnSubmitAnswer: $('btn-submit-answer'),
    resultModal:     $('result-modal'),
    resultTitle:     $('result-title'),
    resultMessage:   $('result-message'),
    btnCloseModal:   $('btn-close-modal')
};

// ============================================================
// Init
// ============================================================
async function init() {
    try {
        const res = await fetch('js/data.json');
        gameData = await res.json();
    } catch (e) {
        alert('data.json の読み込みに失敗しました。');
        return;
    }
    buildSelectionList();
    buildQuestionList();
    bindEvents();
}

// ============================================================
// Screen
// ============================================================
function showScreen(name) {
    Object.entries(el.screens).forEach(([k, s]) => s.classList.toggle('active', k === name));
}

// ============================================================
// Selection
// ============================================================
function buildSelectionList() {
    el.identityList.innerHTML = '';
    gameData.identities.forEach(id => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = id.id;
        cb.checked = true;
        label.appendChild(cb);
        label.appendChild(document.createTextNode(`[${id.character_name}] ${id.title}`));
        el.identityList.appendChild(label);
    });
}

function setAllChecked(v) {
    el.identityList.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = v);
}

// ============================================================
// Game start
// ============================================================
function startGame() {
    const checked = [...el.identityList.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
    if (!checked.length) { alert('最低1体選んでください。'); return; }

    activePool = gameData.identities.filter(id => checked.includes(id.id));
    targetIdentity = activePool[Math.floor(Math.random() * activePool.length)];
    questionCount = 0;
    selectedAnswerId = null;

    el.chatLog.innerHTML = '<div class="msg msg-system">ゲーム開始。右の質問一覧から項目を選んで情報を集めよ。</div>';
    el.answerSearch.value = '';
    el.selectedAnswerLabel.textContent = '未選択';
    el.answerDropdown.innerHTML = '';
    el.answerDropdown.classList.remove('open');
    el.btnSubmitAnswer.disabled = true;
    clearInput();
    el.questionList.querySelectorAll('.q-item').forEach(i => i.classList.remove('selected'));

    console.log('[DEV] target:', targetIdentity.character_name, targetIdentity.title);
    showScreen('game');
}

// ============================================================
// Question list – build
// ============================================================
// Badge label and CSS class per type
const TYPE_BADGE = {
    list:   { text: 'サジェスト', cls: 'badge-suggest' },
    number: { text: '数値',       cls: 'badge-number'  },
    range:  { text: '数値範囲',   cls: 'badge-number'  },
    todo:   { text: '未対応',     cls: 'badge-todo'    }
};

function buildQuestionList() {
    el.questionList.innerHTML = '';
    let lastSection = '';

    QUESTIONS.forEach((q, idx) => {
        if (q.section !== lastSection) {
            const sec = document.createElement('div');
            sec.className = 'q-section-header';
            sec.textContent = q.section;
            el.questionList.appendChild(sec);
            lastSection = q.section;
        }

        const item = document.createElement('div');
        const isTodo = q.type === 'todo';
        item.className = 'q-item' + (isTodo ? ' q-todo' : '');
        item.dataset.idx = idx;

        const badge = TYPE_BADGE[q.type] || TYPE_BADGE.todo;
        item.innerHTML =
            `<span class="q-item-text">${q.label}</span>` +
            `<span class="q-badge ${badge.cls}">${badge.text}</span>`;

        if (!isTodo) {
            item.addEventListener('click', () => selectQuestion(q, item));
        }
        el.questionList.appendChild(item);
    });
}

// ============================================================
// Question select / input
// ============================================================
function selectQuestion(q, itemEl) {
    currentQuestion = q;
    el.questionList.querySelectorAll('.q-item').forEach(i => i.classList.remove('selected'));
    itemEl.classList.add('selected');

    el.activeQLabel.textContent = `▶ ${q.label}`;
    el.questionInput.placeholder = q.hint;
    el.questionInput.value = '';
    el.questionInput.disabled = false;
    el.btnSend.disabled = false;
    el.autocompleteList.innerHTML = '';
    el.autocompleteList.classList.remove('open');
    acIndex = -1;
    el.questionInput.focus();
}

function clearInput() {
    currentQuestion = null;
    el.activeQLabel.textContent = '← 質問一覧から項目を選んでください';
    el.questionInput.placeholder = '値を入力...';
    el.questionInput.value = '';
    el.questionInput.disabled = true;
    el.btnSend.disabled = true;
    el.autocompleteList.innerHTML = '';
    el.autocompleteList.classList.remove('open');
    acIndex = -1;
}

// ============================================================
// Autocomplete
// ============================================================
function updateAutocomplete() {
    if (!currentQuestion || currentQuestion.type === 'number' || currentQuestion.type === 'range' || currentQuestion.type === 'todo') {
        el.autocompleteList.classList.remove('open');
        return;
    }
    const val = el.questionInput.value.trim();
    const known = currentQuestion.getKnown(activePool) || [];
    const matches = val ? known.filter(v => v.includes(val)) : known;

    el.autocompleteList.innerHTML = '';
    acIndex = -1;
    if (!matches.length) { el.autocompleteList.classList.remove('open'); return; }

    matches.forEach(m => {
        const div = document.createElement('div');
        div.className = 'ac-item';
        div.textContent = m;
        div.addEventListener('mousedown', e => {
            e.preventDefault();
            el.questionInput.value = m;
            el.autocompleteList.classList.remove('open');
            submitQuestion();
        });
        el.autocompleteList.appendChild(div);
    });
    el.autocompleteList.classList.add('open');
}

function navigateAC(dir) {
    const items = el.autocompleteList.querySelectorAll('.ac-item');
    if (!items.length) return;
    items.forEach(i => i.classList.remove('active'));
    acIndex = (acIndex + dir + items.length) % items.length;
    items[acIndex].classList.add('active');
    el.questionInput.value = items[acIndex].textContent;
}

// ============================================================
// Submit question – judgment
// ============================================================
function submitQuestion() {
    if (!currentQuestion) return;
    const rawVal = el.questionInput.value.trim();
    if (!rawVal) return;

    questionCount++;
    const qText = `Q: ${currentQuestion.inputLabel}  →  「${rawVal}」`;
    let answer = '不明';
    let ansClass = 'ans-unk';

    if (currentQuestion.type === 'number') {
        const n = parseInt(rawVal, 10);
        if (isNaN(n)) {
            answer = '不明（数値を入力してください）';
        } else {
            const ok = currentQuestion.judge(targetIdentity, n);
            answer = ok ? 'はい' : 'いいえ';
            ansClass = ok ? 'ans-yes' : 'ans-no';
        }

    } else if (currentQuestion.type === 'range') {
        const result = currentQuestion.judge(targetIdentity, rawVal);
        if (result === null) {
            answer = '不明（形式: 最小-最大  例: 4-8）';
        } else {
            answer = result ? 'はい' : 'いいえ';
            ansClass = result ? 'ans-yes' : 'ans-no';
        }

    } else {
        // list
        const known = currentQuestion.getKnown(activePool) || [];
        if (!known.includes(rawVal)) {
            answer = '不明';
        } else {
            const vals = currentQuestion.getValues(targetIdentity);
            const has = Array.isArray(vals) ? vals.includes(rawVal) : vals === rawVal;
            answer = has ? 'はい' : 'いいえ';
            ansClass = has ? 'ans-yes' : 'ans-no';
        }
    }

    appendChat(qText, 'user');
    appendChat(`A: ${answer}`, 'answer', ansClass);
    el.questionInput.value = '';
    el.autocompleteList.classList.remove('open');
    el.questionInput.focus();
}

// ============================================================
// Answer search / submit
// ============================================================
function buildAnswerDropdown(filter) {
    el.answerDropdown.innerHTML = '';
    const matches = activePool.filter(id => {
        const full = `[${id.character_name}] ${id.title}`;
        return !filter || full.includes(filter) || id.character_name.includes(filter) || id.title.includes(filter);
    });
    if (!matches.length) { el.answerDropdown.classList.remove('open'); return; }

    matches.forEach(id => {
        const div = document.createElement('div');
        div.className = 'ac-item';
        div.textContent = `[${id.character_name}] ${id.title}`;
        div.addEventListener('mousedown', e => {
            e.preventDefault();
            selectedAnswerId = id.id;
            el.answerSearch.value = '';
            el.selectedAnswerLabel.textContent = `選択中: [${id.character_name}] ${id.title}`;
            el.btnSubmitAnswer.disabled = false;
            el.answerDropdown.classList.remove('open');
        });
        el.answerDropdown.appendChild(div);
    });
    el.answerDropdown.classList.add('open');
}

function submitAnswer() {
    if (!selectedAnswerId) { alert('人格を選んでください。'); return; }
    const selected = activePool.find(id => id.id === selectedAnswerId);
    if (!selected) return;

    if (selected.id === targetIdentity.id) {
        el.resultTitle.textContent = '正解！';
        el.resultTitle.style.color = '#3a8c5e';
        el.resultMessage.textContent =
            `[${targetIdentity.character_name}] ${targetIdentity.title}\n\n質問回数: ${questionCount} 回`;
        el.resultModal.classList.add('active');
    } else {
        appendChat(`回答: [${selected.character_name}] ${selected.title}`, 'user');
        appendChat('A: いいえ、違います。続けてください。', 'answer', 'ans-no');
        selectedAnswerId = null;
        el.selectedAnswerLabel.textContent = '未選択';
        el.btnSubmitAnswer.disabled = true;
    }
}

// ============================================================
// Chat helpers
// ============================================================
function appendChat(text, type, extraClass = '') {
    const div = document.createElement('div');
    div.className = `msg msg-${type}${extraClass ? ' ' + extraClass : ''}`;
    div.textContent = text;
    el.chatLog.appendChild(div);
    el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

// ============================================================
// Events
// ============================================================
function bindEvents() {
    el.btnToSelect.addEventListener('click', () => showScreen('selection'));
    el.btnSelectAll.addEventListener('click', () => setAllChecked(true));
    el.btnDeselectAll.addEventListener('click', () => setAllChecked(false));
    el.btnStartGame.addEventListener('click', startGame);
    el.btnBackToSelect.addEventListener('click', () => showScreen('selection'));
    el.btnNewGame.addEventListener('click', startGame);

    el.questionInput.addEventListener('input', updateAutocomplete);
    el.questionInput.addEventListener('keydown', e => {
        if (e.key === 'Enter')     { e.preventDefault(); submitQuestion(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); navigateAC(1); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); navigateAC(-1); }
        if (e.key === 'Escape')    { el.autocompleteList.classList.remove('open'); }
    });
    el.questionInput.addEventListener('blur', () => {
        setTimeout(() => el.autocompleteList.classList.remove('open'), 150);
    });
    el.btnSend.addEventListener('click', submitQuestion);

    el.answerSearch.addEventListener('input',  () => buildAnswerDropdown(el.answerSearch.value.trim()));
    el.answerSearch.addEventListener('focus',  () => buildAnswerDropdown(el.answerSearch.value.trim()));
    el.answerSearch.addEventListener('blur',   () => setTimeout(() => el.answerDropdown.classList.remove('open'), 150));

    el.btnSubmitAnswer.addEventListener('click', submitAnswer);
    el.btnSubmitAnswer.disabled = true;

    el.btnCloseModal.addEventListener('click', () => el.resultModal.classList.remove('active'));
}

document.addEventListener('DOMContentLoaded', init);
