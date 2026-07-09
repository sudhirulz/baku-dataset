---
language:
- az
- ru
- en
- lez
- tly
- khv
- ava
- tkr
- udi
- ka
- hy
license: cc-by-4.0
task_categories:
- text-classification
- token-classification
- other
pretty_name: "Baku Comix: Urban Multilingual Signage and Speech Dataset"
size_categories:
- n<1K
tags:
- linguistics
- code-switching
- linguistic-landscape
- azerbaijani
- russian
- post-soviet
- multilingual
- caucasus
- morphology
- etymology
- minority-languages
annotations_creators:
- machine-generated
- expert-generated
language_creators:
- found
multilinguality:
- multilingual
source_datasets:
- original
---

# Baku Comix — Urban Multilingual Signage and Speech Dataset

**Collector:** Sudarshan Manikantan  
**Affiliation:** Independent researcher (high school)  
**Collection location:** Baku, Guba, Gabala, Khinaliq, Shamakhi — Azerbaijan  
**Collection period:** Summer 2026  
**Licence:** CC BY 4.0  
**Contact:** manikantan.sudarshan@gmail.com

---

## Dataset description

This dataset documents multilingual signage and speech in Baku, Azerbaijan and
surrounding regions, with a focus on code-switching and language contact phenomena
in post-Soviet urban Azerbaijan.

The dataset captures how Azerbaijani, Russian, English, and minority languages
(Lezgi, Talysh, Khinaliq, Udi, Tsakhur) mix in everyday commercial signage,
public announcements, menus, street signs, and spontaneous spoken interaction.

Every entry includes full provenance metadata — GPS coordinates, timestamps, camera
model (from EXIF), reverse-geocoded location, and source attribution — making it
verifiable and reproducible.

---

## Research motivation

The linguistic landscape of post-Soviet Azerbaijan reflects multiple overlapping
historical influences: the Soviet-era dominance of Russian, the post-1991
restoration of Azerbaijani as the state language (with a shift from Cyrillic to
Latin script), and the post-2000 penetration of English through globalisation and
digital culture.

Baku's urban signage and speech sit at the intersection of these forces, producing
a rich environment of code-switching, morphological hybridisation, and script mixing
that is largely undocumented in computational linguistics datasets.

This dataset addresses that gap.

---

## Dataset structure

The dataset consists of two files:

### `entries.jsonl`
One JSON object per line. Each entry represents one photo or audio recording.

### `words.jsonl`
One JSON object per line. Each entry represents one word extracted from an entry,
with deep morphological and etymological analysis.

---

## Data sources

### 1. Linguistic landscape photos (primary)
Photos taken by researcher in public spaces across Azerbaijan.
EXIF metadata preserved — every photo has GPS coordinates, timestamp, and camera
model embedded. No personally identifiable information included.

### 2. Native speaker recordings
Spontaneous and elicited speech from a native Baku Azerbaijani speaker.
Recorded with informed consent. Speaker metadata anonymised to initials and
age group only.

### 3. Pedagogical audio (YouTube)
Selected recordings from *Learn Azerbaijani Today*
(youtube.com/@learnazerbaijanitoday). Used with explicit written permission
from Samantha Parker, 7 July 2026. Audio files are not redistributed —
only transcriptions and linguistic annotations are included.

---

## Entry-level fields (`entries.jsonl`)

| Field | Source | Type | Description |
|-------|--------|------|-------------|
| `id` | System | int | Unique entry ID |
| `sourceType` | Researcher | string | `photo` / `native_speaker` / `youtube` |
| `collectedBy` | Researcher | string | Researcher name |
| `filename` | System | string | Original filename |
| `createdAt` | System | datetime | When entry was created in platform |
| `zone` | Researcher + GPS | string | Collection zone |
| `exif_datetime` | EXIF | datetime | Camera capture timestamp |
| `exif_lat` | EXIF | float | GPS latitude |
| `exif_lon` | EXIF | float | GPS longitude |
| `exif_make` | EXIF | string | Camera manufacturer |
| `exif_model` | EXIF | string | Camera model |
| `geo_country` | OpenStreetMap | string | Reverse-geocoded country |
| `geo_city` | OpenStreetMap | string | Reverse-geocoded city |
| `geo_district` | OpenStreetMap | string | Reverse-geocoded district |
| `geo_street` | OpenStreetMap | string | Reverse-geocoded street |
| `ocrText` | AI (Claude) | string | Verbatim text extracted from image |
| `transcription` | AI (Claude) | string | Audio transcription with language tags [AZ][RU][EN] |
| `translation_en` | AI (Claude) | string | English translation |
| `transliteration` | AI (Claude) | string | Latin-script romanisation |
| `detectedLanguages` | AI + Researcher | list[str] | ISO language codes |
| `languageNames` | AI + Researcher | list[str] | Full language names |
| `scripts` | AI + Researcher | list[str] | Writing systems detected |
| `domain` | AI + Researcher | string | Functional domain |
| `entryType` | AI + Researcher | string | Type of sign or speech |
| `matrixLang` | AI + Researcher | string | Dominant language code |
| `hasCodeSwitching` | AI + Researcher | bool | Code-switching present |
| `switchType` | AI + Researcher | string | Type of code-switching |
| `switchTrigger` | AI + Researcher | string | Pragmatic trigger |
| `linguisticNotes` | AI (Claude) | string | Scholarly observations |
| `notes` | Researcher | string | Researcher annotations |
| `comments` | Researcher | dict | Field-level comments |
| `customFields` | Researcher | dict | Researcher-added custom annotations |

**YouTube-specific fields** (sourceType = youtube):

| Field | Description |
|-------|-------------|
| `yt_videoTitle` | Video title |
| `yt_videoUrl` | YouTube URL |
| `yt_publishedDate` | Video publication date |
| `yt_speakerName` | Instructor name |
| `yt_permissionGrantedBy` | Permission contact |
| `yt_permissionDate` | Permission date |
| `yt_licence` | Licence status |

**Native speaker fields** (sourceType = native_speaker):

| Field | Description |
|-------|-------------|
| `ns_speakerName` | Speaker name / initials |
| `ns_speakerAge` | Age or age group |
| `ns_speakerNeighbourhood` | Baku neighbourhood |
| `ns_speakerLangs` | Languages spoken and proficiency |
| `ns_recordingContext` | Recording situation |
| `ns_consentRecorded` | Consent status |

---

## Word-level fields (`words.jsonl`)

| Field | Description |
|-------|-------------|
| `entryId` | Links to parent entry |
| `word` | Exact word form as it appears |
| `position` | Position in source text |
| `script` | Writing script |
| `language` | ISO language code |
| `languageName` | Full language name |
| `root` | Root / stem |
| `rootLanguage` | Language the root originates from |
| `rootLanguageFamily` | Language family |
| `prefix` | Prefix (if any) |
| `suffix` | Suffix (if any) |
| `integrationClass` | Morphological integration class (see below) |
| `pos` | Part of speech |
| `lemma` | Base / dictionary form |
| `meaning_en` | Dictionary meaning in English |
| `meaning_contextual` | Meaning in this specific text |
| `meaningShift` | Semantic change from source language |
| `etymology` | Historical origin of the word |
| `semanticField` | Semantic domain |
| `connotation` | Pragmatic connotation |
| `register` | Sociolinguistic register |
| `notes` | Linguistically notable observations |
| `researcherComment` | Free researcher annotation |

### Integration class taxonomy

This is the original scholarly contribution of this dataset.
Words are classified by their degree of morphological integration:

| Class | Description | Example |
|-------|-------------|---------|
| `native` | Pure Azerbaijani, Turkic root | *kitab* (book) |
| `established_loanword` | Old borrowing, fully absorbed | *stol* (table, from Russian) |
| `recent_borrowing` | New borrowing, phonologically adapted | *internet*, *supermarket* |
| `morphological_hybrid` | Foreign stem + Azerbaijani morphology | *postlamaq* (to post, EN + AZ -lamaq) |
| `code_switch` | Inserted word, no morphological integration | Russian word mid-Azerbaijani sentence |
| `calque` | Phonological reshaping | *kompüter* |
| `proper_noun` | Names, place names | *Bakı*, *Guba* |
| `unknown` | Cannot be classified | — |

---

## Languages documented

| Code | Language | Family | Script |
|------|----------|--------|--------|
| az | Azerbaijani | Turkic | Latin (post-1991), Cyrillic (Soviet-era) |
| ru | Russian | Slavic | Cyrillic |
| en | English | Germanic | Latin |
| lez | Lezgi | Northeast Caucasian | Cyrillic |
| tly | Talysh | Iranian | Latin/Cyrillic |
| khv | Khinaliq | Northeast Caucasian (isolate) | Latin |
| ava | Avar | Northeast Caucasian | Cyrillic |
| tkr | Tsakhur | Northeast Caucasian | Cyrillic |
| udi | Udi | Northeast Caucasian | Latin/Georgian |
| ka | Georgian | Kartvelian | Mkhedruli |
| hy | Armenian | Indo-European | Armenian |

---

## Known limitations

- Photo OCR accuracy varies with image quality and script complexity
- Audio transcription of spontaneous speech contains approximations
- AI-generated fields (OCR, translation, linguistic analysis) have been
  researcher-reviewed but may contain errors — all AI fields are labelled
  with source tags in the data
- YouTube transcriptions cover selected excerpts, not full videos
- Dataset skews toward commercial/urban contexts in Baku city centre —
  village data from Khinaliq and Guba is underrepresented relative to
  their linguistic significance

---

## Ethical statement

- All photographs taken in public spaces in Azerbaijan
- No personally identifiable information is included
- Native speaker data is anonymised to initials and age group
- Audio recordings collected with informed verbal consent
  (consent recorded on audio)
- YouTube data used with explicit written permission from
  Samantha Parker, Learn Azerbaijani Today (7 July 2026)
- Dataset released under CC BY 4.0

---

## Citation

If you use this dataset in your research, please cite:

```bibtex
@dataset{manikantan2026baku,
  title     = {Baku Comix: Urban Multilingual Signage and Speech Dataset},
  author    = {Manikantan, Sudarshan},
  year      = {2026},
  publisher = {Hugging Face},
  url       = {https://huggingface.co/datasets/sudhirulz/baku-comix},
  license   = {CC BY 4.0},
  note      = {Field research conducted in Baku, Guba, Gabala, Khinaliq,
               and Shamakhi, Azerbaijan, summer 2026}
}
```

---

## Acknowledgements

- *Learn Azerbaijani Today* (Samantha Parker) for permission to use
  pedagogical audio as reference data
- OpenStreetMap contributors for reverse geocoding
- Anthropic Claude for AI-assisted OCR, transcription, and linguistic analysis

