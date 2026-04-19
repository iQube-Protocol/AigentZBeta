-- Protocol Economics Knowledge Base
-- Seeds the canonical $KNYT / QriptoCENT ground truth into codex_kb_chunks
-- so all agents can retrieve it via keyword search.
-- Embedding is NULL — keyword fallback in embeddingService covers it.
-- Domain: 'protocol' (searched separately from metaKnyts / qriptopian).

-- 1. Source document record
INSERT INTO codex_kb_documents (
  id, title, domain, content_category, source_type,
  source_url, total_pages, total_words, chunk_count, extraction_status
)
VALUES (
  'doc-protocol-economics-v1',
  'Protocol Economics: $KNYT and QriptoCENT (Qc / Q¢)',
  'protocol',
  'ground_truth',
  'operator_doc',
  'codexes/packs/aigency/items/knowledge/protocol-economics.md',
  1, 1200, 6, 'complete'
)
ON CONFLICT (id) DO UPDATE SET
  title            = EXCLUDED.title,
  domain           = EXCLUDED.domain,
  content_category = EXCLUDED.content_category,
  extraction_status = EXCLUDED.extraction_status;

-- 2. Chunks — split by topic for precision retrieval

INSERT INTO codex_kb_chunks (document_id, chunk_index, content, embedding) VALUES

-- Chunk 0: naming + one-line distinction
('doc-protocol-economics-v1', 0,
'Protocol Economics canonical ground truth. Use these names exactly: QriptoCENT, Qc, Q¢, $KNYT, KNYT, metaKnyt (singular title), metaKnyts (story world). Never say "quality cent", "crypto cent", "quality coin", or "Qc and $KNYT are basically the same thing". The one-line distinction: Qc prices and settles the work. $KNYT aligns and grows the KNYT world.',
NULL),

-- Chunk 1: QriptoCENT definition
('doc-protocol-economics-v1', 1,
'QriptoCENT (Qc / Q¢) is the ecosystem''s Bitcoin-anchored micro-stablecoin and base operating currency. It is designed for deterministic pricing and settlement of very small units of value — micro knowledge-work, micro-payments, micro-rewards, and machine-native transactions. Think of Qc as: the pricing rail, the settlement rail, the unit of economic precision, the stable baseline currency, the economic grammar of the system. Qc is NOT a meme coin, speculative token, fandom badge, or "quality cent". Canonical answer to "What is Qc?": Qc is QriptoCENT, our micro-stable pricing and settlement rail for very small units of value, especially knowledge-work and machine payments.',
NULL),

-- Chunk 2: $KNYT definition
('doc-protocol-economics-v1', 2,
'$KNYT is the native token of the KNYT ecosystem — the franchise token, treasury token, community alignment token, and incentive token. It supports KNYT treasury, rewards, activation, franchise economics, and incentive alignment across the KNYT cartridge, Codex, collector guild, and 21 Sats expansion. The 21 SatoshiKNYTs tier includes $KNYT 10,000 to activate a KNYT franchise. KNYT ascension tiers: Acolyte → Keta → Keji → First → Zero → Satoshi KNYT (apex, reserved for 21 Sats franchise holders). $KNYT is NOT the base stablecoin, NOT a replacement for Qc, NOT just a fan token. Canonical answer to "What is $KNYT?": $KNYT is the native token of the KNYT ecosystem, used for treasury, rewards, activation, and incentive alignment inside the KNYT world.',
NULL),

-- Chunk 3: distinction and canonical language
('doc-protocol-economics-v1', 3,
'How Qc and $KNYT differ and work together. Qc: stable, system-wide, pricing rail, settlement rail, for micro-payments and micro knowledge-work, makes value measurable at fine granularity. $KNYT: franchise-native, KNYT-specific, treasury and incentives token, for activation, alignment, rewards, and ecosystem growth inside KNYT. They are complementary. Canonical language: Say "Qc is the pricing and settlement rail; $KNYT is the native KNYT token." Say "Qc handles stable micro-value exchange; $KNYT handles KNYT-specific alignment and growth." Never say "Qc and $KNYT are interchangeable" or "$KNYT is the stablecoin" or "Qc is the KNYT fandom token".',
NULL),

-- Chunk 4: forbidden phrases + fallback answers
('doc-protocol-economics-v1', 4,
'Forbidden agent phrases — never say: "Qc stands for quality cent", "Qc is just another name for $KNYT", "$KNYT is the stablecoin", "Qc is the KNYT fandom token", "$KNYT is just a payment coin", "Qc and $KNYT are interchangeable", "$KNYT is the whole ecosystem''s base currency". Ultra-short fallback answers: Q: "What is Qc?" A: "Qc is QriptoCENT, our micro-stable pricing and settlement rail for very small units of value, especially knowledge-work and machine payments." Q: "What is $KNYT?" A: "$KNYT is the native token of the KNYT ecosystem, used for treasury, rewards, activation, and incentive alignment inside the KNYT world." Q: "How are they different?" A: "Qc is the base pricing rail. $KNYT is the native KNYT token."',
NULL),

-- Chunk 5: why both exist
('doc-protocol-economics-v1', 5,
'Why Qc and $KNYT both exist. Problem 1: micro-value needs a stable rail for pricing and settling tiny actions (curation, inference, routing, agentic tasks) — Qc solves this. Problem 2: a living franchise like KNYT needs a native economy to reward participation, creation, collecting, recruitment, and franchise activation — $KNYT solves this. Qc belongs to the broader metaMe / AgentiQ / iQube stack as the cross-ecosystem unit for micro-pricing. $KNYT belongs to the KNYT cartridge and franchise world. When KNYT uses Qc, it uses the system''s base operating currency. When KNYT uses $KNYT, it uses its own native ecosystem token.',
NULL)

ON CONFLICT (document_id, chunk_index) DO UPDATE SET
  content = EXCLUDED.content;
