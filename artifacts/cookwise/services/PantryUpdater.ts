import type { ParsedReceipt, PantryItem, PantryUpdateResult, ReceiptLineItem } from "@/types";
import { KEYS, load, save } from "./storage";

// ─────────────────────────────────────────────
// Name normalisation helpers
// ─────────────────────────────────────────────

/**
 * Normalise an ingredient name for deduplication comparison.
 * Strips leading/trailing whitespace, lowercases, collapses spaces.
 */
function normaliseName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Remove common supermarket-specific suffixes and brand noise so
 * "WOOLWORTHS CHICKEN BREAST 500G" matches "chicken breast" in the pantry.
 *
 * TODO: Expand with a proper product-name normalisation library or a
 *       brand-name dictionary when real receipt data is available.
 */
function cleanItemName(name: string): string {
  return name
    // Drop known supermarket brand prefixes (case-insensitive)
    .replace(/^(woolworths|coles|aldi|iga|costco|waitrose|tesco|walmart|kroger|lidl|aldi)\s+/i, "")
    // Drop weight/size suffixes already handled by parser (belt-and-suspenders)
    .replace(/\b\d+(?:\.\d+)?\s*(g|kg|l|ml|oz|lb|pk|pack|pcs?)\b/gi, "")
    // Drop PLU/SKU codes (4–6 digit standalone numbers)
    .replace(/\b\d{4,6}\b/g, "")
    // Title-case for display consistency
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

// ─────────────────────────────────────────────
// Duplicate detection
// ─────────────────────────────────────────────

/**
 * Returns true if receiptName already exists in pantryItems.
 * Uses substring matching in both directions to handle partial names
 * (e.g. "Chicken Breast" matches "Chicken Breast 500g" in pantry).
 *
 * TODO: Replace with a fuzzy-match library (e.g. fuse.js) for higher
 *       accuracy when real receipt/pantry pairs are available.
 */
function existsInPantry(receiptName: string, pantryItems: PantryItem[]): boolean {
  const rn = normaliseName(receiptName);
  return pantryItems.some((p) => {
    const pn = normaliseName(p.name);
    return pn === rn || pn.includes(rn) || rn.includes(pn);
  });
}

// ─────────────────────────────────────────────
// Item filter
// ─────────────────────────────────────────────

/**
 * Decide whether a receipt line item should be added to the pantry.
 *
 * A line is eligible when:
 *   - isNonFood is false
 *   - name is at least 2 characters after cleaning
 *   - name is not purely numeric (PLU code / price)
 *
 * TODO: Add a food-vs-non-food ML classifier here once labelled receipt
 *       data is collected. The current keyword heuristic in ReceiptParser
 *       has high precision but lower recall for unusual non-food items.
 */
function isEligibleForPantry(item: ReceiptLineItem): boolean {
  if (item.isNonFood) return false;
  const cleaned = cleanItemName(item.name);
  if (cleaned.length < 2) return false;
  if (/^\d+$/.test(cleaned)) return false;
  return true;
}

// ─────────────────────────────────────────────
// ID generator
// ─────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

// ─────────────────────────────────────────────
// PantryUpdater
// ─────────────────────────────────────────────

/**
 * Applies a ParsedReceipt to the pantry stored in AsyncStorage.
 *
 * This service operates directly on the storage layer (not through
 * PantryContext) so it can be called from background tasks, tests, and
 * non-React code. PantryContext re-loads from storage on the next render
 * cycle, keeping the UI in sync without coupling.
 *
 * Integration with PantryContext:
 *   After calling applyReceipt(), call usePantry().reload() (if available)
 *   or trigger a context refresh to reflect the new items in the UI.
 *
 * TODO: Expose an event/callback so PantryContext can reactively subscribe
 *       to pantry changes made outside the context (e.g. via receipt scan).
 */
export class PantryUpdater {
  /**
   * Read the current pantry from storage, apply eligible receipt items,
   * and persist the updated pantry.
   *
   * @param receipt  Structured receipt from ReceiptParser.
   * @returns        Summary of what was added, skipped, and ignored.
   */
  async applyReceipt(receipt: ParsedReceipt): Promise<PantryUpdateResult> {
    const result: PantryUpdateResult = {
      added: [],
      skipped: [],
      ignored: [],
      errors: [],
    };

    // Load current pantry
    const currentItems = await load<PantryItem[]>(KEYS.PANTRY, []);
    const updatedItems = [...currentItems];

    for (const lineItem of receipt.items) {
      try {
        if (!isEligibleForPantry(lineItem)) {
          result.ignored.push(lineItem.raw);
          continue;
        }

        const cleanedName = cleanItemName(lineItem.name);

        if (existsInPantry(cleanedName, currentItems)) {
          result.skipped.push(cleanedName);
          continue;
        }

        const pantryItem: PantryItem = {
          id: generateId(),
          name: cleanedName,
          quantity: lineItem.quantity !== undefined
            ? `${lineItem.quantity}${lineItem.unit ? " " + lineItem.unit : ""}`
            : lineItem.unit ?? undefined,
          addedAt: new Date().toISOString(),
          // category and storageLocation intentionally omitted here;
          // ShoppingListService.classifyIngredient() can be used to infer
          // category for display — set it here if the pantry UI uses category.
          // TODO: Infer PantryCategory from ReceiptLineItem using classifyIngredient().
        };

        updatedItems.push(pantryItem);
        result.added.push(cleanedName);
      } catch (err) {
        result.errors.push(
          `Failed to process "${lineItem.raw}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Persist only if something changed
    if (result.added.length > 0) {
      await save(KEYS.PANTRY, updatedItems);
    }

    return result;
  }

  /**
   * Preview what applyReceipt() would do without writing to storage.
   * Useful for showing the user a confirmation screen before committing.
   *
   * TODO: Wire this into a UI flow where the user reviews and deselects
   *       items before they are added to the pantry.
   */
  async previewReceipt(receipt: ParsedReceipt): Promise<PantryUpdateResult> {
    const result: PantryUpdateResult = {
      added: [],
      skipped: [],
      ignored: [],
      errors: [],
    };

    const currentItems = await load<PantryItem[]>(KEYS.PANTRY, []);

    for (const lineItem of receipt.items) {
      if (!isEligibleForPantry(lineItem)) {
        result.ignored.push(lineItem.raw);
        continue;
      }
      const cleanedName = cleanItemName(lineItem.name);
      if (existsInPantry(cleanedName, currentItems)) {
        result.skipped.push(cleanedName);
      } else {
        result.added.push(cleanedName);
      }
    }

    return result;
  }
}
