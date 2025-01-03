const API_BASE = '/api/v1';

// Fetch playlists
async function fetchPlaylists() {
    const playlistSelect = document.getElementById('playlistSelect');
    try {
        const response = await fetch(`${API_BASE}/listplaylists`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const playlists = await response.json();
        playlistSelect.innerHTML = playlists.map(name => `<option value="${name}">${name}</option>`).join('');
    } catch (error) {
        console.error('Error fetching playlists:', error);
        playlistSelect.innerHTML = '<option>Error Loading Playlists</option>';
    }
}

// Play a selected playlist
async function playPlaylist() {
    const playlist = document.getElementById('playlistSelect').value;
    if (!playlist) {
        console.warn('No playlist selected.');
        return;
    }
    try {
        console.log(`Playing playlist: ${playlist}`);
        const response = await fetch(`${API_BASE}/commands/?cmd=playplaylist&name=${encodeURIComponent(playlist)}`);
        fetchQueue(); // Refresh queue after playing
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    } catch (error) {
        console.error(`Error playing playlist "${playlist}":`, error);
    }
}

// Fetch and browse sources
async function fetchSources() {
    const sourceSelect = document.getElementById('sourceSelect');
    try {
        const response = await fetch(`${API_BASE}/browse`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        sourceSelect.innerHTML = data.navigation.lists
            .map(source => `<option value="${source.uri}">${source.name}</option>`)
            .join('');
    } catch (error) {
        console.error('Error fetching sources:', error);
        sourceSelect.innerHTML = '<option>Error Loading Sources</option>';
    }
}

// Browse a selected source
async function browseSource() {
    const source = document.getElementById('sourceSelect').value;
    if (!source) {
        console.warn('No source selected.');
        return;
    }
    try {
        console.log(`Browsing source: ${source}`);
        const response = await fetch(`${API_BASE}/browse?uri=${encodeURIComponent(source)}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();

        if (data.navigation && data.navigation.lists) {
            renderBrowseResults(data.navigation.lists);
        } else {
            console.warn('Invalid response structure:', data);
            document.getElementById('browseResults').innerHTML = '<p>No results found.</p>';
        }
    } catch (error) {
        console.error('Error browsing source:', error);
        document.getElementById('browseResults').innerHTML = '<p>Error Browsing Source</p>';
    }
}

// Render browse results dynamically
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

// Navigate deeper into a source
async function navigateSource(uri) {
    if (!uri) {
        console.warn('Invalid URI for navigation.');
        return;
    }
    try {
        console.log(`Navigating source: ${uri}`);
        const response = await fetch(`${API_BASE}/browse?uri=${encodeURIComponent(uri)}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        renderBrowseResults(data.navigation.lists);
    } catch (error) {
        console.error('Error navigating source:', error);
    }
}

// Add an item to queue and play
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
        const response = await fetch(`${API_BASE}/replaceAndPlay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: payload, index: 0 })
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const result = await response.json();
        if (result.response !== 'success') {
            console.error('Failed to add to queue and play:', result);
        }
        fetchVolumioState(); // Refresh state after playing
    } catch (error) {
        console.error('Error adding to queue and playing:', error);
    }
}

// Fetch and display playback state
async function fetchVolumioState() {
    try {
        const response = await fetch(`${API_BASE}/getState`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const state = await response.json();

        // Update now-playing section
        document.getElementById('title').innerText = state.title || 'No Track Playing';
        document.getElementById('artist').innerText = state.artist || '';
        const albumArt = state.albumart || 'default-album-art.jpg';
        document.getElementById('albumart').src = albumArt.startsWith('http') ? albumArt : `http://${location.host}${albumArt}`;

        // Update play/pause button icon
        const playPauseIcon = document.getElementById('playPauseIcon');
        if (state.status === 'play') {
            playPauseIcon.innerText = 'pause';
        } else {
            playPauseIcon.innerText = 'play_arrow';
        }
    } catch (error) {
        console.error('Error fetching Volumio state:', error);
    }
}

// Send playback commands
async function sendCommand(command) {
    try {
        console.log(`Sending command: ${command}`);
        const response = await fetch(`${API_BASE}/commands/?cmd=${command}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        fetchVolumioState(); // Refresh state after command
    } catch (error) {
        console.error(`Error sending command "${command}":`, error);
    }
}

// Toggle play/stop for web radio and play/pause for local tracks
async function togglePlayPause() {
    try {
        const stateResponse = await fetch(`${API_BASE}/getState`);
        if (!stateResponse.ok) throw new Error(`HTTP error! Status: ${stateResponse.status}`);
        const state = await stateResponse.json();

        if (state.service === 'webradio') {
            if (state.status === 'play') {
                console.log('Stopping web radio');
                await sendCommand('stop');
            } else if (state.status === 'stop') {
                console.log('Starting web radio playback');
                if (state.uri) {
                    const payload = [
                        {
                            uri: state.uri,
                            service: 'webradio',
                            type: 'webradio',
                            title: state.title || 'Web Radio',
                        },
                    ];
                    await fetch(`${API_BASE}/replaceAndPlay`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ list: payload, index: 0 }),
                    });
                } else {
                    console.warn('No URI available to play web radio.');
                }
            }
        } else {
            // Handle local tracks (play/pause)
            if (state.status === 'play') {
                console.log('Pausing playback');
                await sendCommand('pause');
            } else {
                console.log('Resuming playback');
                await sendCommand('play');
            }
        }
    } catch (error) {
        console.error('Error toggling play/pause:', error);
    }
}

// Set playback volume
async function setVolume(value) {
    try {
        document.getElementById('volumeValue').innerText = value;
        const response = await fetch(`${API_BASE}/commands/?cmd=volume&volume=${value}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    } catch (error) {
        console.error('Error setting volume:', error);
    }
}

// Fetch and display the playback queue
async function fetchQueue() {
    try {
        const response = await fetch(`${API_BASE}/getQueue`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const queue = await response.json();
        const queueList = document.getElementById('queueList');
        queueList.innerHTML = queue.queue.map(
            track => `<li>${track.name || 'Unknown'} - ${track.artist || 'Unknown Artist'}</li>`
        ).join('');
    } catch (error) {
        console.error('Error fetching queue:', error);
    }
}

// Initialize the interface
function initializeInterface() {
    fetchPlaylists();
    fetchSources();
    fetchVolumioState();
    setInterval(fetchQueue, 5000); // Refresh queue every 5 seconds
    setInterval(fetchVolumioState, 5000); // Refresh playback state every 5 seconds
}

window.onload = initializeInterface;
