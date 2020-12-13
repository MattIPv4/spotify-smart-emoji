const qs = require('qs');
const { clientId, scopes } = require('./config');

module.exports = () => {
    const query = qs.stringify({
        client_id: clientId,
        response_type: 'token',
        redirect_uri: window.location.origin,
        scope: scopes.join(' '),
    });

    return `https://accounts.spotify.com/authorize?${query}`;
};
