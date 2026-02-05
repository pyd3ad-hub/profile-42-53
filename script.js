// ============================================
// PROFILE MANAGEMENT FUNCTIONS (CUSTOM SITE TAB)
// ============================================

// Save profile info to Firebase
async function saveProfileInfo() {
    const username = document.getElementById('profile-username-input').value.trim();
    const bio = document.getElementById('profile-bio-input').value.trim();
    const location = document.getElementById('profile-location-input').value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    if (!window.firebaseDb) {
        alert('Firebase not initialized. Please wait a moment and try again.');
        return;
    }
    
    try {
        const profileRef = window.firebaseDoc(window.firebaseDb, 'profiles', 'default');
        
        // Get existing data to preserve social links
        const profileSnap = await window.firebaseGetDoc(profileRef);
        const existingData = profileSnap.exists() ? profileSnap.data() : {};
        
        await window.firebaseSetDoc(profileRef, {
            ...existingData,
            username: username,
            bio: bio,
            location: location,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        alert("✅ Profile info saved successfully!");
        loadProfileInfo(); // Refresh the displayed data
    } catch (error) {
        console.error("Error saving profile:", error);
        alert("❌ Failed to save profile info: " + error.message);
    }
}

// Load profile info from Firebase
async function loadProfileInfo() {
    try {
        const db = window.firebaseDb;
        if (!db) {
            console.warn('Firebase not initialized yet');
            return;
        }
        
        const profileRef = window.firebaseDoc(db, 'profiles', 'default');
        const profileSnap = await window.firebaseGetDoc(profileRef);
        
        if (profileSnap.exists()) {
            const data = profileSnap.data();
            document.getElementById('profile-username-input').value = data.username || "4253";
            document.getElementById('profile-bio-input').value = data.bio || "Python/Lua Developer";
            document.getElementById('profile-location-input').value = data.location || "nuh uh";
            
            // Update view counters if they exist
            if (data.views) {
                document.getElementById('profile-total-views').textContent = data.views.total || 0;
                document.getElementById('profile-today-views').textContent = data.views.today || 0;
            }
            
            // Load social links
            loadSocialLinks(data.socialLinks || []);
        } else {
            // Set defaults
            document.getElementById('profile-username-input').value = "4253";
            document.getElementById('profile-bio-input').value = "Python/Lua Developer";
            document.getElementById('profile-location-input').value = "nuh uh";
            loadSocialLinks([]);
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

// Load social links into the UI
function loadSocialLinks(socialLinks) {
    const container = document.getElementById('social-links-list');
    if (!container) return;

    const countEl = document.getElementById('profile-social-count');
    if (countEl) countEl.textContent = socialLinks.length;
    
    if (socialLinks.length === 0) {
        container.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 1rem;">No social links added yet. Click "ADD SOCIAL" to add one.</p>';
        return;
    }
    
    container.innerHTML = socialLinks.map((link, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem;">
            <div>
                <div style="font-weight: 600; color: white;">${link.platform || 'Social Link'}</div>
                <div style="font-size: 0.875rem; color: rgba(255,255,255,0.7); margin-top: 0.25rem;">${link.url}</div>
            </div>
            <button class="btn btn-red" onclick="deleteSocialLinkFromFirebase(${index})" style="padding: 0.5rem 1rem; font-size: 0.875rem;">DELETE</button>
        </div>
    `).join('');
}

// Open add social modal
function openAddSocialModal() {
    // Create a modal for adding social links
    const modalHTML = `
        <div id="add-social-modal" class="modal" style="display: flex; align-items: center; justify-content: center;">
            <div class="modal-content add-user-modal-content modern-modal" style="max-width: 500px;">
                <div class="modal-header modern-modal-header">
                    <div class="modal-title-wrapper">
                        <div class="modal-icon">🔗</div>
                        <h2 class="modal-title">Add Social Link</h2>
                    </div>
                    <div class="modal-header-buttons">
                        <button type="button" class="btn-modal btn-modal-red" onclick="closeAddSocialModal()">
                            <span>✕</span>
                        </button>
                    </div>
                </div>
                <form onsubmit="handleAddSocialLink(event)" style="padding: 2rem;">
                    <div class="modern-form-group">
                        <label class="modern-label">
                            <span class="label-icon">🏷️</span>
                            <span>Platform</span>
                        </label>
                        <select id="social-platform" class="modern-input" required>
                            <option value="">Select platform</option>
                            <option value="Discord">Discord</option>
                            <option value="GitHub">GitHub</option>
                            <option value="Twitter">Twitter</option>
                            <option value="YouTube">YouTube</option>
                            <option value="Twitch">Twitch</option>
                            <option value="Website">Website</option>
                            <option value="Other">Other</option>
                        </select>
                        <div class="modern-form-description">Choose the platform</div>
                    </div>
                    <div class="modern-form-group">
                        <label class="modern-label">
                            <span class="label-icon">🔗</span>
                            <span>URL</span>
                        </label>
                        <input type="url" id="social-url" class="modern-input" placeholder="https://example.com" required>
                        <div class="modern-form-description">Enter the full URL</div>
                    </div>
                    <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
                        <button type="button" class="btn btn-grey" onclick="closeAddSocialModal()">Cancel</button>
                        <button type="submit" class="btn btn-blue">Add Link</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Remove any existing modal
    const existingModal = document.getElementById('add-social-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Close add social modal
function closeAddSocialModal() {
    const modal = document.getElementById('add-social-modal');
    if (modal) {
        modal.remove();
    }
}

// Handle adding social link
async function handleAddSocialLink(event) {
    event.preventDefault();
    
    const platform = document.getElementById('social-platform').value;
    const url = document.getElementById('social-url').value;
    
    if (!platform || !url) {
        alert('Please fill in all fields');
        return;
    }
    
    if (!window.firebaseDb) {
        alert('Firebase not initialized. Please wait a moment and try again.');
        return;
    }
    
    try {
        const db = window.firebaseDb;
        const profileRef = window.firebaseDoc(db, 'profiles', 'default');
        const profileSnap = await window.firebaseGetDoc(profileRef);
        
        let currentData = {};
        if (profileSnap.exists()) {
            currentData = profileSnap.data();
        }
        
        const socialLinks = currentData.socialLinks || [];
        socialLinks.push({ platform, url });
        
        await window.firebaseSetDoc(profileRef, {
            ...currentData,
            socialLinks: socialLinks,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        closeAddSocialModal();
        loadProfileInfo(); // Reload profile info with new social link
        alert("✅ Social link added successfully!");
    } catch (error) {
        console.error("Error adding social link:", error);
        alert("❌ Failed to add social link: " + error.message);
    }
}

// Delete social link from Firebase
async function deleteSocialLinkFromFirebase(index) {
    if (!confirm("Are you sure you want to delete this social link?")) return;
    
    if (!window.firebaseDb) {
        alert('Firebase not initialized. Please wait a moment and try again.');
        return;
    }
    
    try {
        const db = window.firebaseDb;
        const profileRef = window.firebaseDoc(db, 'profiles', 'default');
        const profileSnap = await window.firebaseGetDoc(profileRef);
        
        if (profileSnap.exists()) {
            const data = profileSnap.data();
            let socialLinks = data.socialLinks || [];
            socialLinks.splice(index, 1);
            
            await window.firebaseSetDoc(profileRef, {
                ...data,
                socialLinks: socialLinks,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            
            loadProfileInfo(); // Reload to show updated list
            alert("✅ Social link deleted!");
        }
    } catch (error) {
        console.error("Error deleting social link:", error);
        alert("❌ Failed to delete social link: " + error.message);
    }
}

// Load view analytics from Firebase
async function loadViewAnalytics() {
    if (!window.firebaseDb) return;
    
    try {
        const db = window.firebaseDb;
        const analyticsRef = window.firebaseDoc(db, 'analytics', 'profile');
        const analyticsSnap = await window.firebaseGetDoc(analyticsRef);
        
        const analyticsEl = document.getElementById('view-analytics');
        const totalViewsEl = document.getElementById('profile-total-views');
        const todayViewsEl = document.getElementById('profile-today-views');
        
        if (analyticsSnap.exists()) {
            const data = analyticsSnap.data();
            const total = data.total || 0;
            const today = data.today || 0;
            const lastView = data.lastView;
            
            if (totalViewsEl) totalViewsEl.textContent = total;
            if (todayViewsEl) todayViewsEl.textContent = today;
            
            if (analyticsEl) {
                analyticsEl.innerHTML = `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div>
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.25rem;">Total Views</div>
                            <div style="font-size: 1.5rem; font-weight: 600;">${total}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.25rem;">Today's Views</div>
                            <div style="font-size: 1.5rem; font-weight: 600;">${today}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6); margin-bottom: 0.25rem;">Last View</div>
                            <div style="font-size: 1rem; font-weight: 500;">${lastView ? new Date(lastView).toLocaleString() : 'Never'}</div>
                        </div>
                    </div>
                `;
            }
        } else {
            // Initialize analytics if they don't exist
            await window.firebaseSetDoc(analyticsRef, {
                total: 0,
                today: 0,
                lastView: null
            });
            
            if (totalViewsEl) totalViewsEl.textContent = '0';
            if (todayViewsEl) todayViewsEl.textContent = '0';
            if (analyticsEl) analyticsEl.innerHTML = '<p style="color: rgba(255,255,255,0.5);">No views tracked yet.</p>';
        }
    } catch (error) {
        console.error('Error loading view analytics:', error);
    }
}

// Load profile dashboard data
async function loadProfileDashboard() {
    await loadProfileInfo();
    await loadViewAnalytics();
}

// ============================================
// MODIFY EXISTING FUNCTIONS
// ============================================

// Update the switchTab function to load profile data when custom site tab is opened
function switchTab(tabName, event) {
    // Prevent event from bubbling to overlay
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    // Close mobile menu FIRST (on mobile devices) before switching
    if (window.innerWidth <= 768) {
        closeMobileMenu();
    }
    
    // Remove active class from all navigation tab buttons (not account buttons)
    document.querySelectorAll('.sidebar-nav .tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Remove active class from all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Add active class to clicked tab button (only if it's a navigation tab)
    const activeButton = document.querySelector(`.sidebar-nav [data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Show corresponding content
    const activeContent = document.getElementById(`${tabName}-content`);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // Update content header title
    const contentTitle = document.getElementById('content-title');
    if (contentTitle) {
        const titles = {
            'dashboard': 'Dashboard',
            'users': 'Users',
            'projects': 'Projects',
            'discord': 'Discord Bot',
            'custom-site': 'Custom Site',
            'profile': 'Profile'
        };
        contentTitle.textContent = titles[tabName] || 'Lua Code Manager';
    }

    // Update breadcrumb
    const breadcrumbTab = document.getElementById('breadcrumb-tab');
    if (breadcrumbTab) {
        breadcrumbTab.textContent = tabName;
    }

    // Hide/show Lua projects section in users tab based on project count
    if (tabName === 'users') {
        const projects = getProjects();
        const projectSection = document.querySelector('#users-content .project-section');
        if (projectSection) {
            if (projects.length === 0) {
                projectSection.style.display = 'none';
            } else {
                projectSection.style.display = 'block';
            }
        }
    }

    // Load projects when switching to projects tab
    if (tabName === 'projects') {
        loadProjects();
    }

    // Load users when switching to users tab
    if (tabName === 'users') {
        loadUsers();
        updateUserStats();
    }

    // Load profile data when switching to profile tab
    if (tabName === 'profile') {
        updateProfileDisplay();
    }

    // Load Discord bot files when switching to Discord tab
    if (tabName === 'discord') {
        loadDiscordBotFiles();
    }
    
    // Load profile data when switching to custom site tab
    if (tabName === 'custom-site') {
        setTimeout(() => {
            loadProfileDashboard();
        }, 100);
    }
}

// ============================================
// KEEP ALL YOUR EXISTING CODE BELOW
// (All your existing functions remain unchanged)
// ============================================

// Authentication Functions
function generateAdminKey() {
    // Generate a secure 32-character key
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function getAdminKey() {
    // Always use the default key - don't store random keys
    // This ensures login works consistently across all browsers/devices
    const defaultKey = '2b8d1f4a6c5e9b2d';
    let storedKey = localStorage.getItem('adminKey');
    
    // If no key exists or key doesn't match default, set to default
    if (!storedKey || storedKey !== defaultKey) {
        localStorage.setItem('adminKey', defaultKey);
        return defaultKey;
    }
    
    return storedKey;
}

function getAdminDiscordId() {
    return localStorage.getItem('adminDiscordId') || '561293567780192273';
}

function setAdminDiscordId(id) {
    localStorage.setItem('adminDiscordId', id);
}

function isAuthenticated() {
    return localStorage.getItem('authenticated') === 'true';
}

function setAuthenticated(value) {
    localStorage.setItem('authenticated', value ? 'true' : 'false');
}

function handleLogin(event) {
    event.preventDefault();
    const discordId = document.getElementById('login-discord-id').value.trim();
    const key = document.getElementById('login-key').value.trim();
    const errorDiv = document.getElementById('login-error');
    
    // Get or generate admin key
    const adminKey = getAdminKey();
    const adminDiscordId = getAdminDiscordId();
    
    // Check credentials
    if (discordId === adminDiscordId && key === adminKey) {
        setAuthenticated(true);
        setAdminDiscordId(discordId);
        document.getElementById('login-modal').style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';
        // Clear any error messages
        errorDiv.style.display = 'none';
    } else {
        // Detect which field is wrong and show specific error
        let errorMsg = '';
        if (discordId !== adminDiscordId && key !== adminKey) {
            errorMsg = '❌ Both Discord ID and Security Key are incorrect';
        } else if (discordId !== adminDiscordId) {
            errorMsg = '❌ Discord ID is incorrect. Expected: ' + adminDiscordId;
        } else if (key !== adminKey) {
            errorMsg = '❌ Security Key is incorrect. Make sure you\'re using the correct key.';
        } else {
            errorMsg = '❌ Invalid credentials';
        }
        
        errorDiv.textContent = errorMsg;
        errorDiv.style.display = 'block';
    }
}

// Check authentication on page load
function checkAuthentication() {
    // Ensure default key is set on every page load (fixes cross-device login)
    getAdminKey();
    
    if (!isAuthenticated()) {
        // Show login modal and hide app
        document.getElementById('login-modal').style.display = 'block';
        document.querySelector('.app-container').style.display = 'none';
    } else {
        // Hide login modal and show app
        document.getElementById('login-modal').style.display = 'none';
        document.querySelector('.app-container').style.display = 'flex';
    }
}

// Cloud Sync Configuration
let cloudSyncEnabled = false;
let syncInProgress = false;
const USER_ID = getAdminDiscordId(); // Use Discord ID as user identifier

// Initialize Cloud Sync
function initCloudSync() {
    // Check if Firebase is available
    if (typeof window.firebaseDb !== 'undefined' && window.firebaseDb) {
        cloudSyncEnabled = true;
        console.log('Cloud sync enabled - Firebase connected');
        try {
            startCloudSync();
        } catch (error) {
            console.error('Error starting cloud sync:', error);
            cloudSyncEnabled = false;
        }
    } else {
        console.log('Cloud sync disabled - Firebase not configured or not loaded yet');
        // Fallback to localStorage only
        cloudSyncEnabled = false;
    }
}

// Start listening to cloud changes
function startCloudSync() {
    if (!cloudSyncEnabled || !window.firebaseDb) {
        console.log('Cannot start cloud sync - Firebase not available');
        return;
    }
    
    try {
        const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', USER_ID);
        console.log('Setting up cloud sync listener for user:', USER_ID);
        
        // Listen for real-time updates
        window.firebaseOnSnapshot(userDocRef, (snapshot) => {
            console.log('Cloud data received:', snapshot.exists());
            if (snapshot.exists() && !syncInProgress) {
                const cloudData = snapshot.data();
                syncFromCloud(cloudData);
                console.log('Data synced from cloud');
            }
        }, (error) => {
            console.error('Cloud sync listener error:', error);
        });
        
        // Load initial data from cloud
        console.log('Loading initial data from cloud...');
        loadFromCloud();
    } catch (error) {
        console.error('Failed to start cloud sync:', error);
        cloudSyncEnabled = false;
    }
}

// Load data from cloud
async function loadFromCloud() {
    if (!cloudSyncEnabled || !window.firebaseDb) return;
    
    try {
        const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', USER_ID);
        const docSnap = await window.firebaseGetDoc(userDocRef);
        
        if (docSnap.exists()) {
            const cloudData = docSnap.data();
            syncInProgress = true;
            syncFromCloud(cloudData);
            syncInProgress = false;
        }
    } catch (error) {
        console.error('Failed to load from cloud:', error);
    }
}

// Sync data from cloud to local
function syncFromCloud(cloudData) {
    if (syncInProgress) return;
    syncInProgress = true;
    
    try {
        // Merge cloud data with local (cloud takes priority)
        if (cloudData.projects && Array.isArray(cloudData.projects)) {
            localStorage.setItem('projects', JSON.stringify(cloudData.projects));
        }
        if (cloudData.users && Array.isArray(cloudData.users)) {
            localStorage.setItem('users', JSON.stringify(cloudData.users));
        }
        if (cloudData.backups && Array.isArray(cloudData.backups)) {
            localStorage.setItem('backups', JSON.stringify(cloudData.backups));
        }
        
        // Reload UI
        loadProjects();
        loadUsers();
        updateUserStats();
    } catch (error) {
        console.error('Sync from cloud error:', error);
    } finally {
        syncInProgress = false;
    }
}

// Save data to cloud
async function saveToCloud() {
    if (!cloudSyncEnabled || !window.firebaseDb || syncInProgress) return;
    
    try {
        syncInProgress = true;
        const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', USER_ID);
        
        const dataToSave = {
            projects: getProjects(),
            users: getUsers(),
            backups: getBackups(),
            lastSync: new Date().toISOString(),
            autoSaveState: {
                enabled: autoSaveEnabled,
                filesSavedCount: filesSavedCount,
                lastBackupTime: lastBackupTime
            }
        };
        
        await window.firebaseSetDoc(userDocRef, dataToSave, { merge: true });
        console.log('Data saved to cloud');
    } catch (error) {
        console.error('Failed to save to cloud:', error);
    } finally {
        syncInProgress = false;
    }
}

// ... [ALL YOUR EXISTING CODE CONTINUES BELOW - KEEP EVERYTHING ELSE EXACTLY AS IS]
// ... [I've just added the profile functions above and modified the switchTab function]
