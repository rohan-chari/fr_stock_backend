/**
 * Proxy Manager Utility
 *
 * Manages a pool of rotating proxies for HTTP requests.
 * Uses round-robin rotation with fallback to direct connection.
 * Includes health checking and automatic failover.
 */

const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');

let proxyList = [];
let currentIndex = 0;

// Health tracking state
let proxyHealth = {};  // { proxyUrl: { healthy: boolean, lastFailure: timestamp } }
const COOLDOWN_MS = 5 * 60 * 1000;  // 5 minutes
const VALIDATION_TIMEOUT_MS = 10000;  // 10 seconds for validation requests
const TEST_URL = 'https://httpbin.org/ip';

/**
 * Parses the proxy list from environment variable and validates them.
 * Expected format: host:port:user:pass,host:port:user:pass,...
 *
 * @returns {Promise<void>}
 */
const initializeProxies = async () => {
  const proxyString = process.env.WEBSHARE_PROXY_LIST;

  if (!proxyString || proxyString.trim() === '') {
    proxyList = [];
    return;
  }

  proxyList = proxyString.split(',').map(proxy => {
    const parts = proxy.trim().split(':');
    if (parts.length !== 4) {
      console.warn(`Invalid proxy format: ${proxy}. Expected host:port:user:pass`);
      return null;
    }

    const [host, port, user, pass] = parts;
    return `http://${user}:${pass}@${host}:${port}`;
  }).filter(Boolean);

  if (proxyList.length > 0) {
    console.log(`[ProxyManager] Initialized with ${proxyList.length} proxies`);
    console.log(`[ProxyManager] Validating ${proxyList.length} proxies...`);
    await validateAllProxies();
  }
};

/**
 * Gets the next proxy URL using round-robin rotation.
 * Returns null if no proxies are configured.
 *
 * @returns {string|null} - Proxy URL or null for direct connection
 */
const getNextProxy = () => {
  if (proxyList.length === 0) {
    return null;
  }

  const proxy = proxyList[currentIndex];
  currentIndex = (currentIndex + 1) % proxyList.length;
  return proxy;
};

/**
 * Creates an HttpsProxyAgent for the given proxy URL.
 *
 * @param {string} proxyUrl - The proxy URL (http://user:pass@host:port)
 * @returns {HttpsProxyAgent} - Configured proxy agent
 */
const createProxyAgent = (proxyUrl) => {
  return new HttpsProxyAgent(proxyUrl);
};

/**
 * Validates a single proxy by making a test request.
 *
 * @param {string} proxyUrl - The proxy URL to validate
 * @returns {Promise<boolean>} - True if proxy is healthy
 */
const validateProxy = async (proxyUrl) => {
  try {
    const agent = createProxyAgent(proxyUrl);

    const response = await axios.get(TEST_URL, {
      httpsAgent: agent,
      httpAgent: agent,
      timeout: VALIDATION_TIMEOUT_MS
    });

    if (response.status >= 200 && response.status < 300) {
      proxyHealth[proxyUrl] = { healthy: true, lastFailure: null };
      return true;
    }

    proxyHealth[proxyUrl] = { healthy: false, lastFailure: Date.now() };
    return false;
  } catch (error) {
    proxyHealth[proxyUrl] = { healthy: false, lastFailure: Date.now() };
    return false;
  }
};

/**
 * Validates all proxies on startup.
 * Logs results for each proxy.
 *
 * @returns {Promise<void>}
 */
const validateAllProxies = async () => {
  let healthyCount = 0;

  for (let i = 0; i < proxyList.length; i++) {
    const proxy = proxyList[i];
    const isHealthy = await validateProxy(proxy);

    // Mask credentials in log output
    const maskedProxy = proxy.replace(/:([^:@]+)@/, ':***@');

    if (isHealthy) {
      console.log(`[ProxyManager] Proxy ${i + 1}/${proxyList.length}: ✓ healthy (${maskedProxy})`);
      healthyCount++;
    } else {
      console.log(`[ProxyManager] Proxy ${i + 1}/${proxyList.length}: ✗ failed (${maskedProxy})`);
    }
  }

  console.log(`[ProxyManager] ${healthyCount}/${proxyList.length} proxies healthy`);
};

/**
 * Marks a proxy as failed (unhealthy).
 * Called when a request using this proxy fails.
 *
 * @param {string} proxyUrl - The proxy URL that failed
 */
const markProxyFailed = (proxyUrl) => {
  proxyHealth[proxyUrl] = { healthy: false, lastFailure: Date.now() };
  const maskedProxy = proxyUrl.replace(/:([^:@]+)@/, ':***@');
  console.log(`[ProxyManager] Marked proxy as failed: ${maskedProxy}`);
};

/**
 * Checks if a proxy is available (healthy or cooldown expired).
 *
 * @param {string} proxyUrl - The proxy URL to check
 * @returns {boolean} - True if proxy can be used
 */
const isProxyAvailable = (proxyUrl) => {
  const health = proxyHealth[proxyUrl];
  if (!health) return true;  // Never validated, assume healthy
  if (health.healthy) return true;
  // Check if cooldown has expired
  return Date.now() - health.lastFailure > COOLDOWN_MS;
};

/**
 * Gets a proxy agent for the next healthy proxy in rotation.
 * Skips unhealthy proxies unless their cooldown has expired.
 * Returns null if no proxies are configured.
 *
 * @returns {{ agent: HttpsProxyAgent, proxyUrl: string }|null} - Proxy agent with URL, or null
 */
const getNextProxyAgent = () => {
  if (proxyList.length === 0) return null;

  // Try each proxy, skipping unhealthy ones (unless cooldown expired)
  for (let i = 0; i < proxyList.length; i++) {
    const proxy = proxyList[currentIndex];
    currentIndex = (currentIndex + 1) % proxyList.length;

    if (isProxyAvailable(proxy)) {
      return { agent: createProxyAgent(proxy), proxyUrl: proxy };
    }
  }

  // All proxies unhealthy - return first one anyway (it will retry after cooldown)
  const fallbackProxy = proxyList[0];
  return { agent: createProxyAgent(fallbackProxy), proxyUrl: fallbackProxy };
};

/**
 * Returns the number of configured proxies.
 *
 * @returns {number} - Number of proxies
 */
const getProxyCount = () => {
  return proxyList.length;
};

module.exports = {
  getNextProxy,
  createProxyAgent,
  getNextProxyAgent,
  getProxyCount,
  initializeProxies,
  validateProxy,
  validateAllProxies,
  markProxyFailed
};
