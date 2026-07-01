import type { OcrResult, ParsedReceipt, ReceiptLineItem } from "@/types";

// ─────────────────────────────────────────────
// Parser options
// ─────────────────────────────────────────────

export interface ParseOptions {
  /**
   * Lines with confidence below this threshold are kept in the result but
   * flagged; PantryUpdater will ignore them unless overridden.
   * Range 0–1. Default 0.4.
   */
  minConfidence?: number;
}

// ─────────────────────────────────────────────
// Parser strategy interface
// ─────────────────────────────────────────────

/**
 * Strategy interface for store-specific or locale-specific receipt formats.
 *
 * The default GenericReceiptStrategy handles most English-language receipts.
 * Implement this interface for supermarket-specific quirks (e.g. Woolworths,
 * Coles, Walmart, Lidl) and register it via ReceiptParser.registerStrategy().
 *
 * TODO: Implement store-specific strategies as supermarket integrations are added.
 */
export interface ReceiptParserStrategy {
  readonly name: string;

  /**
   * Return true if this strategy recognises the receipt text.
   * The parser tries strategies in registration order; first match wins.
   */
  canHandle(rawText: string): boolean;

  /** Extract store name from raw text, or undefined if not found. */
  extractStoreName(rawText: string): string | undefined;

  /** Extract receipt date as ISO string, or undefined if not found. */
  extractDate(rawText: string): string | undefined;

  /** Extract line items from raw text. */
  extractItems(rawText: string): ReceiptLineItem[];

  /** Extract total amount, or undefined if not found. */
  extractTotal(rawText: string): number | undefined;

  /** Extract currency code (e.g. "AUD", "USD"), or undefined. */
  extractCurrency(rawText: string): string | undefined;
}

// ─────────────────────────────────────────────
// Heuristics shared across strategies
// ─────────────────────────────────────────────

/**
 * Keywords that strongly suggest a line is NOT a food item.
 * Used by all strategies to set ReceiptLineItem.isNonFood.
 *
 * TODO: Expand this list as real receipts are tested in production.
 */
const NON_FOOD_KEYWORDS = [
  // Household
  "bag", "plastic bag", "carry bag", "reusable bag",
  "toilet paper", "paper towel", "tissues",
  "detergent", "dishwasher", "washing powder", "fabric softener",
  "cleaning", "spray", "bleach", "disinfectant",
  "shampoo", "conditioner", "body wash", "soap bar",
  "toothpaste", "toothbrush", "deodorant", "razor",
  // Loyalty / points
  "points", "rewards", "flybuys", "everyday rewards",
  "discount", "savings", "saving", "special", "coupon",
  // Receipt metadata
  "subtotal", "total", "gst", "tax", "change", "cash", "eftpos",
  "visa", "mastercard", "amex", "card", "payment",
  "receipt", "invoice", "transaction", "terminal", "merchant",
  "cashier", "operator", "store", "abn", "acn",
  "thank you", "thankyou", "thanks",
  // Batteries / electronics
  "battery", "batteries", "charger",
];

export function isNonFoodLine(line: string): boolean {
  const l = line.toLowerCase().trim();
  if (l.length < 2) return true;
  return NON_FOOD_KEYWORDS.some((kw) => l.includes(kw));
}

/**
 * Price pattern: optional currency symbol, digits, decimal part.
 * Matches: $3.49  3.49  3,49  -1.00  1.5
 */
const PRICE_RE = /(?:[$€£¥₹]?\s*)(\d{1,5}[.,]\d{2})\b/;

/**
 * Quantity pattern at start of line: "2x", "x2", "2 x", "3 @"
 */
const QTY_RE = /^(\d+)\s*[x@×]\s*/i;

/**
 * Unit pattern embedded in item name: "500g", "1kg", "2L", "500ml", "6pk"
 */
const UNIT_RE = /\b(\d+(?:\.\d+)?)\s*(g|kg|l|ml|oz|lb|pk|pack|pcs?)\b/i;

export function parsePriceLine(raw: string): { name: string; price?: number; quantity?: number; unit?: string } {
  let line = raw.trim();
  let quantity: number | undefined;
  let price: number | undefined;
  let unit: string | undefined;

  // Extract leading quantity ("2x chicken breast")
  const qtyMatch = QTY_RE.exec(line);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10);
    line = line.slice(qtyMatch[0].length);
  }

  // Extract price (strip it from name)
  const priceMatch = PRICE_RE.exec(line);
  if (priceMatch) {
    price = parseFloat(priceMatch[1].replace(",", "."));
    line = line.replace(priceMatch[0], "").trim();
  }

  // Extract unit from remaining name ("500g chicken breast" → unit 500g)
  const unitMatch = UNIT_RE.exec(line);
  if (unitMatch) {
    unit = unitMatch[0].trim();
  }

  // Clean up name: remove trailing punctuation, codes, excess whitespace
  const name = line
    .replace(/[*#@$%^&()[\]{}<>|\\]/g, " ")
    .replace(/\b\d{4,}\b/g, "")     // remove long numeric codes
    .replace(/\s{2,}/g, " ")
    .trim();

  return { name, price, quantity, unit };
}

// ─────────────────────────────────────────────
// Generic strategy (default)
// ─────────────────────────────────────────────

/**
 * Best-effort parser for general English-language supermarket receipts.
 *
 * TODO: Replace or supplement with store-specific strategies for higher accuracy.
 * TODO: Add locale-aware date parsing (currently handles DD/MM/YYYY and MM/DD/YYYY).
 * TODO: Add multi-line item detection (some receipts split item names across two lines).
 */
class GenericReceiptStrategy implements ReceiptParserStrategy {
  readonly name = "generic";

  canHandle(_rawText: string): boolean {
    return true; // fallback — always matches
  }

  extractStoreName(rawText: string): string | undefined {
    // Heuristic: store name is typically on the first 1–3 non-empty lines
    // before any date or item-like content.
    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 3)) {
      if (/\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/.test(line)) break;
      if (PRICE_RE.test(line)) break;
      if (line.length > 2 && line.length < 60 && !/^\d+$/.test(line)) {
        return line;
      }
    }
    return undefined;
  }

  extractDate(rawText: string): string | undefined {
    // TODO: Add support for locale-specific date formats beyond DD/MM/YYYY.
    const dateRe = /\b(\d{1,2})[/\-.:](\d{1,2})[/\-.:](\d{2,4})\b/;
    const match = dateRe.exec(rawText);
    if (!match) return undefined;
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  extractItems(rawText: string): ReceiptLineItem[] {
    const lines = rawText.split("\n");
    const items: ReceiptLineItem[] = [];

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.length < 2) continue;

      const nonFood = isNonFoodLine(trimmed);
      const { name, price, quantity, unit } = parsePriceLine(trimmed);

      if (!name) continue;

      // TODO: Improve confidence scoring using:
      //   - ML model trained on receipt corpora
      //   - Per-store known product databases
      //   - Barcode/PLU lookup
      const confidence = this.scoreConfidence(trimmed, name, nonFood);

      items.push({
        raw: trimmed,
        name,
        quantity,
        unit,
        price,
        confidence,
        isNonFood: nonFood,
      });
    }

    return items;
  }

  extractTotal(rawText: string): number | undefined {
    const totalRe = /\btotal\b.*?(\d+[.,]\d{2})/i;
    const match = totalRe.exec(rawText);
    if (!match) return undefined;
    return parseFloat(match[1].replace(",", "."));
  }

  extractCurrency(rawText: string): string | undefined {
    if (/\$/.test(rawText)) return "AUD"; // TODO: distinguish AUD/USD/CAD by locale
    if (/€/.test(rawText)) return "EUR";
    if (/£/.test(rawText)) return "GBP";
    return undefined;
  }

  private scoreConfidence(raw: string, name: string, isNonFood: boolean): number {
    if (isNonFood) return 0.1;
    if (!name || name.length < 2) return 0.0;

    let score = 0.5;

    // Longer, cleaner names score higher
    if (name.length >= 4) score += 0.1;
    if (name.length >= 8) score += 0.1;

    // Lines with a price are more likely real items
    if (PRICE_RE.test(raw)) score += 0.2;

    // Lines that are mostly numeric are probably codes/totals
    if (/^\d+$/.test(name)) score -= 0.4;

    // All-caps often indicates category headers on receipts
    if (name === name.toUpperCase() && name.length > 3) score -= 0.15;

    return Math.max(0, Math.min(1, score));
  }
}

// ─────────────────────────────────────────────
// ReceiptParser
// ─────────────────────────────────────────────

/**
 * Converts raw OCR text into a structured ParsedReceipt.
 *
 * Usage:
 *   const parser = new ReceiptParser();
 *   const receipt = parser.parse(ocrResult);
 *
 * To add a store-specific strategy:
 *   parser.registerStrategy(new WoolworthsStrategy(), { prepend: true });
 *
 * TODO: Ship built-in strategies for major AU/US/UK supermarkets.
 */
export class ReceiptParser {
  private strategies: ReceiptParserStrategy[] = [new GenericReceiptStrategy()];

  /**
   * Register a custom parser strategy.
   * @param strategy  The strategy to register.
   * @param options   Pass { prepend: true } to give the strategy priority over existing ones.
   */
  registerStrategy(strategy: ReceiptParserStrategy, options: { prepend?: boolean } = {}): void {
    if (options.prepend) {
      this.strategies.unshift(strategy);
    } else {
      // Insert before the generic fallback (always last)
      this.strategies.splice(this.strategies.length - 1, 0, strategy);
    }
  }

  /**
   * Parse an OcrResult into a structured ParsedReceipt.
   * Selects the first strategy whose canHandle() returns true.
   */
  parse(ocrResult: OcrResult, options: ParseOptions = {}): ParsedReceipt {
    const { minConfidence = 0.4 } = options;
    const { rawText } = ocrResult;

    const strategy = this.strategies.find((s) => s.canHandle(rawText))!;

    const allItems = strategy.extractItems(rawText);

    // Apply confidence filter — low-confidence items stay in result but
    // are flagged; PantryUpdater decides what to do with them.
    const items = allItems.map((item) =>
      item.confidence < minConfidence ? { ...item, isNonFood: true } : item
    );

    return {
      storeName: strategy.extractStoreName(rawText),
      date: strategy.extractDate(rawText),
      items,
      total: strategy.extractTotal(rawText),
      currency: strategy.extractCurrency(rawText),
      parsedAt: new Date().toISOString(),
      parserStrategy: strategy.name,
    };
  }
}
