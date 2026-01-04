// ==================== CONFIGURATION ====================
const CASE_SENSITIVE_MATCH = true;     // true = "A1" ≠ "a1"
const FREQUENCY_CUTOFF = 3000;          // false = no cutoff, or number = top N most frequent
const WORD_LENGTH = 1;                  // 1 = single char, 2 = two-char words, etc.
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    const statsDiv = document.getElementById('stats');
    const listContainer = document.getElementById('char-list-container');
    const tbody = document.getElementById('char-tbody');
    const searchInput = document.getElementById('search');

    try {
        // Parse frequency list — build map: word → rank (only for exact WORD_LENGTH later)
        const freqMap = new Map(); // word → rank
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
        const candidates = []; // array of { word, rawPinyin, rank }

        const lines = dictionaryRawData.trim().split('\n');

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            const columns = line.split('\t');
            if (columns.length < 3) return;

            const simplified = columns[1].trim();
            const pinyinPart = columns[2].trim();

            // Extract pinyin
            const pinyinMatch = pinyinPart.match(/\[(\[)?(.*?)(\])?\]/);
            if (!pinyinMatch) return;
            const rawPinyin = pinyinMatch[2].trim();

            // Must be pure Han characters and exact length
            if (!/^[\u4e00-\u9fff]+$/.test(simplified)) return;
            if (simplified.length !== WORD_LENGTH) return;

            // Look up frequency rank (exact word match)
            const rank = freqMap.get(simplified);
            if (rank === undefined) return; // no frequency data → skip

            // Avoid duplicates (some words might appear multiple times in dict)
            // We'll keep the first one we encounter
            candidates.push({
                word: simplified,
                rawPinyin,
                rank
            });
        });

        // Remove possible duplicates (in case dictionary has multiple entries for same simplified word)
        const seen = new Set();
        const uniqueCandidates = [];
        for (const item of candidates) {
            if (!seen.has(item.word)) {
                seen.add(item.word);
                uniqueCandidates.push(item);
            }
        }

        // Sort by frequency rank ascending (1 = most frequent)
        uniqueCandidates.sort((a, b) => a.rank - b.rank);

        // Apply cutoff: take top N (or all if false)
        let finalList;
        if (FREQUENCY_CUTOFF === false) {
            finalList = uniqueCandidates;
        } else {
            finalList = uniqueCandidates.slice(0, FREQUENCY_CUTOFF);
        }

        const totalWords = finalList.length;

        // Now build pinyin → words map for uniqueness check (only among the final list)
        const pinyinToWords = new Map(); // normalized pinyin → Set<word>

        finalList.forEach(item => {
            let normalized = item.rawPinyin
                .replace(/\s+/g, '')
                .replace(/-/g, '');
            if (!CASE_SENSITIVE_MATCH) {
                normalized = normalized.toLowerCase();
            }

            if (!pinyinToWords.has(normalized)) {
                pinyinToWords.set(normalized, new Set());
            }
            pinyinToWords.get(normalized).add(item.word);
        });

        // Count uniques and build display list
        let uniquePinyinCount = 0;
        const wordList = [];

        finalList.forEach(item => {
            let normalized = item.rawPinyin
                .replace(/\s+/g, '')
                .replace(/-/g, '');
            if (!CASE_SENSITIVE_MATCH) normalized = normalized.toLowerCase();

            const isUnique = pinyinToWords.get(normalized).size === 1;
            if (isUnique) uniquePinyinCount++;

            wordList.push({
                word: item.word,
                rawPinyin: item.rawPinyin,
                rank: item.rank,
                isUnique
            });
        });

        // Optional: secondary sort by word if ranks are equal (rare)
        wordList.sort((a, b) => {
            if (a.rank !== b.rank) return a.rank - b.rank;
            return a.word.localeCompare(b.word);
        });

        // UI text
        const lengthText = WORD_LENGTH === 1 ? 'single-character' : `${WORD_LENGTH}-character`;
        const hasCutoff = FREQUENCY_CUTOFF !== false;
        const cutoffDisplay = hasCutoff ? FREQUENCY_CUTOFF.toLocaleString() : 'all';
        const effectiveTotal = totalWords.toLocaleString();

        const uniquePercentage = totalWords > 0 ? (uniquePinyinCount / totalWords * 100).toFixed(1) : '0.0';

        document.querySelector('#char-list-container h2').textContent =
            `Unique ${lengthText} Words (Top ${cutoffDisplay} by Frequency)`;

        statsDiv.innerHTML = `
            <h2>Results</h2>
            <p><strong>Total ${lengthText} words analyzed:</strong> ${effectiveTotal}</p>
            ${hasCutoff ? `<p><strong>Selection:</strong> The ${cutoffDisplay} most frequent ${lengthText} words<br>
            <small>(only those present in both frequency list and dictionary)</small></p>` : ''}
            <p><strong>Of these, how many have a unique numeric pinyin reading<br>
            <small>(exact match including capitalization, spaces and hyphens removed):</small></strong><br>
            <strong style="font-size:1.5em;color:#27ae60;">
                ${uniquePinyinCount.toLocaleString()} (${uniquePercentage}%)
            </strong></p>
            <p><em>Dictionary entries processed: ${lines.length.toLocaleString()} | 
            Frequency list: ${totalFreqEntries.toLocaleString()} total entries</em></p>
            <p style="font-size:0.9em; color:#666; margin-top:20px;">
                Settings: WORD_LENGTH = ${WORD_LENGTH} | 
                CASE_SENSITIVE_MATCH = ${CASE_SENSITIVE_MATCH} | 
                FREQUENCY_CUTOFF = ${FREQUENCY_CUTOFF}
            </p>
        `;

        // Populate table
        wordList.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="text-align:center; color:#666;">${item.rank}</td>
                <td style="font-size:28px; text-align:center;">${item.word}</td>
                <td style="font-family: monospace; font-size:16px;">${item.rawPinyin}</td>
                <td style="text-align:center; font-size:20px;">${item.isUnique ? '✅ Yes' : '❌ No'}</td>
            `;
            tbody.appendChild(row);
        });

        listContainer.style.display = 'block';

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

    } catch (error) {
        statsDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        console.error(error);
    }
});