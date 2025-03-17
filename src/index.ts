import SpotifyWebApi from 'spotify-web-api-js';
import auth from './auth.ts';
import config, { type SmartPlaylist } from './config.ts';

interface SmartPlaylistHydrated extends SmartPlaylist {
    spotify: {
        sources: string[];
        smart: string;
    };
}

interface PlaylistWithTracks extends Omit<SpotifyApi.PlaylistObjectSimplified, 'tracks'> {
    tracks?: (SpotifyApi.TrackObjectFull | SpotifyApi.TrackObjectSimplified)[];
}

interface Action {
    emoji: string;
    color: [number, number, number];
}

const actions = {
    connection: {
        emoji: '📦',
        color: [ 172, 146, 236 ], // Purple
    },
    download: {
        emoji: '📥',
        color: [ 255, 206, 84 ], // Yellow
    },
    upload: {
        emoji: '📤',
        color: [ 160, 212, 104 ], // Green
    },
    cache: {
        emoji: '📂',
        color: [ 93, 156, 236 ], // Blue
    },
    new: {
        emoji: '🆕',
        color: [ 236, 135, 192 ], // Pink
    },
    add: {
        emoji: '✅',
        color: [ 72, 207, 173 ], // Mint
    },
    remove: {
        emoji: '❌',
        color: [ 237, 85, 101 ], // Red
    },
    skip: {
        emoji: '⏩️',
        color: [ 67, 74, 84 ], // Grey
    },
} as const satisfies Record<string, Action>;

const allUserPlaylists = async (api: SpotifyWebApi.SpotifyWebApiJs, user: SpotifyApi.CurrentUsersProfileResponse) => {
    const data: SpotifyApi.PlaylistObjectSimplified[] = [];
    let offset = 0;

    while (true) {
        const res = await api.getUserPlaylists(user.id, { offset, limit: 50 });
        data.push(...res.items);
        if (res.next) offset += res.items.length;
        else break;
    }

    return data;
};

const allPlaylistTracks = async (api: SpotifyWebApi.SpotifyWebApiJs, playlist: string) => {
    const data: SpotifyApi.TrackObjectFull[] = [];
    let offset = 0;

    while (true) {
        const res = await api.getPlaylistTracks(playlist, { offset, limit: 50 });
        data.push(...res.items.map(item => item.track).filter((item): item is SpotifyApi.TrackObjectFull => item.type === 'track'))
        if (res.next) offset += res.items.length;
        else break;
    }

    return data;
};

const allAlbumTracks = async (api: SpotifyWebApi.SpotifyWebApiJs, album: string) => {
    const data: SpotifyApi.TrackObjectSimplified[] = [];
    let offset = 0;

    while (true) {
        const res = await api.getAlbumTracks(album, { offset, limit: 50 });
        data.push(...res.items);
        if (res.next) offset += res.items.length;
        else break;
    }

    return data;
};

const addAllTracks = async (api: SpotifyWebApi.SpotifyWebApiJs, playlist: string, tracks: string[]) => {
    const remainingTracks = [ ...tracks ];

    while (remainingTracks.length) {
        const addTracks = remainingTracks.splice(0, 100);
        await api.addTracksToPlaylist(playlist, addTracks);
    }
};

const removeAllTracks = async (api: SpotifyWebApi.SpotifyWebApiJs, playlist: string, tracks: string[]) => {
    const remainingTracks = [ ...tracks ];

    while (remainingTracks.length) {
        const removeTracks = remainingTracks.splice(0, 100);
        await api.removeTracksFromPlaylist(playlist, removeTracks);
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

    // Create output helper
    const log = (action: Action, msg: string) => {
        const div = document.createElement('div');
        div.style.backgroundColor = `rgba(${action.color.join(', ')}, 0.4)`;
        div.textContent = `${action.emoji} ${msg}`;
        output.appendChild(div);
        document.body.scrollTop = document.body.scrollHeight;
    };

    // Create API client
    log(actions.connection, 'Connecting to Spotify...');
    const spotifyApi = new SpotifyWebApi();
    spotifyApi.setAccessToken(query.get('access_token'));

    // Get user info
    const spotifyUser = await spotifyApi.getMe();

    // Get all playlists
    log(actions.download, 'Fetching all playlists...');
    const playlists = new Map<string, PlaylistWithTracks>((await allUserPlaylists(spotifyApi, spotifyUser)).map(playlist => [ playlist.id, { ...playlist, tracks: undefined } ]));

    // Track all the playlists that are sources for smart playlists
    const sources = new Set<string>();

    // Hydrate the playlists data
    const smartPlaylists: SmartPlaylistHydrated[] = [];
    for (const smartData of config.smart) {
        // Build the initial spotify data
        const spotifyData = {
            // Array of playlist IDs that are sources for this smart playlist
            sources: [ ...playlists.values() ].filter(playlist => {
                if (playlist.name === smartData.playlist) return false;

                if (Array.isArray(smartData.emoji))
                    return smartData.emoji.some(emoji => playlist.name.startsWith(`${emoji} `));

                return playlist.name.startsWith(`${smartData.emoji} `);
            }).map(playlist => playlist.id),
            // ID of this smart playlist
            smart: [ ...playlists.values() ].find(playlist => playlist.name === smartData.playlist)?.id,
        };

        // Store all the source playlists, so we can do album syncing
        spotifyData.sources.forEach(source => sources.add(source));

        // Create the smart playlist if needed
        if (!spotifyData.smart) {
            log(actions.new, `Creating playlist ${smartData.playlist}...`);
            const playlist = await spotifyApi.createPlaylist(spotifyUser.id, { name: smartData.playlist, public: true });
            playlists.set(playlist.id, { ...playlist, tracks: undefined });
            spotifyData.smart = playlist.id;
        }

        // Get the tracks in the automated playlist
        const playlist = playlists.get(spotifyData.smart)!;
        if (playlist.tracks) {
            log(actions.cache, `Using cached existing tracks for playlist ${smartData.playlist}...`);
        } else {
            log(actions.download, `Fetching existing tracks for playlist ${smartData.playlist}...`);
            playlist.tracks = await allPlaylistTracks(spotifyApi, spotifyData.smart);
        }

        // Get the tracks in each source playlist
        for (const smartSource of spotifyData.sources) {
            const sourcePlaylist = playlists.get(smartSource)!;
            if (sourcePlaylist.tracks) {
                log(actions.cache, `Using cached source tracks from ${sourcePlaylist.name} for playlist ${smartData.playlist}...`);
            } else {
                log(actions.download, `Fetching source tracks from ${sourcePlaylist.name} for playlist ${smartData.playlist}...`);
                sourcePlaylist.tracks = await allPlaylistTracks(spotifyApi, smartSource);
            }
        }

        // Store the hydrated data (cast type as TS can't tell we set the id if its undefined)
        smartPlaylists.push({ ...smartData, spotify: spotifyData as SmartPlaylistHydrated['spotify'] });
    }

    // Update the source playlists
    if (config.sync) {
        const albums = new Map<string, SpotifyApi.TrackObjectSimplified[]>();
        for (const playlistId of sources) {
            const playlist = playlists.get(playlistId);
            if (!playlist || !playlist.tracks) {
                log(actions.skip, `Skipping album sync for playlist ${playlist?.name || playlistId}... no tracks`);
                continue;
            }

            // If the playlist should be ignored, skip
            if (config.sync.ignore.includes(playlist.name)) {
                log(actions.skip, `Skipping album sync for playlist ${playlist.name}... ignored in config`);
                continue;
            }

            // If the album for all the tracks isn't the same, skip
            const album = 'album' in playlist.tracks[0] && playlist.tracks[0].album;
            if (!album || playlist.tracks.some(track => !('album' in track) || track.album.id !== album.id)) {
                log(actions.skip, `Skipping album sync for playlist ${playlist.name}... contains multiple albums`);
                continue;
            }

            // Get the tracks on the album
            let albumTracks = albums.get(album.id);
            if (albumTracks) {
                log(actions.cache, `Using cached album tracks from ${album.name} for playlist ${playlist.name}...`);
            } else {
                log(actions.download, `Fetching album tracks from ${album.name} for playlist ${playlist.name}...`);
                albumTracks = await allAlbumTracks(spotifyApi, album.id);
                albums.set(album.id, albumTracks);
            }

            // Track if we made any changes
            let changed = false;

            // Get the tracks to add and remove
            const albumTrackUris = new Set(albumTracks.map(track => track.uri));
            const playlistTrackUris = new Set(playlist.tracks.map(track => track.uri) ?? []);
            const toAdd = albumTracks.filter(track => !playlistTrackUris.has(track.uri));
            const toRemove = playlist.tracks.filter(track => !albumTrackUris.has(track.uri)) ?? [];

            // Update the playlist if needed
            if (toAdd.length || toRemove.length) {
                // Add the tracks
                if (toAdd.length) {
                    log(actions.add, `Adding new tracks for playlist ${playlist.name}...`);
                    await addAllTracks(spotifyApi, playlistId, [ ...new Set(toAdd.map(track => track.uri)) ]);
                }

                // Remove the tracks
                if (toRemove.length) {
                    log(actions.remove, `Removing old tracks from playlist ${playlist.name}...`);
                    await removeAllTracks(spotifyApi, playlistId, [ ...new Set(toRemove.map(track => track.uri)) ]);
                }

                // Ensure the playlist cache has the correct tracks
                playlist.tracks = [
                    ...playlist.tracks?.filter(track => !toRemove.some(toRemoveTrack => toRemoveTrack.uri === track.uri)) ?? [],
                    ...toAdd,
                ];

                // Done
                log(actions.upload, `${playlist.name} updated, now has ${(playlist.tracks.length + toAdd.length - toRemove.length).toLocaleString()} tracks (added ${toAdd.length.toLocaleString()} tracks, removed ${toRemove.length.toLocaleString()} tracks)`);
                changed = true;
            }

            // Ensure the playlists are in the correct order
            const expectedOrder = [ ...albumTrackUris ];
            if (expectedOrder.some((uri, i) => playlist.tracks?.[i]?.uri !== uri)) {
                for (let i = 0; i < expectedOrder.length; i++) {
                    if (playlist.tracks[i].uri === expectedOrder[i]) continue;

                    // Get the current position of this track
                    const current = playlist.tracks.findIndex(track => track.uri === expectedOrder[i]);

                    // Move this track to the correct position
                    await spotifyApi.reorderTracksInPlaylist(playlistId, current, i, { range_length: 1 });

                    // Update the cache
                    playlist.tracks = [
                        ...playlist.tracks.slice(0, i),
                        playlist.tracks[current],
                        ...playlist.tracks.slice(i, current),
                        ...playlist.tracks.slice(current + 1),
                    ];
                }

                // Done
                log(actions.upload, `${playlist.name} reordered`);
                changed = true;
            }

            // If we didn't make any changes, log it
            if (!changed) {
                log(actions.skip, `Skipping album sync for playlist ${playlist.name}... in sync`);
            }
        }
    }

    // Update the smart playlists
    for (const smartData of smartPlaylists) {
        const playlist = playlists.get(smartData.spotify.smart);
        if (!playlist || !playlist.tracks) {
            log(actions.skip, `Skipping smart playlist sync for playlist ${smartData.playlist}... no tracks`);
            continue;
        }

        // Get all the tracks that should be in the smart playlist
        const allSourceTracks = new Set<string>();
        smartData.spotify.sources.forEach(source => playlists.get(source)?.tracks?.forEach(track => allSourceTracks.add(track.uri)));

        // Get the tracks to add and remove
        const currentTracks = new Set(playlist.tracks.map(track => track.uri));
        const toAdd = new Set([ ...allSourceTracks ].filter(track => !currentTracks.has(track)));
        const toRemove = new Set([ ...currentTracks ].filter(track => !allSourceTracks.has(track)));

        if (toAdd.size || toRemove.size) {
            // Add the tracks
            if (toAdd.size) {
                log(actions.add, `Adding new tracks for playlist ${playlist.name}...`);
                await addAllTracks(spotifyApi, smartData.spotify.smart, [...toAdd]);
            }

            // Remove the tracks
            if (toRemove.size) {
                log(actions.remove, `Removing old tracks for playlist ${playlist.name}...`);
                await removeAllTracks(spotifyApi, smartData.spotify.smart, [...toRemove]);
            }

            // Update the playlist
            log(actions.upload, `Updating description for playlist ${playlist.name}...`);
            const emojiList = Array.isArray(smartData.emoji)
                ? smartData.emoji.length === 1
                    ? smartData.emoji[0]
                    : `${smartData.emoji.slice(0, -1).join(', ')} or ${smartData.emoji.slice(-1)[0]}`
                : smartData.emoji;
            await spotifyApi.changePlaylistDetails(
                smartData.spotify.smart,
                {
                    description: [
                        smartData.description,
                        `Automatically generated from playlists starting with ${emojiList}.`,
                        `Last updated ${(new Date()).toISOString()}`,
                    ].filter(Boolean).join(' ')
                },
            );

            // Done
            log(actions.upload, `${playlist.name} updated, now has ${(playlist.tracks.length + toAdd.size - toRemove.size).toLocaleString()} tracks (added ${toAdd.size.toLocaleString()} tracks, removed ${toRemove.size.toLocaleString()} tracks)`);
        } else {
            // Done
            log(actions.skip, `Skipping smart playlist sync for playlist ${playlist.name}... in sync`);
        }
    }

    // Done
    log(actions.connection, 'Completed');
};

main().then();
