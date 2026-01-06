// ==================== CONFIGURATION WILL BE SET DYNAMICALLY ====================

document.addEventListener('DOMContentLoaded', () => {
    const statsDiv = document.getElementById('stats');
    const listContainer = document.getElementById('char-list-container');
    const tbody = document.getElementById('char-tbody');
    const searchInput = document.getElementById('search');
    const tableTitle = document.getElementById('table-title');

    // Parse data once on load
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

    const dictMap = new Map();
    const dictLines = dictionaryRawData.trim().split('\n');
    dictLines.forEach(line => {
        line = line.trim();
        if (!line) return;

        const columns = line.split('\t');
        if (columns.length < 3) return;

        const simplified = columns[1].trim();
        const pinyinPart = columns[2].trim();

        const pinyinMatch = pinyinPart.match(/\[(\[)?(.*?)(\])?\]/);
        if (!pinyinMatch) return;
        const rawPinyin = pinyinMatch[2].trim();

        if (!/^[\u4e00-\u9fff]+$/.test(simplified)) return;

        if (!dictMap.has(simplified)) {
            dictMap.set(simplified, new Set());
        }
        dictMap.get(simplified).add(rawPinyin);
    });
    const totalDictEntries = dictLines.length;

    // Form handling
    const form = document.getElementById('config-form');
    let currentConfig = {
        WORD_LENGTH: 2,
        FREQUENCY_CUTOFF: 3000,
        UNIQUENESS_MODE: 'lenient'
    };

    // Sorting state
    let currentSort = {
        column: 1,          // 1 = rank, 4 = unique
        direction: 'asc'    // asc or desc
    };

    let wordList = []; // Will hold the current full list for sorting

    function sortAndRenderTable() {
        const sortedList = [...wordList];

        sortedList.sort((a, b) => {
            let primaryDiff = 0;

            if (currentSort.column === 1) {
                // Primary: rank (numeric)
                primaryDiff = a.rank - b.rank;
            } else if (currentSort.column === 4) {
                // Primary: uniqueness
                let aVal, bVal;
                if (currentConfig.UNIQUENESS_MODE === 'pinyin-centric') {
                    aVal = a.isUnique;  // number
                    bVal = b.isUnique;
                } else {
                    aVal = a.isUnique ? 1 : 0;
                    bVal = b.isUnique ? 1 : 0;
                }
                // Higher uniqueness first in asc (e.g., Yes before No, or higher count first)
                primaryDiff = currentConfig.UNIQUENESS_MODE === 'pinyin-centric'
                    ? bVal - aVal
                    : aVal - bVal;
            }

            if (primaryDiff !== 0) {
                return currentSort.direction === 'asc' ? primaryDiff : -primaryDiff;
            }

            // Tiebreaker 1: Pinyin (column 3) — alphabetical, case-insensitive
            const pinyinA = a.rawPinyin.toLowerCase();
            const pinyinB = b.rawPinyin.toLowerCase();
            if (pinyinA !== pinyinB) {
                return currentSort.direction === 'asc'
                    ? pinyinA.localeCompare(pinyinB)
                    : pinyinB.localeCompare(pinyinA);
            }

            // Tiebreaker 2: Rank (column 1) — stable fallback
            const rankDiff = a.rank - b.rank;
            return currentSort.direction === 'asc' ? rankDiff : -rankDiff;
        });

        // Rebuild table body (unchanged)
        tbody.innerHTML = '';
        sortedList.forEach(item => {
            let uniqueText;
            if (currentConfig.UNIQUENESS_MODE === 'pinyin-centric') {
                const count = item.isUnique;  // this is a number
                uniqueText = count > 0 ? `✅ ${count}` : `❌ 0`;
            } else {
                uniqueText = item.isUnique ? '✅ Yes' : '❌ No';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
            <td style="text-align:center;">${item.rank || '—'}</td>
            <td style="font-size:28px; text-align:center;">${item.word}</td>
            <td style="font-family: monospace;">${item.rawPinyin}</td>
            <td style="text-align:center; font-size:20px;">${uniqueText}</td>
        `;
            tbody.appendChild(row);
        });
    }

    function updateHeaderStyles() {
        const rankHeader = document.querySelector('#char-table th:nth-child(1)');
        const uniqueHeader = document.querySelector('#char-table th:nth-child(4)');

        // Reset arrows
        [rankHeader, uniqueHeader].forEach(th => {
            th.style.cursor = 'pointer';
            th.innerHTML = th.innerHTML.replace(/ [↑↓]$/, '');
        });

        // Add arrow to active column
        const arrow = currentSort.direction === 'asc' ? ' ↑' : ' ↓';
        if (currentSort.column === 1) {
            rankHeader.innerHTML += arrow;
        } else if (currentSort.column === 4) {
            uniqueHeader.innerHTML += arrow;
        }
    }

    // Click handlers for sortable headers
    const rankHeader = document.querySelector('#char-table th:nth-child(1)');
    const uniqueHeader = document.querySelector('#char-table th:nth-child(4)');

    rankHeader.addEventListener('click', () => {
        if (currentSort.column === 1) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = 1;
            currentSort.direction = 'asc';
        }
        updateHeaderStyles();
        sortAndRenderTable();
    });

    uniqueHeader.addEventListener('click', () => {
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

        // Update UI text
        const lengthText = config.WORD_LENGTH === 1 ? 'single-character' : `${config.WORD_LENGTH}-character`;
        const cutoffDisplay = config.FREQUENCY_CUTOFF === false ? 'all' : config.FREQUENCY_CUTOFF.toLocaleString();
        tableTitle.textContent = `Unique ${lengthText} Lexical Items (Top ${cutoffDisplay} by Frequency)`;

        // Clear previous results
        tbody.innerHTML = '';
        listContainer.style.display = 'none';
        statsDiv.innerHTML = '<p>Processing data, please wait...</p>';

        try {
            // Collect candidates based on config
            const candidates = [];
            for (const [word, pinyinsSet] of dictMap) {
                if (word.length !== config.WORD_LENGTH) continue;

                let rank = freqMap.get(word);  // may be undefined

                if (config.FREQUENCY_CUTOFF !== false && rank === undefined) {
                    continue;  // skip if cutoff active AND no frequency
                }

                // If no cutoff OR has frequency → include
                candidates.push({
                    word,
                    pinyins: Array.from(pinyinsSet),
                    rank: rank || null  // null means no frequency data
                });
            }

            candidates.sort((a, b) => {
                if (a.rank === null && b.rank === null) return 0;
                if (a.rank === null) return 1;  // no rank → go to end
                if (b.rank === null) return -1;
                return a.rank - b.rank;
            });

            const finalList = config.FREQUENCY_CUTOFF === false
                ? candidates
                : candidates.slice(0, config.FREQUENCY_CUTOFF);

            const totalWords = finalList.length;

            // Build pinyinToWords (always case-insensitive normalization)
            const pinyinToWords = new Map();
            finalList.forEach(item => {
                item.pinyins.forEach(rawPinyin => {
                    const normalized = rawPinyin
                        .replace(/\s+/g, '')
                        .replace(/-/g, '')
                        .toLowerCase();
                    if (!pinyinToWords.has(normalized)) {
                        pinyinToWords.set(normalized, new Set());
                    }
                    pinyinToWords.get(normalized).add(item.word);
                });
            });

            // Process wordList and uniqueness
            wordList = [];
            let uniquePinyinCount = 0;

            finalList.forEach(item => {
                const normalizeds = item.pinyins.map(raw => raw
                    .replace(/\s+/g, '')
                    .replace(/-/g, '')
                    .toLowerCase());

                const uniqueCount = normalizeds.filter(norm => pinyinToWords.get(norm)?.size === 1).length;

                let isUnique;
                if (config.UNIQUENESS_MODE === 'strict') {
                    isUnique = uniqueCount === normalizeds.length && normalizeds.length > 0;
                } else if (config.UNIQUENESS_MODE === 'lenient') {
                    isUnique = uniqueCount > 0;
                } else if (config.UNIQUENESS_MODE === 'pinyin-centric') {
                    isUnique = uniqueCount;
                }

                wordList.push({
                    word: item.word,
                    rawPinyin: item.pinyins.join(' / '),
                    rank: item.rank,
                    isUnique
                });
            });

            // Calculate uniquePinyinCount based on mode
            if (config.UNIQUENESS_MODE === 'pinyin-centric') {
                for (const set of pinyinToWords.values()) {
                    if (set.size === 1) uniquePinyinCount++;
                }
            } else {
                uniquePinyinCount = wordList.filter(item => item.isUnique).length;
            }

            // Adjust stats labels and totals based on mode
            let proportionLabel = 'Unique Pinyin spellings';
            let totalForPercent = totalWords;
            if (config.UNIQUENESS_MODE === 'pinyin-centric') {
                totalForPercent = pinyinToWords.size || 0;
            }

            function getModeName(mode) {
                switch (mode) {
                    case 'lenient':
                        return 'Lenient – at least one unique Pinyin spelling';
                    case 'strict':
                        return 'Strict – all Pinyin spellings unique';
                    case 'pinyin-centric':
                        return 'Pinyin-centric – Number of unique Pinyin spellings';
                    default:
                        return mode;
                }
            }
            let uniqueWordCount;
            if (config.UNIQUENESS_MODE === 'strict') {
                uniqueWordCount = wordList.filter(item => item.isUnique).length;
            } else if (config.UNIQUENESS_MODE === 'pinyin-centric') {
                uniqueWordCount = wordList.filter(item => item.isUnique > 0).length;  // has at least one
            } else {
                // lenient (default)
                uniqueWordCount = wordList.filter(item => item.isUnique).length;
            }

            const uniquePercentage = totalWords > 0 ? (uniqueWordCount / totalWords * 100).toFixed(1) : '0.0';

            statsDiv.innerHTML = `
                <h2>Results</h2>
                <p>Uniqueness Mode: ${getModeName(currentConfig.UNIQUENESS_MODE)}</p>
                <p><strong>Total ${lengthText} words analyzed:</strong><br>
                <strong style="font-size:1.8em;color:#2c3e50;">${totalWords.toLocaleString()}</strong></p>
                <strong>${proportionLabel}<br>
                <strong style="font-size:1.8em;color:#2c3e50;">
                    ${uniqueWordCount.toLocaleString()} (${uniquePercentage}%)
                </strong></p>
                <p><em>Dictionary entries processed: ${totalDictEntries.toLocaleString()} | 
                Frequency list: ${totalFreqEntries.toLocaleString()} total entries</em></p>
            `;

            // Update table header based on mode
            uniqueHeader.textContent = config.UNIQUENESS_MODE === 'pinyin-centric' ? '# of unique Pinyin spellings' : 'Unique';

            // Populate table with initial sort (by rank asc)
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

    // Initial run with defaults
    runAnalysis(currentConfig);

    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const newConfig = {
            WORD_LENGTH: parseInt(document.getElementById('word-length').value, 10),
            FREQUENCY_CUTOFF: document.getElementById('cutoff').value === 'false' ? false : parseInt(document.getElementById('cutoff').value, 10),
            UNIQUENESS_MODE: document.getElementById('uniqueness-mode').value
        };
        runAnalysis(newConfig);
    });

    // Live search
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        const rows = tbody.querySelectorAll('tr');

        rows.forEach(row => {
            const rank = row.cells[0].textContent;
            const word = row.cells[1].textContent;
            const pinyin = row.cells[2].textContent.toLowerCase();
            if (word.includes(query) || pinyin.includes(query) || rank.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
});