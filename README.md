# Empirical Analysis of Pinyin Uniqueness in Mandarin Chinese Lexical Items

**Quantitative Evidence Supporting the Near-Equivalence of Pinyin and Hanzi for Polysyllabic Vocabulary**  
© Alfons Grabher  
---

## Summary

Despite heavy homophony in monosyllables, Pinyin functions with near character-level precision for polysyllabic words.

- **Two-syllable words** are **98.4% unique** among the top **3,000**
- Even among the top **10,000 two-syllable words**, uniqueness remains **95.6%**
- For **three-syllable words**, uniqueness is effectively complete (**99.2%**)
- By contrast, among the **top 800 monosyllables**, only **53.1%** are unique
- Among the **top 3,000 monosyllables**, uniqueness drops to **13.2%**

In practical usage, ambiguity is rare, easily resolved by context, and largely confined to a small set of highly polysemous monosyllables.

---

## Proportion of Unique Pinyin Spellings

| Word Length | Cutoff Setting              | Words Analyzed | Unique Pinyin | Percentage |
|------------:|:----------------------------|---------------:|--------------:|-----------:|
| 1           | Top 800 most frequent       | 800            | 425           | 53.1%      |
| 1           | Top 3,000 most frequent     | 3,000          | 396           | 13.2%      |
| 2           | Top 3,000 most frequent     | 3,000          | 2,952         | 98.4%      |
| 2           | Top 10,000 most frequent    | 10,000         | 9,560         | 95.6%      |
| 2           | Top 25,000 most frequent    | 25,000         | 22,706        | 90.8%      |
| 2           | All (no cutoff)             | 57,329         | 47,328        | 82.6%      |
| 3           | Top 10,000 most frequent    | 6,128          | 6,077         | 99.2%      |

*Word length denotes number of Chinese characters / Pinyin syllables.  
Analysis conducted in lenient uniqueness mode.*

---

## View the Project

The full analysis, including source data, scripts, and interactive tables, is available in this GitHub repository, and can be viewed at the companion GitHub Pages site:

https://alfons.github.io/PinyinUniquenessStudy/

Feel free to open an issue if you spot anything off, improvements—contributions are welcome! 😊

— Alfons Grabher
