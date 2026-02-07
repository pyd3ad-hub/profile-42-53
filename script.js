// Profile page functionality with Firebase integration
const USER_ID = localStorage.getItem('userId') || 'default-user'; // Get from URL or auth in production

// Wait for Firebase to be available
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        if (window.firebaseDb) {
            resolve();
            return;
        }
        
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        const checkInterval = setInterval(() => {
            attempts++;
            if (window.firebaseDb) {
                clearInterval(checkInterval);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.warn('Firebase initialization timeout - using localStorage fallback');
                reject(new Error('Firebase not initialized'));
            }
        }, 100);
    });
}

// Get user ID from URL or localStorage
function getUserId() {
    // Try to get from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user') || urlParams.get('id') || USER_ID;
    return userId;
}

// Load profile data from Firebase
async function loadProfileData() {
    try {
        await waitForFirebase();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const userId = getUserId();
        const userRef = doc(window.firebaseDb, 'profiles', userId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (error) {
        console.error('Error loading from Firebase:', error);
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('profileData');
    return stored ? JSON.parse(stored) : null;
}

// Load customize data from Firebase
async function loadCustomizeData() {
    try {
        await waitForFirebase();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const userId = getUserId();
        console.log('Loading customize data for user:', userId);
        const userRef = doc(window.firebaseDb, 'profiles', userId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists() && docSnap.data().customize) {
            console.log('✓ Loaded customize data from Firebase');
            return docSnap.data().customize;
        } else {
            console.log('No customize data found in Firebase');
        }
    } catch (error) {
        console.warn('Error loading from Firebase, using localStorage:', error);
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('customizeData');
    if (stored) {
        console.log('✓ Loaded customize data from localStorage');
        return JSON.parse(stored);
    }
    return null;
}

// Get links from storage
async function getLinks() {
    try {
        await waitForFirebase();
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const userId = getUserId();
        const userRef = doc(window.firebaseDb, 'profiles', userId);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists() && docSnap.data().links) {
            return docSnap.data().links;
        }
    } catch (error) {
        console.error('Error loading links:', error);
    }
    
    // Fallback to localStorage
    const stored = localStorage.getItem('profileLinks');
    return stored ? JSON.parse(stored) : [];
}

// Apply customize settings to profile
function applyCustomizeSettings(data) {
    if (!data) return;
    
    const style = document.documentElement.style;
    
    // Apply colors
    if (data.accentColor) {
        style.setProperty('--accent-color', data.accentColor);
        document.querySelector('.profile-main-card')?.style.setProperty('border-color', data.accentColor);
    }
    if (data.textColor) {
        style.setProperty('--text-color', data.textColor);
    }
    if (data.backgroundColor) {
        document.body.style.background = data.backgroundColor;
    }
    if (data.iconColor) {
        style.setProperty('--icon-color', data.iconColor);
    }
    
    // Apply background image
    if (data.backgroundImage) {
        document.body.style.backgroundImage = `url(${data.backgroundImage})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
    }
    
    // Apply profile opacity and blur
    const profileCard = document.querySelector('.profile-main-card');
    if (profileCard) {
        if (data.profileOpacity !== undefined) {
            profileCard.style.opacity = data.profileOpacity;
        }
        if (data.profileBlur !== undefined && data.blurredBackground) {
            profileCard.style.backdropFilter = `blur(${data.profileBlur}px)`;
            profileCard.style.webkitBackdropFilter = `blur(${data.profileBlur}px)`;
        }
    }
    
    // Apply avatar
    if (data.avatarImage) {
        const avatarImg = document.querySelector('.profile-avatar img');
        if (avatarImg) {
            avatarImg.src = data.avatarImage;
        }
    }
    
    // Apply cursor
    if (data.cursorImage) {
        document.body.style.cursor = `url(${data.cursorImage}), auto`;
    }
    
    // Apply audio
    if (data.audioFile && data.volumeControl) {
        const audio = document.createElement('audio');
        audio.src = data.audioFile;
        audio.loop = true;
        audio.volume = 0.5;
        audio.id = 'profile-audio';
        document.body.appendChild(audio);
        
        // Play on user interaction
        document.addEventListener('click', function playAudio() {
            audio.play().catch(e => console.log('Audio play failed:', e));
            document.removeEventListener('click', playAudio);
        }, { once: true });
    }
    
    // Apply animated title
    if (data.animatedTitle) {
        const username = document.querySelector('.username');
        if (username) {
            username.style.animation = 'pulse 2s infinite';
        }
    }
}

// Render profile data
async function renderProfileData() {
    const profileData = await loadProfileData();
    const customizeData = await loadCustomizeData();
    
    if (profileData) {
        // Set username
        const usernameEl = document.querySelector('.username');
        if (usernameEl && profileData.username) {
            usernameEl.textContent = profileData.username;
        }
        
        // Set display name/role
        const roleEl = document.querySelector('.role');
        if (roleEl && profileData.displayName) {
            roleEl.textContent = profileData.displayName;
        }
        
        // Set location
        const locationEl = document.querySelector('.bio span:last-child');
        if (locationEl && customizeData?.location) {
            locationEl.textContent = customizeData.location;
        }
        
        // Set description (if you add a description element)
        if (customizeData?.description) {
            // Add description to profile if needed
        }
    }
    
    // Apply customize settings
    if (customizeData) {
        applyCustomizeSettings(customizeData);
    }
}

// Check if string is a valid URL
function isValidUrl(string) {
    try {
        const url = string.startsWith('http') ? string : `https://${string}`;
        new URL(url);
        return true;
    } catch (_) {
        return false;
    }
}

// Normalize URL
function normalizeUrl(url) {
    if (!url) return '';
    if (isValidUrl(url)) {
        return url.startsWith('http') ? url : `https://${url}`;
    }
    return url;
}

// Copy text to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    }
}

// Show temporary notification
function showNotification(message) {
    const existing = document.querySelector('.copy-notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #667eea;
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Render links on profile
async function renderProfileLinks() {
    const linksSection = document.getElementById('linksSection');
    if (!linksSection) return;
    
    const links = await getLinks();
    
    if (links.length === 0) {
        linksSection.innerHTML = '';
        return;
    }
    
    linksSection.innerHTML = links.map(link => {
        const title = link.title || (link.isUrl ? new URL(normalizeUrl(link.url)).hostname : 'Link') : 'Link');
        const displayUrl = link.url.length > 50 ? link.url.substring(0, 50) + '...' : link.url;
        const isUrl = link.isUrl !== false && isValidUrl(link.url);
        
        const faviconUrl = link.faviconUrl || (isUrl ? `https://www.google.com/s2/favicons?domain=${new URL(normalizeUrl(link.url)).hostname.replace(/^www\./, '')}&sz=64` : null);
        const emojiIcon = link.icon || '🔗';
        
        const iconHtml = faviconUrl 
            ? `<img src="${faviconUrl}" alt="icon" class="profile-link-favicon" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <span class="profile-link-icon" style="display: none;">${emojiIcon}</span>`
            : `<span class="profile-link-icon">${emojiIcon}</span>`;
        
        return `
            <div class="profile-link-item" data-url="${link.url}" data-is-url="${isUrl}">
                <div class="profile-link-icon-wrapper">
                    ${iconHtml}
                </div>
                <div class="profile-link-content">
                    <div class="profile-link-title">${title}</div>
                    <div class="profile-link-url">${displayUrl}</div>
                    ${!isUrl ? '<div class="profile-link-copy-hint">Click to copy</div>' : ''}
                </div>
            </div>
        `;
    }).join('');
    
    document.querySelectorAll('.profile-link-item').forEach(item => {
        item.addEventListener('click', async () => {
            const url = item.dataset.url;
            const isUrl = item.dataset.isUrl === 'true';
            
            if (isUrl) {
                window.open(normalizeUrl(url), '_blank');
            } else {
                const success = await copyToClipboard(url);
                if (success) {
                    showNotification('Copied to clipboard!');
                } else {
                    showNotification('Failed to copy');
                }
            }
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Profile page loaded');
    
    // Wait for Firebase to be ready
    console.log('Waiting for Firebase...');
    await new Promise((resolve) => {
        if (window.firebaseDb) {
            resolve();
        } else {
            window.addEventListener('firebaseReady', resolve, { once: true });
            // Timeout after 3 seconds
            setTimeout(resolve, 3000);
        }
    });
    
    console.log('Firebase ready, loading profile...');
    
    try {
        // Render profile data and customize settings
        await renderProfileData();
        
        // Render links
        await renderProfileLinks();
    } catch (error) {
        console.error('Error initializing profile page:', error);
        // Show error message to user
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #fff;">
                    <h2>Error loading profile</h2>
                    <p>Please check the browser console for details.</p>
                    <p style="color: #888; font-size: 0.9rem;">Error: ${error.message}</p>
                </div>
            `;
        }
    }
    
    // Add CSS animation for notification
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.7;
                }
            }
        `;
        document.head.appendChild(style);
    }
});
