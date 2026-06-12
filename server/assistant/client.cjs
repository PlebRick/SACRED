// Anthropic client factory for the in-app assistant and enrichment pipeline.
// The whole AI feature set degrades gracefully when no API key is configured.
const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-opus-4-8';

let cachedClient = null;

const isAvailable = () => !!process.env.ANTHROPIC_API_KEY;

const getClient = () => {
  if (!isAvailable()) return null;
  if (!cachedClient) {
    cachedClient = new Anthropic();
  }
  return cachedClient;
};

const getModel = () => process.env.SACRED_AI_MODEL || DEFAULT_MODEL;

module.exports = { isAvailable, getClient, getModel };
