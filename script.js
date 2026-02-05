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

// Project Storage Functions
function getProjects() {
    const projects = localStorage.getItem('projects');
    return projects ? JSON.parse(projects) : [];
}

function saveProjects(projects) {
    localStorage.setItem('projects', JSON.stringify(projects));
    // Auto-sync to cloud
    if (cloudSyncEnabled) {
        saveToCloud();
    }
    // Also sync projects to Firestore for loader API
    syncProjectsToLoaderAPI(projects);
    // Sync projects to GitHub scripts subdomain
    syncProjectsToGitHub(projects);
}

function addProject(project) {
    const projects = getProjects();
    // Generate a unique loader ID if not exists (32 character hex string)
    if (!project.loaderId) {
        project.loaderId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    projects.push(project);
    saveProjects(projects);
    return projects;
}

// Tab switching functionality
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
    
    // Load custom site content when switching to custom site tab
    if (tabName === 'custom-site') {
        loadProfileDashboard();
    }
}

// Logout handler
function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        // Clear authentication
        setAuthenticated(false);
        
        // Hide app and show login modal
        document.getElementById('login-modal').style.display = 'block';
        document.querySelector('.app-container').style.display = 'none';
        
        // Clear login form
        document.getElementById('login-discord-id').value = '';
        document.getElementById('login-key').value = '';
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }
}

// Mobile Menu Functions
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
    }
}

function closeMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Initialize - check authentication first
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication before showing app
    checkAuthentication();
    
    // Only initialize app if authenticated
    if (isAuthenticated()) {
        switchTab('dashboard');
    }
    
    // Initialize cloud sync when Firebase is ready
    function tryInitCloudSync() {
        if (typeof window.firebaseDb !== 'undefined') {
            initCloudSync();
            updateCloudSyncStatus();
        } else {
            // Try again after a short delay (max 5 seconds)
            setTimeout(tryInitCloudSync, 500);
        }
    }
    
    // Listen for Firebase ready event
    window.addEventListener('firebaseReady', function() {
        initCloudSync();
        updateCloudSyncStatus();
    });
    
    // Also try initializing after DOM is ready (fallback)
    setTimeout(tryInitCloudSync, 1000);
    
    // File input change handler
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const fileNameDisplay = document.getElementById('file-name');
            if (fileNameDisplay) {
                if (file) {
                    // Read file content
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const fileContent = e.target.result;
                        // Store file data temporarily in the file input's data attribute
                        fileInput.dataset.fileContent = fileContent;
                        fileInput.dataset.fileName = file.name;
                        fileNameDisplay.textContent = `Selected: ${file.name}`;
                    };
                    reader.readAsText(file);
                } else {
                    fileNameDisplay.textContent = '';
                    delete fileInput.dataset.fileContent;
                    delete fileInput.dataset.fileName;
                }
            }
        });
    }

    // Graph filter buttons
    const graphFilterButtons = document.querySelectorAll('.graph-filter-btn');
    graphFilterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            graphFilterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Visual only - no actual functionality yet
            const period = this.getAttribute('data-period');
            console.log('Filter changed to:', period);
        });
    });

    // Initialize projects visibility
    const projects = getProjects();
    const projectSection = document.querySelector('#users-content .project-section');
    if (projectSection) {
        if (projects.length === 0) {
            projectSection.style.display = 'none';
        } else {
            projectSection.style.display = 'block';
        }
    }

    // Load users on page load
    loadUsers();
    updateUserStats();
    updateProfileDisplay();
});


// Create Project Modal Functions
function openCreateProjectModal() {
    const modal = document.getElementById('create-project-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeCreateProjectModal() {
    const modal = document.getElementById('create-project-modal');
    if (modal) {
        modal.style.display = 'none';
        // Reset form
        const form = document.querySelector('.create-project-form');
        if (form) {
            form.reset();
        }
        const fileNameDisplay = document.getElementById('file-name');
        if (fileNameDisplay) {
            fileNameDisplay.textContent = '';
        }
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.value = '';
            delete fileInput.dataset.fileContent;
            delete fileInput.dataset.fileName;
        }
    }
}

function handleCreateProject(event) {
    event.preventDefault();
    
    const projectName = document.getElementById('project-name').value.trim();
    if (!projectName) {
        alert('Please enter a project name');
        return;
    }

    const fileInput = document.getElementById('file-input');
    const fileContent = fileInput?.dataset.fileContent || '';
    const fileName = fileInput?.dataset.fileName || '';

    const project = {
        id: Date.now().toString(),
        name: projectName,
        logsWebhook: document.getElementById('logs-webhook').value.trim(),
        alertWebhook: document.getElementById('alert-webhook').value.trim(),
        allowHwidReset: document.getElementById('allow-hwid-reset').checked,
        autoDeleteExpired: document.getElementById('auto-delete-expired').checked,
        allowHwidCloned: document.getElementById('allow-hwid-cloned').checked,
        cooldown: document.getElementById('cooldown').value.trim(),
        files: fileName ? [{
            name: fileName,
            content: fileContent
        }] : [],
        createdAt: new Date().toISOString()
    };

    addProject(project);
    
    // Update UI
    loadProjects();
    
    // Show/hide project section in users tab
    const projectSection = document.querySelector('#users-content .project-section');
    if (projectSection) {
        projectSection.style.display = 'block';
    }
    
    closeCreateProjectModal();
    
    // Switch to projects tab to show the new project
    switchTab('projects');
}

// Add User Modal Functions
function openAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    if (modal) {
        modal.style.display = 'none';
        // Reset form
        const form = document.querySelector('.add-user-form');
        if (form) {
            form.reset();
        }
    }
}

// User Storage Functions
function getUsers() {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
    // Auto-sync to cloud
    if (cloudSyncEnabled) {
        saveToCloud();
        // Also sync to loader API for key validation
        if (window.firebaseDb) {
            syncUsersToLoaderAPI(users);
        }
    }
}

function generateUserKey() {
    // Generate a random 32-character hex key
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function handleAddUser(event) {
    event.preventDefault();
    
    const userNote = document.getElementById('user-note').value.trim();
    const discordId = document.getElementById('discord-id').value.trim();
    const identifier = document.getElementById('identifier').value.trim();
    const days = document.getElementById('days').value.trim();

    // Generate user key
    const userKey = generateUserKey();
    
    // Create user object
    const user = {
        id: Date.now().toString(),
        key: userKey,
        discordId: discordId || null,
        status: 'Active',
        note: userNote || '',
        executions: 0,
        hwidResets: 0,
        days: days ? parseInt(days) : null, // null means infinite
        daysRemaining: days ? parseInt(days) : null,
        banReason: '',
        ac: false, // Anti-cheat status
        identifier: identifier || null,
        createdAt: new Date().toISOString(),
        lastExecution: null
    };

    // Add user to storage
    const users = getUsers();
    users.push(user);
    saveUsers(users);

    // Update UI
    loadUsers();
    updateUserStats();
    
    // Show success message with key
    alert(`User created successfully!\n\nUser Key: ${userKey}\n\nCopy this key and give it to the user.`);
    
    closeAddUserModal();
}

// Load and display users
function loadUsers() {
    const users = getUsers();
    const usersTable = document.querySelector('#users-content .users-table tbody');
    if (!usersTable) return;

    // Clear existing rows
    usersTable.innerHTML = '';

    if (users.length === 0) {
        usersTable.innerHTML = `
            <tr>
                <td colspan="9" class="empty-table-message">No users found. Click "+ ADD USER" to create a new user.</td>
            </tr>
        `;
        return;
    }

    // Display each user
    users.forEach(user => {
        const row = document.createElement('tr');
        
        const daysDisplay = user.days === null ? '∞' : (user.daysRemaining !== null ? user.daysRemaining : user.days);
        const statusClass = user.status === 'Active' ? 'status-active' : '';
        const statusBadge = `<span class="status-badge ${statusClass}">${user.status}</span>`;
        
        row.innerHTML = `
            <td>
                <div style="font-family: 'Courier New', monospace; font-size: 0.75rem; color: var(--blue);">${user.key}</div>
            </td>
            <td>${user.discordId || '-'}</td>
            <td>${statusBadge}</td>
            <td>${user.note || '-'}</td>
            <td>${user.executions}</td>
            <td>${user.hwidResets}</td>
            <td>${daysDisplay}</td>
            <td>${user.banReason || '-'}</td>
            <td>${user.ac ? '✓' : '✗'}</td>
        `;
        
        usersTable.appendChild(row);
    });
}

// Update user statistics
function updateUserStats() {
    const users = getUsers();
    
    // Update total scripts/users count
    const totalScriptsCard = document.querySelector('#users-content .stat-card-green .stat-value-large');
    const totalUsersCard = document.querySelector('#users-content .stat-card-blue .stat-value-large');
    const bannedUsersCard = document.querySelector('#users-content .stat-card-red .stat-value-large');
    
    if (totalScriptsCard) {
        totalScriptsCard.textContent = users.length;
    }
    if (totalUsersCard) {
        totalUsersCard.textContent = users.length;
    }
    if (bannedUsersCard) {
        const bannedCount = users.filter(u => u.status === 'Banned').length;
        bannedUsersCard.textContent = bannedCount;
        const banDescription = document.querySelector('#users-content .stat-card-red .stat-description');
        if (banDescription) {
            banDescription.textContent = `There are ${bannedCount} blacklisted IPs`;
        }
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const createModal = document.getElementById('create-project-modal');
    const addUserModal = document.getElementById('add-user-modal');
    const editModal = document.getElementById('edit-file-modal');
    const backupsModal = document.getElementById('backups-modal');
    const resetKeyModal = document.getElementById('reset-key-modal');
    
    if (event.target === createModal) {
        closeCreateProjectModal();
    }
    if (event.target === addUserModal) {
        closeAddUserModal();
    }
    if (event.target === editModal) {
        closeEditFileModal();
    }
    if (event.target === backupsModal) {
        closeBackupsModal();
    }
    if (event.target === resetKeyModal) {
        closeResetKeyModal();
    }
}

// Auto-Save Backup Functionality
let autoSaveEnabled = true;
let filesSavedCount = 0;
let lastBackupTime = null;

// Load saved state from localStorage
document.addEventListener('DOMContentLoaded', function() {
    const savedState = localStorage.getItem('autoSaveState');
    if (savedState) {
        const state = JSON.parse(savedState);
        autoSaveEnabled = state.enabled !== false;
        filesSavedCount = state.filesSavedCount || 0;
        lastBackupTime = state.lastBackupTime || null;
    }
    updateAutoSaveUI();
});

function updateAutoSaveUI() {
    const statusEl = document.getElementById('auto-save-status');
    const toggleBtn = document.getElementById('toggle-auto-save-btn');
    const lastBackupEl = document.getElementById('last-backup-time');
    const filesCountEl = document.getElementById('files-saved-count');
    
    if (statusEl) {
        statusEl.textContent = autoSaveEnabled ? 'Enabled' : 'Disabled';
        statusEl.classList.toggle('disabled', !autoSaveEnabled);
    }
    
    if (toggleBtn) {
        toggleBtn.textContent = autoSaveEnabled ? '⏸️ DISABLE' : '▶️ ENABLE';
    }
    
    if (lastBackupEl) {
        if (lastBackupTime) {
            const date = new Date(lastBackupTime);
            lastBackupEl.textContent = date.toLocaleString();
        } else {
            lastBackupEl.textContent = 'Never';
        }
    }
    
    if (filesCountEl) {
        filesCountEl.textContent = filesSavedCount;
    }
}

function toggleAutoSave() {
    autoSaveEnabled = !autoSaveEnabled;
    saveAutoSaveState();
    updateAutoSaveUI();
    
    if (autoSaveEnabled) {
        console.log('Auto-save enabled - files will be backed up before updates');
    } else {
        console.log('Auto-save disabled');
    }
}

function triggerManualBackup() {
    // Create backup of all data
    console.log('Starting manual backup...');
    
    const backup = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        projects: getProjects(),
        users: getUsers(),
        autoSaveState: {
            enabled: autoSaveEnabled,
            filesSavedCount: filesSavedCount,
            lastBackupTime: lastBackupTime
        }
    };
    
    // Save backup to localStorage
    let backups = getBackups();
    backups.unshift(backup); // Add to beginning
    // Keep only last 50 backups
    if (backups.length > 50) {
        backups = backups.slice(0, 50);
    }
    localStorage.setItem('backups', JSON.stringify(backups));
    
    filesSavedCount += 1;
    lastBackupTime = new Date().toISOString();
    saveAutoSaveState();
    updateAutoSaveUI();
    
    // Show feedback
    const btn = document.querySelector('.btn-manual-backup');
    const originalText = btn.textContent;
    btn.textContent = '✓ BACKED UP!';
    btn.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 2000);
    
    console.log('Backup completed!');
}

function getBackups() {
    const backups = localStorage.getItem('backups');
    return backups ? JSON.parse(backups) : [];
}

function openBackupsModal() {
    const modal = document.getElementById('backups-modal');
    const content = document.getElementById('backups-content');
    const backups = getBackups();
    
    if (backups.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <h2>No Backups Yet</h2>
                <p>Backups will appear here after you create them</p>
            </div>
        `;
    } else {
        content.innerHTML = backups.map(backup => {
            const date = new Date(backup.timestamp);
            const projectCount = backup.projects ? backup.projects.length : 0;
            const userCount = backup.users ? backup.users.length : 0;
            
            return `
                <div class="backup-item" style="background: var(--bg-card-dark); padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                        <div>
                            <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-white); margin-bottom: 0.5rem;">Backup ${backup.id}</h3>
                            <div style="font-size: 0.875rem; color: rgba(255,255,255,0.6);">${date.toLocaleString()}</div>
                        </div>
                        <button class="btn btn-blue" onclick="restoreBackup('${backup.id}')" style="padding: 0.5rem 1rem; font-size: 0.875rem;">RESTORE</button>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; font-size: 0.875rem;">
                        <div>
                            <div style="color: rgba(255,255,255,0.6);">Projects:</div>
                            <div style="color: var(--text-white); font-weight: 600;">${projectCount}</div>
                        </div>
                        <div>
                            <div style="color: rgba(255,255,255,0.6);">Users:</div>
                            <div style="color: var(--text-white); font-weight: 600;">${userCount}</div>
                        </div>
                        <div>
                            <div style="color: rgba(255,255,255,0.6);">Status:</div>
                            <div style="color: var(--text-white); font-weight: 600;">${backup.autoSaveState?.enabled ? 'Enabled' : 'Disabled'}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    modal.style.display = 'block';
}

function closeBackupsModal() {
    document.getElementById('backups-modal').style.display = 'none';
}

function restoreBackup(backupId) {
    if (!confirm('Are you sure you want to restore this backup? This will replace all current data.')) {
        return;
    }
    
    const backups = getBackups();
    const backup = backups.find(b => b.id === backupId);
    
    if (!backup) {
        alert('Backup not found');
        return;
    }
    
    // Restore data
    if (backup.projects) {
        localStorage.setItem('projects', JSON.stringify(backup.projects));
    }
    if (backup.users) {
        localStorage.setItem('users', JSON.stringify(backup.users));
    }
    if (backup.autoSaveState) {
        autoSaveEnabled = backup.autoSaveState.enabled !== false;
        filesSavedCount = backup.autoSaveState.filesSavedCount || 0;
        lastBackupTime = backup.autoSaveState.lastBackupTime || null;
        saveAutoSaveState();
        updateAutoSaveUI();
    }
    
    // Reload UI
    loadProjects();
    loadUsers();
    updateUserStats();
    closeBackupsModal();
    
    alert('Backup restored successfully!');
}

// Security Key Management
let keyVisible = false;

function toggleKeyVisibility() {
    keyVisible = !keyVisible;
    const keyDisplay = document.getElementById('display-security-key');
    const showBtn = document.querySelector('.btn-show-key');
    const adminKey = getAdminKey();
    
    if (keyVisible) {
        keyDisplay.textContent = adminKey;
        showBtn.textContent = 'HIDE';
    } else {
        keyDisplay.textContent = '••••••••••••••••';
        showBtn.textContent = 'SHOW';
    }
}

function openResetKeyModal() {
    document.getElementById('reset-key-modal').style.display = 'block';
}

function closeResetKeyModal() {
    document.getElementById('reset-key-modal').style.display = 'none';
    document.getElementById('security-code').value = '';
    document.getElementById('current-key').value = '';
}

function handleResetKey(event) {
    event.preventDefault();
    
    const securityCode = document.getElementById('security-code').value.trim();
    const currentKey = document.getElementById('current-key').value.trim();
    const adminKey = getAdminKey();
    
    // Check security code first
    if (securityCode !== '161983531') {
        alert('Invalid security code');
        return;
    }
    
    // Check current key
    if (currentKey !== adminKey) {
        alert('Invalid current security key');
        return;
    }
    
    // Reset to default key
    const defaultKey = '2b8d1f4a6c5e9b2d';
    localStorage.setItem('adminKey', defaultKey);
    
    // Logout user (they'll need to login with default key)
    setAuthenticated(false);
    
    closeResetKeyModal();
    
    // Show default key in alert
    alert(`Security key reset successfully!\n\nYour security key has been reset to the default:\n${defaultKey}\n\n⚠️ You can now log in with this key!`);
    
    // Reload page to show login
    location.reload();
}

// Update profile display on load
function updateProfileDisplay() {
    const discordId = getAdminDiscordId();
    const discordIdEl = document.getElementById('display-discord-id');
    if (discordIdEl) {
        discordIdEl.textContent = discordId;
    }
    
    // Load and display saved loader server URL
    const serverUrlInput = document.getElementById('loader-server-url');
    if (serverUrlInput) {
        const savedUrl = getLoaderBaseUrl();
        serverUrlInput.value = savedUrl;
    }
    updateLoaderServerStatus();
}

// Save server URL (deprecated - no longer using server-based loaders)
function saveServerUrl() {
    alert('Server URL is no longer needed. The loader now embeds code directly in the downloaded file.');
}

function saveAutoSaveState() {
    const state = {
        enabled: autoSaveEnabled,
        filesSavedCount: filesSavedCount,
        lastBackupTime: lastBackupTime
    };
    localStorage.setItem('autoSaveState', JSON.stringify(state));
}

// Auto-save before updates (simulated)
function performAutoSave() {
    if (!autoSaveEnabled) return;
    
    console.log('Auto-saving files before update...');
    filesSavedCount += 1;
    lastBackupTime = new Date().toISOString();
    saveAutoSaveState();
    updateAutoSaveUI();
}

// Load and display projects
function loadProjects() {
    const projects = getProjects();
    const projectsContent = document.getElementById('projects-content');
    if (!projectsContent) return;

    // Find or create projects container
    let projectsContainer = projectsContent.querySelector('.projects-list-container');
    if (!projectsContainer) {
        // Create container after the create project button
        const createButtonContainer = projectsContent.querySelector('.create-project-container');
        projectsContainer = document.createElement('div');
        projectsContainer.className = 'projects-list-container';
        projectsContainer.style.marginTop = '2rem';
        if (createButtonContainer && createButtonContainer.nextSibling) {
            createButtonContainer.parentNode.insertBefore(projectsContainer, createButtonContainer.nextSibling);
        } else {
            createButtonContainer.parentNode.appendChild(projectsContainer);
        }
    }

    // Clear existing projects
    projectsContainer.innerHTML = '';

    if (projects.length === 0) {
        projectsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📄</div>
                <h2>No Projects Yet</h2>
                <p>Create your first project to get started</p>
            </div>
        `;
        return;
    }

    // Display each project
    projects.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        projectCard.style.cssText = `
            background-color: var(--bg-card-dark);
            backdrop-filter: blur(10px);
            border-radius: 0.75rem;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: var(--shadow-lg);
            border: 1px solid rgba(255, 255, 255, 0.05);
        `;

        // Generate loader ID if it doesn't exist
        if (!project.loaderId) {
            project.loaderId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            const projects = getProjects();
            const projIndex = projects.findIndex(p => p.id === project.id);
            if (projIndex !== -1) {
                projects[projIndex].loaderId = project.loaderId;
                saveProjects(projects);
            }
        }

        const filesList = project.files && project.files.length > 0 
            ? project.files.map((f, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(20,20,20,0.3); border-radius: 0.5rem; margin: 0.5rem 0;">
                    <div style="font-size: 0.875rem; flex: 1;">📎 ${f.name}</div>
                    <button class="btn btn-blue" onclick="openEditFileModal('${project.id}', ${index})" style="padding: 0.375rem 0.75rem; font-size: 0.75rem;">EDIT</button>
                </div>
            `).join('')
            : '<div style="color: rgba(255,255,255,0.5); font-size: 0.875rem; padding: 0.5rem;">No files added</div>';

        projectCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h3 style="font-size: 1.25rem; font-weight: 600; color: var(--text-white); margin-bottom: 0.5rem;">${project.name}</h3>
                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">Created: ${new Date(project.createdAt).toLocaleDateString()}</div>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-blue" onclick="openAddFileModal('${project.id}')" style="padding: 0.5rem 1rem; font-size: 0.875rem;">+ ADD FILE</button>
                    <button class="btn btn-green" onclick="copyLoader('${project.id}', this)" style="padding: 0.5rem 1rem; font-size: 0.875rem;">📋 LOADER</button>
                    <button class="btn btn-grey" onclick="deleteProject('${project.id}')" style="padding: 0.5rem 1rem; font-size: 0.875rem;">DELETE</button>
                </div>
            </div>
            <div style="margin-top: 1rem;">
                <div style="font-size: 0.875rem; font-weight: 600; color: rgba(255,255,255,0.8); margin-bottom: 0.5rem;">Files:</div>
                ${filesList}
            </div>
        `;

        projectsContainer.appendChild(projectCard);
    });

    // Update project count
    const projectCountCard = projectsContent.querySelector('.stat-card-green .stat-value');
    if (projectCountCard) {
        projectCountCard.textContent = `${projects.length}/∞`;
    }
}

// Add file to project
function openAddFileModal(projectId) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.lua';
    fileInput.style.display = 'none';
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const fileContent = e.target.result;
            const projects = getProjects();
            const project = projects.find(p => p.id === projectId);
            
            if (project) {
                if (!project.files) {
                    project.files = [];
                }
                project.files.push({
                    name: file.name,
                    content: fileContent
                });
                saveProjects(projects);
                loadProjects();
            }
        };
        reader.readAsText(file);
        
        // Clean up
        document.body.removeChild(fileInput);
    });
    
    document.body.appendChild(fileInput);
    fileInput.click();
}

// Delete project
function deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) {
        return;
    }
    
    const projects = getProjects();
    const filteredProjects = projects.filter(p => p.id !== projectId);
    saveProjects(filteredProjects);
    loadProjects();
    
    // Hide project section in users tab if no projects
    if (filteredProjects.length === 0) {
        const projectSection = document.querySelector('#users-content .project-section');
        if (projectSection) {
            projectSection.style.display = 'none';
        }
    }
}

// Set loader base URL (call this function to configure your server URL)
function setLoaderBaseUrl(url) {
    localStorage.setItem('loaderServerUrl', url);
    console.log('Loader server URL saved:', url);
}

// Get loader base URL for server-based loaders
function getLoaderBaseUrl() {
    return localStorage.getItem('loaderServerUrl') || 'https://42-53.com/api/loaders';
}

// Set loader base URL
function setLoaderBaseUrl(url) {
    localStorage.setItem('loaderServerUrl', url);
    console.log('Loader server URL updated to:', url);
}

// Get or generate user key for the loader
function getUserKey() {
    let key = localStorage.getItem('userKey');
    if (!key) {
        // Generate a random 32-character key
        key = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        localStorage.setItem('userKey', key);
    }
    return key;
}

// Copy loader to clipboard
async function copyLoader(projectId, buttonElement) {
    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
        alert('Project not found');
        return;
    }

    // Check if project has files
    if (!project.files || project.files.length === 0) {
        alert('This project has no files. Please add files to the project first.');
        return;
    }

    // Generate loader ID if it doesn't exist
    if (!project.loaderId) {
        project.loaderId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        const projIndex = projects.findIndex(p => p.id === projectId);
        if (projIndex !== -1) {
            projects[projIndex].loaderId = project.loaderId;
            saveProjects(projects);
        }
    }

    // Sync project to Firestore for loader API
    if (cloudSyncEnabled && window.firebaseDb) {
        try {
            await syncProjectsToLoaderAPI([project]);
            // Also sync users so API can validate keys
            const users = getUsers();
            if (users.length > 0) {
                await syncUsersToLoaderAPI(users);
            }
        } catch (error) {
            console.error('Failed to sync project to loader API:', error);
            alert('Warning: Project may not be available on server. Make sure Firebase is configured.');
        }
    }

    // Get the first file name from the project (for GitHub scripts format)
    const firstFile = project.files[0];
    const fileName = firstFile.name.endsWith('.lua') ? firstFile.name : `${firstFile.name}.lua`;
    
    // Use direct GitHub link (scripts.42-53.com)
    // The validation code will be injected when the script is served
    const scriptUrl = `https://scripts.42-53.com/${fileName}`;
    
    // Create the loader script - simple format that works
    // User fills in their key, validation happens inside the script
    const loaderScript = `script_key="";\nloadstring(game:HttpGet("${scriptUrl}"))()`;

    // Download as text file
    const blob = new Blob([loaderScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name}_loader.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show feedback
    if (buttonElement) {
        const originalText = buttonElement.textContent;
        buttonElement.textContent = '✓ DOWNLOADED!';
        buttonElement.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
        
        setTimeout(() => {
            buttonElement.textContent = originalText;
            buttonElement.style.backgroundColor = '';
        }, 2000);
    }
}

// Open edit file modal
function openEditFileModal(projectId, fileIndex) {
    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project || !project.files || !project.files[fileIndex]) {
        alert('File not found');
        return;
    }

    const file = project.files[fileIndex];
    
    // Create or get edit modal
    let editModal = document.getElementById('edit-file-modal');
    if (!editModal) {
        editModal = document.createElement('div');
        editModal.id = 'edit-file-modal';
        editModal.className = 'modal';
        editModal.innerHTML = `
            <div class="modal-content add-user-modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Edit File</h2>
                    <div class="modal-header-buttons">
                        <button type="button" class="btn-modal btn-modal-green" onclick="saveEditedFile()">
                            <span>✓</span>
                        </button>
                        <button type="button" class="btn-modal btn-modal-red" onclick="closeEditFileModal()">
                            <span>✕</span>
                        </button>
                    </div>
                </div>
                <div style="padding: 2rem;">
                    <div class="form-group">
                        <label for="edit-file-name" style="font-size: 0.875rem; font-weight: 500; color: rgba(255, 255, 255, 0.9); margin-bottom: 0.25rem; display: block;">File Name</label>
                        <input type="text" id="edit-file-name" style="width: 100%; padding: 0.75rem; background-color: rgba(20, 20, 20, 0.3); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.5rem; color: var(--text-white); font-size: 1rem; font-family: inherit; transition: all 0.3s ease;" placeholder="Enter file name">
                    </div>
                    <div class="form-group" style="margin-top: 1.5rem;">
                        <label for="edit-file-content" style="font-size: 0.875rem; font-weight: 500; color: rgba(255, 255, 255, 0.9); margin-bottom: 0.25rem; display: block;">File Content</label>
                        <textarea id="edit-file-content" style="width: 100%; min-height: 400px; padding: 0.75rem; background-color: rgba(20, 20, 20, 0.3); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.5rem; color: var(--text-white); font-size: 0.875rem; font-family: 'Courier New', monospace; resize: vertical; transition: all 0.3s ease;" placeholder="Enter Lua code here..."></textarea>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(editModal);
    }

    // Store current editing context
    editModal.dataset.projectId = projectId;
    editModal.dataset.fileIndex = fileIndex;

    // Populate form
    document.getElementById('edit-file-name').value = file.name;
    document.getElementById('edit-file-content').value = file.content;

    // Show modal
    editModal.style.display = 'block';
}

// Close edit file modal
function closeEditFileModal() {
    const editModal = document.getElementById('edit-file-modal');
    if (editModal) {
        editModal.style.display = 'none';
    }
}

// Save edited file
function saveEditedFile() {
    const editModal = document.getElementById('edit-file-modal');
    if (!editModal) return;

    const projectId = editModal.dataset.projectId;
    const fileIndex = parseInt(editModal.dataset.fileIndex);
    const fileName = document.getElementById('edit-file-name').value.trim();
    const fileContent = document.getElementById('edit-file-content').value;

    if (!fileName) {
        alert('Please enter a file name');
        return;
    }

    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project || !project.files || !project.files[fileIndex]) {
        alert('File not found');
        return;
    }

    // Update file
    project.files[fileIndex].name = fileName;
    project.files[fileIndex].content = fileContent;
    
    saveProjects(projects);
    loadProjects();
    closeEditFileModal();
}

// Data Export/Import Functions for Cross-Device Sync
function exportData() {
    try {
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            projects: getProjects(),
            users: getUsers(),
            backups: getBackups(),
            autoSaveState: {
                enabled: autoSaveEnabled,
                filesSavedCount: filesSavedCount,
                lastBackupTime: lastBackupTime
            }
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `4253sHub-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        const statusDiv = document.getElementById('sync-status');
        if (statusDiv) {
            statusDiv.textContent = '✓ Data exported successfully!';
            statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
            setTimeout(() => {
                statusDiv.textContent = '';
            }, 3000);
        }
    } catch (error) {
        alert('Error exporting data: ' + error.message);
        console.error('Export error:', error);
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusDiv = document.getElementById('sync-status');
    
    if (!confirm('Importing data will replace all current projects, users, and backups. Are you sure?')) {
        event.target.value = ''; // Reset file input
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate data structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data file format');
            }
            
            // Import projects
            if (data.projects && Array.isArray(data.projects)) {
                localStorage.setItem('projects', JSON.stringify(data.projects));
            }
            
            // Import users
            if (data.users && Array.isArray(data.users)) {
                localStorage.setItem('users', JSON.stringify(data.users));
            }
            
            // Import backups
            if (data.backups && Array.isArray(data.backups)) {
                localStorage.setItem('backups', JSON.stringify(data.backups));
            }
            
            // Import auto-save state
            if (data.autoSaveState) {
                autoSaveEnabled = data.autoSaveState.enabled !== false;
                filesSavedCount = data.autoSaveState.filesSavedCount || 0;
                lastBackupTime = data.autoSaveState.lastBackupTime || null;
                saveAutoSaveState();
                updateAutoSaveUI();
            }
            
            // Reload UI
            loadProjects();
            loadUsers();
            updateUserStats();
            
            // Show success message
            if (statusDiv) {
                statusDiv.textContent = '✓ Data imported successfully!';
                statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 3000);
            }
            
            alert('Data imported successfully! The page will refresh to show your data.');
            setTimeout(() => {
                location.reload();
            }, 1000);
            
        } catch (error) {
            alert('Error importing data: ' + error.message + '\n\nPlease make sure you selected a valid export file.');
            console.error('Import error:', error);
            if (statusDiv) {
                statusDiv.textContent = '❌ Import failed. Please check the file format.';
                statusDiv.style.color = 'rgba(239, 68, 68, 0.8)';
                setTimeout(() => {
                    statusDiv.textContent = '';
                }, 5000);
            }
        }
    };
    
    reader.onerror = function() {
        alert('Error reading file. Please try again.');
        if (statusDiv) {
            statusDiv.textContent = '❌ Error reading file.';
            statusDiv.style.color = 'rgba(239, 68, 68, 0.8)';
            setTimeout(() => {
                statusDiv.textContent = '';
            }, 3000);
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

// Manual cloud sync trigger
async function manualCloudSync() {
    const statusDiv = document.getElementById('sync-status');
    
    if (statusDiv) {
        statusDiv.textContent = '⏳ Syncing...';
        statusDiv.style.color = 'rgba(255, 255, 255, 0.7)';
    }
    
    // For now, this will work with localStorage
    // When Firebase is configured, it will auto-sync
    if (cloudSyncEnabled && window.firebaseDb) {
        try {
            await saveToCloud();
            await loadFromCloud();
            if (statusDiv) {
                statusDiv.textContent = '✓ Sync complete!';
                statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
                setTimeout(() => { statusDiv.textContent = ''; }, 3000);
            }
        } catch (error) {
            if (statusDiv) {
                statusDiv.textContent = '❌ Sync failed: ' + error.message;
                statusDiv.style.color = 'rgba(239, 68, 68, 0.8)';
                setTimeout(() => { statusDiv.textContent = ''; }, 5000);
            }
        }
    } else {
        if (statusDiv) {
            statusDiv.textContent = 'ℹ️ Cloud sync not configured. Data is stored locally.';
            statusDiv.style.color = 'rgba(255, 255, 255, 0.6)';
            setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        }
    }
}

// Update cloud sync status
function updateCloudSyncStatus() {
    const statusEl = document.getElementById('cloud-sync-status');
    if (!statusEl) return;
    
    if (cloudSyncEnabled && window.firebaseDb) {
        statusEl.textContent = '✓ Cloud sync active - Data syncs automatically';
        statusEl.style.color = 'rgba(16, 185, 129, 0.8)';
    } else {
        statusEl.textContent = 'ℹ️ Local storage mode - Configure Firebase for cloud sync';
        statusEl.style.color = 'rgba(255, 255, 255, 0.6)';
    }
}

// Update status display on load
setTimeout(() => {
    updateCloudSyncStatus();
}, 1500);

// Sync projects to Firestore for loader API
async function syncProjectsToLoaderAPI(projects) {
    if (!cloudSyncEnabled || !window.firebaseDb) return;
    
    try {
        // Store each project in Firestore under 'projects' collection with loaderId as document ID
        for (const project of projects) {
            if (project.loaderId && project.files && project.files.length > 0) {
                const projectDocRef = window.firebaseDoc(window.firebaseDb, 'projects', project.loaderId);
                await window.firebaseSetDoc(projectDocRef, {
                    name: project.name,
                    files: project.files,
                    loaderId: project.loaderId,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                console.log(`Project ${project.name} synced to loader API`);
            }
        }
    } catch (error) {
        console.error('Failed to sync projects to loader API:', error);
    }
}

// Sync users to loader API (Firestore) - separate collection for API validation
async function syncUsersToLoaderAPI(users) {
    if (!cloudSyncEnabled || !window.firebaseDb || !users || users.length === 0) return;
    
    try {
        for (const user of users) {
            if (user.key) {
                // Store each user in a separate document in 'users' collection
                // Use the key as the document ID for easy lookup
                const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', user.key);
                
                await window.firebaseSetDoc(userDocRef, {
                    key: user.key,
                    discordId: user.discordId || null,
                    status: user.status || 'Active',
                    note: user.note || '',
                    executions: user.executions || 0,
                    hwidResets: user.hwidResets || 0,
                    days: user.days || null,
                    daysRemaining: user.daysRemaining || null,
                    banReason: user.banReason || '',
                    ac: user.ac || false,
                    identifier: user.identifier || null,
                    createdAt: user.createdAt || new Date().toISOString(),
                    lastExecution: user.lastExecution || null,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
        }
        console.log(`Synced ${users.length} users to loader API`);
    } catch (error) {
        console.error('Failed to sync users to loader API:', error);
    }
}

// Save loader server URL
function saveLoaderServerUrl() {
    const serverUrlInput = document.getElementById('loader-server-url');
    if (!serverUrlInput) return;
    
    const url = serverUrlInput.value.trim();
    if (!url) {
        alert('Please enter a server URL');
        return;
    }
    
    // Validate URL format
    try {
        new URL(url);
    } catch (e) {
        alert('Invalid URL format. Please enter a valid URL (e.g., https://your-app.vercel.app/api/loaders)');
        return;
    }
    
    setLoaderBaseUrl(url);
    updateLoaderServerStatus();
    
    // Show success message
    const statusDiv = document.getElementById('loader-server-status');
    if (statusDiv) {
        statusDiv.textContent = '✓ Server URL saved successfully!';
        statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
        
        setTimeout(() => {
            statusDiv.textContent = '';
            updateLoaderServerStatus();
        }, 3000);
    }
}

// Update loader server status display
function updateLoaderServerStatus() {
    const statusDiv = document.getElementById('loader-server-status');
    if (!statusDiv) return;
    
    const currentUrl = getLoaderBaseUrl();
    if (currentUrl && currentUrl !== 'https://42-53.com/api/loaders') {
        statusDiv.textContent = `Current: ${currentUrl}`;
        statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
    } else {
        statusDiv.textContent = 'No server URL set. Deploy your Vercel server and enter the URL above.';
        statusDiv.style.color = 'rgba(255, 255, 255, 0.5)';
    }
}

// GitHub Sync Functions
function getGitHubConfig() {
    const config = localStorage.getItem('githubConfig');
    return config ? JSON.parse(config) : { token: '', repo: '', owner: '' };
}

function saveGitHubConfig(config) {
    localStorage.setItem('githubConfig', JSON.stringify(config));
}

// Sync projects to GitHub scripts subdomain
async function syncProjectsToGitHub(projects) {
    const config = getGitHubConfig();
    if (!config.token || !config.repo || !config.owner) {
        console.log('GitHub sync not configured. Go to Profile → Scripts Sync to set it up.');
        return;
    }
    
    if (!projects || projects.length === 0) return;
    
    try {
        for (const project of projects) {
            if (project.files && project.files.length > 0) {
                // Sync each file in the project to GitHub
                for (const file of project.files) {
                    const fileName = file.name.endsWith('.lua') ? file.name : `${file.name}.lua`;
                    const filePath = `${project.name}/${fileName}`;
                    
                    // Check if file exists in GitHub
                    const existingFile = await getGitHubFile(config, filePath);
                    
                    // Remove old validation code and inject fresh validation code
                    let fileContent = file.content;
                    
                    // Remove any existing validation code (old or new)
                    // Look for the validation code marker
                    const validationMarker = 'Key Validation System';
                    const validationEndMarker = '-- Key validated, continue with script execution';
                    
                    // Find and remove old validation code
                    const markerIndex = fileContent.indexOf(validationMarker);
                    if (markerIndex !== -1) {
                        // Find the end of validation code
                        const endIndex = fileContent.indexOf(validationEndMarker);
                        if (endIndex !== -1) {
                            // Remove everything from marker to end marker (including the end marker line)
                            const afterEnd = fileContent.indexOf('\n', endIndex);
                            if (afterEnd !== -1) {
                                fileContent = fileContent.substring(0, markerIndex) + fileContent.substring(afterEnd + 1);
                            } else {
                                fileContent = fileContent.substring(0, markerIndex);
                            }
                        } else {
                            // If end marker not found, remove from marker to first non-comment line
                            const lines = fileContent.split('\n');
                            let startLine = -1;
                            let endLine = -1;
                            for (let i = 0; i < lines.length; i++) {
                                if (lines[i].includes(validationMarker)) {
                                    startLine = i;
                                }
                                if (startLine !== -1 && !lines[i].startsWith('--') && lines[i].trim() !== '') {
                                    endLine = i;
                                    break;
                                }
                            }
                            if (startLine !== -1 && endLine !== -1) {
                                lines.splice(startLine, endLine - startLine);
                                fileContent = lines.join('\n');
                            }
                        }
                    }
                    
                    // Always inject fresh validation code with correct API URL
                    const apiBaseUrl = getApiBaseUrl();
                    const validationCode = `-- Key Validation System (Auto-injected by 42-53.com)
local script_key = script_key or ""
if script_key == "" then
    game.Players.LocalPlayer:Kick("❌ No key provided. Please set script_key before running.")
    return
end

-- Get HWID from executor
local hwid = game:GetService("RbxAnalyticsService"):GetClientId() or ""
if not hwid or hwid == "" then
    hwid = tostring(game:GetService("HttpService"):GenerateGUID(false))
end

local validationUrl = "${apiBaseUrl}/api/validate-key?script_key=" .. script_key .. "&hwid=" .. hwid

local function validateKey()
    local HttpService = game:GetService("HttpService")
    local success, response = pcall(function()
        return game:HttpGet(validationUrl, true)
    end)
    
    if not success or not response then
        game.Players.LocalPlayer:Kick("❌ Key validation failed. Invalid key or connection error.")
        return false
    end
    
    local success2, validation = pcall(function()
        return HttpService:JSONDecode(response)
    end)
    
    if not success2 or not validation then
        game.Players.LocalPlayer:Kick("❌ Key validation error. Please contact support.")
        return false
    end
    
    if not validation.valid then
        local reason = validation.reason or "Invalid key"
        game.Players.LocalPlayer:Kick("❌ " .. reason)
        return false
    end
    
    return true
end

-- Validate key before executing script
if not validateKey() then
    return
end

-- Key validated, continue with script execution

`;
                    fileContent = validationCode + fileContent;
                    
                    if (existingFile && existingFile.sha) {
                        // Update existing file
                        await updateGitHubFile(config, filePath, fileContent, existingFile.sha, `Update ${fileName} from project ${project.name}`);
                    } else {
                        // Create new file
                        await createGitHubFile(config, filePath, fileContent, `Add ${fileName} from project ${project.name}`);
                    }
                }
            }
        }
        console.log('Projects synced to GitHub successfully');
    } catch (error) {
        console.error('Failed to sync projects to GitHub:', error);
    }
}

// Get file from GitHub
async function getGitHubFile(config, path) {
    try {
        const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(path)}`, {
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.status === 404) {
            return null; // File doesn't exist
        }
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting GitHub file:', error);
        return null;
    }
}

// Create file in GitHub
async function createGitHubFile(config, path, content, message) {
    const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            content: btoa(unescape(encodeURIComponent(content))) // Base64 encode
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create file: ${error.message}`);
    }
    
    return await response.json();
}

// Update file in GitHub
async function updateGitHubFile(config, path, content, sha, message) {
    const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: message,
            content: btoa(unescape(encodeURIComponent(content))), // Base64 encode
            sha: sha
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to update file: ${error.message}`);
    }
    
    return await response.json();
}

// Import scripts from GitHub to main website
async function importScriptsFromGitHub() {
    const config = getGitHubConfig();
    if (!config.token || !config.repo || !config.owner) {
        alert('GitHub sync not configured. Go to Profile → Scripts Sync to set it up.');
        return;
    }
    
    try {
        // Get all files from GitHub repo
        const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/trees/main?recursive=1`, {
            headers: {
                'Authorization': `token ${config.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const data = await response.json();
        const luaFiles = data.tree.filter(item => item.path.endsWith('.lua') && item.type === 'blob');
        
        if (luaFiles.length === 0) {
            alert('No Lua files found in GitHub repository.');
            return;
        }
        
        // Group files by folder/project name
        const projects = getProjects();
        const fileGroups = {};
        
        for (const file of luaFiles) {
            const fileName = file.path.split('/').pop();
            const folderName = file.path.includes('/') ? file.path.split('/')[0] : 'root';
            
            if (!fileGroups[folderName]) {
                fileGroups[folderName] = [];
            }
            fileGroups[folderName].push({ path: file.path, name: fileName });
        }
        
        let importedCount = 0;
        
        // Process each project/folder
        for (const [folderName, files] of Object.entries(fileGroups)) {
            // Check if project already exists (by name)
            let project = projects.find(p => p.name === folderName || p.name === folderName.replace('root', 'Main'));
            
            if (!project && folderName !== 'root') {
                // Create new project only if it's in a folder (not root)
                project = {
                    id: Date.now().toString() + Math.random(),
                    name: folderName,
                    files: [],
                    createdAt: new Date().toISOString()
                };
                projects.push(project);
            } else if (!project && folderName === 'root') {
                // For root files, create a project with the first file's name (without .lua)
                const firstFileName = files[0].name.replace('.lua', '');
                project = {
                    id: Date.now().toString() + Math.random(),
                    name: firstFileName,
                    files: [],
                    createdAt: new Date().toISOString()
                };
                projects.push(project);
            }
            
            // Import/update all files in this project
            for (const fileInfo of files) {
                // Get file content
                const fileResponse = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(fileInfo.path)}`, {
                    headers: {
                        'Authorization': `token ${config.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (fileResponse.ok) {
                    const fileData = await fileResponse.json();
                    const content = decodeURIComponent(escape(atob(fileData.content)));
                    
                    // Check if file already exists in project
                    const existingFileIndex = project.files.findIndex(f => f.name === fileInfo.name);
                    if (existingFileIndex !== -1) {
                        // Update existing file
                        project.files[existingFileIndex].content = content;
                        importedCount++;
                    } else {
                        // Add new file
                        project.files.push({
                            name: fileInfo.name,
                            content: content
                        });
                        importedCount++;
                    }
                }
            }
        }
        
        if (importedCount > 0) {
            saveProjects(projects);
            loadProjects();
            alert(`Successfully imported ${importedCount} script(s) from GitHub!`);
        } else {
            alert('All scripts from GitHub are already imported.');
        }
    } catch (error) {
        console.error('Failed to import scripts from GitHub:', error);
        alert('Failed to import scripts from GitHub. Check console for details.');
    }
}

// Save GitHub configuration (UI handler)
function saveGitHubConfigUI() {
    const tokenInput = document.getElementById('github-token');
    const repoInput = document.getElementById('github-repo');
    const ownerInput = document.getElementById('github-owner');
    
    if (!tokenInput || !repoInput || !ownerInput) return;
    
    const config = {
        token: tokenInput.value.trim(),
        repo: repoInput.value.trim(),
        owner: ownerInput.value.trim()
    };
    
    if (!config.token || !config.repo || !config.owner) {
        alert('Please fill in all GitHub configuration fields.');
        return;
    }
    
    saveGitHubConfig(config);
    
    const statusDiv = document.getElementById('github-sync-status');
    if (statusDiv) {
        statusDiv.textContent = '✓ GitHub configuration saved!';
        statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
        
        setTimeout(() => {
            statusDiv.textContent = '';
        }, 3000);
    }
}

// Update GitHub sync status display
function updateGitHubSyncStatus() {
    const statusDiv = document.getElementById('github-sync-status');
    if (!statusDiv) return;
    
    const config = getGitHubConfig();
    if (config.token && config.repo && config.owner) {
        statusDiv.textContent = `Configured: ${config.owner}/${config.repo}`;
        statusDiv.style.color = 'rgba(16, 185, 129, 0.8)';
    } else {
        statusDiv.textContent = 'Not configured. Set up GitHub sync below.';
        statusDiv.style.color = 'rgba(255, 255, 255, 0.5)';
    }
}

// ============================================
// DISCORD BOT MANAGEMENT FUNCTIONS (Render)
// ============================================

// Get Discord bot files from localStorage
function getDiscordBotFiles() {
    const stored = localStorage.getItem('discordBotFiles');
    return stored ? JSON.parse(stored) : [];
}

// Save Discord bot files to localStorage
function saveDiscordBotFiles(files) {
    localStorage.setItem('discordBotFiles', JSON.stringify(files));
}

// Load and display Discord bot files
function loadDiscordBotFiles() {
    const files = getDiscordBotFiles();
    const tbody = document.getElementById('discord-files-list');
    if (!tbody) return;

    // Update stats
    const pythonFiles = files.filter(f => f.name.endsWith('.py'));
    const configFiles = files.filter(f => 
        f.name.endsWith('.json') || 
        f.name.endsWith('.txt') || 
        f.name === 'config.py' || 
        f.name === 'requirements.txt' ||
        f.name === 'Procfile'
    );

    const filesCountEl = document.getElementById('discord-files-count');
    const pythonCountEl = document.getElementById('discord-python-count');
    const configCountEl = document.getElementById('discord-config-count');
    
    if (filesCountEl) filesCountEl.textContent = files.length;
    if (pythonCountEl) pythonCountEl.textContent = pythonFiles.length;
    if (configCountEl) configCountEl.textContent = configFiles.length;

    if (files.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-table-message">No bot files loaded. Click "IMPORT FILES" to load your Discord bot files.</td></tr>';
        return;
    }

    tbody.innerHTML = files.map(file => {
        const fileSize = new Blob([file.content]).size;
        const sizeKB = (fileSize / 1024).toFixed(2);
        const fileType = getDiscordFileType(file.name);
        const lastModified = file.lastModified ? new Date(file.lastModified).toLocaleString() : 'Unknown';

        return `
            <tr>
                <td style="font-weight: 500;">${file.name}</td>
                <td><span style="padding: 0.25rem 0.5rem; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 0.75rem;">${fileType}</span></td>
                <td>${sizeKB} KB</td>
                <td>${lastModified}</td>
                <td>
                    <button class="btn btn-blue" onclick="editDiscordFile('${file.name.replace(/'/g, "\\'")}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; margin-right: 0.5rem;">✏️ EDIT</button>
                    <button class="btn btn-grey" onclick="downloadDiscordFile('${file.name.replace(/'/g, "\\'")}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem;">📥 DOWNLOAD</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Get file type label
function getDiscordFileType(fileName) {
    if (fileName.endsWith('.py')) return 'Python';
    if (fileName.endsWith('.json')) return 'JSON';
    if (fileName.endsWith('.txt')) return 'Text';
    if (fileName.endsWith('.md')) return 'Markdown';
    if (fileName === 'Procfile') return 'Config';
    if (fileName === 'requirements.txt') return 'Dependencies';
    return 'Other';
}

// Import Discord bot files from folder
function importDiscordBotFiles() {
    document.getElementById('discord-bot-files-input').click();
}

// Handle file import
function handleDiscordFilesImport(event) {
    const files = event.target.files;
    if (!files || files.length === 0) {
        alert('❌ No files selected. Please select a folder containing your Discord bot files.');
        return;
    }

    const existingFiles = getDiscordBotFiles();
    const newFiles = [];
    let processedCount = 0;
    
    // Filter valid files (skip hidden files, __pycache__, and directories)
    const validFiles = Array.from(files).filter(f => {
        const path = f.webkitRelativePath || f.name || '';
        return !f.name.startsWith('.') && 
               !path.includes('__pycache__') && 
               !path.includes('node_modules') &&
               f.size > 0; // Skip empty files (likely directories)
    });
    
    const totalFiles = validFiles.length;
    
    if (totalFiles === 0) {
        alert('❌ No valid files found. Make sure you selected a folder with bot files (not empty or only hidden files).');
        // Reset the input
        document.getElementById('discord-bot-files-input').value = '';
        return;
    }

    // Process each file
    validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onerror = function() {
            console.error('Error reading file:', file.name);
            processedCount++;
            if (processedCount === totalFiles) {
                if (newFiles.length > 0) {
                    saveDiscordBotFiles(existingFiles);
                    loadDiscordBotFiles();
                    alert(`✅ Successfully imported ${newFiles.length} file(s)!`);
                } else {
                    alert('❌ Failed to read files. Make sure they are text files.');
                }
            }
        };
        
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                const fileName = file.name;
                const filePath = file.webkitRelativePath || fileName;
                
                // Check if file already exists
                const existingIndex = existingFiles.findIndex(f => f.name === fileName);
                const fileData = {
                    name: fileName,
                    content: content,
                    lastModified: new Date().toISOString(),
                    path: filePath
                };

                if (existingIndex !== -1) {
                    existingFiles[existingIndex] = fileData;
                } else {
                    existingFiles.push(fileData);
                }

                newFiles.push(fileData);
                processedCount++;

                // If this is the last file, save and refresh
                if (processedCount === totalFiles) {
                    saveDiscordBotFiles(existingFiles);
                    loadDiscordBotFiles();
                    alert(`✅ Successfully imported ${newFiles.length} file(s)!`);
                    // Reset the input
                    document.getElementById('discord-bot-files-input').value = '';
                }
            } catch (error) {
                console.error('Error processing file:', file.name, error);
                processedCount++;
                if (processedCount === totalFiles) {
                    if (newFiles.length > 0) {
                        saveDiscordBotFiles(existingFiles);
                        loadDiscordBotFiles();
                        alert(`✅ Successfully imported ${newFiles.length} file(s)! (Some files may have failed)`);
                    }
                }
            }
        };
        
        // Read as text for all files (Python files, config files, etc.)
        reader.readAsText(file);
    });
}

// Edit Discord bot file
function editDiscordFile(fileName) {
    const files = getDiscordBotFiles();
    const file = files.find(f => f.name === fileName);
    if (!file) {
        alert('File not found');
        return;
    }

    document.getElementById('discord-file-editor-title').textContent = `Edit: ${fileName}`;
    document.getElementById('discord-file-editor-content').value = file.content;
    document.getElementById('discord-file-editor-modal').style.display = 'flex';
    document.getElementById('discord-file-editor-content').dataset.fileName = fileName;
}

// Save Discord bot file
function saveDiscordFile() {
    const fileName = document.getElementById('discord-file-editor-content').dataset.fileName;
    const content = document.getElementById('discord-file-editor-content').value;

    if (!fileName) {
        alert('No file selected');
        return;
    }

    const files = getDiscordBotFiles();
    const fileIndex = files.findIndex(f => f.name === fileName);
    
    if (fileIndex !== -1) {
        files[fileIndex].content = content;
        files[fileIndex].lastModified = new Date().toISOString();
        saveDiscordBotFiles(files);
        loadDiscordBotFiles();
        closeDiscordFileEditor();
        alert('✅ File saved locally! Click "SYNC TO GITHUB" to deploy to Render.');
    } else {
        alert('File not found');
    }
}

// Save and sync Discord file to GitHub
async function saveAndSyncDiscordFile() {
    // First save locally
    saveDiscordFile();
    
    // Then sync to GitHub
    await syncDiscordBotToGitHub();
}

// Sync all Discord bot files to GitHub
async function syncDiscordBotToGitHub() {
    const config = getGitHubConfig();
    if (!config.token || !config.repo || !config.owner) {
        alert('GitHub sync not configured. Go to Profile → Scripts Sync to set it up.');
        return;
    }

    const files = getDiscordBotFiles();
    if (files.length === 0) {
        alert('No bot files to sync. Import files first.');
        return;
    }

    // Get bot repo config (could be different from scripts repo)
    const botRepo = localStorage.getItem('discordBotRepo') || config.repo;
    const botOwner = localStorage.getItem('discordBotOwner') || config.owner;

    try {
        for (const file of files) {
            const filePath = file.path || file.name;
            const content = file.content;
            
            // Check if file exists
            const existingFile = await getGitHubFile({ ...config, repo: botRepo, owner: botOwner }, filePath);
            
            if (existingFile) {
                // Update existing file
                await updateGitHubFile({ ...config, repo: botRepo, owner: botOwner }, filePath, content, existingFile.sha, `Update ${file.name}`);
            } else {
                // Create new file
                await createGitHubFile({ ...config, repo: botRepo, owner: botOwner }, filePath, content, `Add ${file.name}`);
            }
        }
        
        alert('✅ Bot files synced to GitHub! Render will auto-deploy in a few moments.');
    } catch (error) {
        console.error('Failed to sync bot files:', error);
        alert('❌ Failed to sync to GitHub: ' + error.message);
    }
}

// Restart Discord bot on Render (via GitHub webhook or manual)
function restartDiscordBotOnRender() {
    alert(`🔄 Restart Bot on Render\n\n` +
          `To restart your bot:\n\n` +
          `1. Go to Render dashboard\n` +
          `2. Find your Discord bot service\n` +
          `3. Click "Manual Deploy" → "Clear build cache & deploy"\n\n` +
          `OR\n\n` +
          `Push any change to GitHub and Render will auto-deploy.\n\n` +
          `Note: Make sure your bot repo is connected to Render.`);
}

// Close file editor modal
function closeDiscordFileEditor() {
    document.getElementById('discord-file-editor-modal').style.display = 'none';
    document.getElementById('discord-file-editor-content').value = '';
    document.getElementById('discord-file-editor-content').dataset.fileName = '';
}

// Download Discord bot file
function downloadDiscordFile(fileName) {
    const files = getDiscordBotFiles();
    const file = files.find(f => f.name === fileName);
    if (!file) {
        alert('File not found');
        return;
    }

    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== Custom Site Editor Functions ====================

// Get API base URL (can be customized via localStorage or use default)
function getApiBaseUrl() {
    // Check if custom API URL is set in localStorage
    const customUrl = localStorage.getItem('apiBaseUrl');
    if (customUrl) {
        return customUrl;
    }
    // Default to Render API URL
    return 'https://four253-api.onrender.com';
}

// Load custom site content from Firebase
async function loadCustomSite() {
    try {
        if (!window.firebaseDb) {
            console.warn('Firebase not initialized yet, will retry...');
            // Don't show alert, just return silently
            return;
        }
        
        const docRef = window.firebaseDoc(window.firebaseDb, 'config', 'customSite');
        const docSnap = await window.firebaseGetDoc(docRef);
        
        const editor = document.getElementById('custom-site-editor');
        if (!editor) return;
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            editor.value = data.html || '';
        } else {
            // Default content
            editor.value = `<div class="grid">
    <div class="card">
        <h3>Welcome</h3>
        <p>This is your custom website. Edit it from the main dashboard to customize this content!</p>
    </div>
    <div class="card">
        <h3>Features</h3>
        <p>Modern design, fully customizable, and easy to edit from your main website.</p>
    </div>
    <div class="card">
        <h3>Get Started</h3>
        <p>Go to your dashboard and use the "Custom Site" tab to start editing!</p>
    </div>
</div>`;
        }
    } catch (error) {
        console.error('Error loading custom site:', error);
        // Don't show alert that might block UI, just log it
    }
}

// Save custom site content to Firebase
async function saveCustomSite() {
    try {
        if (!window.firebaseDb) {
            alert('Firebase not initialized. Please wait a moment and try again.');
            return;
        }
        
        const editor = document.getElementById('custom-site-editor');
        if (!editor) {
            console.error('Editor not found');
            return;
        }
        
        const htmlContent = editor.value.trim();
        
        if (!htmlContent) {
            alert('Please enter some HTML content');
            return;
        }
        
        const docRef = window.firebaseDoc(window.firebaseDb, 'config', 'customSite');
        await window.firebaseSetDoc(docRef, {
            html: htmlContent,
            lastModified: new Date().toISOString(),
            updatedBy: getAdminDiscordId() || 'unknown'
        });
        
        alert('✅ Custom site content saved! Changes will appear on custom-site.html');
    } catch (error) {
        console.error('Error saving custom site:', error);
        alert('Failed to save custom site content: ' + error.message);
    }
}

// Preview custom site content
function previewCustomSite() {
    window.open('custom-site.html', '_blank');
}

// Load profile data for dashboard
async function loadProfileDashboard() {
    if (!window.firebaseDb) return;
    
    try {
        const profileRef = window.firebaseDoc(window.firebaseDb, 'config', 'profile');
        const profileSnap = await window.firebaseGetDoc(profileRef);
        
        if (profileSnap.exists()) {
            const data = profileSnap.data();
            
            // Update inputs
            const usernameInput = document.getElementById('profile-username-input');
            const bioInput = document.getElementById('profile-bio-input');
            const locationInput = document.getElementById('profile-location-input');
            
            if (usernameInput) usernameInput.value = data.username || '4253';
            if (bioInput) bioInput.value = data.bio || 'Python/Lua Developer';
            if (locationInput) locationInput.value = data.location || 'nuh uh';
            
            // Load social links
            if (data.socialLinks && Array.isArray(data.socialLinks)) {
                loadSocialLinksDashboard(data.socialLinks);
            } else {
                loadSocialLinksDashboard([]);
            }
        } else {
            // Set defaults
            const usernameInput = document.getElementById('profile-username-input');
            const bioInput = document.getElementById('profile-bio-input');
            const locationInput = document.getElementById('profile-location-input');
            
            if (usernameInput) usernameInput.value = '4253';
            if (bioInput) bioInput.value = 'Python/Lua Developer';
            if (locationInput) locationInput.value = 'nuh uh';
            loadSocialLinksDashboard([]);
        }
        
        // Load view analytics
        await loadViewAnalytics();
    } catch (error) {
        console.error('Error loading profile dashboard:', error);
    }
}

// Load social links in dashboard
function loadSocialLinksDashboard(socialLinks) {
    const container = document.getElementById('social-links-list');
    if (!container) return;
    
    const countEl = document.getElementById('profile-social-count');
    if (countEl) countEl.textContent = socialLinks.length;
    
    if (socialLinks.length === 0) {
        container.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 1rem;">No social links added yet. Click "ADD SOCIAL" to add one.</p>';
        return;
    }
    
    container.innerHTML = socialLinks.map((link, index) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 40px; height: 40px; border-radius: 8px; background: ${link.iconColor || '#667eea'}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">${link.icon || '🔗'}</div>
                <div>
                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.6);">${link.label || ''}</div>
                    <div style="font-weight: 500;">${link.text || link.url}</div>
                </div>
            </div>
            <button class="btn btn-grey" onclick="deleteSocialLink(${index})" style="padding: 0.5rem 1rem; font-size: 0.875rem;">DELETE</button>
        </div>
    `).join('');
}

// Load view analytics
async function loadViewAnalytics() {
    if (!window.firebaseDb) return;
    
    try {
        const viewRef = window.firebaseDoc(window.firebaseDb, 'config', 'profileViews');
        const viewSnap = await window.firebaseGetDoc(viewRef);
        
        const analyticsEl = document.getElementById('view-analytics');
        const totalViewsEl = document.getElementById('profile-total-views');
        const todayViewsEl = document.getElementById('profile-today-views');
        
        if (viewSnap.exists()) {
            const data = viewSnap.data();
            const total = data.total || 0;
            const today = data.today || 0;
            
            if (totalViewsEl) totalViewsEl.textContent = total;
            if (todayViewsEl) todayViewsEl.textContent = today;
            
            if (analyticsEl) {
                const lastView = data.lastView ? new Date(data.lastView).toLocaleString() : 'Never';
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
                            <div style="font-size: 1rem; font-weight: 500;">${lastView}</div>
                        </div>
                    </div>
                `;
            }
        } else {
            if (totalViewsEl) totalViewsEl.textContent = '0';
            if (todayViewsEl) todayViewsEl.textContent = '0';
            if (analyticsEl) analyticsEl.innerHTML = '<p style="color: rgba(255,255,255,0.5);">No views tracked yet.</p>';
        }
    } catch (error) {
        console.error('Error loading view analytics:', error);
    }
}

// Save profile info
async function saveProfileInfo() {
    if (!window.firebaseDb) {
        alert('Firebase not initialized. Please wait a moment and try again.');
        return;
    }
    
    const username = document.getElementById('profile-username-input').value.trim();
    const bio = document.getElementById('profile-bio-input').value.trim();
    const location = document.getElementById('profile-location-input').value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    try {
        const profileRef = window.firebaseDoc(window.firebaseDb, 'config', 'profile');
        const profileSnap = await window.firebaseGetDoc(profileRef);
        
        const currentData = profileSnap.exists() ? profileSnap.data() : {};
        
        await window.firebaseSetDoc(profileRef, {
            ...currentData,
            username: username,
            bio: bio,
            location: location,
            lastModified: new Date().toISOString()
        }, { merge: true });
        
        alert('✅ Profile info saved!');
    } catch (error) {
        console.error('Error saving profile info:', error);
        alert('Failed to save profile info: ' + error.message);
    }
}

// Open add social modal
function openAddSocialModal() {
    // Simple prompt for now - can be enhanced with a proper modal
    const label = prompt('Enter label (e.g., "GitHub", "Twitter"):');
    if (!label) return;
    
    const text = prompt('Enter display text:');
    if (!text) return;
    
    const url = prompt('Enter URL:');
    if (!url) return;
    
    const icon = prompt('Enter icon emoji (or leave empty for default):') || '🔗';
    const iconColor = prompt('Enter icon color (hex, e.g., #667eea) or leave empty:') || '#667eea';
    
    addSocialLink({ label, text, url, icon, iconColor });
}

// Add social link
async function addSocialLink(linkData) {
    if (!window.firebaseDb) {
        alert('Firebase not initialized. Please wait a moment and try again.');
        return;
    }
    
    try {
        const profileRef = window.firebaseDoc(window.firebaseDb, 'config', 'profile');
        const profileSnap = await window.firebaseGetDoc(profileRef);
        
        const currentData = profileSnap.exists() ? profileSnap.data() : {};
        const socialLinks = currentData.socialLinks || [];
        
        socialLinks.push(linkData);
        
        await window.firebaseSetDoc(profileRef, {
            ...currentData,
            socialLinks: socialLinks,
            lastModified: new Date().toISOString()
        }, { merge: true });
        
        loadSocialLinksDashboard(socialLinks);
        alert('✅ Social link added!');
    } catch (error) {
        console.error('Error adding social link:', error);
        alert('Failed to add social link: ' + error.message);
    }
}

// Delete social link
async function deleteSocialLink(index) {
    if (!confirm('Are you sure you want to delete this social link?')) return;
    
    if (!window.firebaseDb) {
        alert('Firebase not initialized. Please wait a moment and try again.');
        return;
    }
    
    try {
        const profileRef = window.firebaseDoc(window.firebaseDb, 'config', 'profile');
        const profileSnap = await window.firebaseGetDoc(profileRef);
        
        if (!profileSnap.exists()) return;
        
        const currentData = profileSnap.data();
        const socialLinks = currentData.socialLinks || [];
        
        socialLinks.splice(index, 1);
        
        await window.firebaseSetDoc(profileRef, {
            ...currentData,
            socialLinks: socialLinks,
            lastModified: new Date().toISOString()
        }, { merge: true });
        
        loadSocialLinksDashboard(socialLinks);
        alert('✅ Social link deleted!');
    } catch (error) {
        console.error('Error deleting social link:', error);
        alert('Failed to delete social link: ' + error.message);
    }
}

// Open edit profile modal (placeholder - can be enhanced)
function openEditProfileModal() {
    // For now, just scroll to profile section
    const profileSection = document.querySelector('#custom-site-content .project-section');
    if (profileSection) {
        profileSection.scrollIntoView({ behavior: 'smooth' });
    }
}
