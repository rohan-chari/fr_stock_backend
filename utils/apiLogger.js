/**
 * External API Logger Utility
 *
 * Provides functions to log external API requests to the database.
 * Tracks request/response times, status codes, and errors.
 */

const prisma = require('../config/database');

// Service name constants
const SERVICES = {
  REDDIT: 'reddit',
  FINNHUB: 'finnhub',
  OPENAI: 'openai'
};

// Cache for service IDs to avoid repeated lookups
const serviceIdCache = {};

/**
 * Gets or creates an external service record.
 * Results are cached in memory for performance.
 *
 * @param {string} serviceName - Name of the service (reddit, finnhub, openai)
 * @returns {Promise<number>} - The service ID
 */
const getServiceId = async (serviceName) => {
  // Check cache first
  if (serviceIdCache[serviceName]) {
    return serviceIdCache[serviceName];
  }

  // Find or create the service
  const service = await prisma.externalService.upsert({
    where: { name: serviceName },
    update: {},
    create: {
      name: serviceName,
      description: getServiceDescription(serviceName),
      baseUrl: getServiceBaseUrl(serviceName)
    }
  });

  // Cache the ID
  serviceIdCache[serviceName] = service.id;
  return service.id;
};

/**
 * Gets description for a service
 */
const getServiceDescription = (serviceName) => {
  const descriptions = {
    [SERVICES.REDDIT]: 'Reddit API for fetching posts and comments',
    [SERVICES.FINNHUB]: 'Finnhub API for stock symbol search',
    [SERVICES.OPENAI]: 'OpenAI API for sentiment analysis'
  };
  return descriptions[serviceName] || serviceName;
};

/**
 * Gets base URL for a service
 */
const getServiceBaseUrl = (serviceName) => {
  const urls = {
    [SERVICES.REDDIT]: 'https://www.reddit.com',
    [SERVICES.FINNHUB]: 'https://finnhub.io/api/v1',
    [SERVICES.OPENAI]: 'https://api.openai.com/v1'
  };
  return urls[serviceName] || null;
};

/**
 * Logs an external API request to the database.
 *
 * @param {Object} params - Log parameters
 * @param {string} params.service - Service name (reddit, finnhub, openai)
 * @param {string} params.endpoint - The endpoint called
 * @param {string} params.method - HTTP method (GET, POST, etc.)
 * @param {Date} params.requestedAt - When the request was made
 * @param {Date} [params.respondedAt] - When the response was received
 * @param {number} [params.statusCode] - HTTP status code
 * @param {boolean} params.success - Whether the request succeeded
 * @param {string} [params.errorMessage] - Error message if failed
 * @param {string} [params.requestSummary] - Brief description of the request
 * @param {string} [params.responseSummary] - Brief summary of the response
 * @param {string} [params.proxyUsed] - Masked proxy URL used for request
 * @returns {Promise<Object>} - The created log entry
 */
const logApiRequest = async ({
  service,
  endpoint,
  method = 'GET',
  requestedAt,
  respondedAt,
  statusCode,
  success,
  errorMessage,
  requestSummary,
  responseSummary,
  proxyUsed
}) => {
  try {
    const serviceId = await getServiceId(service);

    const durationMs = respondedAt && requestedAt
      ? respondedAt.getTime() - requestedAt.getTime()
      : null;

    return await prisma.externalApiLog.create({
      data: {
        serviceId,
        endpoint,
        method,
        requestedAt,
        respondedAt,
        durationMs,
        statusCode,
        success,
        errorMessage: errorMessage ? String(errorMessage).slice(0, 1000) : null,
        requestSummary: requestSummary ? String(requestSummary).slice(0, 500) : null,
        responseSummary: responseSummary ? String(responseSummary).slice(0, 500) : null,
        proxyUsed: proxyUsed ? String(proxyUsed).slice(0, 255) : null
      }
    });
  } catch (error) {
    // Don't let logging failures break the main flow
    console.error('[API Logger] Failed to log request:', error.message);
    return null;
  }
};

/**
 * Wraps an axios request with automatic logging.
 *
 * @param {string} service - Service name (reddit, finnhub, openai)
 * @param {Function} axiosCall - Function that returns an axios promise
 * @param {Object} options - Additional options
 * @param {string} options.endpoint - The endpoint being called
 * @param {string} [options.method='GET'] - HTTP method
 * @param {string} [options.requestSummary] - Brief description of the request
 * @param {Function} [options.getResponseSummary] - Function to extract summary from response
 * @param {string} [options.proxyUsed] - Masked proxy URL used for request
 * @returns {Promise<Object>} - The axios response
 */
const withLogging = async (service, axiosCall, options = {}) => {
  const {
    endpoint,
    method = 'GET',
    requestSummary,
    getResponseSummary,
    proxyUsed
  } = options;

  const requestedAt = new Date();
  let response = null;
  let error = null;

  try {
    response = await axiosCall();
    return response;
  } catch (err) {
    error = err;
    throw err;
  } finally {
    const respondedAt = new Date();

    // Log asynchronously - don't block the main flow
    logApiRequest({
      service,
      endpoint: endpoint || 'unknown',
      method,
      requestedAt,
      respondedAt,
      statusCode: response?.status || error?.response?.status || null,
      success: !error && response?.status >= 200 && response?.status < 300,
      errorMessage: error?.message,
      requestSummary,
      responseSummary: response && getResponseSummary ? getResponseSummary(response) : null,
      proxyUsed
    }).catch(() => {}); // Silently ignore logging errors
  }
};

module.exports = {
  SERVICES,
  logApiRequest,
  withLogging,
  getServiceId
};
