const puppeteer = require('puppeteer');

class BaseScraper {
  constructor(config = {}) {
    this.baseURL = config.baseURL || '';
    this.headless = config.headless !== false;
    this.timeout = config.timeout || 30000;
  }

  async scrape(url) {
    const browser = await puppeteer.launch({
      headless: this.headless
    });
    
    try {
      const page = await browser.newPage();
      const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
      
      await page.goto(fullUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      const content = await page.content();
      await browser.close();
      
      return content;
    } catch (error) {
      await browser.close();
      throw new Error(`Failed to scrape ${url}: ${error.message}`);
    }
  }

  async scrapeWithPage(url, callback) {
    const browser = await puppeteer.launch({
      headless: this.headless
    });
    
    try {
      const page = await browser.newPage();
      const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
      
      await page.goto(fullUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      const result = await callback(page);
      await browser.close();
      
      return result;
    } catch (error) {
      await browser.close();
      throw new Error(`Failed to scrape ${url}: ${error.message}`);
    }
  }
}

module.exports = BaseScraper;

