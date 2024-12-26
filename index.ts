const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

exports.handler = async (event) => {
  let browser = null;

  try {
    console.log('Launching Puppeteer...');
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--headless',
        '--disable-crash-reporter',
        '--disable-extensions',
        '--disable-sync',
        '--disable-features=site-per-process',
        '--enable-logging',
        '--v=1'
      ],
      executablePath: await chromium.executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
      userDataDir: '/tmp/user-data',
      devtools: false,
      defaultViewport: chromium.defaultViewport,
    });

    console.log('Creating a new page...');
    const page = await browser.newPage();

    console.log('Navigating to example.com...');
    await page.goto('https://example.com', { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('Getting page content...');
    const content = await page.content();

    console.log('Closing Puppeteer...');
    await browser.close();

    return {
      statusCode: 200,
      body: JSON.stringify({ content }),
    };
  } catch (error) {
    console.error('Error in Lambda Handler:', error);
    if (browser) {
      await browser.close();
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
};
