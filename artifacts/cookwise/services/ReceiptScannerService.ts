import type { OcrResult, ParsedReceipt, PantryUpdateResult } from "@/types";
import { ReceiptParser } from "./ReceiptParser";
import { PantryUpdater } from "./PantryUpdater";

// ─────────────────────────────────────────────
// OCR adapter interface
// ─────────────────────────────────────────────

/**
 * Plug-in interface for OCR engines.
 *
 * Implement this to add a real OCR backend. Swap the adapter in
 * ReceiptScannerService without touching any other code.
 *
 * Candidate implementations:
 *   - GoogleVisionAdapter  (Google Cloud Vision API)
 *   - AwsTextractAdapter   (Amazon Textract)
 *   - AppleVisionAdapter   (on-device, iOS only, via expo-image-picker + native module)
 *   - TesseractAdapter     (open-source, runs in JS via tesseract.js)
 *   - OpenAiVisionAdapter  (GPT-4o vision — high accuracy, no setup)
 */
export interface OcrAdapter {
  /** Human-readable name surfaced in OcrResult and logs. */
  readonly name: string;

  /**
   * Extract text from an image.
   *
   * @param imageUri  Local file URI (e.g. from expo-image-picker) or remote URL.
   * @returns         Raw text extracted from the image, suitable for ReceiptParser.
   */
  extractText(imageUri: string): Promise<string>;
}

// ─────────────────────────────────────────────
// Null adapter (stub until OCR is wired in)
// ─────────────────────────────────────────────

/**
 * Placeholder adapter that throws a clear error instead of silently returning
 * empty strings. Replace by calling setOcrAdapter() with a real implementation.
 */
class NullOcrAdapter implements OcrAdapter {
  readonly name = "null";

  extractText(_imageUri: string): Promise<string> {
    // TODO: Replace NullOcrAdapter with a real OcrAdapter implementation.
    // See the OcrAdapter interface above for the contract.
    throw new Error(
      "[ReceiptScannerService] No OCR adapter configured. " +
        "Call ReceiptScannerService.setAdapter(adapter) with a real OcrAdapter before scanning."
    );
  }
}

// ─────────────────────────────────────────────
// Scan options & result
// ─────────────────────────────────────────────

export interface ScanOptions {
  /**
   * If true, food items parsed from the receipt are automatically pushed
   * into the pantry after scanning. Defaults to true.
   */
  updatePantry?: boolean;

  /**
   * Minimum parser confidence (0–1) for a line item to be included.
   * Lines below this threshold are placed in PantryUpdateResult.ignored.
   * Defaults to 0.4.
   */
  minConfidence?: number;
}

export interface ScanResult {
  ocrResult: OcrResult;
  parsedReceipt: ParsedReceipt;
  /** Only present when ScanOptions.updatePantry is true. */
  pantryUpdate?: PantryUpdateResult;
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

export class ReceiptScannerService {
  private adapter: OcrAdapter;
  private parser: ReceiptParser;
  private pantryUpdater: PantryUpdater;

  constructor(
    adapter: OcrAdapter = new NullOcrAdapter(),
    parser: ReceiptParser = new ReceiptParser(),
    pantryUpdater: PantryUpdater = new PantryUpdater()
  ) {
    this.adapter = adapter;
    this.parser = parser;
    this.pantryUpdater = pantryUpdater;
  }

  /**
   * Swap the OCR adapter at runtime.
   * Call this once during app initialisation after the user grants camera/photo
   * permissions and you've instantiated your chosen OcrAdapter.
   *
   * @example
   *   import { OpenAiVisionAdapter } from "./adapters/OpenAiVisionAdapter";
   *   receiptScanner.setAdapter(new OpenAiVisionAdapter(apiKey));
   */
  setAdapter(adapter: OcrAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Full pipeline: image → OCR → parse → (optionally) update pantry.
   *
   * Steps:
   *   1. Run the OcrAdapter on the image URI.
   *   2. Wrap raw text in an OcrResult.
   *   3. Pass OcrResult to ReceiptParser → ParsedReceipt.
   *   4. If updatePantry is true, pass ParsedReceipt to PantryUpdater.
   *
   * @param imageUri  Local or remote image URI.
   * @param options   See ScanOptions.
   */
  async scan(imageUri: string, options: ScanOptions = {}): Promise<ScanResult> {
    const { updatePantry = true, minConfidence = 0.4 } = options;

    // ── Step 1: OCR ──────────────────────────────────────────────────────────
    // TODO: Once an OcrAdapter is configured this will call the real engine.
    const rawText = await this.adapter.extractText(imageUri);

    const ocrResult: OcrResult = {
      rawText,
      imagePath: imageUri,
      scannedAt: new Date().toISOString(),
      adapterName: this.adapter.name,
      confidence: -1, // TODO: propagate per-adapter confidence score
    };

    // ── Step 2: Parse ────────────────────────────────────────────────────────
    const parsedReceipt = this.parser.parse(ocrResult, { minConfidence });

    // ── Step 3: Pantry update ────────────────────────────────────────────────
    let pantryUpdate: PantryUpdateResult | undefined;
    if (updatePantry) {
      pantryUpdate = await this.pantryUpdater.applyReceipt(parsedReceipt);
    }

    return { ocrResult, parsedReceipt, pantryUpdate };
  }

  /**
   * Parse already-extracted text without running OCR.
   * Useful for testing the parser with known input or for manual text entry.
   */
  async parseText(
    rawText: string,
    options: ScanOptions = {}
  ): Promise<ScanResult> {
    const { updatePantry = false, minConfidence = 0.4 } = options;

    const ocrResult: OcrResult = {
      rawText,
      imagePath: "",
      scannedAt: new Date().toISOString(),
      adapterName: "manual",
      confidence: 1,
    };

    const parsedReceipt = this.parser.parse(ocrResult, { minConfidence });

    let pantryUpdate: PantryUpdateResult | undefined;
    if (updatePantry) {
      pantryUpdate = await this.pantryUpdater.applyReceipt(parsedReceipt);
    }

    return { ocrResult, parsedReceipt, pantryUpdate };
  }
}

// ─────────────────────────────────────────────
// Singleton export
// ─────────────────────────────────────────────

/**
 * App-wide singleton. Import this anywhere.
 *
 * @example
 *   import { receiptScanner } from "@/services/ReceiptScannerService";
 *   receiptScanner.setAdapter(new MyOcrAdapter());
 *   const result = await receiptScanner.scan(imageUri);
 */
export const receiptScanner = new ReceiptScannerService();
