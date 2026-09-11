/**
 * Crystal Semantic Structure — the measurement layer behind two readiness
 * checks whose previous implementations scored LABELS AND LEXICAL DISTANCE
 * rather than content (IRL Review #001, remediation cycle 1).
 *
 * This module implements no check and gates nothing. It provides three
 * assessments that `crystalReadiness.ts` consumes:
 *
 *   1. `findSemanticDuplicatePairs` — behind `duplicate-detection`, alongside
 *      (not replacing) the existing lexical Jaccard pass.
 *   2. `detectRelationalStructures` — the seven-structure classifier.
 *   3. `assessInferentialCapacity` — behind `derivation-headroom`, which
 *      already CLAIMED to assess whether conjunctions entail unstated
 *      conclusions and in fact tested `semanticType ∈ {constraint, law}` or a
 *      connective word.
 *
 * ── WHAT THE MECHANISM ACTUALLY IS (read this before trusting a result) ────
 *
 * There is no embedding model and no LLM call inside a readiness function, and
 * inventing a provider integration to get one would be a larger and less
 * auditable change than the defect warrants. So the mechanism here is
 * **structural, not distributional**: every statement is reduced to a
 * predicate-argument form — `(determinant, relationClass, dependent)` — by
 * matching a table of relation lexemes, and comparison happens between those
 * FORMS rather than between bags of words.
 *
 * That is what lets it catch the failure the lexical pass structurally cannot:
 *
 *   "Liquidity is essential for market stability."
 *   "Market stability depends on adequate liquidity."
 *
 * Word-set Jaccard over these is low (`is/essential/for` vs `depends/on/
 * adequate` share nothing), so the lexical pass reports two distinct
 * statements. Both parse to relation class `necessity`, and the second's
 * direction is inverted, so after direction canonicalisation both yield
 * `(liquidity) --necessity--> (market stability)` and collide.
 *
 * ── WHAT IT STILL CANNOT DO — stated plainly, because the previous
 *    implementation's honesty about its own limit is why this was catchable ──
 *
 *   - It is NOT a formal entailment prover. An "entailment chain" here is a
 *     shared-middle-term composition over parsed forms; whether the conclusion
 *     is TRUE, or interesting, is not decided.
 *   - It cannot recognise a paraphrase whose relation is carried by a lexeme
 *     absent from `RELATION_PATTERNS` below. The table is extensible and its
 *     coverage is a real limit, not a hidden one.
 *   - It cannot recognise a duplicate expressed through different CONCEPT
 *     vocabulary ("liquidity" vs "cash availability"); argument-slot comparison
 *     is over crudely stemmed content words, not over synonyms or embeddings.
 *   - Morphological folding is a suffix heuristic, not a lemmatiser, and will
 *     both over- and under-fold.
 *   - Multi-clause statements are reduced around their FIRST matched relation;
 *     a statement asserting two relations contributes one form.
 *
 * A pair this module flags that a steward judges genuinely distinct is a
 * FINDING to record, not a threshold to raise — the same discipline the lexical
 * check already carries.
 *
 * ── THE REFERENCE STANDARD ────────────────────────────────────────────────
 *
 * The seven structures below are the operator's own enumeration (2026-08-26):
 * causal, conditional, propagation, constraint, threshold, trade-off,
 * quantitative.
 *
 * The independent reviewer cited "the causal/conditional relationships your own
 * orientation note defines as the standard (the hydrogen example)". NO DOCUMENT
 * IN THIS REPOSITORY IS TITLED AS AN ORIENTATION NOTE AND CONTAINS A HYDROGEN
 * EXAMPLE DEFINING THAT STANDARD — searched (`hydrogen`, `valence`,
 * `orientation note`) and not found. Two ratified loci carry hydrogen examples
 * and are named here rather than guessed at:
 *
 *   (a) CFS-019 §"three functions" amendment (2026-07-18) and
 *       CRP-002 §"EXP-010" — "an invariant is a computational object, not a
 *       sentence — 'hydrogen atom vs the word Hydrogen'". This is the
 *       REPRESENTATION example, not a statement-quality standard.
 *   (b) CFS-019, same amendment — the hydrogen/valence case, verbatim:
 *       *"you do not need the identity of the object, you need the properties
 *       that determine its behaviour relative to the intent"* (valence-vs-
 *       atomic-mass). THIS is the closest thing in ratified canon to the
 *       standard the reviewer invoked, and it is the one this module encodes:
 *       a statement earns its place by asserting the properties that DETERMINE
 *       behaviour, not by identifying or ranking an object.
 *
 * `bare-necessity` below is the formalisation of the failure that standard
 * excludes. "X is essential for Y" asserts that Y's behaviour depends on X
 * without saying by what mechanism, in which direction it propagates, under
 * what condition it triggers, or across what magnitude — it is the atomic-mass
 * half of the example, and it is deliberately NOT one of the seven.
 *
 * Server-safe, pure, no I/O.
 */

/** The operator's seven relational structures (2026-08-26), verbatim. */
export type RelationalStructure =
  | 'causal'
  | 'conditional'
  | 'propagation'
  | 'constraint'
  | 'threshold'
  | 'trade-off'
  | 'quantitative';

export const RELATIONAL_STRUCTURES: readonly RelationalStructure[] = [
  'causal',
  'conditional',
  'propagation',
  'constraint',
  'threshold',
  'trade-off',
  'quantitative',
];

/**
 * The coarse relation family used for duplicate comparison. Two statements can
 * only be semantic duplicates within one family — a causal claim and a bound
 * over the same two concepts are different assertions, not paraphrases.
 *
 * `necessity` is the family the reviewer's "X is essential for Y" generalities
 * fall into, and it carries NO structure from the seven.
 */
export type RelationClass =
  | 'necessity'
  | 'causation'
  | 'condition'
  | 'propagation'
  | 'bound'
  | 'threshold'
  | 'exchange'
  | 'proportion';

export const RELATION_CLASSES: readonly RelationClass[] = [
  'necessity',
  'causation',
  'condition',
  'propagation',
  'bound',
  'threshold',
  'exchange',
  'proportion',
];

/**
 * Families whose two arguments are interchangeable. A trade-off between A and B
 * is the same assertion as a trade-off between B and A, so duplicate comparison
 * must try both orderings; a causal claim must not.
 */
const SYMMETRIC_CLASSES: ReadonlySet<RelationClass> = new Set<RelationClass>(['exchange', 'proportion']);

/**
 * Families whose members can carry an inferential chain. `necessity` is
 * EXCLUDED, and that exclusion is the load-bearing judgment in this module —
 * see `assessInferentialCapacity`'s doc for the argument and for what is
 * reported instead of being silently dropped.
 */
const COMPOSABLE_CLASSES: ReadonlySet<RelationClass> = new Set<RelationClass>([
  'causation',
  'condition',
  'propagation',
  'bound',
  'threshold',
  'proportion',
]);

export interface RelationalForm {
  /** null when no relation lexeme in the table matched the statement at all. */
  relationClass: RelationClass | null;
  /** The lexeme that matched, verbatim from the normalised text — so a reader
   *  can see WHY a statement parsed the way it did. */
  matchedLexeme: string | null;
  /** Content stems of the slot that DETERMINES, after direction
   *  canonicalisation. Empty when the statement carried no left/right split. */
  determinant: string[];
  /** Content stems of the slot whose behaviour is determined. */
  dependent: string[];
  /** Which of the seven structures the statement's text actually asserts.
   *  Detected independently of `relationClass`, over the whole statement, so a
   *  cap that is also a threshold reports both. */
  structures: RelationalStructure[];
  /**
   * TRUE when the statement asserts a dependency and NOTHING from the seven —
   * the "X is essential for Y" shape. This is a finding about the statement,
   * not an error.
   */
  bareNecessity: boolean;
}

interface RelationPattern {
  re: RegExp;
  cls: RelationClass;
  /** Whether the text BEFORE the lexeme is the determinant or the dependent. */
  leftRole: 'determinant' | 'dependent';
}

/**
 * The relation-lexeme table. Order matters only in that the FIRST match wins,
 * so the more specific multi-word forms are listed before bare verbs.
 *
 * Coverage is a documented limit: a relation carried by a lexeme absent here
 * parses to `relationClass: null` and is reported as unparsed, never guessed.
 */
const RELATION_PATTERNS: readonly RelationPattern[] = [
  // ── necessity / bare dependency (NOT one of the seven) ──
  {
    re: /\b(?:is|are|remains?|stays?)\s+(?:the\s+|a\s+|an\s+)?(?:only\s+|absolutely\s+|strictly\s+|generally\s+)?(?:essential|necessary|required|requisite|critical|vital|fundamental|indispensable|crucial|key|important|central|foundational|pivotal|prerequisite|precondition)\s+(?:for|to|in)\b/,
    cls: 'necessity',
    leftRole: 'determinant',
  },
  {
    re: /\b(?:cannot|can\s+not|may\s+not|will\s+not)\s+(?:be\s+)?\w*\s*without\b/,
    cls: 'necessity',
    leftRole: 'dependent',
  },
  {
    re: /\b(?:depends?|depend|dependent|reliant|relies|rely|hinges?|rests?)\s+(?:up)?on\b/,
    cls: 'necessity',
    leftRole: 'dependent',
  },
  {
    re: /\b(?:presupposes?|requires?|require|needs?|need|demands?|presumes?)\b/,
    cls: 'necessity',
    leftRole: 'dependent',
  },
  {
    re: /\b(?:underpins?|underpin|underlies?|enables?|enable|supports?|support|sustains?|sustain|makes?\s+possible|provides?\s+the\s+basis\s+for)\b/,
    cls: 'necessity',
    leftRole: 'determinant',
  },

  // ── causation ──
  //
  // THE PASSIVE FORM MUST BE TESTED FIRST. "Bertol shelf is caused by aldrin
  // ridge" contains the bare participle `caused`, so an active-voice pattern
  // listed above this one matches it and splits the arguments the WRONG WAY
  // ROUND — yielding (bertol shelf) --causes--> (aldrin ridge), the exact
  // inversion of the claim. That silently defeats duplicate detection between a
  // statement and its own passive paraphrase, which is one of the pair shapes
  // this instrument exists to catch. Caught by the tier-split canary in
  // tests/prd-epi-001-crystal-readiness.test.ts.
  {
    re: /\b(?:is|are|was|were|been|being)\s+(?:caused|driven|induced|produced|triggered|generated|precipitated)\s+by\b/,
    cls: 'causation',
    leftRole: 'dependent',
  },
  {
    re: /\b(?:gives?\s+rise\s+to|brings?\s+about|results?\s+in|leads?\s+to|causes?|caused|causing|produces?|produce|induces?|induce|triggers?|trigger|drives?|generates?|precipitates?|creates?)\b/,
    cls: 'causation',
    leftRole: 'determinant',
  },
  {
    re: /\b(?:because\s+of|owing\s+to|as\s+a\s+result\s+of|attributable\s+to)\b/,
    cls: 'causation',
    leftRole: 'dependent',
  },

  // ── propagation ──
  {
    re: /\b(?:propagates?|propagate|transmits?|transmit|spreads?|spread|cascades?|cascade|spills?\s+over|flows?\s+through|passes?\s+through|amplifies?\s+through|contagion\s+(?:from|to)|transmission\s+(?:from|to))\b/,
    cls: 'propagation',
    leftRole: 'determinant',
  },

  // ── bound / constraint ──
  {
    re: /\b(?:must\s+not\s+exceed|may\s+not\s+exceed|cannot\s+exceed|shall\s+not\s+exceed|is\s+capped\s+at|are\s+capped\s+at|is\s+bounded\s+by|are\s+bounded\s+by|is\s+limited\s+to|are\s+limited\s+to|must\s+remain\s+(?:above|below|within)|may\s+not\s+fall\s+below|must\s+not\s+fall\s+below|no\s+more\s+than|no\s+fewer\s+than|at\s+most|at\s+least)\b/,
    cls: 'bound',
    leftRole: 'dependent',
  },

  // ── threshold ──
  {
    re: /\b(?:once\s+\w+\s+exceeds?|exceeds?|exceed|falls?\s+below|drops?\s+below|rises?\s+above|climbs?\s+above|breach(?:es|ed)?|crosses?|at\s+or\s+above|at\s+or\s+below|beyond\s+the|above\s+the|below\s+the)\b/,
    cls: 'threshold',
    leftRole: 'determinant',
  },

  // ── exchange / trade-off (symmetric) ──
  {
    re: /\b(?:at\s+the\s+expense\s+of|in\s+exchange\s+for|trades?\s+off\s+against|trades?\s+off|comes?\s+at\s+the\s+cost\s+of|is\s+traded\s+against|tension\s+between|inversely\s+(?:related|proportional)\s+to)\b/,
    cls: 'exchange',
    leftRole: 'determinant',
  },

  // ── proportion / quantitative relation ──
  {
    re: /\b(?:is|are)\s+(?:directly\s+|inversely\s+)?proportional\s+to\b/,
    cls: 'proportion',
    leftRole: 'determinant',
  },
  {
    re: /\b(?:scales?\s+with|varies?\s+with|per\s+unit\s+of|ratio\s+of|elasticity\s+of)\b/,
    cls: 'proportion',
    leftRole: 'determinant',
  },
];

/**
 * Structure cue sets, scanned INDEPENDENTLY of the relation table and over the
 * whole statement — a statement can assert several of the seven at once, and
 * collapsing that into one label is precisely the "scored labels" defect.
 */
const STRUCTURE_CUES: ReadonlyArray<{ structure: RelationalStructure; re: RegExp }> = [
  {
    structure: 'causal',
    re: /\b(?:gives?\s+rise\s+to|brings?\s+about|results?\s+in|leads?\s+to|causes?|caused|causing|produces?|induces?|triggers?|drives?|generates?|precipitates?|because\s+of|owing\s+to|as\s+a\s+result\s+of|attributable\s+to|is\s+(?:caused|driven|induced|produced|triggered)\s+by)\b/,
  },
  {
    structure: 'conditional',
    re: /(?:^|\b)(?:if|whenever|unless|provided\s+that|only\s+if|so\s+long\s+as|as\s+long\s+as|in\s+the\s+event\s+that|when\s+\w+|once\s+\w+|where\s+\w+)\b/,
  },
  {
    structure: 'propagation',
    re: /\b(?:propagates?|transmits?|spreads?|cascades?|cascading|spills?\s+over|spillover|contagion|flows?\s+through|passes?\s+through|amplifies?\s+through|knock[-\s]?on|downstream|upstream|transmission)\b/,
  },
  {
    structure: 'constraint',
    re: /\b(?:must\s+not|may\s+not|cannot|shall\s+not|is\s+capped|are\s+capped|is\s+bounded|are\s+bounded|is\s+limited\s+to|are\s+limited\s+to|no\s+more\s+than|no\s+fewer\s+than|at\s+most|at\s+least|must\s+remain|may\s+never|is\s+prohibited|is\s+forbidden)\b/,
  },
  {
    structure: 'threshold',
    re: /\b(?:threshold|exceeds?|exceed|falls?\s+below|drops?\s+below|rises?\s+above|climbs?\s+above|breach(?:es|ed)?|crosses?|tipping\s+point|trigger\s+point|at\s+or\s+above|at\s+or\s+below|beyond\s+the|above\s+the|below\s+the)\b/,
  },
  {
    structure: 'trade-off',
    re: /\b(?:trade[-\s]?offs?|trades?\s+off|at\s+the\s+expense\s+of|in\s+exchange\s+for|comes?\s+at\s+the\s+cost\s+of|sacrific\w+|tension\s+between|inversely\s+(?:related|proportional)|the\s+(?:more|higher|greater)\s+.*\bthe\s+(?:less|lower|smaller)\b)/,
  },
  {
    structure: 'quantitative',
    re: /(?:\b\d+(?:\.\d+)?\s*(?:%|percent|percentage\s+points?|bps|basis\s+points?|bp|days?|weeks?|months?|years?|hours?|times|fold|x)\b|\b\d+(?:\.\d+)?\s*(?:to|-)\s*\d+(?:\.\d+)?\b|\bproportional\s+to\b|\bper\s+unit\b|\bratio\s+of\b|\bscales?\s+with\b|\belasticity\b|\bdoubl\w+\b|\bhalv\w+\b|\bsquare\s+root\b|\bexponential\w*\b|\blinear\s+in\b)/,
  },
];

/**
 * Function words dropped from argument slots before comparison. Deliberately
 * conservative: modal and quantifier words that CARRY a structure (must, not,
 * exceeds) are never dropped, because structure detection runs over the raw
 * normalised text and slot comparison should not be handed a bag containing
 * only stop-words.
 */
const SLOT_STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'of', 'is', 'are', 'be', 'been', 'being', 'was', 'were', 'to', 'for', 'in', 'on',
  'at', 'by', 'with', 'that', 'which', 'this', 'these', 'those', 'it', 'its', 'and', 'or', 'as',
  'from', 'any', 'all', 'each', 'every', 'their', 'has', 'have', 'had', 'there', 'then', 'both',
  'such', 'into', 'over', 'under', 'than', 'also', 'more', 'most', 'some', 'other', 'own',
]);

/**
 * CLAUSE BOUNDARIES ARE PRESERVED. An earlier draft stripped commas, which
 * silently destroyed the conditional parser: "If A breaches its limit, then B
 * follows" lost its comma, so the antecedent/consequent split failed and the
 * statement fell through to a bare-verb match on "breaches" — a conditional
 * misread as a threshold, with the wrong argument slots. Sentence-internal
 * separators (`, ; :`) are therefore folded to a comma and kept; slot extraction
 * strips them from word edges.
 */
export function normalizeForStructure(statement: string): string {
  return statement
    .toLowerCase()
    .replace(/[;:]/g, ',')
    .replace(/[^a-z0-9%.,\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Crude morphological folding — a suffix heuristic, NOT a lemmatiser. It exists
 * so "liquidity"/"liquid" and "stability"/"stable" do not read as unrelated
 * concepts, and it will both over-fold and under-fold. Documented, not hidden.
 */
export function foldWord(word: string): string {
  let w = word;
  if (w.length <= 4) return w;
  if (w.endsWith('ies') && w.length > 5) return `${w.slice(0, -3)}y`;
  for (const suffix of ['iness', 'ility', 'ation', 'ments', 'ness', 'ment', 'ings', 'ity', 'ion', 'ing', 'ies', 'ed', 'es', 's']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 4) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

function slotStems(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(' ')) {
    // Edge punctuation must go, or "stability." and "stability" fold to
    // different stems and two paraphrases of one claim read as distinct.
    const word = raw.replace(/^[-.,]+|[-.,]+$/g, '');
    if (!word || SLOT_STOPWORDS.has(word)) continue;
    if (/^[\d.%,-]+$/.test(word)) continue; // magnitudes belong to `quantitative`, not to concept identity
    seen.add(foldWord(word));
  }
  return [...seen].sort();
}

/** Detect which of the seven structures a statement's text actually asserts. */
export function detectRelationalStructures(statement: string): RelationalStructure[] {
  const text = normalizeForStructure(statement);
  const found: RelationalStructure[] = [];
  for (const cue of STRUCTURE_CUES) {
    if (cue.re.test(text)) found.push(cue.structure);
  }
  return found;
}

/**
 * Conditional statements carry their antecedent and consequent around a
 * connective rather than on either side of a verb, so they get a dedicated
 * matcher — otherwise "If A then B" splits at index 0 and yields an empty
 * determinant.
 */
function parseConditional(text: string): { determinant: string; dependent: string; lexeme: string } | null {
  const leading =
    /^(?:if|whenever|unless|once|provided\s+that|in\s+the\s+event\s+that|where)\s+(.+?)(?:,\s*|\s+then\s+)(.+)$/.exec(
      text,
    );
  if (leading) {
    return { determinant: leading[1], dependent: leading[2], lexeme: text.split(' ')[0] };
  }
  const trailing =
    /^(.+?)\s+(?:if|when|whenever|once|unless|provided\s+that|only\s+if|so\s+long\s+as|as\s+long\s+as|in\s+the\s+event\s+that)\s+(.+)$/.exec(
      text,
    );
  if (trailing) {
    return { determinant: trailing[2], dependent: trailing[1], lexeme: 'if/when (trailing)' };
  }
  return null;
}

/**
 * Reduce a statement to a canonical predicate-argument form. Direction is
 * normalised so that `determinant` is always the slot doing the determining —
 * which is what makes "X is essential for Y" and "Y depends on X" collide.
 */
export function parseRelationalForm(statement: string): RelationalForm {
  const text = normalizeForStructure(statement);
  const structures = detectRelationalStructures(statement);

  const conditional = parseConditional(text);
  if (conditional) {
    return {
      relationClass: 'condition',
      matchedLexeme: conditional.lexeme,
      determinant: slotStems(conditional.determinant),
      dependent: slotStems(conditional.dependent),
      structures,
      bareNecessity: false,
    };
  }

  for (const pattern of RELATION_PATTERNS) {
    const match = pattern.re.exec(text);
    if (!match) continue;
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const leftStems = slotStems(before);
    const rightStems = slotStems(after);
    const determinant = pattern.leftRole === 'determinant' ? leftStems : rightStems;
    const dependent = pattern.leftRole === 'determinant' ? rightStems : leftStems;
    return {
      relationClass: pattern.cls,
      matchedLexeme: match[0].trim(),
      determinant,
      dependent,
      structures,
      bareNecessity: pattern.cls === 'necessity' && structures.length === 0,
    };
  }

  return {
    relationClass: null,
    matchedLexeme: null,
    determinant: [],
    dependent: [],
    structures,
    bareNecessity: false,
  };
}

/**
 * Slot overlap by the OVERLAP COEFFICIENT (Szymkiewicz–Simpson):
 * |A ∩ B| ÷ min(|A|, |B|).
 *
 * Not Jaccard, deliberately, and this choice is load-bearing. Argument slots
 * are short and asymmetric: "liquidity" against "adequate liquidity" is one
 * concept plus a modifier, and Jaccard scores that 0.5 — below any usable bar —
 * so every paraphrase carrying an adjective would escape detection. The same
 * dilution defeats chaining, where a long consequent clause has to be matched
 * against a short antecedent.
 *
 * The cost is a real false-positive risk on single-word slots, which is why a
 * duplicate requires BOTH slots to clear the bar within the SAME relation
 * family — "liquidity is essential for market stability" and "liquidity is
 * essential for regulatory reporting" share a determinant completely and share
 * no dependent, so they are correctly kept distinct.
 */
function slotOverlap(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const smaller = Math.min(setA.size, setB.size);
  return smaller === 0 ? 0 : intersection / smaller;
}

export interface SemanticDuplicatePair {
  aId: string;
  bId: string;
  relationClass: RelationClass;
  /** Per-slot overlap after direction canonicalisation. */
  determinantOverlap: number;
  dependentOverlap: number;
  /** Whether the collision required inverting one statement's direction —
   *  i.e. exactly the case the lexical pass cannot see. */
  directionInverted: boolean;
  detail: string;
}

export interface SemanticDuplicateInput {
  id: string;
  statement: string;
}

export interface SemanticDuplicateOptions {
  /**
   * Minimum per-slot content overlap for two same-family statements to be
   * called duplicates. AN INSTRUMENT PARAMETER, not a derived constant — it is
   * the same class of illustrative default as `duplicateSimilarityThreshold`
   * (PRD-EPI-001 §0.5: every number in that PRD is an illustrative default,
   * never a precondition). Its calibration bar is the falsification test:
   * near-identical "X is essential for Y" variants must trip it. It is NOT
   * derived from any registered constraint and must not be presented as one.
   */
  argumentOverlapThreshold?: number;
}

export const DEFAULT_ARGUMENT_OVERLAP_THRESHOLD = 0.6;

/**
 * Semantic near-duplicate detection over parsed predicate-argument forms.
 *
 * Two statements are duplicates when they share a relation FAMILY and both
 * argument slots overlap at/above the threshold after direction
 * canonicalisation. For symmetric families (trade-off, proportion) the swapped
 * pairing is also tried and the better match wins.
 */
export function findSemanticDuplicatePairs(
  items: readonly SemanticDuplicateInput[],
  options: SemanticDuplicateOptions = {},
): SemanticDuplicatePair[] {
  const threshold = options.argumentOverlapThreshold ?? DEFAULT_ARGUMENT_OVERLAP_THRESHOLD;
  const parsed = items.map((item) => ({ id: item.id, form: parseRelationalForm(item.statement) }));
  const pairs: SemanticDuplicatePair[] = [];

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i];
      const b = parsed[j];
      if (!a.form.relationClass || a.form.relationClass !== b.form.relationClass) continue;
      const cls = a.form.relationClass;
      if (a.form.determinant.length === 0 || a.form.dependent.length === 0) continue;
      if (b.form.determinant.length === 0 || b.form.dependent.length === 0) continue;

      const straight = {
        det: slotOverlap(a.form.determinant, b.form.determinant),
        dep: slotOverlap(a.form.dependent, b.form.dependent),
        inverted: false,
      };
      const candidates = [straight];
      if (SYMMETRIC_CLASSES.has(cls)) {
        candidates.push({
          det: slotOverlap(a.form.determinant, b.form.dependent),
          dep: slotOverlap(a.form.dependent, b.form.determinant),
          inverted: true,
        });
      }
      const best = candidates.reduce((x, y) => (Math.min(y.det, y.dep) > Math.min(x.det, x.dep) ? y : x));
      if (Math.min(best.det, best.dep) < threshold) continue;

      // A collision the LEXICAL pass would also have caught is still reported —
      // the union is what the check gates on — but the flag records whether the
      // relation direction had to be inverted to see it, which is the class of
      // duplicate that motivated this instrument.
      const directionInverted =
        best.inverted ||
        (a.form.matchedLexeme !== null &&
          b.form.matchedLexeme !== null &&
          a.form.matchedLexeme !== b.form.matchedLexeme);

      pairs.push({
        aId: a.id,
        bId: b.id,
        relationClass: cls,
        determinantOverlap: best.det,
        dependentOverlap: best.dep,
        directionInverted,
        detail:
          `same relation family '${cls}' with determinant overlap ${best.det.toFixed(2)} and dependent ` +
          `overlap ${best.dep.toFixed(2)} after direction canonicalisation` +
          (directionInverted
            ? ` (surface forms differ — '${a.form.matchedLexeme ?? '?'}' vs '${b.form.matchedLexeme ?? '?'}' — so a ` +
              `word-set comparison would not have found this)`
            : ''),
      });
    }
  }
  return pairs;
}

export interface EntailmentChain {
  fromId: string;
  throughId: string;
  relationClass: RelationClass;
  /** Overlap of the shared middle term. */
  middleOverlap: number;
  detail: string;
}

export interface InferentialCapacityAssessment {
  assessedCount: number;
  /** Members asserting ≥1 of the seven structures. */
  relationalMemberCount: number;
  relationalMemberFraction: number;
  /** Members asserting a dependency and NOTHING from the seven. */
  bareNecessityCount: number;
  /** Members no relation lexeme in the table matched at all. */
  unparsedCount: number;
  /** Compositions whose conclusion is not stated by either premise. */
  entailmentChains: EntailmentChain[];
  entailmentChainCount: number;
  /** Members participating in ≥1 such composition. */
  inferentiallyCapableCount: number;
  inferentialCapacityFraction: number;
  /**
   * Bare-necessity transitivity ("A essential for B" + "B essential for C")
   * — counted, disclosed, and EXCLUDED from capacity. See the doc below.
   */
  degenerateNecessityChainCount: number;
  structuresPresent: RelationalStructure[];
  structuresAbsent: RelationalStructure[];
  /** Per-structure member counts, so a reader sees the distribution. */
  structureCounts: Record<RelationalStructure, number>;
  /** What was measured and how, stated in the payload rather than only here. */
  mechanism: string;
}

export interface InferentialCapacityOptions {
  /**
   * Minimum overlap for two forms to share a middle term. Instrument
   * parameter, same class and same disclosure as `argumentOverlapThreshold`.
   */
  chainingOverlapThreshold?: number;
  argumentOverlapThreshold?: number;
}

export const DEFAULT_CHAINING_OVERLAP_THRESHOLD = 0.5;

const CAPACITY_MECHANISM =
  'Structural, not distributional: each statement is reduced to (determinant, relationClass, dependent) ' +
  'by lexeme match, and an entailment chain is a composition A→B, B→C where the middle terms overlap and ' +
  'the outer terms do not (so the conclusion A→C is UNSTATED by either premise — EXP-P1 README §6(d)). ' +
  'This is NOT a formal entailment proof: it establishes that a conjunction has somewhere to go, not that ' +
  'the conclusion is true or interesting. Bare-necessity transitivity is counted separately and excluded.';

/**
 * Assess whether the collection's CONJUNCTIONS can entail unstated conclusions
 * — EXP-P1 README §6(d)'s actual requirement, as opposed to whether individual
 * statements carry a relational-looking label or a connective word.
 *
 * ── The load-bearing judgment: why bare-necessity chains are excluded ──────
 *
 * "A is essential for B" + "B is essential for C" does compose, to "A is
 * essential for C". Pretending otherwise would be dishonest, so the count is
 * reported. It is excluded from CAPACITY because the composition is
 * type-preserving and mechanism-free: the derived statement is the same
 * unquantified dependency generality as its premises, so a derivation task
 * built on it measures a syntactic transitivity move rather than reconstruction
 * of structure. §6(d) asks for "relational and conditional statements, not
 * isolated atomic assertions", and CFS-019's hydrogen/valence standard asks for
 * "the properties that determine its behaviour" — a necessity generality
 * supplies neither a mechanism, a direction of propagation, a trigger condition,
 * nor a magnitude.
 *
 * This exclusion is a judgment encoded in an instrument, and it is stated here
 * rather than buried so that a steward who disagrees can argue with it.
 */
export function assessInferentialCapacity(
  items: readonly SemanticDuplicateInput[],
  options: InferentialCapacityOptions = {},
): InferentialCapacityAssessment {
  const chainThreshold = options.chainingOverlapThreshold ?? DEFAULT_CHAINING_OVERLAP_THRESHOLD;
  const parsed = items.map((item) => ({ id: item.id, form: parseRelationalForm(item.statement) }));

  const structureCounts = Object.fromEntries(
    RELATIONAL_STRUCTURES.map((s) => [s, 0]),
  ) as Record<RelationalStructure, number>;
  for (const p of parsed) {
    for (const s of p.form.structures) structureCounts[s] += 1;
  }

  const relationalMembers = parsed.filter((p) => p.form.structures.length > 0);
  const bareNecessity = parsed.filter((p) => p.form.bareNecessity);
  const unparsed = parsed.filter((p) => p.form.relationClass === null);

  const chains: EntailmentChain[] = [];
  let degenerateNecessityChains = 0;
  const capable = new Set<string>();

  for (const a of parsed) {
    for (const b of parsed) {
      if (a.id === b.id) continue;
      const ca = a.form.relationClass;
      const cb = b.form.relationClass;
      if (!ca || !cb) continue;
      if (a.form.dependent.length === 0 || b.form.determinant.length === 0) continue;

      const middle = slotOverlap(a.form.dependent, b.form.determinant);
      if (middle < chainThreshold) continue;
      // The conclusion must be UNSTATED: if a's determinant already overlaps
      // b's dependent, the "chain" is a restatement of one of the premises.
      const outer = slotOverlap(a.form.determinant, b.form.dependent);
      if (outer >= chainThreshold) continue;

      const composable = COMPOSABLE_CLASSES.has(ca) && COMPOSABLE_CLASSES.has(cb);
      if (!composable) {
        if (ca === 'necessity' && cb === 'necessity') degenerateNecessityChains += 1;
        continue;
      }
      // Both premises must assert real structure, not merely parse.
      if (a.form.structures.length === 0 || b.form.structures.length === 0) continue;

      chains.push({
        fromId: a.id,
        throughId: b.id,
        relationClass: ca,
        middleOverlap: middle,
        detail:
          `'${a.id}' (${ca}) and '${b.id}' (${cb}) share a middle term at overlap ${middle.toFixed(2)} ` +
          `with distinct outer terms — their conjunction entails a conclusion neither states`,
      });
      capable.add(a.id);
      capable.add(b.id);
    }
  }

  const assessedCount = parsed.length;
  const structuresPresent = RELATIONAL_STRUCTURES.filter((s) => structureCounts[s] > 0);
  const structuresAbsent = RELATIONAL_STRUCTURES.filter((s) => structureCounts[s] === 0);

  return {
    assessedCount,
    relationalMemberCount: relationalMembers.length,
    relationalMemberFraction: assessedCount > 0 ? relationalMembers.length / assessedCount : 0,
    bareNecessityCount: bareNecessity.length,
    unparsedCount: unparsed.length,
    entailmentChains: chains,
    entailmentChainCount: chains.length,
    inferentiallyCapableCount: capable.size,
    inferentialCapacityFraction: assessedCount > 0 ? capable.size / assessedCount : 0,
    degenerateNecessityChainCount: degenerateNecessityChains,
    structuresPresent,
    structuresAbsent,
    structureCounts,
    mechanism: CAPACITY_MECHANISM,
  };
}
