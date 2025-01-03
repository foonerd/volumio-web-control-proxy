const API_BASE = '/api/v1';

// Fetch playlists
async function fetchPlaylists() {
    const playlistSelect = document.getElementById('playlistSelect');
    try {
        const response = await fetch(`${API_BASE}/listplaylists`);
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
        await fetch(`${API_BASE}/commands/?cmd=playplaylist&name=${encodeURIComponent(playlist)}`);
        fetchQueue(); // Refresh queue after playing
    } catch (error) {
        console.error(`Error playing playlist "${playlist}":`, error);
    }
}

// Fetch and browse sources
async function fetchSources() {
    const sourceSelect = document.getElementById('sourceSelect');
    try {
        const response = await fetch(`${API_BASE}/browse`);
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
        const addResponse = await fetch(`${API_BASE}/replaceAndPlay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ list: payload, index: 0 })
        });
        const addResult = await addResponse.json();
        if (addResult.response !== 'success') {
            console.error('Failed to add to queue and play:', addResult);
        }
    } catch (error) {
        console.error('Error adding to queue and playing:', error);
    }
}

// Fetch and display the playback queue
async function fetchQueue() {
    try {
        const response = await fetch(`${API_BASE}/getQueue`);
        const queue = await response.json();
        const queueList = document.getElementById('queueList');
        queueList.innerHTML = queue.queue.map(
            track => `<li>${track.name || 'Unknown'} - ${track.artist || 'Unknown Artist'}</li>`
        ).join('');
    } catch (error) {
        console.error('Error fetching queue:', error);
    }
}

// Fetch and display playback state
async function fetchVolumioState() {
    try {
        const response = await fetch(`${API_BASE}/getState`);
        const state = await response.json();

        // Update now-playing section
        document.getElementById('title').innerText = state.title || 'No Track Playing';
        document.getElementById('artist').innerText = state.artist || '';
        const albumArt = state.albumart || 'default-album-art.jpg';
        document.getElementById('albumart').src = albumArt.startsWith('http') ? albumArt : `http://${location.host}${albumArt}`;
    } catch (error) {
        console.error('Error fetching Volumio state:', error);
    }
}

// Send playback commands
async function sendCommand(command) {
    try {
        console.log(`Sending command: ${command}`);
        await fetch(`${API_BASE}/commands/?cmd=${command}`);
        fetchVolumioState(); // Refresh state after command
    } catch (error) {
        console.error(`Error sending command "${command}":`, error);
    }
}

// Set playback volume
async function setVolume(value) {
    try {
        document.getElementById('volumeValue').innerText = value;
        await fetch(`${API_BASE}/commands/?cmd=volume&volume=${value}`);
    } catch (error) {
        console.error('Error setting volume:', error);
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
