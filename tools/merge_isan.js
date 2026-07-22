const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'public', 'js', 'data.json');
const parsedPath = path.join(__dirname, '..', '人格一覧　イサン_parsed.json');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const parsedData = JSON.parse(fs.readFileSync(parsedPath, 'utf-8'));

// スペースとカッコ書きを無視してタイトルを正規化する関数
function normalizeTitle(title) {
    return title.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').replace(/\s+/g, '').toLowerCase();
}

let updateCount = 0;

data.identities = data.identities.map(id => {
    if (id.character_name === 'イサン') {
        const normExisting = normalizeTitle(id.title);
        // パース結果から対応する人格を探す
        const matched = parsedData.find(p => normalizeTitle(p.title_raw) === normExisting);
        
        if (matched) {
            updateCount++;
            // 既存のデータに新しい詳細データを統合
            return {
                ...id,
                characteristics: matched.characteristics,
                affiliations_detail: matched.affiliations,
                battle_keywords: Array.from(new Set([...id.battle_keywords, ...matched.used_keywords])), // キーワードをマージ
                skills_detail: matched.skills
            };
        } else {
            console.warn(`未マッチ: ${id.title}`);
        }
    }
    return id;
});

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`${updateCount}体のイサンの人格データを更新しました。`);
