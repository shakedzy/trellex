/**
 * Trellex - Main Application Module
 * Handles state management, API calls, and view switching
 */

const App = {
    config: null,
    tickets: [],
    currentView: 'kanban',
    currentTheme: 'dark',
    themeMode: 'dark', // 'dark', 'light', or 'system'
    activeTagFilter: null,
    systemThemeMediaQuery: null,
    googleConnected: false,
    googleConfigured: false,
    showCreationDates: false, // Toggle for showing ticket creation dates
    
    // Gradient presets for dark mode
    darkGradientPresets: [
        { name: 'Midnight', start: '#1e1b4b', end: '#0f172a' },
        { name: 'Ocean', start: '#0c4a6e', end: '#082f49' },
        { name: 'Forest', start: '#14532d', end: '#052e16' },
        { name: 'Sunset', start: '#7c2d12', end: '#450a0a' },
        { name: 'Purple', start: '#581c87', end: '#3b0764' },
        { name: 'Slate', start: '#334155', end: '#0f172a' },
        { name: 'Rose', start: '#881337', end: '#4c0519' },
        { name: 'Amber', start: '#78350f', end: '#451a03' },
        { name: 'Cyan', start: '#164e63', end: '#083344' },
        { name: 'Emerald', start: '#065f46', end: '#022c22' }
    ],
    
    // Gradient presets for light mode
    lightGradientPresets: [
        { name: 'Lavender', start: '#e0e7ff', end: '#c7d2fe' },
        { name: 'Sky', start: '#e0f2fe', end: '#bae6fd' },
        { name: 'Mint', start: '#d1fae5', end: '#a7f3d0' },
        { name: 'Peach', start: '#ffedd5', end: '#fed7aa' },
        { name: 'Blush', start: '#fce7f3', end: '#fbcfe8' },
        { name: 'Cloud', start: '#f1f5f9', end: '#e2e8f0' },
        { name: 'Cream', start: '#fef3c7', end: '#fde68a' },
        { name: 'Rose', start: '#ffe4e6', end: '#fecdd3' },
        { name: 'Aqua', start: '#ccfbf1', end: '#99f6e4' },
        { name: 'Lilac', start: '#f3e8ff', end: '#e9d5ff' }
    ],
    
    /**
     * Get current gradient presets based on theme
     */
    get gradientPresets() {
        return this.currentTheme === 'light' ? this.lightGradientPresets : this.darkGradientPresets;
    },
    
    /**
     * Initialize the application
     */
    async init() {
        await this.loadConfig();
        await this.loadTickets();
        await this.checkGoogleStatus();
        this.setupSystemThemeListener();
        this.applyTheme();
        this.applyBackground();
        this.setupEventListeners();
        this.render();
    },
    
    /**
     * Check Google account connection status
     */
    async checkGoogleStatus() {
        try {
            const response = await fetch('/api/google/status');
            const data = await response.json();
            this.googleConnected = data.connected || false;
            this.googleConfigured = data.configured || false;
        } catch (error) {
            console.error('Failed to check Google status:', error);
            this.googleConnected = false;
            this.googleConfigured = false;
        }
    },
    
    /**
     * Set up listener for system theme changes
     */
    setupSystemThemeListener() {
        this.systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.systemThemeMediaQuery.addEventListener('change', (e) => {
            if (this.themeMode === 'system') {
                this.currentTheme = e.matches ? 'dark' : 'light';
                this.applyTheme();
                this.applyBackground();
            }
        });
    },
    
    /**
     * Get the effective theme based on mode
     */
    getEffectiveTheme() {
        if (this.themeMode === 'system') {
            return this.systemThemeMediaQuery?.matches ? 'dark' : 'light';
        }
        return this.themeMode;
    },
    
    /**
     * Load configuration from server
     */
    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            this.config = await response.json();
            // Load theme mode from config (supports 'dark', 'light', 'system')
            this.themeMode = this.config.theme || 'dark';
            this.currentTheme = this.getEffectiveTheme();
            
            // Migrate old single background to separate light/dark backgrounds if needed
            if (this.config.background && !this.config.background_dark && !this.config.background_light) {
                // Determine which theme the old background was for
                const oldBg = this.config.background;
                if (this.themeMode === 'light' || this.themeMode === 'system') {
                    this.config.background_light = oldBg;
                    this.config.background_dark = { gradient_start: '#1e1b4b', gradient_end: '#0f172a' };
                } else {
                    this.config.background_dark = oldBg;
                    this.config.background_light = { gradient_start: '#e0e7ff', gradient_end: '#c7d2fe' };
                }
            }
        } catch (error) {
            console.error('Failed to load config:', error);
            this.config = {
                lists: [],
                background_dark: { gradient_start: '#1e1b4b', gradient_end: '#0f172a' },
                background_light: { gradient_start: '#e0e7ff', gradient_end: '#c7d2fe' },
                theme: 'dark'
            };
            this.themeMode = 'dark';
            this.currentTheme = 'dark';
        }
    },
    
    /**
     * Save configuration to server
     */
    async saveConfig() {
        try {
            const response = await fetch('/api/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.config)
            });
            this.config = await response.json();
            this.applyBackground();
            this.render();
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    },
    
    /**
     * Save all tickets to server (batch update)
     */
    async saveAllTickets() {
        try {
            // Use bulk update endpoint to avoid race conditions
            await fetch('/api/tickets/bulk', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.tickets)
            });
        } catch (error) {
            console.error('Failed to save tickets:', error);
        }
    },
    
    /**
     * Load tickets from server
     */
    async loadTickets() {
        try {
            const response = await fetch('/api/tickets');
            this.tickets = await response.json();
        } catch (error) {
            console.error('Failed to load tickets:', error);
            this.tickets = [];
        }
    },
    
    /**
     * Create a new ticket
     */
    async createTicket(ticketData) {
        try {
            const response = await fetch('/api/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ticketData)
            });
            const ticket = await response.json();
            this.tickets.push(ticket);
            this.render();
            return ticket;
        } catch (error) {
            console.error('Failed to create ticket:', error);
            return null;
        }
    },
    
    /**
     * Update a ticket
     */
    async updateTicket(ticketId, ticketData) {
        try {
            const response = await fetch(`/api/tickets/${ticketId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ticketData)
            });
            const updatedTicket = await response.json();
            const index = this.tickets.findIndex(t => t.id === ticketId);
            if (index !== -1) {
                this.tickets[index] = updatedTicket;
            }
            this.render();
            return updatedTicket;
        } catch (error) {
            console.error('Failed to update ticket:', error);
            return null;
        }
    },
    
    /**
     * Delete a ticket
     */
    async deleteTicket(ticketId) {
        try {
            await fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' });
            this.tickets = this.tickets.filter(t => t.id !== ticketId);
            this.render();
        } catch (error) {
            console.error('Failed to delete ticket:', error);
        }
    },
    
    /**
     * Move a ticket to a different list
     */
    async moveTicket(ticketId, listId) {
        try {
            const response = await fetch(`/api/tickets/${ticketId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ list_id: listId })
            });
            const updatedTicket = await response.json();
            const index = this.tickets.findIndex(t => t.id === ticketId);
            if (index !== -1) {
                this.tickets[index] = updatedTicket;
            }
            return updatedTicket;
        } catch (error) {
            console.error('Failed to move ticket:', error);
            return null;
        }
    },
    
    /**
     * Archive or unarchive a ticket
     */
    async archiveTicket(ticketId, archived = true) {
        try {
            const response = await fetch(`/api/tickets/${ticketId}/archive`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived })
            });
            const updatedTicket = await response.json();
            const index = this.tickets.findIndex(t => t.id === ticketId);
            if (index !== -1) {
                this.tickets[index] = updatedTicket;
            }
            this.render();
            return updatedTicket;
        } catch (error) {
            console.error('Failed to archive ticket:', error);
            return null;
        }
    },
    
    /**
     * Reorder tickets (after drag & drop)
     */
    async reorderTickets(orders) {
        try {
            const response = await fetch('/api/tickets/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orders })
            });
            this.tickets = await response.json();
        } catch (error) {
            console.error('Failed to reorder tickets:', error);
        }
    },
    
    /**
     * Apply theme to document
     */
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        this.updateThemeToggleIcon();
    },
    
    /**
     * Update the theme toggle button icon based on current mode
     */
    updateThemeToggleIcon() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;
        
        // Remove existing mode classes
        toggle.classList.remove('mode-dark', 'mode-light', 'mode-system');
        toggle.classList.add(`mode-${this.themeMode}`);
        
        // Update title
        const titles = {
            'dark': 'Dark mode (click to switch to light)',
            'light': 'Light mode (click to switch to auto)',
            'system': `Auto mode (${this.currentTheme}) - click to switch to dark`
        };
        toggle.title = titles[this.themeMode];
    },
    
    /**
     * Toggle between dark, light, and system themes
     */
    async toggleTheme() {
        // Cycle: dark -> light -> system -> dark
        const modes = ['dark', 'light', 'system'];
        const currentIndex = modes.indexOf(this.themeMode);
        this.themeMode = modes[(currentIndex + 1) % modes.length];
        
        // Update effective theme
        this.currentTheme = this.getEffectiveTheme();
        this.applyTheme();
        
        // Update config with new theme mode (backgrounds are preserved)
        this.config.theme = this.themeMode;
        
        this.applyBackground();
        await this.saveConfig();
    },
    
    /**
     * Apply background gradient from config based on current theme
     */
    applyBackground() {
        const bgKey = this.currentTheme === 'light' ? 'background_light' : 'background_dark';
        const fallbackStart = this.currentTheme === 'light' ? '#e0e7ff' : '#1e1b4b';
        const fallbackEnd = this.currentTheme === 'light' ? '#c7d2fe' : '#0f172a';
        
        // Try theme-specific background, fall back to old 'background' key for compatibility
        const bg = this.config?.[bgKey] || this.config?.background;
        const start = bg?.gradient_start || fallbackStart;
        const end = bg?.gradient_end || fallbackEnd;
        
        document.documentElement.style.setProperty('--bg-gradient-start', start);
        document.documentElement.style.setProperty('--bg-gradient-end', end);
    },
    
    /**
     * Set background for current theme
     */
    setBackground(gradientStart, gradientEnd) {
        const bgKey = this.currentTheme === 'light' ? 'background_light' : 'background_dark';
        this.config[bgKey] = {
            gradient_start: gradientStart,
            gradient_end: gradientEnd
        };
    },
    
    /**
     * Get current background settings for the active theme
     */
    getCurrentBackground() {
        const bgKey = this.currentTheme === 'light' ? 'background_light' : 'background_dark';
        return this.config?.[bgKey] || this.config?.background || {};
    },
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // View switching
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });
        
        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Filter button
        const filterBtn = document.getElementById('filter-btn');
        const filterDropdown = document.getElementById('filter-dropdown');
        
        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.renderFilterDropdown();
            filterDropdown.classList.toggle('active');
        });
        
        // Close filter dropdown when clicking outside
        document.addEventListener('click', () => {
            filterDropdown.classList.remove('active');
        });
        
        // Settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            Modal.openSettings();
        });
        
        // Keyboard shortcut: Ctrl+K / Cmd+K to open add new card modal
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                // Only open if in kanban view and no modal is currently open
                if (this.currentView === 'kanban' && !document.querySelector('.modal-overlay.active')) {
                    // Open new card modal with the configured default list (or first list as fallback)
                    const defaultListId = this.config?.quick_add_default_list || this.config?.lists?.[0]?.id;
                    if (defaultListId) {
                        Modal.openTicket(null, defaultListId);
                    }
                }
            }
            
            // Keyboard shortcut: Ctrl+D / Cmd+D to toggle creation dates
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
                e.preventDefault();
                this.toggleCreationDates();
            }
        });
    },
    
    /**
     * Toggle display of ticket creation dates
     */
    toggleCreationDates() {
        this.showCreationDates = !this.showCreationDates;
        document.body.classList.toggle('show-creation-dates', this.showCreationDates);
    },
    
    /**
     * Switch between Kanban and Archive views
     */
    switchView(view) {
        this.currentView = view;
        
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Update view visibility
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        document.getElementById(`${view}-view`).classList.add('active');
        
        this.render();
    },
    
    /**
     * Render the current view
     */
    render() {
        if (this.currentView === 'kanban') {
            Kanban.render();
        } else if (this.currentView === 'archive') {
            this.renderArchive();
        }
    },
    
    /**
     * Render archive view
     */
    renderArchive() {
        const grid = document.getElementById('archive-grid');
        const empty = document.getElementById('archive-empty');
        
        let archivedTickets = this.tickets.filter(t => t.archived);
        
        // Apply tag filter if active
        if (this.activeTagFilter) {
            archivedTickets = archivedTickets.filter(t => t.tags && t.tags.includes(this.activeTagFilter));
        }
        
        if (archivedTickets.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }
        
        empty.classList.add('hidden');
        
        grid.innerHTML = archivedTickets.map(ticket => `
            <div class="archived-card" data-ticket-id="${ticket.id}">
                <div class="ticket-title">${this.escapeHtml(ticket.title)}</div>
                ${ticket.status ? `<div class="ticket-status">Status: ${this.escapeHtml(ticket.status)}</div>` : ''}
                ${ticket.tags && ticket.tags.length > 0 ? `
                    <div class="ticket-meta">
                        ${ticket.tags.map(tag => {
                            const tagData = this.getTagData(tag);
                            const colorStyle = tagData.color ? `background: ${tagData.color}; color: white;` : '';
                            return `<span class="ticket-tag" style="${colorStyle}">${this.escapeHtml(tag)}</span>`;
                        }).join('')}
                    </div>
                ` : ''}
                <button class="restore-btn" data-ticket-id="${ticket.id}">Restore</button>
            </div>
        `).join('');
        
        // Add event listeners
        grid.querySelectorAll('.archived-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('restore-btn')) {
                    const ticketId = card.dataset.ticketId;
                    const ticket = this.tickets.find(t => t.id === ticketId);
                    if (ticket) {
                        Modal.openTicket(ticket);
                    }
                }
            });
        });
        
        grid.querySelectorAll('.restore-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const ticketId = btn.dataset.ticketId;
                this.archiveTicket(ticketId, false);
            });
        });
    },
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Truncate text to maxLength and add ellipsis if needed
     */
    truncate(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },
    
    /**
     * Get priority sort order (lower = higher priority)
     */
    getPriorityOrder(priority) {
        const order = { 'high': 0, 'none': 1, 'low': 2 };
        return order[priority] ?? 1;
    },
    
    /**
     * Get tickets for a specific list (with tag filter applied), sorted by priority
     */
    getTicketsForList(listId) {
        let tickets = this.tickets.filter(t => t.list_id === listId && !t.archived);
        
        // Apply tag filter if active
        if (this.activeTagFilter) {
            tickets = tickets.filter(t => t.tags && t.tags.includes(this.activeTagFilter));
        }
        
        // Sort by priority: high first, then none, then low
        // Preserve relative order within each priority group (stable sort)
        tickets.sort((a, b) => {
            return this.getPriorityOrder(a.priority) - this.getPriorityOrder(b.priority);
        });
        
        return tickets;
    },
    
    /**
     * Get tag data (color) from config
     */
    getTagData(tagName) {
        const tagColors = this.config?.tag_colors || {};
        return { color: tagColors[tagName] || null };
    },
    
    /**
     * Check if a list is marked as a completed list
     */
    isCompletedList(listId) {
        const list = this.config?.lists?.find(l => l.id === listId);
        return list?.is_completed_list || false;
    },
    
    /**
     * Get the due date status for a ticket (for coloring)
     * Returns: 'completed', 'overdue', 'critical', 'warning', 'soon', 'normal', or null
     */
    getDueDateStatus(ticket) {
        if (!ticket.due_date) return null;
        
        // If in a completed list, always return 'completed'
        if (this.isCompletedList(ticket.list_id)) {
            return 'completed';
        }
        
        // Compare by calendar days, not exact hours
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDate = new Date(ticket.due_date);
        const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        
        // Calculate difference in days
        const diffDays = Math.floor((dueDateMidnight - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return 'overdue'; // Past deadline - grey
        } else if (diffDays <= 1) {
            return 'critical'; // Today or tomorrow - red
        } else if (diffDays <= 3) {
            return 'warning'; // 2-3 days - orange
        } else if (diffDays <= 7) {
            return 'soon'; // 4-7 days - yellow
        }
        
        return 'normal';
    },
    
    /**
     * Set tag color
     */
    setTagColor(tagName, color) {
        if (!this.config.tag_colors) {
            this.config.tag_colors = {};
        }
        if (color) {
            this.config.tag_colors[tagName] = color;
        } else {
            delete this.config.tag_colors[tagName];
        }
    },
    
    /**
     * Get all unique tags from tickets
     */
    getAllTags() {
        const tags = new Set();
        this.tickets.forEach(ticket => {
            if (ticket.tags) {
                ticket.tags.forEach(tag => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    },
    
    /**
     * Set tag filter
     */
    setTagFilter(tag) {
        this.activeTagFilter = tag;
        this.render();
        this.updateFilterDisplay();
    },
    
    /**
     * Clear tag filter
     */
    clearTagFilter() {
        this.activeTagFilter = null;
        this.render();
        this.updateFilterDisplay();
    },
    
    /**
     * Update filter display in UI
     */
    updateFilterDisplay() {
        const filterBtn = document.getElementById('filter-btn');
        const filterDropdown = document.getElementById('filter-dropdown');
        
        if (this.activeTagFilter) {
            filterBtn.classList.add('active');
            filterBtn.title = `Filtering: ${this.activeTagFilter}`;
        } else {
            filterBtn.classList.remove('active');
            filterBtn.title = 'Filter by tag';
        }
    },
    
    /**
     * Render filter dropdown
     */
    renderFilterDropdown() {
        const dropdown = document.getElementById('filter-dropdown');
        const tags = this.getAllTags();
        
        if (tags.length === 0) {
            dropdown.innerHTML = '<div class="filter-empty">No tags available</div>';
            return;
        }
        
        let html = '';
        
        if (this.activeTagFilter) {
            html += `<div class="filter-item filter-clear" data-clear="true">✕ Clear filter</div>`;
        }
        
        html += tags.map(tag => {
            const tagData = this.getTagData(tag);
            const colorStyle = tagData.color ? `background: ${tagData.color}; color: white;` : '';
            const isActive = tag === this.activeTagFilter;
            return `<div class="filter-item ${isActive ? 'active' : ''}" data-tag="${this.escapeHtml(tag)}">
                <span class="filter-tag-color" style="${colorStyle}">${this.escapeHtml(tag)}</span>
            </div>`;
        }).join('');
        
        dropdown.innerHTML = html;
        
        // Add event listeners
        dropdown.querySelectorAll('.filter-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (item.dataset.clear) {
                    this.clearTagFilter();
                } else {
                    this.setTagFilter(item.dataset.tag);
                }
                dropdown.classList.remove('active');
            });
        });
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
