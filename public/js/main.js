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
// Question Definitions (Template/Natural Language Form)
//
// type:
//   'list'   … 候補一覧からサジェスト付きフリー入力
//   'number' … 数値入力
//   'range'  … 範囲（N-M）
//   'todo'   … データ未整備（選択不可・グレーアウト表示）
// ============================================================

// Helper: Extract unique values from nested array
const getKnownList = (pool, field) => [...new Set(pool.flatMap(id => id[field] || []))].filter(Boolean);

const QUESTIONS = [
    // ====================== 囚人 ======================
    {
        section: '囚人',
        id: 'prisoner_name',
        label: 'その囚人は…？',
        type: 'list',
        template: 'その囚人は [name] ですか？',
        inputs: {
            name: { type: 'suggest', getKnown: pool => getKnownList(pool, 'character_name'), placeholder: '例: イサン' }
        },
        judge: (id, vals) => id.character_name === vals.name
    },
    {
        section: '囚人',
        id: 'prisoner_num',
        label: 'その囚人の囚人番号は…？',
        type: 'number',
        template: 'その囚人の囚人番号は [num] ですか？',
        inputs: {
            num: { type: 'number', placeholder: '1〜13' }
        },
        judge: (id, vals) => id.prisoner_num === parseInt(vals.num, 10)
    },
    {
        section: '囚人',
        id: 'prisoner_num_cmp',
        label: '囚人番号は N 以上/以下…？',
        type: 'number',
        template: 'その囚人の囚人番号は [num] [cmp] ですか？',
        inputs: {
            num: { type: 'number', placeholder: '1〜13' },
            cmp: { type: 'select', options: ['以上', '以下'] }
        },
        judge: (id, vals) => {
            const n = parseInt(vals.num, 10);
            return vals.cmp === '以上' ? id.prisoner_num >= n : id.prisoner_num <= n;
        }
    },
    {
        section: '囚人',
        id: 'gender',
        label: 'その囚人は〔男性・女性〕？',
        type: 'list',
        template: 'その囚人は [gender] ですか？',
        inputs: { gender: { type: 'select', options: ['男性', '女性'] } },
        judge: (id, vals) => {
            const males = ['イサン', 'ムルソー', 'ホンル', 'ヒースクリフ', 'シンクレア', 'グレゴール'];
            const actualGender = males.includes(id.character_name) ? '男性' : '女性';
            return actualGender === vals.gender;
        }
    },

    // ====================== スキル ======================
    {
        section: 'スキル（通常）',
        id: 'skill_attack',
        label: 'スキルの物理属性は？',
        type: 'list',
        template: 'その人格のスキル [skill_num] の物理属性は [attack_type] ですか？',
        inputs: {
            skill_num: { type: 'select', options: ['1・2・3・守備', '1', '2', '3', '守備'] },
            attack_type: { type: 'select', options: ['斬撃', '貫通', '打撃'] }
        },
        judge: (id, vals) => {
            const type = vals.attack_type.charAt(0); // 斬, 貫, 打
            if (vals.skill_num !== '1・2・3・守備') return null; // 詳細データ未整備
            return id.attack_types.includes(type);
        }
    },
    {
        section: 'スキル（通常）',
        id: 'skill_sin',
        label: 'スキルの罪悪属性は？',
        type: 'list',
        template: 'その人格のスキル [skill_num] の罪悪属性は [sin_type] ですか？',
        inputs: {
            skill_num: { type: 'select', options: ['1・2・3・守備', '1', '2', '3', '守備'] },
            sin_type: { type: 'select', options: ['憤怒', '色欲', '怠惰', '暴食', '憂鬱', '傲慢', '嫉妬'] }
        },
        judge: (id, vals) => {
            if (vals.skill_num !== '1・2・3・守備') return null; // 詳細データ未整備
            return id.sin_types.includes(vals.sin_type);
        }
    },
    {
        section: 'スキル（通常）',
        id: 'defense_type',
        label: '守備スキルの種類は？',
        type: 'list',
        template: 'その人格の守備スキルは [def_type] ですか？',
        inputs: {
            def_type: { type: 'select', options: ['防御', '回避', '反撃', 'マッチ可能反撃', 'マッチ可能ガード'] }
        },
        judge: (id, vals) => {
            if (['マッチ可能反撃', 'マッチ可能ガード'].includes(vals.def_type)) return null;
            return id.defense_types?.includes(vals.def_type) || false;
        }
    },
    {
        section: 'スキル（通常）',
        id: 'coin_count',
        label: 'スキルのコイン枚数は？',
        type: 'todo',
        template: 'その人格のスキル [skill_num] のコイン枚数は [num] [cmp] ですか？',
        inputs: {
            skill_num: { type: 'select', options: ['1・2・3・守備', '1', '2', '3', '守備'] },
            num: { type: 'number', placeholder: '1' },
            cmp: { type: 'select', options: ['以上', '以下'] }
        },
        judge: () => null
    },
    {
        section: 'スキル（通常）',
        id: 'skill_keyword',
        label: 'スキルに特定キーワードがある？',
        type: 'todo',
        template: 'その人格のスキル [skill_num] は「 [keyword] 」を持っていますか？',
        inputs: {
            skill_num: { type: 'select', options: ['1・2・3・守備', '1', '2', '3', '守備'] },
            keyword: { type: 'suggest', getKnown: () => gameData?.metadata?.all_keywords || [] }
        },
        judge: () => null
    },

    // ====================== キーワード ======================
    {
        section: 'キーワード',
        id: 'battle_keyword',
        label: 'キーワードを利用しますか？',
        type: 'list',
        template: 'その人格は「 [keyword] 」を利用しますか？',
        inputs: {
            keyword: { type: 'suggest', getKnown: () => gameData?.metadata?.all_keywords || [] }
        },
        judge: (id, vals) => {
            // 現在は7大キーワードのみ取得可能。データがないものは不明ではなく「いいえ」か「未整備」になるが、
            // 暫定として、持っていればtrue、それ以外はfalse
            if (!gameData.metadata.all_keywords.includes(vals.keyword)) return null; // 存在しないキーワード
            return id.battle_keywords.includes(vals.keyword);
        }
    },
    {
        section: 'キーワード',
        id: 'kw_apply_target',
        label: 'キーワードを敵/自身/味方に付与する？',
        type: 'todo',
        template: 'その人格は「 [keyword] 」を [target] に付与しますか？',
        inputs: {
            keyword: { type: 'suggest', getKnown: () => gameData?.metadata?.all_keywords || [] },
            target: { type: 'select', options: ['敵', '自身', '味方'] }
        },
        judge: () => null
    },
    {
        section: 'キーワード',
        id: 'ego_kw_any',
        label: 'E.G.O外部効果でキーワードを利用可能になる？',
        type: 'todo',
        template: 'その人格はE.G.O.における外部効果でキーワードを利用可能になりますか？',
        inputs: {},
        judge: () => null
    },
    {
        section: 'キーワード',
        id: 'ego_kw_specific',
        label: 'E.G.O外部効果で特定キーワードを利用可能になる？',
        type: 'todo',
        template: 'その人格はE.G.O.における外部効果で「 [keyword] 」を利用可能になりますか？',
        inputs: {
            keyword: { type: 'suggest', getKnown: () => gameData?.metadata?.all_keywords || [] }
        },
        judge: () => null
    },

    // ====================== 所属 ======================
    {
        section: '所属',
        id: 'affiliation',
        label: '所属は？',
        type: 'list',
        template: 'その人格は「 [affil] 」所属ですか？',
        inputs: {
            affil: { type: 'suggest', getKnown: pool => getKnownList(pool, 'affiliations') }
        },
        judge: (id, vals) => {
            const known = getKnownList(activePool, 'affiliations');
            if (!known.includes(vals.affil)) return null;
            return id.affiliations.includes(vals.affil);
        }
    },
    {
        section: '所属',
        id: 'is_association',
        label: '協会所属ですか？',
        type: 'list',
        template: 'その人格は [assoc] 協会所属ですか？',
        inputs: {
            assoc: { type: 'select', options: ['いずれかの', 'ツヴァイ', 'トレス', 'シ', 'シンク', 'ユク', 'セブン', 'エイト', 'ディエチ', 'ウーフィ', 'リウ'] }
        },
        judge: (id, vals) => {
            if (vals.assoc === 'いずれかの') return id.affiliations.some(a => a.includes('協会'));
            return id.affiliations.some(a => a.includes(vals.assoc + '協会'));
        }
    },
    {
        section: '所属',
        id: 'is_wing',
        label: '翼所属ですか？',
        type: 'list',
        template: 'その人格は [wing] 社所属ですか？',
        inputs: {
            wing: { type: 'select', options: ['いずれかの', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')] }
        },
        judge: (id, vals) => {
            if (vals.wing === 'いずれかの') return id.affiliations.some(a => a.includes('社'));
            return id.affiliations.some(a => a.includes(vals.wing + '社'));
        }
    },
    {
        section: '所属',
        id: 'is_finger',
        label: '指所属ですか？',
        type: 'list',
        template: 'その人格は [finger] 所属ですか？',
        inputs: {
            finger: { type: 'select', options: ['いずれかの指', '親指', '人差し指', '中指', '薬指', '小指'] }
        },
        judge: (id, vals) => {
            const fingers = ['親指', '人差し指', '中指', '薬指', '小指'];
            if (vals.finger === 'いずれかの指') return id.affiliations.some(a => fingers.some(f => a.includes(f)));
            return id.affiliations.some(a => a.includes(vals.finger));
        }
    },
    {
        section: '所属',
        id: 'is_fixer',
        label: 'フィクサーですか？',
        type: 'todo',
        template: 'その人格はフィクサーですか？',
        inputs: {},
        judge: () => null
    },
    {
        section: '所属',
        id: 'characteristic_kw',
        label: '特性キーワードですか？',
        type: 'todo',
        template: 'その人格は「 [kw] 」ですか？（特性キーワード）',
        inputs: { kw: { type: 'suggest', getKnown: () => gameData?.metadata?.characteristics || [] } },
        judge: () => null
    },

    // ====================== 情報 ======================
    {
        section: '情報',
        id: 'impl_year',
        label: '実装された年は？',
        type: 'list',
        template: 'その人格が実装された年は [year] ですか？',
        inputs: {
            year: { type: 'select', options: ['2023', '2024', '2025', '2026'] }
        },
        judge: (id, vals) => id.impl_year === parseInt(vals.year, 10)
    },
    {
        section: '情報',
        id: 'season',
        label: '実装シーズンは？',
        type: 'list',
        template: 'その人格が実装されたのはシーズン [season] ですか？',
        inputs: {
            season: { type: 'select', options: ['0', '1', '2', '3', '4', '5', '6', '7', 'W'] }
        },
        judge: (id, vals) => {
            let expected;
            if (vals.season === '0') expected = '恒常';
            else if (vals.season === 'W') expected = 'ヴァルプルギスの夜';
            else expected = `シーズン${vals.season}`;
            return id.season === expected;
        }
    },
    {
        section: '情報',
        id: 'hp',
        label: '体力は？',
        type: 'number',
        template: 'その人格の体力は [num] [cmp] ですか？',
        inputs: {
            num: { type: 'number', placeholder: '250' },
            cmp: { type: 'select', options: ['ちょうど', '以上', '以下'] }
        },
        judge: (id, vals) => {
            const n = parseInt(vals.num, 10);
            if (vals.cmp === 'ちょうど') return id.hp === n;
            if (vals.cmp === '以上') return id.hp >= n;
            return id.hp <= n;
        }
    },
    {
        section: '情報',
        id: 'defense_level',
        label: '防御レベルは？',
        type: 'number',
        template: 'その人格の防御レベルは [num] ですか？',
        inputs: {
            num: { type: 'number', placeholder: '62' }
        },
        judge: (id, vals) => id.defense_level === parseInt(vals.num, 10)
    },
    {
        section: '情報',
        id: 'speed_min',
        label: '速度最低値は？',
        type: 'number',
        template: 'その人格の速度最低値は [num] [cmp] ですか？',
        inputs: {
            num: { type: 'number', placeholder: '4' },
            cmp: { type: 'select', options: ['ちょうど', '以上', '以下'] }
        },
        judge: (id, vals) => {
            const n = parseInt(vals.num, 10);
            if (vals.cmp === 'ちょうど') return id.speed_min === n;
            if (vals.cmp === '以上') return id.speed_min >= n;
            return id.speed_min <= n;
        }
    },
    {
        section: '情報',
        id: 'speed_max',
        label: '速度最大値は？',
        type: 'number',
        template: 'その人格の速度最大値は [num] [cmp] ですか？',
        inputs: {
            num: { type: 'number', placeholder: '8' },
            cmp: { type: 'select', options: ['ちょうど', '以上', '以下'] }
        },
        judge: (id, vals) => {
            const n = parseInt(vals.num, 10);
            if (vals.cmp === 'ちょうど') return id.speed_max === n;
            if (vals.cmp === '以上') return id.speed_max >= n;
            return id.speed_max <= n;
        }
    },
    {
        section: '情報',
        id: 'speed_range',
        label: '速度範囲は？',
        type: 'range',
        template: 'その人格の速度範囲は [min] 〜 [max] ですか？',
        inputs: {
            min: { type: 'number', placeholder: '4' },
            max: { type: 'number', placeholder: '8' }
        },
        judge: (id, vals) => id.speed_min === parseInt(vals.min, 10) && id.speed_max === parseInt(vals.max, 10)
    },
    {
        section: '情報',
        id: 'confusion_count',
        label: '混乱区間は？',
        type: 'todo',
        template: 'その人格の混乱区間は [num] 個ですか？',
        inputs: { num: { type: 'number', placeholder: '2' } },
        judge: () => null
    },

    // ====================== 耐性 ======================
    {
        section: '耐性',
        id: 'resistance',
        label: '耐性（斬/貫/打）は？',
        type: 'list',
        template: 'その人格の [type] 耐性は [label] ですか？',
        inputs: {
            type: { type: 'select', options: ['斬撃', '貫通', '打撃'] },
            label: { type: 'select', options: ['脆弱', '普通', '耐性'] }
        },
        judge: (id, vals) => {
            const r = id.resistances.find(x => x.type === vals.type);
            return r ? r.label === vals.label : null;
        }
    }
];

// ============================================================
// DOM refs
// ============================================================
const $ = id => document.getElementById(id);
const el = {
    screens: { title: $('title-screen'), db: $('db-screen'), selection: $('selection-screen'), game: $('game-screen') },
    btnToSelect: $('btn-to-select'),
    btnToDb: $('btn-to-db'),
    btnBackFromDb: $('btn-back-from-db'),
    dbCategorySelect: $('db-category-select'),
    dbSearch: $('db-search'),
    dbThead: $('db-thead'),
    dbTbody: $('db-tbody'),
    btnSelectAll: $('btn-select-all'),
    btnDeselectAll: $('btn-deselect-all'),
    identityList: $('identity-list-container'),
    btnStartGame: $('btn-start-game'),
    btnBackToSelect: $('btn-back-to-select'),
    btnNewGame: $('btn-new-game'),
    chatLog: $('chat-log'),
    questionList: $('question-list'),
    activeQLabel: $('active-q-label'),
    templateContainer: $('template-container'),
    btnSend: $('btn-send'),
    answerSearch: $('answer-search'),
    answerDropdown: $('answer-dropdown'),
    selectedAnswerLabel: $('selected-answer-label'),
    btnSubmitAnswer: $('btn-submit-answer'),
    resultModal: $('result-modal'),
    resultTitle: $('result-title'),
    resultMessage: $('result-message'),
    btnCloseModal: $('btn-close-modal')
};

// ============================================================
// Init
// ============================================================
async function init() {
    try {
        const res = await fetch('js/data.json?v=' + Date.now());
        gameData = await res.json();
    } catch (e) {
        alert('data.json の読み込みに失敗しました。');
        return;
    }
    buildSelectionList();
    buildQuestionList();
    renderDb();
    bindEvents();
}

function showScreen(name) {
    Object.entries(el.screens).forEach(([k, s]) => {
        if (s) s.classList.toggle('active', k === name);
    });
}

// ============================================================
// DB Screen
// ============================================================
function renderDb(filter = '') {
    if (!el.dbTbody) return;
    const cat = el.dbCategorySelect ? el.dbCategorySelect.value : 'identities';
    
    el.dbThead.innerHTML = '';
    el.dbTbody.innerHTML = '';
    
    if (cat === 'identities') {
        el.dbThead.innerHTML = `<tr><th>番号</th><th>囚人</th><th>人格名</th><th>所属</th><th>属性/耐性</th><th>HP/防御/速度</th></tr>`;
        const items = gameData.identities.filter(id => {
            if (!filter) return true;
            const txt = `${id.num} ${id.character_name} ${id.title} ${id.affiliations.join(' ')}`;
            return txt.includes(filter);
        });
        items.forEach(id => {
            const tr = document.createElement('tr');
            const res = id.resistances.map(r => `${r.type}:${r.label}`).join(' / ');
            const attr = `罪悪: ${id.sin_types.join(',')} | 物理: ${id.attack_types.join(',')} | 耐性: ${res}`;
            const stats = `HP:${id.hp} | 防:${id.defense_level} | 速度:${id.speed_min}-${id.speed_max}`;
            tr.innerHTML = `
                <td>${id.num}</td>
                <td>${id.character_name}</td>
                <td>${id.title}</td>
                <td>${id.affiliations.join('<br>')}</td>
                <td style="font-size: 0.8em; color: var(--text-dim);">${attr}</td>
                <td style="font-size: 0.8em; color: var(--text-dim);">${stats}</td>
            `;
            el.dbTbody.appendChild(tr);
        });
    } else if (cat === 'keywords') {
        el.dbThead.innerHTML = `<tr><th style="width: 20%">キーワード</th><th>説明</th></tr>`;
        const items = (gameData.metadata.keywords_data || []).filter(k => !filter || k.name.includes(filter) || (k.desc && k.desc.includes(filter)));
        items.forEach(k => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold; color: var(--red);">${k.name}</td>
                <td style="white-space: pre-wrap; font-size: 0.9em;">${k.desc || ''}</td>
            `;
            el.dbTbody.appendChild(tr);
        });
    } else if (cat === 'affiliations') {
        el.dbThead.innerHTML = `<tr><th>所属名</th></tr>`;
        const items = (gameData.metadata.affiliations_data || []).filter(a => !filter || a.includes(filter));
        items.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${a}</td>`;
            el.dbTbody.appendChild(tr);
        });
    } else if (cat === 'characteristics') {
        el.dbThead.innerHTML = `<tr><th>特性キーワード</th></tr>`;
        const items = (gameData.metadata.characteristics_data || []).filter(c => !filter || c.includes(filter));
        items.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${c}</td>`;
            el.dbTbody.appendChild(tr);
        });
    }
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
// Question list
// ============================================================
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
// Template Input Builder
// ============================================================
let activeInputs = [];

function selectQuestion(q, itemEl) {
    currentQuestion = q;
    el.questionList.querySelectorAll('.q-item').forEach(i => i.classList.remove('selected'));
    itemEl.classList.add('selected');

    el.activeQLabel.textContent = `▶ ${q.label}`;
    el.templateContainer.innerHTML = '';
    activeInputs = [];

    // Parse template e.g. "その人格のスキル [skill_num] は〜"
    const parts = q.template.split(/(\[[a-zA-Z0-9_]+\])/);

    parts.forEach(p => {
        if (p.startsWith('[') && p.endsWith(']')) {
            const key = p.slice(1, -1);
            const def = q.inputs[key];
            if (!def) return; // Should not happen if correctly defined

            if (def.type === 'select') {
                const sel = document.createElement('select');
                sel.className = 'template-select';
                sel.dataset.key = key;
                def.options.forEach(opt => {
                    const o = document.createElement('option');
                    o.value = opt; o.textContent = opt;
                    sel.appendChild(o);
                });
                el.templateContainer.appendChild(sel);
                activeInputs.push({ key, element: sel, def });

            } else {
                // text, suggest, number
                const wrapper = document.createElement('div');
                wrapper.className = 'ac-wrapper';

                const inp = document.createElement('input');
                inp.className = 'template-input';
                inp.type = def.type === 'number' ? 'number' : 'text';
                inp.dataset.key = key;
                inp.placeholder = def.placeholder || '';
                if (def.type === 'number') inp.style.width = '70px';

                wrapper.appendChild(inp);

                if (def.type === 'suggest') {
                    const acList = document.createElement('div');
                    acList.className = 'autocomplete-list';
                    wrapper.appendChild(acList);
                    
                    // AC Logic
                    inp.addEventListener('input', () => {
                        const val = inp.value.trim();
                        const known = def.getKnown ? def.getKnown(activePool) : [];
                        const matches = val ? known.filter(v => v.includes(val)) : known;
                        
                        acList.innerHTML = '';
                        if (!matches.length) { acList.style.display = 'none'; return; }
                        
                        matches.slice(0, 50).forEach(m => {
                            const d = document.createElement('div');
                            d.className = 'ac-item';
                            d.textContent = m;
                            d.addEventListener('mousedown', e => {
                                e.preventDefault();
                                inp.value = m;
                                acList.style.display = 'none';
                            });
                            acList.appendChild(d);
                        });
                        acList.style.display = 'block';
                    });
                    
                    inp.addEventListener('blur', () => setTimeout(() => acList.style.display='none', 150));
                    inp.addEventListener('focus', () => inp.dispatchEvent(new Event('input')));
                }

                el.templateContainer.appendChild(wrapper);
                activeInputs.push({ key, element: inp, def });
            }
        } else if (p.trim() !== '') {
            const span = document.createElement('span');
            span.textContent = p;
            el.templateContainer.appendChild(span);
        }
    });

    el.btnSend.disabled = false;

    // Focus first input
    const firstInp = activeInputs.find(i => i.element.tagName === 'INPUT');
    if (firstInp) firstInp.element.focus();
}

function clearInput() {
    currentQuestion = null;
    el.activeQLabel.textContent = '← 質問一覧から項目を選んでください';
    el.templateContainer.innerHTML = '<span class="template-placeholder">質問を選ぶとここに入力枠が表示されます</span>';
    el.btnSend.disabled = true;
    activeInputs = [];
}

// ============================================================
// Submit question
// ============================================================
function submitQuestion() {
    if (!currentQuestion) return;

    // Gather values
    const values = {};
    let isComplete = true;

    activeInputs.forEach(i => {
        const val = i.element.value.trim();
        if (!val) isComplete = false;
        values[i.key] = val;
    });

    if (!isComplete && !Object.values(currentQuestion.inputs).every(d => d.type === 'select')) {
        alert('すべての入力欄を埋めてください。');
        return;
    }

    // Generate readable question string
    let qText = currentQuestion.template;
    for (const [k, v] of Object.entries(values)) {
        qText = qText.replace(`[${k}]`, `「${v}」`);
    }

    questionCount++;
    appendChat(`Q: ${qText}`, 'user');

    // Judge
    let answer = '不明';
    let ansClass = 'ans-unk';

    const result = currentQuestion.judge(targetIdentity, values);
    
    if (result === null) {
        answer = '不明（データ未整備、または該当なし）';
    } else {
        answer = result ? 'はい' : 'いいえ';
        ansClass = result ? 'ans-yes' : 'ans-no';
    }

    appendChat(`A: ${answer}`, 'answer', ansClass);

    // Reset inputs
    activeInputs.forEach(i => {
        if (i.element.tagName === 'INPUT') i.element.value = '';
    });
    const firstInp = activeInputs.find(i => i.element.tagName === 'INPUT');
    if (firstInp) firstInp.element.focus();
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
        el.resultMessage.textContent = `[${targetIdentity.character_name}] ${targetIdentity.title}\n\n質問回数: ${questionCount} 回`;
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
    // Title
    el.btnToSelect.addEventListener('click', () => showScreen('selection'));
    if (el.btnToDb) el.btnToDb.addEventListener('click', () => showScreen('db'));
    
    // DB
    if (el.btnBackFromDb) el.btnBackFromDb.addEventListener('click', () => showScreen('title'));
    if (el.dbCategorySelect) el.dbCategorySelect.addEventListener('change', () => renderDb(el.dbSearch.value.trim()));
    if (el.dbSearch) el.dbSearch.addEventListener('input', () => renderDb(el.dbSearch.value.trim()));

    // Selection
    el.btnDeselectAll.addEventListener('click', () => setAllChecked(false));
    el.btnStartGame.addEventListener('click', startGame);
    el.btnBackToSelect.addEventListener('click', () => showScreen('selection'));
    el.btnNewGame.addEventListener('click', startGame);

    el.btnSend.addEventListener('click', submitQuestion);

    // Global keydown for Enter to submit
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !el.btnSend.disabled && document.activeElement.classList.contains('template-input')) {
            e.preventDefault();
            submitQuestion();
        }
    });

    el.answerSearch.addEventListener('input',  () => buildAnswerDropdown(el.answerSearch.value.trim()));
    el.answerSearch.addEventListener('focus',  () => buildAnswerDropdown(el.answerSearch.value.trim()));
    el.answerSearch.addEventListener('blur',   () => setTimeout(() => el.answerDropdown.classList.remove('open'), 150));

    el.btnSubmitAnswer.addEventListener('click', submitAnswer);
    el.btnSubmitAnswer.disabled = true;

    el.btnCloseModal.addEventListener('click', () => el.resultModal.classList.remove('active'));
}

document.addEventListener('DOMContentLoaded', init);
