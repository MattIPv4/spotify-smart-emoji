import config from './config.js';

export default () => {
    const query = new URL('https://accounts.spotify.com/authorize');
    query.searchParams.set('client_id', config.clientId);
    query.searchParams.set('response_type', 'token');
    query.searchParams.set('redirect_uri', window.location.href.replace(/\/$/, ''));
    query.searchParams.set('scope', config.scopes.join(' '));
    return query.href;
};
