const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..');
const DATA_FILE = path.join(DIR, '人格一覧データ.txt');
const KEYWORD_DATA_FILE = path.join(DIR, '人格一覧データー　キーワード編.txt');
const AFFILIATIONS_FILE = path.join(DIR, '所属一覧');
const CHARACTERISTICS_FILE = path.join(DIR, '特性キーワード一覧.txt');
const OUTPUT_FILE = path.join(DIR, 'public', 'js', 'data.json');

// ------------------------------------------------------------
// TSVパーサ
// ヘッダー行が全角スペース区切り、データ行がタブ区切りのファイルに対応
// ------------------------------------------------------------
function parseTSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rawLines = content.split('\n').map(line => line.trim()).filter(line => line);
    
    // Merge broken lines (newlines inside cells)
    const lines = [];
    rawLines.forEach((line, index) => {
        if (index === 0) {
            lines.push(line);
        } else {
            if (/^\d{4}\t/.test(line)) {
                lines.push(line);
            } else {
                // Append to the previous line if it doesn't start with a valid ID
                lines[lines.length - 1] += line;
            }
        }
    });

    const headers = lines[0].split(/[ \t　]+/).map(h => h.trim()).filter(h => h);

    // ヘッダー名を正規化（キーワード編の末尾注釈などを除去）
    const normalizedHeaders = headers.map(h => {
        if (h.includes('充電')) return '充電';
        if (h.includes('嫉妬（数字')) return '嫉妬';
        return h;
    });

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const entry = {};
        normalizedHeaders.forEach((header, index) => {
            entry[header] = values[index] ? values[index].trim() : '';
        });
        data.push(entry);
    }
    return { headers: normalizedHeaders, data };
}

// ------------------------------------------------------------
// リストパーサ（所属一覧・特性キーワード一覧）
// 「カテゴリ/xxx/名称」形式の末尾だけ抽出
// ------------------------------------------------------------
function parseList(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('/'))
        .map(line => line.split('/').pop().trim());
}

// ------------------------------------------------------------
// 耐性値を文字列化
// ------------------------------------------------------------
function parseResist(val) {
    if (val === '0.5') return '耐性';
    if (val === '1' || val === '1.0') return '普通';
    if (val === '2.0' || val === '2') return '脆弱';
    return val || '不明';
}

// ------------------------------------------------------------
// 守備スキルの種類を抽出（防/回/反 など）
// 人格一覧データ.txt の各罪悪属性列に「防」「避」「反」等が入っている
// ------------------------------------------------------------
function extractDefenseTypes(item) {
    const sins = ['憤怒', '色欲', '怠惰', '暴食', '憂鬱', '傲慢', '嫉妬'];
    const defMap = {
        '防': '防御', '避': '回避', '反': '反撃'
    };
    const found = new Set();
    sins.forEach(sin => {
        const val = item[sin] || '';
        Object.entries(defMap).forEach(([abbr, full]) => {
            if (val.includes(abbr)) found.add(full);
        });
    });
    return [...found];
}

// ------------------------------------------------------------
// メイン変換処理
// ------------------------------------------------------------
function convertData() {
    const mainData  = parseTSV(DATA_FILE).data;
    const kwData    = parseTSV(KEYWORD_DATA_FILE).data;
    const affiliations    = parseList(AFFILIATIONS_FILE);
    const characteristics = parseList(CHARACTERISTICS_FILE);

    // キーワード編データを番号でルックアップできるマップを作る
    const kwMap = {};
    kwData.forEach(item => {
        const num = item['番号'];
        if (num) kwMap[num] = item;
    });

    const identities = [];
    const sins = ['憤怒', '色欲', '怠惰', '暴食', '憂鬱', '傲慢', '嫉妬'];
    const battleKwList = ['火傷', '出血', '振動', '破裂', '沈潜', '呼吸', '充電'];

    mainData.forEach(item => {
        const num = item['番号'];
        if (!num) return; // ヘッダーなど空行をスキップ

        // 囚人番号（番号の上2桁: 01〜12、10は欠番）
        const prisonerNum = parseInt(num.slice(0, 2), 10);

        // 速度
        const speedVal  = item['速度'] || '';
        const speedMatch = speedVal.match(/(\d+)-(\d+)/);
        const speedMin = speedMatch ? parseInt(speedMatch[1], 10) : 0;
        const speedMax = speedMatch ? parseInt(speedMatch[2], 10) : 0;

        // 罪悪属性（列に値が入っていれば所持）
        const sinTypes = sins.filter(sin => item[sin] && item[sin] !== '');

        // 所持物理属性を一文字ずつ分解して配列化
        const rawAtk = (item['所持物理属性'] || '').trim();
        // "打(斬)" のような表記に対応：括弧内も含める
        const attackTypes = [...new Set(
            rawAtk.replace(/[()（）]/g, '').split('').filter(c => '斬貫打'.includes(c))
        )];

        // 守備スキルの種類（防/避/反）
        const defenseTypes = extractDefenseTypes(item);

        // キーワード編データとマージ
        const kw = kwMap[num] || {};

        // 戦闘キーワード（★印があれば所持）
        const battleKeywords = battleKwList.filter(k => (kw[k] || '').includes('★'));

        // 実装年月日（キーワード編の列）
        const implDateRaw = kw['実装年月日'] || '';
        let implYear = null;
        const dateMatch = implDateRaw.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
        if (dateMatch) {
            implYear = 2000 + parseInt(dateMatch[1], 10); // 例: "23/02/27" → 2023
        }

        // シーズン
        const seasonRaw = item['シーズン'] || '0';
        let season;
        if (seasonRaw === '0') season = '恒常';
        else if (seasonRaw === 'W') season = 'ヴァルプルギスの夜';
        else season = `シーズン${seasonRaw}`;

        // 防御レベル（列名「防御レベル」）
        const defLevel = parseInt(item['防御レベル'], 10) || null;

        const identity = {
            id:             `id_${num}`,
            num:            num,            // 生番号（例: "0101"）
            prisoner_num:   prisonerNum,    // 囚人番号 1〜13 (10除く)
            character_name: item['囚人名'],
            title:          item['名称'],
            season,
            impl_year:      implYear,       // 実装年 (2023〜) ※データがある場合のみ
            affiliations:   [item['所属']].filter(Boolean),
            battle_keywords: battleKeywords,
            hp:             parseInt(item['体力'], 10) || 0,
            defense_level:  defLevel,
            speed_min:      speedMin,
            speed_max:      speedMax,
            resistances: [
                { type: '斬撃', label: parseResist(item['斬撃耐性']) },
                { type: '貫通', label: parseResist(item['貫通耐性']) },
                { type: '打撃', label: parseResist(item['打撃耐性']) }
            ],
            attack_types:   attackTypes,
            sin_types:      sinTypes,
            defense_types:  defenseTypes
        };

        identities.push(identity);
    });

    const finalData = {
        identities,
        metadata: {
            affiliations,
            characteristics,
            sin_types:    ['憤怒', '色欲', '怠惰', '暴食', '憂鬱', '傲慢', '嫉妬'],
            attack_types: ['斬', '貫', '打'],
            battle_keywords: battleKwList,
            defense_types: ['防御', '回避', '反撃'],
            resist_labels: ['耐性', '普通', '脆弱'],
            seasons: ['恒常', 'ヴァルプルギスの夜',
                      'シーズン1','シーズン2','シーズン3','シーズン4',
                      'シーズン5','シーズン6','シーズン7'],
            impl_years: [2023, 2024, 2025, 2026]
        }
    };

    // キーワード一覧
    const ALL_KEYWORDS_FILE = path.join(DIR, 'キーワード一覧.txt');
    try {
        const content = fs.readFileSync(ALL_KEYWORDS_FILE, 'utf8');
        const match = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            finalData.metadata.keywords_data = parsed.map(k => ({ name: k.name, desc: k.description }));
            finalData.metadata.all_keywords = parsed.map(k => k.name);
        }
    } catch (e) {
        console.error('Failed to parse キーワード一覧.txt:', e);
        finalData.metadata.keywords_data = [];
        finalData.metadata.all_keywords = [];
    }

    // 所属一覧
    try {
        const lines = fs.readFileSync(path.join(DIR, '所属一覧'), 'utf8').split('\n');
        finalData.metadata.affiliations_data = lines
            .map(l => l.trim().replace('カテゴリ/所属/', ''))
            .filter(l => l && !l.includes('名称だけ抽出'));
    } catch (e) {
        finalData.metadata.affiliations_data = [];
    }

    // 特性キーワード一覧
    try {
        const lines = fs.readFileSync(path.join(DIR, '特性キーワード一覧.txt'), 'utf8').split('\n');
        finalData.metadata.characteristics_data = lines
            .map(l => l.trim().replace('カテゴリ/特性/', ''))
            .filter(l => l && !l.includes('名称だけ抽出'));
    } catch (e) {
        finalData.metadata.characteristics_data = [];
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log(`変換完了 → ${OUTPUT_FILE}`);
    console.log(`  人格数: ${identities.length}`);
}

convertData();
