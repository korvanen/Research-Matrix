# Dimensional Framework — Sheet Schema Guide

A reference for structuring your Google Sheet so all tools work correctly, and the new academic features (DOI resolution, screening, export, methods blurb) have the data they expect.

---

## Tab naming

Every tab you want the app to load **must contain `TAB` in its name**. The app ignores all other tabs.

| Tab name | Loaded? 
|---|---|
| `TAB — Epistemology` | ✓ |
| `TAB — Methodology` | ✓ |
| `Overview` | ✗ (no `TAB`) |
| `Raw import` | ✗ |

You can have as many `TAB` tabs as you like — each becomes a separate dataset tab in the Spreadsheet tool.

---

## Grid layout (the internal format)

Each `TAB` tab follows this fixed row/column structure. **Do not change the position of Row 0 or the "HEADER ROW" / "TITLE" sentinel cells.**

```
Row 0:   CATEGORY   COLUMN    COLUMN   COLUMN   COLUMN   COLUMN   COLUMN  …
Row 1:   TITLE      Your Study Title
Row 2:   HEADER ROW            Title   Authors  Year     DOI      Journal …
Row 3+:  [category] [empty]    value   value    value    value    value   …
```

### Row 0 — the flag row

- `CATEGORY` marks a column whose values label the left-hand category sidebar.
- `COLUMN` marks a column that is a normal data column.
- You can have multiple `CATEGORY` columns (for hierarchical groupings) but typically one is enough.

### Row 1 — TITLE row

Put `TITLE` in column A and the name of your dataset in column B. This name appears in the topbar and concept map.

### Row 2 — HEADER ROW

Put `HEADER ROW` in column A (the CATEGORY column). Then fill in human-readable column names starting in the first `COLUMN` position. These names appear as headers in the Spreadsheet tool and in Find Matches result cards.

### Row 3 onwards — data rows

- Column A (CATEGORY): the category label. Rows with the same category value are visually grouped together. Leave it blank to inherit the previous row's category span.
- Column B (first COLUMN): first data value.
- And so on.

---

## Recommended columns

These columns unlock the most academic features. They don't need to match exactly — the schema validator does a fuzzy check — but the names below are ideal.

| Column name | Required? | What it unlocks |
|---|---|---|
| `Title` | ✓ Recommended | Find Matches primary label, concept map node names |
| `Authors` | ✓ Recommended | Export CSV, methods blurb citations |
| `Year` | ✓ Recommended | Export, filtering, methods blurb |
| `DOI` | ✓ Recommended | Auto-linking to source, Crossref metadata fetch button |
| `Journal` | Optional | Export, cluster labels |
| `Abstract` | Optional | Semantic similarity quality (embeddings over full abstract = much better results) |
| `Keywords` | Optional | Keyword extraction for Find Matches |
| `Status` | Optional | Screening workflow (overridden by the in-app badge system anyway) |
| `Notes` | Optional | Free annotations (also stored in-app localStorage) |
| `URL` | Optional | Fallback link if DOI is absent |

---

## Minimal example (copy-pasteable)

Here is the smallest valid `TAB` tab for a literature review. Columns: A = CATEGORY, B–F = COLUMN.

```
Row 0:  CATEGORY   COLUMN       COLUMN    COLUMN  COLUMN  COLUMN
Row 1:  TITLE      My Thesis Review
Row 2:  HEADER ROW              Title     Authors Year    DOI
Row 3:  Theoretical             Sense-making in organizations  Weick, K.   1995   10.xxxx/yyyy
Row 4:  Theoretical             Organizational learning        Argyris, C. 1978
Row 5:  Empirical               A survey of remote work        Smith, J.   2022   10.xxxx/zzzz
Row 6:  Empirical
```

- Row 3 and Row 4 both belong to category `Theoretical`. Row 4 leaves column A blank so the cell spans both rows in the spreadsheet view.
- Row 5 and Row 6 belong to `Empirical`.

---

## Extended example with all recommended columns

```
Row 0:  CATEGORY  COLUMN  COLUMN   COLUMN   COLUMN  COLUMN   COLUMN    COLUMN    COLUMN
Row 1:  TITLE     Cohousing and Community — Master's Thesis Lit Review
Row 2:  HEADER ROW        Title    Authors  Year    DOI      Journal   Abstract  Keywords
Row 3:  Social Capital    Bowling Alone  Putnam, R.  2000  10.1073/pnas.97.1.16  PNAS  "Social capital refers to..."  community; trust; reciprocity
Row 4:  Social Capital
Row 5:  Design            The Image of the City  Lynch, K.  1960    MIT Press  "People orient themselves through..."  urban; wayfinding; place
```

---

## Multi-level categories

You can have a hierarchy of categories by adding a second `CATEGORY` column. For example: outer category = `Domain`, inner = `Sub-theme`.

```
Row 0:  CATEGORY  CATEGORY  COLUMN  COLUMN  COLUMN  COLUMN
Row 2:  HEADER ROW                  Title   Authors Year    DOI
Row 3:  Design    Spatial           ...
Row 4:  Design    Spatial
Row 5:  Design    Temporal          ...
Row 6:  Social    Networks          ...
```

The Spreadsheet tool will span and indent both category columns automatically.

---

## Using the BibTeX / CSV import (no Google Sheets needed)

If you don't want to use Google Sheets, you can import a `.bib` (BibTeX) or `.csv` file directly on the home page:

1. Open the home page.
2. Drop your `.bib` or `.csv` file into the **Import from file** drop zone.
3. The app parses it, converts it to the internal grid format (with Title, Authors, Year, Journal, DOI, Abstract, Keywords, Status columns), and reloads.
4. All four tools work normally on the imported data.

The imported tab is named `MX-Imported-<filename>` and is persisted in `localStorage` so it survives page reloads. Click **✕ Clear imported data** to remove it.

### BibTeX support

The parser handles `@article`, `@book`, `@inproceedings`, `@thesis`, `@misc`, and other entry types. It reads: `title`, `author`, `year`, `journal`/`booktitle`, `doi`, `abstract`, `url`, `keywords`, `publisher`, `volume`, `number`, `pages`.

### CSV column auto-detection

The CSV parser auto-detects columns by matching common header names:

| What you call it | Mapped to |
|---|---|
| `Title`, `Article Name`, `Paper Title` | Title |
| `Author`, `Authors` | Authors |
| `Year`, `Pub Year`, `Publication Year` | Year |
| `Journal`, `Source`, `Booktitle`, `Venue`, `Container` | Journal |
| `DOI`, `Digital Object Identifier` | DOI |
| `Abstract`, `Summary`, `Description` | Abstract |
| `Keywords`, `Tags` | Keywords |
| `URL`, `Link` | URL |

---

## Screening workflow

The **Screening** column is a visual feature injected by the app (not stored in your Sheet). Click the ⚖ badge on any row in the Spreadsheet tool to mark it:

- **✓ Include** — entry is included in your review
- **✕ Exclude** — entry is excluded, with an optional reason
- **○ Unscreened** — default state

Screening decisions are stored in `localStorage` keyed by tab index + row index. They persist across sessions but are browser-local (not synced to the Sheet). Export the spreadsheet as CSV (↓ CSV button at the bottom of the Spreadsheet tool) to get a full export with screening status included.

The progress bar at the bottom of the Spreadsheet tool shows how many entries have been screened.

---

## DOI auto-linking

Any cell whose content looks like a DOI (`10.xxxx/...`) is automatically converted to a clickable `https://doi.org/` link. A **fetch metadata** button appears next to it — clicking this queries the Crossref public API and shows the full bibliographic record (title, authors, journal, year, abstract) on hover.

---

## Methods blurb

Click **📋 Generate methods blurb** on the home page to get a ready-to-paste paragraph describing your analysis methodology (embedding model, similarity threshold, entry count, screening progress, date). Paste it directly into your methods section and adjust as needed.

---

## Reproducibility

The app uses the `all-MiniLM-L6-v2` embedding model (Xenova/Transformers.js, quantized). Embedding vectors are cached in `localStorage` so they are consistent across sessions as long as the cell text doesn't change. If you need to describe the exact model in a methods section:

> Semantic embeddings were computed using the `all-MiniLM-L6-v2` model (Wang et al., 2020) via the Transformers.js library (v2.17.2, Xenova). The model produces 384-dimensional dense vectors. Cosine similarity was used for all pairwise comparisons.

---

*Last updated: 2026 — Dimensional Framework v2.0*
