# Episode 1 Content Import Guide

## Quick Reference

### Section Summary

| Section | Domain | Tab | Count | Badge |
|---------|--------|-----|-------|-------|
| home-hero | home | - | 3 | HERO |
| latest-news | home | - | 4-6 | NEWS |
| second-hero | home | - | 1-3 | FEATURED |
| pennydrops | pennydrops | - | 7+ | Q¢ |
| 21knowdz | qriptopian | dev | 5+ | DEV |
| 21knowdz | qriptopian | creative | 5+ | CREATIVE |
| 21knowdz | qriptopian | exec | 5+ | EXEC |

## Critical Rules

### ⚠️ Tab Names for Kn0wdZ
**MUST USE SHORTENED NAMES:**
- ✅ `"dev"` (NOT 'developer')
- ✅ `"creative"`
- ✅ `"exec"` (NOT 'executive')

### Required Fields (All Content)
```json
{
  "title": "string (required)",
  "slug": "string (required, unique)",
  "domain": "string (required)",
  "type": "string (required)",
  "format": "string (required)",
  "status": "string (required)",
  "placement": "object (required)"
}
```

### Valid Values
- **format**: `"article"`, `"comic"`, `"video"`, `"audio"`, `"interactive"`, `"mixed"`
- **status**: `"draft"`, `"published"`, `"archived"`
- **type**: `"article"`, `"tutorial"`, `"resource"`, etc.

## Section Details

### 1. HOME-HERO (Main Hero Carousel)
**Purpose:** 3 large featured articles on homepage

**Minimal Example:**
```json
{
  "title": "The Great Rebundling",
  "slug": "great-rebundling",
  "excerpt": "How Web3 is reassembling the internet's value stack",
  "thumbnail": "https://images.unsplash.com/photo-xxx?w=1200&h=800",
  "image": "https://images.unsplash.com/photo-xxx?w=1200&h=800",
  "badge": "HERO",
  "domain": "home",
  "type": "article",
  "format": "article",
  "status": "published",
  "placement": {
    "section": "home-hero",
    "position": 1
  },
  "tags": ["web3", "featured"],
  "modalities": {
    "read": {
      "available": true,
      "text": "# Article content in markdown...",
      "duration": "8 min read"
    }
  }
}
```

**Key Points:**
- Exactly 3 articles (position 1, 2, 3)
- Both `thumbnail` and `image` fields recommended
- High-quality images (1200x800)
- Longer content (8-15 min read)

---

### 2. LATEST-NEWS (News Carousel)
**Purpose:** 4-6 news articles in horizontal carousel

**Minimal Example:**
```json
{
  "title": "Q¢ Adoption Surges 300% in Q4",
  "slug": "qct-adoption-surge-q4",
  "excerpt": "QriptoCENT sees massive adoption across 5 chains",
  "thumbnail": "https://images.unsplash.com/photo-xxx?w=800&h=600",
  "badge": "NEWS",
  "domain": "home",
  "type": "article",
  "format": "article",
  "status": "published",
  "placement": {
    "section": "latest-news",
    "position": 1
  },
  "tags": ["news", "adoption"],
  "modalities": {
    "read": {
      "available": true,
      "text": "# News content...",
      "duration": "3 min read"
    }
  }
}
```

**Key Points:**
- 4-6 articles recommended
- Shorter content (2-5 min read)
- Brief excerpts (1-2 sentences)
- Badge typically "NEWS"

---

### 3. SECOND-HERO (Bottom Featured)
**Purpose:** 1 large featured article at bottom of homepage

**Minimal Example:**
```json
{
  "title": "The Qriptopian Manifesto",
  "slug": "qriptopian-manifesto",
  "excerpt": "Our vision for a decentralized, equitable digital economy",
  "thumbnail": "https://images.unsplash.com/photo-xxx?w=1200&h=800",
  "image": "https://images.unsplash.com/photo-xxx?w=1200&h=800",
  "badge": "FEATURED",
  "domain": "home",
  "type": "article",
  "format": "article",
  "status": "published",
  "placement": {
    "section": "second-hero",
    "position": 1
  },
  "tags": ["manifesto", "vision"],
  "modalities": {
    "read": {
      "available": true,
      "text": "# Manifesto content...",
      "duration": "12 min read"
    }
  }
}
```

**Key Points:**
- Typically 1 article (can have up to 3)
- Large, prominent display
- Longer, in-depth content

---

### 4. PENNYDROPS (Q¢ Stories)
**Purpose:** Fun, practical Q¢ use case stories

**Minimal Example:**
```json
{
  "title": "Coffee Shop Revolution",
  "slug": "coffee-shop-revolution",
  "excerpt": "How Q¢ transformed my morning coffee routine",
  "thumbnail": "https://images.unsplash.com/photo-xxx?w=800&h=600",
  "image": "https://images.unsplash.com/photo-xxx?w=800&h=600",
  "badge": "Q¢",
  "domain": "pennydrops",
  "type": "article",
  "format": "article",
  "status": "published",
  "placement": {
    "section": "pennydrops",
    "position": 1
  },
  "tags": ["use-case", "retail", "qct"],
  "modalities": {
    "read": {
      "available": true,
      "text": "# Story content...",
      "duration": "5 min read"
    }
  }
}
```

**Key Points:**
- Fun, relatable stories
- Real-world Q¢ usage examples
- Badge typically "Q¢"
- Can include video modality

---

### 5. KN0WDZ - Developer Tab
**Purpose:** Technical tutorials and guides for developers

**Minimal Example:**
```json
{
  "title": "QIRI SDK Quick Start",
  "slug": "qiri-sdk-quick-start",
  "excerpt": "Get started with the QIRI SDK in minutes",
  "thumbnail": "https://images.unsplash.com/photo-xxx?w=800&h=600",
  "badge": "DEV",
  "domain": "qriptopian",
  "type": "tutorial",
  "format": "article",
  "status": "published",
  "placement": {
    "section": "21knowdz",
    "tab": "dev",
    "position": 1
  },
  "tags": ["developer", "sdk", "tutorial"],
  "modalities": {
    "read": {
      "available": true,
      "text": "# Tutorial with code examples...",
      "duration": "10 min read"
    }
  }
}
```

**Key Points:**
- **CRITICAL:** Use `"tab": "dev"` NOT "developer"
- Type typically "tutorial"
- Include code examples
- Technical content

---

### 6. KN0WDZ - Creative Tab
**Purpose:** Design, storytelling, and creative guides

**Minimal Example:**
```json
{
  "title": "Visual Storytelling in Web3",
  "slug": "visual-storytelling-web3",
  "excerpt": "Create compelling narratives that resonate",
  "thumbnail": "https://images.unsplash.com/photo-xxx?w=800&h=600",
  "badge": "CREATIVE",
  "domain": "qriptopian",
  "type": "article",
  "format": "article",
  "status": "published",
  "placement": {
    "section": "21knowdz",
    "tab": "creative",
    "position": 1
  },
  "tags": ["creative", "storytelling", "design"],
  "modalities": {
    "read": {
      "available": true,
      "text": "# Creative guide...",
      "duration": "8 min read"
    }
  }
}
```

---

### 7. KN0WDZ - Executive Tab
**Purpose:** Strategy, business, and leadership content

**Minimal Example:**
```json
{
  "title": "Strategic Impact Framework",
  "slug": "strategic-impact-framework",
  "excerpt": "Measure and report real-world impact",
  "thumbnail": "https://images.unsplash.com/photo-xxx?w=800&h=600",
  "badge": "EXEC",
  "domain": "qriptopian",
  "type": "tutorial",
  "format": "article",
  "status": "published",
  "placement": {
    "section": "21knowdz",
    "tab": "exec",
    "position": 1
  },
  "tags": ["executive", "strategy", "impact"],
  "modalities": {
    "read": {
      "available": true,
      "text": "# Strategic content...",
      "duration": "12 min read"
    }
  }
}
```

**Key Points:**
- **CRITICAL:** Use `"tab": "exec"` NOT "executive"
- Business-focused content
- Strategic frameworks

---

## Modalities Reference

### Read Modality
```json
{
  "read": {
    "available": true,
    "text": "Full markdown content here...",
    "duration": "5 min read"
  }
}
```

### Watch Modality (Video)
```json
{
  "watch": {
    "available": true,
    "url": "https://youtube.com/watch?v=xxx",
    "duration": "3:45"
  }
}
```

### Listen Modality (Audio)
```json
{
  "listen": {
    "available": true,
    "url": "https://soundcloud.com/xxx",
    "duration": "10:00"
  }
}
```

### Link Modality (External)
```json
{
  "link": {
    "available": true,
    "url": "https://docs.example.com",
    "allow_embed": false
  }
}
```

---

## Import Process

### Using the Import Script

1. **Prepare your JSON file** following the templates above
2. **Place it in** `/scripts/your-content.json`
3. **Create import script** (see example below)
4. **Run the script:** `npx tsx scripts/import-episode1.ts`

### Example Import Script

```typescript
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function importContent() {
  const contentData = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'your-content.json'), 'utf-8')
  );

  for (const item of contentData) {
    // Check if exists
    const { data: existing } = await supabase
      .from('content')
      .select('id')
      .eq('slug', item.slug)
      .single();

    if (existing) {
      console.log(`⏭️  Skipping existing: ${item.title}`);
      continue;
    }

    // Insert new content
    const { error } = await supabase
      .from('content')
      .insert(item);

    if (error) {
      console.error(`✗ Error importing "${item.title}":`, error.message);
    } else {
      console.log(`✓ Imported: ${item.title}`);
    }
  }
}

importContent();
```

---

## Validation Checklist

Before importing, verify:

- [ ] All required fields present
- [ ] Unique slugs for each article
- [ ] Correct domain for each section
- [ ] **Kn0wdZ tabs use shortened names** (`dev`, `exec`)
- [ ] Valid format values
- [ ] Status set to `"published"`
- [ ] Placement section and position correct
- [ ] Modalities properly structured
- [ ] Images accessible (test URLs)
- [ ] No duplicate content

---

## Common Mistakes

### ❌ Wrong Tab Names
```json
"placement": { "section": "21knowdz", "tab": "developer" }  // WRONG
```

### ✅ Correct Tab Names
```json
"placement": { "section": "21knowdz", "tab": "dev" }  // CORRECT
```

### ❌ Missing Required Fields
```json
{
  "title": "Article",
  "slug": "article"
  // Missing: domain, type, format, status, placement
}
```

### ✅ All Required Fields
```json
{
  "title": "Article",
  "slug": "article",
  "domain": "home",
  "type": "article",
  "format": "article",
  "status": "published",
  "placement": { "section": "home-hero", "position": 1 }
}
```

---

## Files Reference

- **Schema:** `docs/EPISODE1_SCHEMA.json`
- **Template:** `docs/EPISODE1_TEMPLATE.json`
- **This Guide:** `docs/EPISODE1_IMPORT_GUIDE.md`
- **Content Management:** `docs/CONTENT_MANAGEMENT_SYSTEM.md`
