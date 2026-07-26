'use strict';

function normalizeHttpsUrl(value, label = 'URL', options = {}) {
    const raw = String(value || '').trim();
    if (!raw) {
        if (options.allowEmpty) return '';
        throw new Error(`${label} is required.`);
    }

    let parsed;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error(`${label} must be a valid URL.`);
    }

    if (parsed.protocol !== 'https:') throw new Error(`${label} must use https.`);
    if (parsed.username || parsed.password) throw new Error(`${label} must not contain credentials.`);
    if (parsed.search || parsed.hash) throw new Error(`${label} must not contain a query string or fragment.`);
    if (parsed.port) throw new Error(`${label} must not contain a port.`);
    if (parsed.hostname.startsWith('www.')) parsed.hostname = parsed.hostname.slice(4);

    return parsed.href;
}

function normalizeSiteUrl(value, label = 'Published URL') {
    const href = normalizeHttpsUrl(value, label);
    const parsed = new URL(href);
    parsed.pathname = `/${parsed.pathname.split('/').filter(Boolean).join('/')}${parsed.pathname === '/' ? '' : '/'}`;
    const normalized = parsed.href;
    return {
        url: normalized,
        origin: parsed.origin,
        hostname: parsed.hostname,
        basePath: parsed.pathname
    };
}

function normalizeCustomDomain(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw.startsWith('www.')) throw new Error('deployment.custom_domain must use the bare domain without www.');
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(raw)) {
        throw new Error('deployment.custom_domain must be a hostname without a scheme, path, port, query, or fragment.');
    }
    return raw;
}

function normalizeSocialConfig(social = {}) {
    const supportedCards = new Set(['summary', 'summary_large_image']);
    const twitterCard = String(social.twitter_card || 'summary').trim();
    if (!supportedCards.has(twitterCard)) {
        throw new Error(`social.twitter_card must be one of: ${[...supportedCards].join(', ')}.`);
    }

    const twitterSite = String(social.twitter_site || '').trim();
    if (twitterSite && !/^@[A-Za-z0-9_]{1,15}$/.test(twitterSite)) {
        throw new Error('social.twitter_site must be an @handle containing up to 15 letters, numbers, or underscores.');
    }
    return { ...social, twitter_card: twitterCard, twitter_site: twitterSite };
}

module.exports = {
    normalizeCustomDomain,
    normalizeHttpsUrl,
    normalizeSiteUrl,
    normalizeSocialConfig
};
