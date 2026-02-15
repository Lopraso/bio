document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

document.querySelectorAll('.card').forEach(card => {
  const shine = document.createElement('div');
  shine.classList.add('shine');
  card.style.position = 'relative';
  card.appendChild(shine);

  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;
  let animating = false;
  const maxTilt = 8;
  const edgeBuffer = 0.85;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function animate() {
    if (!animating) return;
    currentX = lerp(currentX, targetX, 0.08);
    currentY = lerp(currentY, targetY, 0.08);

    if (Math.abs(currentX - targetX) < 0.01 && Math.abs(currentY - targetY) < 0.01) {
      currentX = targetX;
      currentY = targetY;
    }

    card.style.transform = `perspective(800px) rotateX(${currentY}deg) rotateY(${currentX}deg) scale3d(1.02, 1.02, 1.02)`;
    requestAnimationFrame(animate);
  }

  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    let normalX = (x - centerX) / centerX;
    let normalY = (y - centerY) / centerY;

    normalX = clamp(normalX, -edgeBuffer, edgeBuffer);
    normalY = clamp(normalY, -edgeBuffer, edgeBuffer);

    targetX = normalX * maxTilt;
    targetY = normalY * -maxTilt;

    if (!animating) {
      animating = true;
      animate();
    }

    shine.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.12) 0%, transparent 60%)`;
  });

  card.addEventListener('mouseleave', () => {
    targetX = 0;
    targetY = 0;
    setTimeout(() => { animating = false; }, 600);
    card.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
    card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    shine.style.background = 'none';
    setTimeout(() => { card.style.transition = 'none'; }, 600);
  });
});

const CLIENT_ID = '78ffd0aa61eb40a597d5658fd80a4f8a';
const CLIENT_SECRET = '59a9965adff1447aaad7ab93560c839d';
const REFRESH_TOKEN = 'AQCYxTASG070i5AaWEaPGuFUZYFf1wYbCJbHjtr6qQCNW_y5EuzZK3dk9BmUPRvzTKsb3qXZFak1AWdfpz1xfDTTOiOQvaySaLlnVsRPPLPZoBLWU_X7LOarajeAsM-8qfQ';

let accessToken = null;
let tokenExpiry = 0;
let lastProgress = 0;
let lastDuration = 1;
let lastTimestamp = 0;
let isPlaying = false;
let interpolator = null;

const trackName = document.querySelector('.track-name');
const trackArtist = document.querySelector('.track-artist');
const trackArt = document.querySelector('.track-art');
const progressFill = document.querySelector('.progress-fill');
const timeCurrent = document.querySelector('.time-current');
const timeTotal = document.querySelector('.time-total');

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
    },
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(REFRESH_TOKEN)
  });

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

function startInterpolation() {
  if (interpolator) return;
  interpolator = requestAnimationFrame(function tick() {
    if (!isPlaying) {
      interpolator = null;
      return;
    }
    const elapsed = Date.now() - lastTimestamp;
    const current = Math.min(lastProgress + elapsed, lastDuration);
    const pct = (current / lastDuration) * 100;
    progressFill.style.transition = 'none';
    progressFill.style.width = pct + '%';
    timeCurrent.textContent = formatTime(current);
    if (current >= lastDuration) {
      isPlaying = false;
      interpolator = null;
      return;
    }
    interpolator = requestAnimationFrame(tick);
  });
}

async function fetchNowPlaying() {
  try {
    const token = await getAccessToken();
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.status === 204 || res.status > 400) {
      trackName.textContent = 'Nothing playing';
      trackArtist.textContent = 'Open Spotify to play';
      progressFill.style.width = '0%';
      timeCurrent.textContent = '0:00';
      timeTotal.textContent = '0:00';
      trackArt.style.backgroundImage = '';
      isPlaying = false;
      return;
    }

    const data = await res.json();

    if (data.item) {
      trackName.textContent = data.item.name;
      trackArtist.textContent = data.item.artists.map(a => a.name).join(', ');

      if (data.item.album && data.item.album.images && data.item.album.images.length > 0) {
        const img = data.item.album.images[data.item.album.images.length > 1 ? 1 : 0].url;
        trackArt.style.backgroundImage = 'url(' + img + ')';
        trackArt.style.backgroundSize = 'cover';
        trackArt.style.backgroundPosition = 'center';
      }

      lastProgress = data.progress_ms || 0;
      lastDuration = data.item.duration_ms || 1;
      lastTimestamp = Date.now();
      isPlaying = data.is_playing;

      const pct = (lastProgress / lastDuration) * 100;
      progressFill.style.width = pct + '%';
      timeCurrent.textContent = formatTime(lastProgress);
      timeTotal.textContent = formatTime(lastDuration);

      if (isPlaying) startInterpolation();
    }
  } catch (e) {
    trackName.textContent = 'Connection error';
    trackArtist.textContent = 'Retrying...';
  }
}

fetchNowPlaying();
setInterval(fetchNowPlaying, 5000);

async function fetchFavArts() {
  try {
    const token = await getAccessToken();
    const ids = Array.from(document.querySelectorAll('.fav-item')).map(el => el.dataset.trackId).join(',');
    const res = await fetch('https://api.spotify.com/v1/tracks?ids=' + ids, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (data.tracks) {
      data.tracks.forEach(track => {
        if (!track) return;
        const el = document.querySelector('[data-track-id="' + track.id + '"] .fav-art');
        if (el && track.album && track.album.images && track.album.images.length > 0) {
          const img = track.album.images[track.album.images.length > 1 ? 1 : 0].url;
          el.style.backgroundImage = 'url(' + img + ')';
        }
      });
    }
  } catch (e) {}
}

fetchFavArts();