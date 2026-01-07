// ==================== CONFIGURATION WILL BE SET DYNAMICALLY ====================

document.addEventListener('DOMContentLoaded', () => {
    const statsDiv = document.getElementById('stats');
    const listContainer = document.getElementById('char-list-container');
    const tbody = document.getElementById('char-tbody');
    const searchInput = document.getElementById('search');
    const tableTitle = document.getElementById('table-title');

    // Parse frequency list (unchanged)
    const freqMap = new Map();
    const freqLines = frequencyList.trim().split('\n');
    let rankCounter = 1;
    freqLines.forEach(line => {
        line = line.trim();
        if (!line) return;
        const parts = line.split(/\s+/);
        if (parts.length < 2) return;
        const word = parts[0];
        const freq = parseInt(parts[1], 10);
        if (/^[\u4e00-\u9fff]+$/.test(word) && !isNaN(freq)) {
            freqMap.set(word, rankCounter);
            rankCounter++;
        }
    });
    const totalFreqEntries = freqMap.size;

    // Parse dictionary
    const dictMap = new Map(); // word → { numeric: Set, display: Set }
    const dictLines = dictionaryRawData.trim().split('\n');
    dictLines.forEach(line => {
        line = line.trim();
        if (!line) return;

        const columns = line.split('\t');
        if (columns.length < 3) return;

        const word = columns[0].trim();
        const numericPinyin = columns[1].trim();   // e.g., ni3hao3 (used for logic + search)
        const displayPinyin = columns[2].trim();   // e.g., nǐhǎo (display only)

        if (!/^[\u4e00-\u9fff]+$/.test(word)) return;

        if (!dictMap.has(word)) {
            dictMap.set(word, { numeric: new Set(), display: new Set() });
        }
        dictMap.get(word).numeric.add(numericPinyin);
        dictMap.get(word).display.add(displayPinyin);
    });
    const totalDictEntries = dictLines.length;

    // Config & state
    let currentConfig = {
        WORD_LENGTH: 2,
        FREQUENCY_CUTOFF: 3000,
        UNIQUENESS_MODE: 'lenient'
    };

    let currentSort = {
        column: 1,
        direction: 'asc'
    };

    let wordList = [];

    function sortAndRenderTable() {
        const sortedList = [...wordList];

        sortedList.sort((a, b) => {
            let primaryDiff = 0;

            if (currentSort.column === 1) {
                primaryDiff = (a.rank || Infinity) - (b.rank || Infinity);
            } else if (currentSort.column === 4) {
                let aVal = currentConfig.UNIQUENESS_MODE === 'pinyin-centric' ? a.isUnique : (a.isUnique ? 1 : 0);
                let bVal = currentConfig.UNIQUENESS_MODE === 'pinyin-centric' ? b.isUnique : (b.isUnique ? 1 : 0);
                primaryDiff = currentConfig.UNIQUENESS_MODE === 'pinyin-centric' ? bVal - aVal : aVal - bVal;
            }

            if (primaryDiff !== 0) {
                return currentSort.direction === 'asc' ? primaryDiff : -primaryDiff;
            }

            // Tiebreaker: number-marked pinyin (correct alphabetical order)
            const pinyinA = a.sortPinyin.toLowerCase();
            const pinyinB = b.sortPinyin.toLowerCase();
            if (pinyinA !== pinyinB) {
                return currentSort.direction === 'asc'
                    ? pinyinA.localeCompare(pinyinB)
                    : pinyinB.localeCompare(pinyinA);
            }

            // Final tiebreaker: rank
            return currentSort.direction === 'asc'
                ? (a.rank || Infinity) - (b.rank || Infinity)
                : (b.rank || Infinity) - (a.rank || Infinity);
        });

        // Render rows
        tbody.innerHTML = '';
        sortedList.forEach(item => {
            let uniqueText = currentConfig.UNIQUENESS_MODE === 'pinyin-centric'
                ? (item.isUnique > 0 ? `✅ ${item.isUnique}` : `❌ 0`)
                : (item.isUnique ? '✅ Yes' : '❌ No');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="text-align:center;">${item.rank || '—'}</td>
                <td style="font-size:28px; text-align:center;">${item.word}</td>
                <td style="font-family: monospace;">${item.displayPinyin}</td>
                <td style="text-align:center; font-size:20px;">${uniqueText}</td>
            `;
            // Store number-marked pinyin for search
            row.dataset.numericPinyin = item.sortPinyin.toLowerCase();
            tbody.appendChild(row);
        });
    }

    function updateHeaderStyles() {
        const rankHeader = document.querySelector('#char-table th:nth-child(1)');
        const uniqueHeader = document.querySelector('#char-table th:nth-child(4)');

        [rankHeader, uniqueHeader].forEach(th => {
            th.style.cursor = 'pointer';
            th.innerHTML = th.innerHTML.replace(/ [↑↓]$/, '');
        });

        const arrow = currentSort.direction === 'asc' ? ' ↑' : ' ↓';
        if (currentSort.column === 1) rankHeader.innerHTML += arrow;
        if (currentSort.column === 4) uniqueHeader.innerHTML += arrow;
    }

    // Header clicks
    document.querySelector('#char-table th:nth-child(1)').addEventListener('click', () => {
        if (currentSort.column === 1) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = 1;
            currentSort.direction = 'asc';
        }
        updateHeaderStyles();
        sortAndRenderTable();
    });

    document.querySelector('#char-table th:nth-child(4)').addEventListener('click', () => {
        if (currentSort.column === 4) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = 4;
            currentSort.direction = 'asc';
        }
        updateHeaderStyles();
        sortAndRenderTable();
    });

    function runAnalysis(config) {
        currentConfig = config;

        const lengthText = config.WORD_LENGTH === 1 ? 'single-character' : `${config.WORD_LENGTH}-character`;
        const cutoffDisplay = config.FREQUENCY_CUTOFF === false ? 'all' : config.FREQUENCY_CUTOFF.toLocaleString();
        tableTitle.textContent = `Unique ${lengthText} Lexical Items (Top ${cutoffDisplay} by Frequency)`;

        tbody.innerHTML = '';
        listContainer.style.display = 'none';
        statsDiv.innerHTML = '<p>Processing data, please wait...</p>';

        try {
            const candidates = [];
            for (const [word, sets] of dictMap) {
                if (word.length !== config.WORD_LENGTH) continue;
                const rank = freqMap.get(word);
                if (config.FREQUENCY_CUTOFF !== false && rank === undefined) continue;

                candidates.push({
                    word,
                    numericPinyins: Array.from(sets.numeric),
                    displayPinyins: Array.from(sets.display),
                    rank: rank || null
                });
            }

            candidates.sort((a, b) => {
                if (a.rank === null) return 1;
                if (b.rank === null) return -1;
                return a.rank - b.rank;
            });

            const finalList = config.FREQUENCY_CUTOFF === false ? candidates : candidates.slice(0, config.FREQUENCY_CUTOFF);
            const totalWords = finalList.length;

            // Uniqueness mapping (normalized number-marked pinyin)
            const pinyinToWords = new Map();
            finalList.forEach(item => {
                item.numericPinyins.forEach(raw => {
                    const norm = raw.replace(/\s+/g, '').replace(/-/g, '').toLowerCase();
                    if (!pinyinToWords.has(norm)) pinyinToWords.set(norm, new Set());
                    pinyinToWords.get(norm).add(item.word);
                });
            });

            // Build wordList
            wordList = [];
            finalList.forEach(item => {
                const normalizeds = item.numericPinyins.map(raw => raw.replace(/\s+/g, '').replace(/-/g, '').toLowerCase());
                const uniqueCount = normalizeds.filter(norm => pinyinToWords.get(norm)?.size === 1).length;

                let isUnique;
                if (config.UNIQUENESS_MODE === 'strict') {
                    isUnique = uniqueCount === normalizeds.length && normalizeds.length > 0;
                } else if (config.UNIQUENESS_MODE === 'lenient') {
                    isUnique = uniqueCount > 0;
                } else { // pinyin-centric
                    isUnique = uniqueCount;
                }

                wordList.push({
                    word: item.word,
                    displayPinyin: item.displayPinyins.join(' / '),
                    sortPinyin: item.numericPinyins.join(' / '),  // for sorting + search
                    rank: item.rank,
                    isUnique
                });
            });

            // Stats
            let uniqueWordCount = config.UNIQUENESS_MODE === 'pinyin-centric'
                ? wordList.filter(i => i.isUnique > 0).length
                : wordList.filter(i => i.isUnique).length;

            const uniquePercentage = totalWords > 0 ? (uniqueWordCount / totalWords * 100).toFixed(1) : '0.0';

            function getModeName(mode) {
                switch (mode) {
                    case 'lenient': return 'Lenient – at least one unique Pinyin spelling';
                    case 'strict': return 'Strict – all Pinyin spellings unique';
                    case 'pinyin-centric': return 'Pinyin-centric – Number of unique Pinyin spellings';
                    default: return mode;
                }
            }

            const cutoffText = cutoffDisplay !== 'all'
                ? ` (out of top ${cutoffDisplay} by frequency)`
                : '';

            statsDiv.innerHTML = `
                <h2>Results</h2>
                <p>Uniqueness Mode: ${getModeName(config.UNIQUENESS_MODE)}</p>
                <p><strong>Total ${lengthText} words analyzed${cutoffText}:</strong><br>
                <strong style="font-size:1.8em;color:#2c3e50;">${totalWords.toLocaleString()}</strong></p>
                <strong>Unique items<br>
                <strong style="font-size:1.8em;color:#2c3e50;">
                    ${uniqueWordCount.toLocaleString()} (${uniquePercentage}%)
                </strong></p>
                <p><em>Dictionary entries processed: ${totalDictEntries.toLocaleString()} | 
                Frequency list: ${totalFreqEntries.toLocaleString()} total entries</em></p>
            `;

            document.querySelector('#char-table th:nth-child(4)').textContent =
                config.UNIQUENESS_MODE === 'pinyin-centric' ? '# of unique Pinyin spellings' : 'Pinyin is unique';

            currentSort.column = 1;
            currentSort.direction = 'asc';
            sortAndRenderTable();
            updateHeaderStyles();

            listContainer.style.display = 'block';

        } catch (error) {
            statsDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
            console.error(error);
        }
    }

    runAnalysis(currentConfig);

    // Form submit
    document.getElementById('config-form').addEventListener('submit', e => {
        e.preventDefault();
        const newConfig = {
            WORD_LENGTH: parseInt(document.getElementById('word-length').value, 10),
            FREQUENCY_CUTOFF: document.getElementById('cutoff').value === 'false' ? false : parseInt(document.getElementById('cutoff').value, 10),
            UNIQUENESS_MODE: document.getElementById('uniqueness-mode').value
        };
        runAnalysis(newConfig);
    });

    // === ENHANCED SEARCH: supports number-marked pinyin (primary) + tone-marked + hanzi + rank ===
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query === '') {
            tbody.querySelectorAll('tr').forEach(row => row.style.display = '');
            return;
        }

        tbody.querySelectorAll('tr').forEach(row => {
            const rank = row.cells[0].textContent;
            const word = row.cells[1].textContent;
            const displayPinyin = row.cells[2].textContent.toLowerCase(); // tone-marked
            const numericPinyin = row.dataset.numericPinyin || '';         // number-marked (stored earlier)

            if (word.includes(query) ||
                numericPinyin.includes(query) ||
                displayPinyin.includes(query) ||
                rank.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
});