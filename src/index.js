require('regenerator-runtime/runtime'); // Thanks Parcel

const qs = require('qs');
const SpotifyWebApi = require('spotify-web-api-node');
const auth = require('./auth');
const { smart } = require('./config');

const allUserPlaylists = async api => {
    const data = [];
    let offset = 0;

    while (true) {
        const res = await api.getUserPlaylists(undefined, { offset });
        data.push(...res.body.items);
        if (res.body.next) offset += res.body.limit;
        else break;
    }

    return data;
};

const allPlaylistTracks = async (api, playlist) => {
    const data = [];
    let offset = 0;

    while (true) {
        const res = await api.getPlaylistTracks(playlist, { offset });
        data.push(...res.body.items);
        if (res.body.next) offset += res.body.limit;
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
    const rawQuery = window.location.hash && window.location.hash.slice(1);
    const query = qs.parse(rawQuery);

    // If no access token present, auth
    if (!query || !query.access_token) return window.location.href = auth();

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
    spotifyApi.setAccessToken(query.access_token);

    // Get all playlists
    log('📥 Fetching all playlists...');
    const playlists = await allUserPlaylists(spotifyApi);

    // Hydrate the playlists data
    for (const smartData of smart) {
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
            const newPlaylist = await spotifyApi.createPlaylist(smartData.playlist, { public: true });
            smartData.spotify.smart.playlist = newPlaylist.body;
        }

        // Get the tracks in the automated playlist
        log(`📥 Fetching existing tracks for playlist ${smartData.playlist}...`);
        const smartTracks = await allPlaylistTracks(spotifyApi, smartData.spotify.smart.playlist.id);
        smartData.spotify.smart.tracks = new Set(smartTracks.map(track => track.track.uri));

        // Get the tracks in each source playlist
        for (const smartSource of smartData.spotify.sources) {
            log(`📥 Fetching source tracks from ${smartSource.playlist.name} for playlist ${smartData.playlist}...`);
            const sourceTracks = await allPlaylistTracks(spotifyApi, smartSource.playlist.id);
            smartSource.tracks = new Set(sourceTracks.map(track => track.track.uri));
        }
    }

    // Update the playlists
    for (const smartData of smart) {
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
        await spotifyApi.changePlaylistDetails(
            smartData.spotify.smart.playlist.id,
            { description: `Automated playlist. Last updated ${(new Date()).toISOString()}` },
        );

        // Done
        log(`📤 ${smartData.playlist} updated, now has ${(smartData.spotify.smart.tracks.size + toAdd.size - toRemove.size).toLocaleString()} tracks (added ${toAdd.size.toLocaleString()} tracks, removed ${toRemove.size.toLocaleString()} tracks)`);
    }

    // Done
    log('📦 Completed');
};

main().then();

