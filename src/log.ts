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

export default (parent: HTMLElement) => {
    // Create HTML output
    const wrapper = document.createElement('pre');
    const output = document.createElement('code');
    wrapper.appendChild(output);
    parent.appendChild(wrapper);

    // Create output helper
    const log = (action: Action, msg: string) => {
        const div = document.createElement('div');
        div.style.backgroundColor = `rgba(${action.color.join(', ')}, 0.4)`;
        div.textContent = `${action.emoji} ${msg}`;
        output.appendChild(div);
        parent.scrollTop = parent.scrollHeight;
    };

    return Object.keys(actions).reduce((acc, key) => {
        acc[key] = (msg: string) => log(actions[key], msg);
        return acc;
    }, {} as Record<keyof typeof actions, (msg: string) => void>);
};
