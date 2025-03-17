import SpotifyWebApi from 'spotify-web-api-js';

export const getApi = (token: string) => {
    const spotifyApi = new SpotifyWebApi();
    spotifyApi.setAccessToken(token);
    return spotifyApi;
};

export const allUserPlaylists = async (api: SpotifyWebApi.SpotifyWebApiJs, user: SpotifyApi.CurrentUsersProfileResponse) => {
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

export const allPlaylistTracks = async (api: SpotifyWebApi.SpotifyWebApiJs, playlist: string) => {
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

export const allAlbumTracks = async (api: SpotifyWebApi.SpotifyWebApiJs, album: string) => {
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

export const addAllTracks = async (api: SpotifyWebApi.SpotifyWebApiJs, playlist: string, tracks: string[]) => {
    const remainingTracks = [ ...tracks ];

    while (remainingTracks.length) {
        const addTracks = remainingTracks.splice(0, 100);
        await api.addTracksToPlaylist(playlist, addTracks);
    }
};

export const removeAllTracks = async (api: SpotifyWebApi.SpotifyWebApiJs, playlist: string, tracks: string[]) => {
    const remainingTracks = [ ...tracks ];

    while (remainingTracks.length) {
        const removeTracks = remainingTracks.splice(0, 100);
        await api.removeTracksFromPlaylist(playlist, removeTracks);
    }
};
