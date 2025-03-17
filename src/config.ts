export interface SmartPlaylist {
    playlist: string;
    description?: string;
    emoji: string | string[];
}

interface SmartConfig {
    clientId: string;
    scopes: string[];
    smart: SmartPlaylist[];
    sync?: {
        ignore: string[];
    };
}

const config: SmartConfig = {
    clientId: '220a2f9321f04d0ba2633276c1c18de0',
    scopes: [
        'playlist-modify-public',
        'playlist-modify-private',
        'playlist-read-private',
    ],
    smart: [
        {
            playlist: '🎭 Musicals',
            description: 'Mega-collection of tracks from all the musicals (ish).',
            emoji: '🎭',
        },
        {
            playlist: '💫 Disney',
            description: 'Mega-collection of all things Disney (movies, shows, parks, etc.).',
            emoji: ['💫', '🪄', '🧚', '🏰', '🎬'],
        },
        {
            playlist: '🧚 Disney Shows & Parades',
            description: 'Tracks used in Disney shows and parades at the parks.',
            emoji: '🧚',
        },
        {
            playlist: '🏰 Disney Parks & Sounds',
            description: 'Tracks heard around the Disney parks (or relating to the parks).',
            emoji: '🏰',
        },
        {
            playlist: '🎬 HSMTMTS',
            description: 'Soundtracks from Disney+ High School Musical: The Musical: The Series',
            emoji: '🎬',
        },
        {
            playlist: '🤐 Depresso Espresso',
            emoji: ['🤐', '🛰', '🍬', '🌹', '☠️', '🦅'],
        },
        {
            playlist: '🍬 Olivia Rodrigo',
            emoji: '🍬',
        },
        {
            playlist: '🌹 Emma Blackery',
            emoji: '🌹',
        },
        {
            playlist: '☠️ MCR',
            emoji: '☠️',
        },
        {
            playlist: '🦅 TØP',
            emoji: '🦅',
        },
        {
            playlist: '🎙 Twitch',
            description: 'Mega-collection of songs from the Twitch world.',
            emoji: '🎙',
        },
        {
            playlist: '🎄 Christmas',
            emoji: ['🎄', '🔨'],
        },
    ],
    sync: {
        ignore: [
            '🎙 ERA',
            '🎙 Mitch Jones',
            '🎙 Sordiway',
        ],
    },
};

export default config;
