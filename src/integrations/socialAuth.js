const axios = require('axios');

/**
 * Mirrors Socialite::driver($provider)->userFromToken($token) — verifies a
 * client-supplied access_token directly against the provider, returns
 * { id, name, email }. Throws on an invalid/expired token.
 */
async function verifySocialToken(provider, accessToken) {
  if (provider === 'google') {
    const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { id: data.sub, name: data.name, email: data.email };
  }

  if (provider === 'facebook') {
    const { data } = await axios.get('https://graph.facebook.com/me', {
      params: { fields: 'id,name,email', access_token: accessToken },
    });
    return { id: data.id, name: data.name, email: data.email };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

module.exports = { verifySocialToken };
