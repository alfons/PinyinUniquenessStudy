// ==================== CONFIGURATION WILL BE SET DYNAMICALLY ====================

document.addEventListener('DOMContentLoaded', () => {
    const statsDiv = document.getElementById('stats');
    const listContainer = document.getElementById('char-list-container');
    const tbody = document.getElementById('char-tbody');
    const searchInput = document.getElementById('search');
    const tableTitle = document.getElementById('table-title');

    // Form handling
    const form = document.getElementById('config-form');
    let currentConfig = {
        WORD_LENGTH: 2,
        FREQUENCY_CUTOFF: 3000,
        CASE_SENSITIVE_MATCH: true
    };

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
            // Parse frequency list — build map: word → rank
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

            // Parse dictionary and collect candidates
            const candidates = [];

            const lines = dictionaryRawData.trim().split('\n');

            lines.forEach(line => {
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
                if (simplified.length !== config.WORD_LENGTH) return;

                const rank = freqMap.get(simplified);
                if (rank === undefined) return;

                candidates.push({
                    word: simplified,
                    rawPinyin,
                    rank
                });
            });

            // Deduplicate
            const seen = new Set();
            const uniqueCandidates = [];
            for (const item of candidates) {
                if (!seen.has(item.word)) {
                    seen.add(item.word);
                    uniqueCandidates.push(item);
                }
            }

            uniqueCandidates.sort((a, b) => a.rank - b.rank);

            let finalList = config.FREQUENCY_CUTOFF === false
                ? uniqueCandidates
                : uniqueCandidates.slice(0, config.FREQUENCY_CUTOFF);

            const totalWords = finalList.length;

            // Pinyin uniqueness check
            const pinyinToWords = new Map();
            finalList.forEach(item => {
                let normalized = item.rawPinyin
                    .replace(/\s+/g, '')
                    .replace(/-/g, '');
                if (!config.CASE_SENSITIVE_MATCH) {
                    normalized = normalized.toLowerCase();
                }

                if (!pinyinToWords.has(normalized)) {
                    pinyinToWords.set(normalized, new Set());
                }
                pinyinToWords.get(normalized).add(item.word);
            });

            let uniquePinyinCount = 0;
            const wordList = [];

            finalList.forEach(item => {
                let normalized = item.rawPinyin
                    .replace(/\s+/g, '')
                    .replace(/-/g, '');
                if (!config.CASE_SENSITIVE_MATCH) normalized = normalized.toLowerCase();

                const isUnique = pinyinToWords.get(normalized).size === 1;
                if (isUnique) uniquePinyinCount++;

                wordList.push({
                    word: item.word,
                    rawPinyin: item.rawPinyin,
                    rank: item.rank,
                    isUnique
                });
            });

            wordList.sort((a, b) => {
                if (a.rank !== b.rank) return a.rank - b.rank;
                return a.word.localeCompare(b.word);
            });

            const uniquePercentage = totalWords > 0 ? (uniquePinyinCount / totalWords * 100).toFixed(1) : '0.0';

            statsDiv.innerHTML = `
                <h2>Results</h2>
                <p><strong>Total ${lengthText} words analyzed:</strong><br>
                <small>(Only those present in both frequency list and dictionary)</small><br>
                <strong style="font-size:1.8em;color:#2c3e50;">${totalWords.toLocaleString()}</strong></p>
                <strong>Proportion with unique pinyin reading<br></strong>
                <small>(During the comparison all spaces and hyphens are removed; ${config.CASE_SENSITIVE_MATCH ? 'case-sensitive' : 'case-insensitive'}):</small><br>
                <strong style="font-size:1.8em;color:#2c3e50;">
                    ${uniquePinyinCount.toLocaleString()} (${uniquePercentage}%)
                </strong></p>
                <p><em>Dictionary entries processed: ${lines.length.toLocaleString()} | 
                Frequency list: ${totalFreqEntries.toLocaleString()} total entries</em></p>
            `;

            // Populate table
            wordList.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style="text-align:center;">${item.rank}</td>
                    <td style="font-size:28px; text-align:center;">${item.word}</td>
                    <td style="font-family: monospace;">${item.rawPinyin}</td>
                    <td style="text-align:center; font-size:20px;">${item.isUnique ? '✅ Yes' : '❌ No'}</td>
                `;
                tbody.appendChild(row);
            });

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
            CASE_SENSITIVE_MATCH: document.getElementById('case-sensitive').checked
        };
        runAnalysis(newConfig);
    });

    // Live search (unchanged)
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