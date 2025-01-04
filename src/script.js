const API_BASE = '/api/v1';

/**
 * A generic wrapper for making API requests with consistent error handling.
 * @param {string} endpoint - The API endpoint to call.
 * @param {object} options - Additional fetch options like method, headers, and body.
 * @returns {Promise<any>} - The JSON-parsed response from the API.
 */
async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        throw error;
    }
}

// Caching playlists to avoid redundant network requests.
let cachedPlaylists = null;

/**
 * Fetches the list of available playlists from the API and populates the dropdown.
 * @param {boolean} refresh - If true, forces fetching from the server instead of using cache.
 */
async function fetchPlaylists(refresh = false) {
    const playlistSelect = document.getElementById('playlistSelect');
    if (!refresh && cachedPlaylists) {
        populatePlaylists(cachedPlaylists);
        return;
    }
    try {
        const playlists = await apiFetch('/listplaylists');
        cachedPlaylists = playlists;
        populatePlaylists(playlists);
    } catch {
        playlistSelect.innerHTML = '<option>Error Loading Playlists</option>';
    }
}

/**
 * Populates the playlist dropdown with the provided playlist names.
 * @param {string[]} playlists - Array of playlist names.
 */
function populatePlaylists(playlists) {
    const playlistSelect = document.getElementById('playlistSelect');
    playlistSelect.innerHTML = playlists
        .map(name => `<option value="${name}">${name}</option>`)
        .join('');
}

/**
 * Plays the selected playlist using the Volumio API.
 */
async function playPlaylist() {
    const playlist = document.getElementById('playlistSelect').value;
    if (!playlist) {
        console.warn('No playlist selected.');
        return;
    }
    try {
        console.log(`Playing playlist: ${playlist}`);
        await apiFetch(`/commands/?cmd=playplaylist&name=${encodeURIComponent(playlist)}`);
        fetchQueue(); // Refresh queue after playing.
    } catch (error) {
        console.error(`Error playing playlist "${playlist}":`, error);
    }
}

/**
 * Fetches the available music sources from the API and populates the dropdown.
 */
async function fetchSources() {
    const sourceSelect = document.getElementById('sourceSelect');
    try {
        const data = await apiFetch('/browse');
        sourceSelect.innerHTML = data.navigation.lists
            .map(source => `<option value="${source.uri}">${source.name}</option>`)
            .join('');
    } catch (error) {
        console.error('Error fetching sources:', error);
        sourceSelect.innerHTML = '<option>Error Loading Sources</option>';
    }
}

/**
 * Browses the selected music source and displays its contents.
 */
async function browseSource() {
    const source = document.getElementById('sourceSelect').value;
    if (!source) {
        console.warn('No source selected.');
        return;
    }
    try {
        console.log(`Browsing source: ${source}`);
        const data = await apiFetch(`/browse?uri=${encodeURIComponent(source)}`);
        renderBrowseResults(data.navigation.lists);
    } catch (error) {
        console.error('Error browsing source:', error);
        document.getElementById('browseResults').innerHTML = '<p>Error Browsing Source</p>';
    }
}

/**
 * Renders the results of browsing a music source dynamically in the UI.
 * @param {Array} lists - Array of music source contents.
 */
function renderBrowseResults(lists) {
    const browseSection = document.getElementById('browseResults');
    browseSection.innerHTML = '';

    if (!lists || lists.length === 0) {
        browseSection.innerHTML = '<p>No results found.</p>';
        return;
    }

    lists.forEach(list => {
        const section = document.createElement('div');
        const itemsHTML = list.items
            ? list.items
                  .map(item => {
                      const name = item.name || item.title || 'Unnamed Item';
                      const uri = item.uri
                          ? `<button onclick="addToQueueAndPlay('${item.uri}', '${name}')">Play</button>
                             <button onclick="navigateSource('${item.uri}')">Browse</button>`
                          : name;
                      return `<li>${uri} - ${name}</li>`;
                  })
                  .join('')
            : '<li>No items available</li>';

        section.innerHTML = `<h3>${list.title || 'Results'}</h3><ul>${itemsHTML}</ul>`;
        browseSection.appendChild(section);
    });
}

/**
 * Navigates deeper into a music source hierarchy and displays its contents.
 * @param {string} uri - URI of the music source to navigate into.
 */
async function navigateSource(uri) {
    if (!uri) {
        console.warn('Invalid URI for navigation.');
        return;
    }
    try {
        console.log(`Navigating source: ${uri}`);
        const data = await apiFetch(`/browse?uri=${encodeURIComponent(uri)}`);
        renderBrowseResults(data.navigation.lists);
    } catch (error) {
        console.error('Error navigating source:', error);
    }
}

/**
 * Adds an item to the playback queue and starts playing it.
 * @param {string} uri - URI of the item to add.
 * @param {string} title - Title of the item to add.
 */
async function addToQueueAndPlay(uri, title = 'Unknown Item') {
    const payload = [
        {
            uri: uri,
            service: uri.startsWith('http') ? 'webradio' : 'mpd',
            type: uri.startsWith('http') ? 'webradio' : 'song',
            title: title
        }
    ];
    try {
        console.log(`Adding to queue: ${uri}`);
        const result = await apiFetch('/replaceAndPlay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: payload, index: 0 })
        });
        if (result.response !== 'success') {
            console.error('Failed to add to queue and play:', result);
        }
        fetchVolumioState(); // Refresh state after playing.
    } catch (error) {
        console.error('Error adding to queue and playing:', error);
    }
}

/**
 * Fetches the current playback state and updates the UI accordingly.
 */
async function fetchVolumioState() {
    try {
        const state = await apiFetch('/getState');
        document.getElementById('title').innerText = state.title || 'No Track Playing';
        document.getElementById('artist').innerText = state.artist || '';
        const albumArt = state.albumart || 'default-album-art.jpg';
        document.getElementById('albumart').src = albumArt.startsWith('http') ? albumArt : `http://${location.host}${albumArt}`;
        updatePlaybackControls(state.status);
    } catch (error) {
        console.error('Error fetching Volumio state:', error);
    }
}

/**
 * Updates the playback controls (e.g., play/pause icon) based on the playback status.
 * @param {string} status - Current playback status (e.g., 'play', 'pause').
 */
function updatePlaybackControls(status) {
    const playPauseIcon = document.getElementById('playPauseIcon');
    if (status === 'play') {
        playPauseIcon.innerText = 'pause';
    } else {
        playPauseIcon.innerText = 'play_arrow';
    }
}

/**
 * Sends a playback command (e.g., play, pause, stop) to the API.
 * @param {string} command - The playback command to send.
 */
async function sendCommand(command) {
    try {
        console.log(`Sending command: ${command}`);
        await apiFetch(`/commands/?cmd=${command}`);
        fetchVolumioState(); // Refresh state after command.
    } catch (error) {
        console.error(`Error sending command "${command}":`, error);
    }
}

/**
 * Fetches the current playback queue and updates the UI.
 */
async function fetchQueue() {
    try {
        const data = await apiFetch('/getQueue');
        const queueList = document.getElementById('queueList');
        queueList.innerHTML = data.queue
            .map(track => `<li>${track.name || 'Unknown'} - ${track.artist || 'Unknown Artist'}</li>`)
            .join('');
    } catch (error) {
        console.error('Error fetching queue:', error);
    }
}

/**
 * Debounced volume setting to prevent excessive API calls.
 * @param {function} func - Function to debounce.
 * @param {number} delay - Delay in milliseconds.
 */
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

/**
 * Sets the playback volume using the API.
 * @param {number} value - The volume value to set (0-100).
 */
const setVolume = debounce(async (value) => {
    try {
        document.getElementById('volumeValue').innerText = value;
        await apiFetch(`/commands/?cmd=volume&volume=${value}`);
    } catch (error) {
        console.error('Error setting volume:', error);
    }
}, 300);

/**
 * Initializes the UI and starts periodic updates for playback state and queue.
 */
function initializeInterface() {
    fetchPlaylists();
    fetchSources();
    fetchVolumioState();
    setInterval(fetchQueue, 5000); // Refresh queue every 5 seconds.
    setInterval(fetchVolumioState, 5000); // Refresh playback state every 5 seconds.
}

window.onload = initializeInterface;
