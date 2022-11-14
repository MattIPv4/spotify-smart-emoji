import SpotifyWebApi from 'spotify-web-api-js';
import auth from './auth.js';
import config from './config.js';

const allUserPlaylists = async (api, user) => {
    const data = [];
    let offset = 0;

    while (true) {
        const res = await api.getUserPlaylists(user.id, { offset, limit: 50 });
        data.push(...res.items);
        if (res.next) offset += res.items.length;
        else break;
    }

    return data;
};

const allPlaylistTracks = async (api, playlist) => {
    const data = [];
    let offset = 0;

    while (true) {
        const res = await api.getPlaylistTracks(playlist, { offset, limit: 50 });
        data.push(...res.items);
        if (res.next) offset += res.items.length;
        else break;
    }

    return data;
};

const addAllTracks = async (api, playlist, tracks) => {
    const remainingTracks = [...tracks];

    while (remainingTracks.length) {
        const addTracks = remainingTracks.splice(0, 100);
        await api.addTracksToPlaylist(playlist, addTracks);
    }
};

const main = async () => {
    const query = new URLSearchParams(window.location.hash.slice(1));

    // If no access token present, auth
    if (!query.has('access_token')) return window.location.href = auth();

    // Create HTML output
    const wrapper = document.createElement('pre');
    const output = document.createElement('code');
    wrapper.appendChild(output);
    document.body.appendChild(wrapper);
    output.textContent = '📦 Connecting to Spotify...';

    // Create output helper
    const log = msg => {
        output.textContent += `\n${msg}`;
        document.body.scrollTop = document.body.scrollHeight;
    };

    // Create API client
    const spotifyApi = new SpotifyWebApi();
    spotifyApi.setAccessToken(query.get('access_token'));

    // Get user info
    const spotifyUser = await spotifyApi.getMe();

    // Get all playlists
    log('📥 Fetching all playlists...');
    const playlists = await allUserPlaylists(spotifyApi, spotifyUser);

    // Create a global cache of playlist tracks
    const tracksCache = new Map();

    // Hydrate the playlists data
    for (const smartData of config.smart) {
        // Build the initial spotify data
        smartData.spotify = {
            sources: playlists.filter(playlist => {
                if (playlist.name === smartData.playlist) return false;

                if (Array.isArray(smartData.emoji))
                    return smartData.emoji.some(emoji => playlist.name.startsWith(`${emoji} `));

                return playlist.name.startsWith(`${smartData.emoji} `);
            }).map(playlist => ({ playlist })),
            smart: {
                playlist: playlists.find(playlist => playlist.name === smartData.playlist),
            },
        };

        // Create the smart playlist if needed
        if (!smartData.spotify.smart.playlist) {
            log(`🆕 Creating playlist ${smartData.playlist}...`);
            smartData.spotify.smart.playlist = await spotifyApi.createPlaylist(spotifyUser.id, { name: smartData.playlist, public: true });
        }

        // Get the tracks in the automated playlist
        if (tracksCache.has(smartData.spotify.smart.playlist.id)) {
            log(`📥 Using cached existing tracks for playlist ${smartData.playlist}...`);
            smartData.spotify.smart.tracks = tracksCache.get(smartData.spotify.smart.playlist.id);
        } else {
            log(`📥 Fetching existing tracks for playlist ${smartData.playlist}...`);
            const smartTracks = await allPlaylistTracks(spotifyApi, smartData.spotify.smart.playlist.id);
            smartData.spotify.smart.tracks = new Set(smartTracks.map(track => track.track.uri));
            tracksCache.set(smartData.spotify.smart.playlist.id, smartData.spotify.smart.tracks);
        }

        // Get the tracks in each source playlist
        for (const smartSource of smartData.spotify.sources) {
            if (tracksCache.has(smartSource.playlist.id)) {
                log(`📥 Using cached source tracks from ${smartSource.playlist.name} for playlist ${smartData.playlist}...`);
                smartSource.tracks = tracksCache.get(smartSource.playlist.id);
            } else {
                log(`📥 Fetching source tracks from ${smartSource.playlist.name} for playlist ${smartData.playlist}...`);
                const sourceTracks = await allPlaylistTracks(spotifyApi, smartSource.playlist.id);
                smartSource.tracks = new Set(sourceTracks.map(track => track.track.uri));
                tracksCache.set(smartSource.playlist.id, smartSource.tracks);
            }
        }
    }

    // Update the playlists
    for (const smartData of config.smart) {
        // Establish which tracks to add and remove
        const allSourceTracks = new Set();
        smartData.spotify.sources.forEach(source => source.tracks.forEach(track => allSourceTracks.add(track)));
        const toAdd = new Set([...allSourceTracks].filter(track => !smartData.spotify.smart.tracks.has(track)));
        const toRemove = new Set([...smartData.spotify.smart.tracks].filter(track => !allSourceTracks.has(track)));

        // Add the tracks
        if (toAdd.size) {
            log(`✅ Adding new tracks for playlist ${smartData.playlist}...`);
            await addAllTracks(spotifyApi, smartData.spotify.smart.playlist.id, [...toAdd]);
        }

        // Remove the tracks
        if (toRemove.size) {
            log(`⛔️ Removing old tracks for playlist ${smartData.playlist}...`);
            await spotifyApi.removeTracksFromPlaylist(
                smartData.spotify.smart.playlist.id,
                [...toRemove].map(uri => ({ uri })),
            );
        }

        // Update the playlist
        log(`📤 Updating description for playlist ${smartData.playlist}...`);
        const emojiList = Array.isArray(smartData.emoji)
            ? smartData.emoji.length === 1
                ? smartData.emoji[0]
                : `${smartData.emoji.slice(0, -1).join(', ')} or ${smartData.emoji.slice(-1)[0]}`
            : smartData.emoji;
        await spotifyApi.changePlaylistDetails(
            smartData.spotify.smart.playlist.id,
            { description: [
                smartData.description,
                `Automatically generated from playlists starting with ${emojiList}.`,
                `Last updated ${(new Date()).toISOString()}`,
            ].filter(Boolean).join(' ') },
        );

        // Done
        log(`📤 ${smartData.playlist} updated, now has ${(smartData.spotify.smart.tracks.size + toAdd.size - toRemove.size).toLocaleString()} tracks (added ${toAdd.size.toLocaleString()} tracks, removed ${toRemove.size.toLocaleString()} tracks)`);
    }

    // Done
    log('📦 Completed');
};

main().then();

