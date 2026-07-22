#!/usr/bin/env node
// tools/parse_detail.js
// 詳細人格ファイル（例: 人格一覧　イサン.txt）をパースしてJSONに変換するスクリプト

const fs = require('fs');
const path = require('path');

const SIN_TYPES = ['憤怒', '色欲', '怠惰', '暴食', '憂鬱', '傲慢', '嫉妬'];
const ATK_TYPES = ['斬撃', '貫通', '打撃'];
const DEF_TYPES = ['防御', '回避', '反撃'];

const BLOCK_DELIMITER = /^\s*同期化段階\s*Ⅱ\s*\/\s*Ⅲ\s*\/\s*Ⅳ\s*で表示\s*$/;

/** キーワード一覧.txt から全キーワード名を取得 */
function loadAllKeywords(dir) {
    const kwFile = path.join(dir, 'キーワード一覧.txt');
    if (!fs.existsSync(kwFile)) return [];
    const content = fs.readFileSync(kwFile, 'utf-8');
    const match = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!match) return [];
    try {
        return JSON.parse(match[0]).map(k => k.name).filter(k => k.length >= 2); // 1文字は誤検知が多いため除外
    } catch { return []; }
}

/**
 * スキルセクション（スキル1〜守備スキル・特殊）を識別するかどうか
 * 返り値: { key, name, coinCount } または null
 */
function detectSkillHeader(line) {
    // 通常スキル: "スキル1\t名前\t×3\t"
    const m1 = line.match(/^スキル([123])\t(.+?)\t×(\d+)/);
    if (m1) return { key: `skill${m1[1]}`, name: m1[2], coinCount: parseInt(m1[3], 10) };

    // 守備スキル: "守備スキル\t名前\t" (×N なし可)
    const m2 = line.match(/^守備スキル\t(.+)/);
    if (m2) {
        const coinMatch = m2[1].match(/×(\d+)/);
        return { key: 'defense', name: m2[1].split('\t')[0], coinCount: coinMatch ? parseInt(coinMatch[1], 10) : null };
    }

    // 特殊スキル: "特殊\t名前\t×N"
    const m3 = line.match(/^特殊\t(.+?)\t×(\d+)/);
    if (m3) return { key: 'special', name: m3[1], coinCount: parseInt(m3[2], 10) };

    // 特殊スキル（タグなし、×0 形式）: "スキル名\t×0"
    const m4 = line.match(/^([^\t]+)\t×(\d+)/);
    if (m4 && m4[1] !== 'スキル1' && m4[1] !== 'スキル2' && m4[1] !== 'スキル3') {
        return { key: 'special', name: m4[1], coinCount: parseInt(m4[2], 10) };
    }

    return null;
}

/**
 * スキルブロック内から属性情報を抽出する
 */
function extractSkillAttrs(lines, startIdx) {
    const sinSet = new Set();
    const atkSet = new Set();
    const defSet = new Set();
    let j = startIdx;

    // 列ヘッダー行をスキップ
    while (j < lines.length) {
        const l = lines[j].trim();
        if (!l) { j++; continue; }
        if (l.startsWith('罪悪属性') || l.startsWith('守備タイプ')) { j++; continue; }
        break;
    }

    // データ行を読む
    for (; j < lines.length; j++) {
        const sl = lines[j].trim();
        if (!sl) continue;
        // 次のセクション開始で終了
        if (sl.match(/^(スキル[1-3]|守備スキル|特殊|バトル|サポート)\t/) ||
            sl.match(/^[^\t]+\t×\d+\t?$/) && !sl.startsWith('Ⅰ') && !sl.startsWith('Ⅱ') && !sl.startsWith('Ⅲ')) {
            break;
        }
        SIN_TYPES.forEach(s => { if (sl === s || sl.startsWith(s + '\t')) sinSet.add(s); });
        ATK_TYPES.forEach(s => { if (sl === s || sl.startsWith(s + '\t')) atkSet.add(s); });
        DEF_TYPES.forEach(s => { if (sl.includes(s)) defSet.add(s); });
        if (sl.includes('反撃')) defSet.add('反撃');
        if (sl.includes('マッチ可能反撃')) { defSet.delete('反撃'); defSet.add('マッチ可能反撃'); }
        if (sl.includes('マッチ可能ガード')) { defSet.delete('防御'); defSet.add('マッチ可能ガード'); }
    }

    return {
        sin_types: [...sinSet],
        atk_types: [...atkSet],
        def_types: [...defSet],
        nextIdx: j
    };
}

/**
 * ブロック全体のテキストからキーワード一覧に載っているキーワードを抽出
 */
function extractKeywords(lines, allKeywords) {
    const fullText = lines.join('\n');
    return allKeywords.filter(kw => fullText.includes(kw));
}

/**
 * テキストブロックから1体の人格データを抽出する
 */
function parseBlock(lines, allKeywords) {
    const result = {
        title_raw: null,
        characteristics: [],
        affiliations: [],
        used_keywords: [],
        skills: {
            skill1:  { sin_types: [], atk_types: [], coin_count: null },
            skill2:  { sin_types: [], atk_types: [], coin_count: null },
            skill3:  { sin_types: [], atk_types: [], coin_count: null },
            defense: { sin_types: [], def_types: [], coin_count: null },
            special: []  // [{name, sin_types, atk_types, coin_count}]
        }
    };

    // 先頭の意味ある行を title_raw とする
    const nonEmpty = lines.find(l => {
        const t = l.trim();
        return t && !t.match(/^[a-f0-9]{30,}\.(png|webp)/) && !t.match(/^\d+$/);
    });
    if (nonEmpty) result.title_raw = nonEmpty.trim();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // ---- 特性キーワード ----
        const charMatch = line.match(/^特性キーワード\t(.+)/);
        if (charMatch) {
            result.characteristics = charMatch[1].split(/[,、]/).map(s => s.trim()).filter(Boolean);
            continue;
        }

        // ---- 所属 ----
        const affilMatch = line.match(/^所属[\*\d]*\t(.+)/);
        if (affilMatch) {
            const v = affilMatch[1].split('\t')[0].trim();
            if (v) result.affiliations.push(v);
            // "Limbus\nCompany" のような改行結合
            if (v === 'Limbus' && lines[i + 1] && lines[i + 1].trim() === 'Company') {
                result.affiliations[result.affiliations.length - 1] = 'Limbus Company';
                i++;
            }
            continue;
        }

        // ---- スキルセクション ----
        const skillHeader = detectSkillHeader(line);
        if (skillHeader) {
            const { key, name, coinCount } = skillHeader;
            const attrs = extractSkillAttrs(lines, i + 1);

            if (key === 'special') {
                result.skills.special.push({
                    name,
                    coin_count: coinCount,
                    sin_types: attrs.sin_types,
                    atk_types: attrs.atk_types
                });
            } else {
                result.skills[key].coin_count = coinCount;
                result.skills[key].sin_types = attrs.sin_types;
                result.skills[key].atk_types = attrs.atk_types;
                if (key === 'defense') result.skills[key].def_types = attrs.def_types;
            }

            i = attrs.nextIdx - 1;
            continue;
        }
    }

    // キーワード抽出
    result.used_keywords = extractKeywords(lines, allKeywords);

    return result;
}

/**
 * ファイルを読み込み、ブロックに分割してパースする
 */
function parseDetailFile(filePath, allKeywords) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rawLines = content.split('\n');

    const blocks = [];
    let current = [];
    for (const line of rawLines) {
        if (BLOCK_DELIMITER.test(line)) {
            if (current.length > 0) { blocks.push([...current]); current = []; }
        } else {
            current.push(line);
        }
    }
    if (current.length > 0 && current.some(l => l.trim())) blocks.push(current);

    return blocks.map(block => parseBlock(block, allKeywords));
}

// ===== MAIN =====
const inputFile = process.argv[2] || path.join(__dirname, '..', '人格一覧　イサン.txt');
const dir = path.dirname(inputFile);

if (!fs.existsSync(inputFile)) {
    console.error('File not found:', inputFile);
    process.exit(1);
}

const allKeywords = loadAllKeywords(path.join(__dirname, '..'));
console.log(`キーワード一覧: ${allKeywords.length}件 読み込み`);
console.log('Parsing:', inputFile);

const results = parseDetailFile(inputFile, allKeywords);
console.log(`\n=== 解析結果 (${results.length}体) ===\n`);

results.forEach((r, idx) => {
    console.log(`---- [${idx + 1}] ${r.title_raw} ----`);
    console.log('  特性KW:', r.characteristics.join(', ') || '(なし)');
    console.log('  所属:', r.affiliations.join(', ') || '(なし)');
    const sk = r.skills;
    console.log('  スキル1  sin:', sk.skill1.sin_types.join(','), '| atk:', sk.skill1.atk_types.join(','), '| coin:', sk.skill1.coin_count);
    console.log('  スキル2  sin:', sk.skill2.sin_types.join(','), '| atk:', sk.skill2.atk_types.join(','), '| coin:', sk.skill2.coin_count);
    console.log('  スキル3  sin:', sk.skill3.sin_types.join(','), '| atk:', sk.skill3.atk_types.join(','), '| coin:', sk.skill3.coin_count);
    console.log('  守備     def:', sk.defense.def_types.join(','), '| sin:', sk.defense.sin_types.join(','));
    if (sk.special.length > 0) {
        sk.special.forEach(s => console.log(`  特殊[${s.name}] sin:`, s.sin_types.join(','), '| atk:', s.atk_types.join(','), '| coin:', s.coin_count));
    }
    console.log('  使用KW:', r.used_keywords.join(', ') || '(なし)');
    console.log();
});

const outputFile = inputFile.replace(/\.txt$/, '_parsed.json');
fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');
console.log(`JSON出力 → ${outputFile}`);
