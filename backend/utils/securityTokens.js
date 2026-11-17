'use strict';

const crypto = require('crypto');

const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

const generateOpaqueToken = () => crypto.randomBytes(32).toString('base64url');

const hashOpaqueToken = (token) => (
    crypto.createHash('sha256').update(token, 'utf8').digest('hex')
);

const isOpaqueToken = (value) => (
    typeof value === 'string' && OPAQUE_TOKEN_PATTERN.test(value)
);

module.exports = {
    generateOpaqueToken,
    hashOpaqueToken,
    isOpaqueToken
};
