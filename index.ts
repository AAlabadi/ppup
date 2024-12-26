import { Callback, Context, Handler } from "aws-lambda";
import { Browser, Page, PuppeteerLaunchOptions } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Add Stealth Plugin for bot detection evasion
puppeteer.use(StealthPlugin());

interface ExampleEvent {
  product_name: string;
}

/**
 * 🧠 Extract Dimensions and Weight from Text
 */
function findDimensionsAndWeight(detailsText: string) {
  detailsText = detailsText.replace(/\s+/g, ' ').trim();
  console.log("📝 Extracting from text:", detailsText);

  const dimensionsPatterns = [
    /(?:Dimensions|Product Dimensions|Size)[:\s]*([\d.]+)\s*[xX×]\s*([\d.]+)\s*[xX×]\s*([\d.\-]+)\s*(inches|in|cm|mm)?/i,
    /\b([\d.]+)\s*[xX×]\s*([\d.]+)\s*[xX×]\s*([\d.\-]+)\s*(mm|cm|inches|in)?\b/i
  ];

  const weightPatterns = [
    /Weight[:\s]*([\d.,]+)\s*(kg|kilograms|pounds|lbs|grams|g|ounces|oz|tons|mg)/gi,
    /\b([\d.,]+)\s*(kg|kilograms|pounds|lbs|grams|g|ounces|oz|tons|mg)\b/gi
  ];

  let dimensions = { length: "NA", width: "NA", height: "NA" };
  let weight = 0;
  let dimensionalWeight = 0;

  let length = NaN, width = NaN, height = NaN;

  // 🧠 Extract Dimensions
  for (let pattern of dimensionsPatterns) {
    const match = pattern.exec(detailsText);
    if (match) {
      let [_, lengthVal, widthVal, heightVal, unit] = match;

      length = parseFloat(lengthVal) || 0;
      width = parseFloat(widthVal) || 0;
      height = parseFloat(heightVal) || 0;

      if (!isNaN(length) && !isNaN(width) && !isNaN(height)) {
        if (unit) {
          switch (unit.toLowerCase()) {
            case "in":
            case "inches":
              length *= 2.54;
              width *= 2.54;
              height *= 2.54;
              break;
            case "mm":
              length /= 10;
              width /= 10;
              height /= 10;
              break;
          }
        }

        dimensions = {
          length: `${length.toFixed(2)} cm`,
          width: `${width.toFixed(2)} cm`,
          height: `${height.toFixed(2)} cm`
        };

        dimensionalWeight = (length * width * height) / 5000 || 0;
        console.log(`📦 Dimensional Weight: ${dimensionalWeight.toFixed(2)} kg`);
        break;
      }
    }
  }

  // 🧠 Extract Weight
  for (let pattern of weightPatterns) {
    const match = pattern.exec(detailsText);
    if (match) {
      let [_, weightValue, unit] = match;
      weightValue = parseFloat(weightValue.replace(',', '.')) || 0;

      switch (unit.toLowerCase()) {
        case 'pounds': case 'lbs': weight = weightValue * 0.453592; break;
        case 'grams': case 'g': weight = weightValue / 1000; break;
        case 'ounce': case 'ounces': case 'oz': weight = weightValue * 0.0283495; break;
        case 'kg': case 'kilograms': weight = weightValue; break;
        default:
          console.warn(`⚠️ Unknown weight unit: ${unit}`);
          weight = weightValue;
      }

      console.log(`⚖️ Parsed Weight: ${weight.toFixed(2)} kg`);
      break;
    }
  }

  if (!isNaN(dimensionalWeight) && (isNaN(weight) || dimensionalWeight > weight)) {
    weight = dimensionalWeight;
  }

  console.log(`✅ Final Calculated Weight: ${weight.toFixed(2)} kg`);

  return JSON.stringify({
    dimensions,
    weight: `${weight.toFixed(2)} kg`,
    dimensionalWeight: dimensionalWeight !== "NA" ? `${dimensionalWeight.toFixed(2)} kg` : "NA",
    finalCalculatedWeight: `${weight.toFixed(2)} kg`
  }, null, 2);
}

/**
 * 🚀 AWS Lambda Handler
 */
export const handler: Handler = async (
  event: ExampleEvent,
  context: Context,
  callback: Callback
): Promise<any> => {
  let browser: Browser | null = null;

  try {
    console.log("🔍 Event Received:", JSON.stringify(event));

    if (!event.product_name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "❌ Please provide 'product_name' in the event." })
      };
    }

    // ✅ Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/opt/nodejs/node_modules/puppeteer/.local-chromium",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--incognito',
        '--disable-client-side-phishing-detection'
      ]
    });

    const page: Page = await browser.newPage();
    await page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
    await page.type('textarea[name="q"], input[name="q"]', `What is the weight for ${event.product_name}`);
    await page.keyboard.press('Enter');
    await page.waitForSelector('#search', { timeout: 30000 });

    // ✅ Extract snippets
    const snippets = await page.$$eval(
      '.IsZvec, .VwiC3b, .BNeawe.s3v9rd.AP7Wnd',
      (elements: Element[]) =>
        Array.from(new Set(
          elements.map(el => (el as HTMLElement).innerText)
            .filter(text => text.trim() !== '')
        ))
    );

    if (!snippets.length) {
      throw new Error("❌ No valid snippets found.");
    }

    console.log(`✅ Extracted ${snippets.length} snippets.`);

    // ✅ Extract Dimensions and Weight
    const result = findDimensionsAndWeight(snippets.join(' '));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "✅ Successfully extracted dimensions and weight.",
        data: JSON.parse(result)
      })
    };

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log('🛑 Browser closed successfully.');
    }
  }
};
