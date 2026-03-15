/**
 * Trellex - Modal Module
 * Handles ticket modal, settings modal, and list modal
 */

const Modal = {
    currentTicket: null,
    currentListId: null,
    currentList: null,
    tempTags: [],
    tempTasks: [],
    tempRepos: [],
    tempDocs: [],
    tempContacts: [],
    tempDueDate: null,
    tempPriority: 'none',
    contactSource: 'directory',
    contactSearchTimeout: null,
    editingContactIndex: null,
    listsSortable: null,
    
    // Color presets for lists
    colorPresets: [
        { name: 'Indigo', color: '#6366f1' },
        { name: 'Blue', color: '#3b82f6' },
        { name: 'Cyan', color: '#06b6d4' },
        { name: 'Teal', color: '#14b8a6' },
        { name: 'Green', color: '#22c55e' },
        { name: 'Emerald', color: '#10b981' },
        { name: 'Lime', color: '#84cc16' },
        { name: 'Yellow', color: '#eab308' },
        { name: 'Amber', color: '#f59e0b' },
        { name: 'Orange', color: '#f97316' },
        { name: 'Red', color: '#ef4444' },
        { name: 'Rose', color: '#f43f5e' },
        { name: 'Pink', color: '#ec4899' },
        { name: 'Fuchsia', color: '#d946ef' },
        { name: 'Purple', color: '#a855f7' },
        { name: 'Violet', color: '#8b5cf6' },
        { name: 'Slate', color: '#64748b' },
        { name: 'Gray', color: '#6b7280' },
    ],
    
    
    /**
     * Initialize modal event listeners
     */
    init() {
        // Ticket modal
        document.getElementById('modal-close').addEventListener('click', () => this.closeTicketModal());
        document.getElementById('modal-save-btn').addEventListener('click', () => this.saveTicket());
        document.getElementById('modal-archive-btn').addEventListener('click', () => this.archiveCurrentTicket());
        document.getElementById('modal-delete-btn').addEventListener('click', () => this.deleteCurrentTicket());
        document.getElementById('add-tag-btn').addEventListener('click', () => this.addTag());
        document.getElementById('add-task-btn').addEventListener('click', () => this.addTask());
        document.getElementById('add-repo-btn').addEventListener('click', () => this.addRepo());
        document.getElementById('add-docs-btn').addEventListener('click', () => this.addDocs());
        document.getElementById('clear-due-date-btn').addEventListener('click', () => this.clearDueDate());
        
        // Priority dropdown change - update icon preview
        document.getElementById('modal-priority').addEventListener('change', (e) => {
            this.updatePriorityIconPreview(e.target.value);
        });
        
        // Tag input enter key
        document.getElementById('modal-tag-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTag();
        });
        
        // Task input enter key
        document.getElementById('modal-task-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        
        // Repo input enter key
        document.getElementById('modal-repo-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addRepo();
        });
        
        // Docs URL input enter key
        document.getElementById('modal-docs-url').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addDocs();
        });
        
        // Contact input with debounced search
        const contactInput = document.getElementById('modal-contact-input');
        contactInput.addEventListener('input', (e) => {
            this.handleContactSearch(e.target.value);
        });
        contactInput.addEventListener('focus', () => {
            if (contactInput.value.length >= 2) {
                document.getElementById('contact-suggestions').classList.add('active');
            }
        });
        
        // Contact source toggle
        document.querySelectorAll('.contact-source-toggle .source-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.contact-source-toggle .source-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.contactSource = btn.dataset.source;
                // Re-search with new source
                const query = document.getElementById('modal-contact-input').value;
                if (query.length >= 2) {
                    this.searchContacts(query);
                }
            });
        });
        
        // Connect Google button in ticket modal
        document.getElementById('connect-google-btn').addEventListener('click', () => {
            window.location.href = '/api/google/auth';
        });
        
        // Close contact suggestions when clicking outside
        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('contact-input-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                document.getElementById('contact-suggestions').classList.remove('active');
            }
        });
        
        // Settings modal
        document.getElementById('settings-close').addEventListener('click', () => this.closeSettings());
        document.getElementById('settings-save-btn').addEventListener('click', () => this.saveSettings());
        document.getElementById('add-new-list-btn').addEventListener('click', () => this.openListModal(null));
        
        // Gradient color pickers
        document.getElementById('gradient-start').addEventListener('input', () => this.updateGradientPreview());
        document.getElementById('gradient-end').addEventListener('input', () => this.updateGradientPreview());
        
        // Google account buttons in settings
        document.getElementById('settings-connect-google-btn').addEventListener('click', () => {
            window.location.href = '/api/google/auth';
        });
        document.getElementById('settings-disconnect-google-btn').addEventListener('click', async () => {
            await this.disconnectGoogle();
        });
        
        // List modal
        document.getElementById('list-modal-close').addEventListener('click', () => this.closeListModal());
        document.getElementById('list-save-btn').addEventListener('click', () => this.saveList());
        document.getElementById('list-delete-btn').addEventListener('click', () => this.deleteList());
        
        // Emoji picker
        document.getElementById('emoji-picker-btn').addEventListener('click', () => this.toggleEmojiPicker());
        document.getElementById('list-emoji-input').addEventListener('click', () => this.toggleEmojiPicker());
        document.getElementById('emoji-clear-btn').addEventListener('click', () => this.clearEmoji());
        
        // Listen for emoji selection from emoji-picker-element
        document.getElementById('emoji-picker').addEventListener('emoji-click', (e) => {
            document.getElementById('list-emoji-input').value = e.detail.unicode;
            document.getElementById('emoji-picker-container').classList.remove('active');
        });
        
        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });
        
        // Close modals on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(overlay => {
                    overlay.classList.remove('active');
                });
            }
        });
    },
    
    // ==================== Ticket Modal ====================
    
    /**
     * Open ticket modal for viewing/editing or creating
     */
    openTicket(ticket, listId = null) {
        this.currentTicket = ticket;
        this.currentListId = listId || (ticket ? ticket.list_id : App.config.lists[0]?.id);
        
        const modal = document.getElementById('ticket-modal');
        const archiveBtn = document.getElementById('modal-archive-btn');
        const deleteBtn = document.getElementById('modal-delete-btn');
        
        if (ticket) {
            // Editing existing ticket
            document.getElementById('modal-title').value = ticket.title || '';
            document.getElementById('modal-status').value = ticket.status || '';
            document.getElementById('modal-description').value = ticket.description || '';
            
            // Due date
            this.tempDueDate = ticket.due_date || null;
            document.getElementById('modal-due-date').value = ticket.due_date ? ticket.due_date.split('T')[0] : '';
            
            // Priority
            this.tempPriority = ticket.priority || 'none';
            document.getElementById('modal-priority').value = this.tempPriority;
            this.updatePriorityIconPreview(this.tempPriority);
            
            // Tags
            this.tempTags = [...(ticket.tags || [])];
            
            // Tasks
            this.tempTasks = (ticket.tasks || []).map(t => ({ ...t }));
            
            // Repos - handle both old single link and new array format
            if (Array.isArray(ticket.repo_links)) {
                this.tempRepos = [...ticket.repo_links];
            } else if (ticket.repo_link?.url) {
                this.tempRepos = [ticket.repo_link];
            } else {
                this.tempRepos = [];
            }
            
            // Docs - handle both old single link and new array format
            if (Array.isArray(ticket.docs_links)) {
                this.tempDocs = [...ticket.docs_links];
            } else if (ticket.docs_link?.url) {
                this.tempDocs = [ticket.docs_link];
            } else {
                this.tempDocs = [];
            }
            
            // Contacts
            this.tempContacts = [...(ticket.contacts || [])];
            
            archiveBtn.textContent = ticket.archived ? 'Unarchive' : 'Archive';
            archiveBtn.style.display = 'block';
            deleteBtn.style.display = 'block';
        } else {
            // Creating new ticket
            document.getElementById('modal-title').value = '';
            document.getElementById('modal-status').value = '';
            document.getElementById('modal-description').value = '';
            document.getElementById('modal-due-date').value = '';
            
            this.tempTags = [];
            this.tempTasks = [];
            this.tempRepos = [];
            this.tempDocs = [];
            this.tempContacts = [];
            this.tempDueDate = null;
            this.tempPriority = 'none';
            document.getElementById('modal-priority').value = 'none';
            this.updatePriorityIconPreview('none');
            
            archiveBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
        }
        
        this.renderTags();
        this.renderTasks();
        this.renderRepos();
        this.renderDocs();
        this.renderContacts();
        this.updateContactsUI();
        
        modal.classList.add('active');
        // Small delay to ensure modal animation completes before focusing
        setTimeout(() => {
            document.getElementById('modal-title').focus();
        }, 50);
    },
    
    /**
     * Close ticket modal
     */
    closeTicketModal() {
        document.getElementById('ticket-modal').classList.remove('active');
        this.currentTicket = null;
        this.currentListId = null;
    },
    
    /**
     * Save ticket (create or update)
     */
    async saveTicket() {
        const title = document.getElementById('modal-title').value.trim();
        
        if (!title) {
            alert('Please enter a title');
            return;
        }
        
        // Get due date from input
        const dueDateInput = document.getElementById('modal-due-date').value;
        const dueDate = dueDateInput ? dueDateInput : null;
        
        const ticketData = {
            title,
            status: document.getElementById('modal-status').value.trim(),
            description: document.getElementById('modal-description').value.trim(),
            due_date: dueDate,
            priority: document.getElementById('modal-priority').value,
            tags: this.tempTags,
            tasks: this.tempTasks,
            repo_links: this.tempRepos,
            docs_links: this.tempDocs,
            contacts: this.tempContacts,
            list_id: this.currentListId,
            archived: this.currentTicket?.archived || false
        };
        
        if (this.currentTicket) {
            await App.updateTicket(this.currentTicket.id, ticketData);
        } else {
            await App.createTicket(ticketData);
        }
        
        // Save config if tag colors were added
        await App.saveConfig();
        
        this.closeTicketModal();
    },
    
    /**
     * Archive/unarchive current ticket
     */
    async archiveCurrentTicket() {
        if (!this.currentTicket) return;
        
        const newArchived = !this.currentTicket.archived;
        await App.archiveTicket(this.currentTicket.id, newArchived);
        this.closeTicketModal();
    },
    
    /**
     * Delete current ticket
     */
    async deleteCurrentTicket() {
        if (!this.currentTicket) return;
        
        if (confirm('Are you sure you want to delete this ticket?')) {
            await App.deleteTicket(this.currentTicket.id);
            this.closeTicketModal();
        }
    },
    
    /**
     * Clear the due date
     */
    clearDueDate() {
        document.getElementById('modal-due-date').value = '';
        this.tempDueDate = null;
    },
    
    /**
     * Update priority icon preview in modal
     */
    updatePriorityIconPreview(priority) {
        const preview = document.getElementById('priority-icon-preview');
        preview.className = 'priority-icon-preview';
        
        if (priority === 'high') {
            preview.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="17 11 12 6 7 11"></polyline>
                    <polyline points="17 18 12 13 7 18"></polyline>
                </svg>
            `;
            preview.classList.add('priority-high');
        } else if (priority === 'low') {
            preview.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="7 13 12 18 17 13"></polyline>
                    <polyline points="7 6 12 11 17 6"></polyline>
                </svg>
            `;
            preview.classList.add('priority-low');
        } else {
            preview.innerHTML = '';
        }
    },
    
    /**
     * Add a tag with color
     */
    addTag() {
        const input = document.getElementById('modal-tag-input');
        const colorInput = document.getElementById('modal-tag-color');
        const tag = input.value.trim();
        const color = colorInput.value;
        
        if (tag && !this.tempTags.includes(tag)) {
            this.tempTags.push(tag);
            // Save tag color to config
            App.setTagColor(tag, color);
            this.renderTags();
        }
        
        input.value = '';
        input.focus();
    },
    
    /**
     * Remove a tag
     */
    removeTag(tag) {
        this.tempTags = this.tempTags.filter(t => t !== tag);
        this.renderTags();
    },
    
    /**
     * Render tags in modal
     */
    renderTags() {
        const container = document.getElementById('modal-tags');
        container.innerHTML = this.tempTags.map(tag => {
            const tagData = App.getTagData(tag);
            const colorStyle = tagData.color ? `background: ${tagData.color}; color: white;` : '';
            return `
                <div class="tag-item" style="${colorStyle}">
                    <span>${App.escapeHtml(tag)}</span>
                    <button class="tag-remove" data-tag="${App.escapeHtml(tag)}">&times;</button>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeTag(btn.dataset.tag);
            });
        });
        
        // Render existing tags that can be clicked to add
        this.renderExistingTags();
    },
    
    /**
     * Render existing tags that can be clicked to add
     */
    renderExistingTags() {
        const container = document.getElementById('existing-tags');
        const allTags = App.getAllTags();
        
        // Filter out tags already added to this ticket
        const availableTags = allTags.filter(tag => !this.tempTags.includes(tag));
        
        if (availableTags.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        container.innerHTML = `
            <div class="existing-tags-label">Click to add existing tags:</div>
            <div class="existing-tags-list">
                ${availableTags.map(tag => {
                    const tagData = App.getTagData(tag);
                    const colorStyle = tagData.color ? `background: ${tagData.color}; color: white;` : '';
                    return `<span class="existing-tag" data-tag="${App.escapeHtml(tag)}" style="${colorStyle}">${App.escapeHtml(tag)}</span>`;
                }).join('')}
            </div>
        `;
        
        container.querySelectorAll('.existing-tag').forEach(tagEl => {
            tagEl.addEventListener('click', () => {
                const tag = tagEl.dataset.tag;
                if (!this.tempTags.includes(tag)) {
                    this.tempTags.push(tag);
                    this.renderTags();
                }
            });
        });
    },
    
    /**
     * Add a task
     */
    addTask() {
        const input = document.getElementById('modal-task-input');
        const text = input.value.trim();
        
        if (text) {
            this.tempTasks.push({ text, done: false });
            this.renderTasks();
        }
        
        input.value = '';
        input.focus();
    },
    
    /**
     * Remove a task
     */
    removeTask(index) {
        this.tempTasks.splice(index, 1);
        this.renderTasks();
    },
    
    /**
     * Toggle task completion
     */
    toggleTask(index) {
        this.tempTasks[index].done = !this.tempTasks[index].done;
        this.renderTasks();
    },
    
    /**
     * Render tasks in modal
     */
    renderTasks() {
        const container = document.getElementById('modal-tasks');
        container.innerHTML = this.tempTasks.map((task, index) => `
            <div class="task-item">
                <input type="checkbox" class="task-checkbox" data-index="${index}" ${task.done ? 'checked' : ''}>
                <span class="task-text ${task.done ? 'done' : ''}">${App.escapeHtml(task.text)}</span>
                <button class="task-remove" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `).join('');
        
        container.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.toggleTask(parseInt(checkbox.dataset.index));
            });
        });
        
        container.querySelectorAll('.task-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeTask(parseInt(btn.dataset.index));
            });
        });
    },
    
    /**
     * Extract repo name from URL
     */
    extractRepoName(url) {
        try {
            const parts = url.replace(/\/$/, '').split('/');
            return parts[parts.length - 1] || 'Repo';
        } catch {
            return 'Repo';
        }
    },
    
    /**
     * Add a repo link
     */
    addRepo() {
        const input = document.getElementById('modal-repo-url');
        const url = input.value.trim();
        
        if (url) {
            const title = this.extractRepoName(url);
            this.tempRepos.push({ title, url });
            this.renderRepos();
        }
        
        input.value = '';
        input.focus();
    },
    
    /**
     * Remove a repo link
     */
    removeRepo(index) {
        this.tempRepos.splice(index, 1);
        this.renderRepos();
    },
    
    /**
     * Render repo links in modal
     */
    renderRepos() {
        const container = document.getElementById('modal-repos');
        container.innerHTML = this.tempRepos.map((repo, index) => `
            <div class="link-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
                <a href="${App.escapeHtml(repo.url)}" target="_blank" class="link-item-text">${App.escapeHtml(repo.title)}</a>
                <button class="link-remove" data-index="${index}">&times;</button>
            </div>
        `).join('');
        
        container.querySelectorAll('.link-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeRepo(parseInt(btn.dataset.index));
            });
        });
    },
    
    /**
     * Add a docs link
     */
    addDocs() {
        const titleInput = document.getElementById('modal-docs-title');
        const urlInput = document.getElementById('modal-docs-url');
        const url = urlInput.value.trim();
        const title = titleInput.value.trim() || 'Docs';
        
        if (url) {
            this.tempDocs.push({ title, url });
            this.renderDocs();
        }
        
        titleInput.value = '';
        urlInput.value = '';
        titleInput.focus();
    },
    
    /**
     * Remove a docs link
     */
    removeDocs(index) {
        this.tempDocs.splice(index, 1);
        this.renderDocs();
    },
    
    /**
     * Render docs links in modal
     */
    renderDocs() {
        const container = document.getElementById('modal-docs');
        container.innerHTML = this.tempDocs.map((doc, index) => `
            <div class="link-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <a href="${App.escapeHtml(doc.url)}" target="_blank" class="link-item-text">${App.escapeHtml(doc.title)}</a>
                <button class="link-remove" data-index="${index}">&times;</button>
            </div>
        `).join('');
        
        container.querySelectorAll('.link-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeDocs(parseInt(btn.dataset.index));
            });
        });
    },
    
    // ==================== Contacts ====================
    
    /**
     * Update contacts UI based on Google connection status
     */
    async updateContactsUI() {
        const inputWrapper = document.getElementById('contact-input-wrapper');
        const connectPrompt = document.getElementById('google-connect-prompt');
        
        if (App.googleConnected) {
            inputWrapper.style.display = 'block';
            connectPrompt.style.display = 'none';
        } else {
            inputWrapper.style.display = 'none';
            connectPrompt.style.display = 'block';
        }
    },
    
    /**
     * Handle contact search input with debounce
     */
    handleContactSearch(query) {
        // Clear previous timeout
        if (this.contactSearchTimeout) {
            clearTimeout(this.contactSearchTimeout);
        }
        
        const suggestions = document.getElementById('contact-suggestions');
        
        if (query.length < 2) {
            suggestions.classList.remove('active');
            suggestions.innerHTML = '';
            return;
        }
        
        // Debounce the search
        this.contactSearchTimeout = setTimeout(() => {
            this.searchContacts(query);
        }, 300);
    },
    
    /**
     * Search contacts from Google
     */
    async searchContacts(query) {
        const suggestions = document.getElementById('contact-suggestions');
        
        try {
            suggestions.innerHTML = '<div class="contact-suggestion-loading">Searching...</div>';
            suggestions.classList.add('active');
            
            const response = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}&source=${this.contactSource}`);
            
            if (!response.ok) {
                if (response.status === 401) {
                    App.googleConnected = false;
                    this.updateContactsUI();
                    return;
                }
                throw new Error('Search failed');
            }
            
            const contacts = await response.json();
            this.renderContactSuggestions(contacts);
        } catch (error) {
            console.error('Error searching contacts:', error);
            suggestions.innerHTML = '<div class="contact-suggestion-error">Error searching contacts</div>';
        }
    },
    
    /**
     * Get initials from a name for placeholder
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },
    
    /**
     * Render contact suggestions dropdown
     */
    renderContactSuggestions(contacts) {
        const suggestions = document.getElementById('contact-suggestions');
        
        if (contacts.length === 0) {
            suggestions.innerHTML = '<div class="contact-suggestion-empty">No contacts found</div>';
            return;
        }
        
        // Filter out already added contacts
        const availableContacts = contacts.filter(c => 
            !this.tempContacts.some(tc => tc.email === c.email)
        );
        
        if (availableContacts.length === 0) {
            suggestions.innerHTML = '<div class="contact-suggestion-empty">All matching contacts already added</div>';
            return;
        }
        
        suggestions.innerHTML = availableContacts.map(contact => {
            const photoHtml = contact.photo 
                ? `<img src="${App.escapeHtml(contact.photo)}" alt="" class="contact-suggestion-photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <div class="contact-suggestion-photo-placeholder" style="display:none;">${this.getInitials(contact.name)}</div>`
                : `<div class="contact-suggestion-photo-placeholder">${this.getInitials(contact.name)}</div>`;
            
            return `
                <div class="contact-suggestion" data-email="${App.escapeHtml(contact.email)}" data-name="${App.escapeHtml(contact.name)}" data-photo="${App.escapeHtml(contact.photo || '')}">
                    ${photoHtml}
                    <div class="contact-suggestion-info">
                        <span class="contact-suggestion-name">${App.escapeHtml(contact.name)}</span>
                        <span class="contact-suggestion-email">${App.escapeHtml(contact.email)}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        suggestions.querySelectorAll('.contact-suggestion').forEach(item => {
            item.addEventListener('click', () => {
                this.addContact({
                    name: item.dataset.name,
                    email: item.dataset.email,
                    photo: item.dataset.photo || null,
                    role: null
                });
                document.getElementById('modal-contact-input').value = '';
                suggestions.classList.remove('active');
            });
        });
    },
    
    /**
     * Add a contact
     */
    addContact(contact) {
        // Check if already added
        if (this.tempContacts.some(c => c.email === contact.email)) {
            return;
        }
        
        this.tempContacts.push({
            name: contact.name,
            email: contact.email,
            photo: contact.photo || null,
            role: contact.role || null
        });
        
        this.renderContacts();
    },
    
    /**
     * Remove a contact
     */
    removeContact(index) {
        this.tempContacts.splice(index, 1);
        this.renderContacts();
    },
    
    /**
     * Render contacts in modal
     */
    renderContacts() {
        const container = document.getElementById('modal-contacts');
        
        if (this.tempContacts.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        container.innerHTML = this.tempContacts.map((contact, index) => {
            const roleText = contact.role ? ` (${App.escapeHtml(contact.role)})` : '';
            const isEditing = this.editingContactIndex === index;
            
            if (isEditing) {
                return `
                    <div class="contact-item-modal editing" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span class="contact-item-name-static">${App.escapeHtml(contact.name)}</span>
                        <input type="text" class="contact-role-edit" value="${App.escapeHtml(contact.role || '')}" placeholder="Role (optional)" data-index="${index}">
                        <button class="contact-role-save" data-index="${index}">Save</button>
                    </div>
                `;
            }
            
            return `
                <div class="contact-item-modal" title="Double-click to add/edit role&#10;${App.escapeHtml(contact.email)}" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span class="contact-item-name">${App.escapeHtml(contact.name)}${roleText}</span>
                    <button class="contact-remove" data-index="${index}">&times;</button>
                </div>
            `;
        }).join('');
        
        // Double-click to edit role
        container.querySelectorAll('.contact-item-modal:not(.editing)').forEach(item => {
            item.addEventListener('dblclick', (e) => {
                if (e.target.classList.contains('contact-remove')) return;
                this.editingContactIndex = parseInt(item.dataset.index);
                this.renderContacts();
                // Focus the input
                setTimeout(() => {
                    const input = container.querySelector('.contact-role-edit');
                    if (input) input.focus();
                }, 0);
            });
        });
        
        // Save role on button click or Enter
        container.querySelectorAll('.contact-role-save').forEach(btn => {
            btn.addEventListener('click', () => {
                this.saveContactRole(parseInt(btn.dataset.index));
            });
        });
        
        container.querySelectorAll('.contact-role-edit').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveContactRole(parseInt(input.dataset.index));
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.editingContactIndex = null;
                    this.renderContacts();
                }
            });
        });
        
        container.querySelectorAll('.contact-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeContact(parseInt(btn.dataset.index));
            });
        });
    },
    
    /**
     * Save contact role after editing
     */
    saveContactRole(index) {
        const input = document.querySelector(`.contact-role-edit[data-index="${index}"]`);
        if (input && this.tempContacts[index]) {
            this.tempContacts[index].role = input.value.trim() || null;
        }
        this.editingContactIndex = null;
        this.renderContacts();
    },
    
    // ==================== Settings Modal ====================
    
    /**
     * Open settings modal
     */
    openSettings() {
        const modal = document.getElementById('settings-modal');
        
        // Set current gradient values for the active theme
        const currentBg = App.getCurrentBackground();
        const fallbackStart = App.currentTheme === 'light' ? '#e0e7ff' : '#1e1b4b';
        const fallbackEnd = App.currentTheme === 'light' ? '#c7d2fe' : '#0f172a';
        
        document.getElementById('gradient-start').value = currentBg.gradient_start || fallbackStart;
        document.getElementById('gradient-end').value = currentBg.gradient_end || fallbackEnd;
        
        this.renderGradientPresets();
        this.updateGradientPreview();
        this.renderListsManager();
        this.renderTagsManager();
        this.updateGoogleAccountSection();
        
        modal.classList.add('active');
    },
    
    /**
     * Update Google account section in settings based on status
     */
    updateGoogleAccountSection() {
        const notConfigured = document.getElementById('google-not-configured');
        const disconnected = document.getElementById('google-disconnected');
        const connected = document.getElementById('google-connected');
        
        notConfigured.style.display = 'none';
        disconnected.style.display = 'none';
        connected.style.display = 'none';
        
        if (!App.googleConfigured) {
            notConfigured.style.display = 'block';
        } else if (App.googleConnected) {
            connected.style.display = 'block';
        } else {
            disconnected.style.display = 'block';
        }
    },
    
    /**
     * Disconnect Google account
     */
    async disconnectGoogle() {
        try {
            const response = await fetch('/api/google/disconnect', { method: 'POST' });
            if (response.ok) {
                App.googleConnected = false;
                this.updateGoogleAccountSection();
            }
        } catch (error) {
            console.error('Error disconnecting Google:', error);
        }
    },
    
    /**
     * Close settings modal
     */
    closeSettings() {
        document.getElementById('settings-modal').classList.remove('active');
    },
    
    /**
     * Render gradient presets
     */
    renderGradientPresets() {
        const container = document.getElementById('gradient-presets');
        const currentBg = App.getCurrentBackground();
        const currentStart = currentBg.gradient_start;
        const currentEnd = currentBg.gradient_end;
        
        container.innerHTML = App.gradientPresets.map(preset => {
            const isActive = preset.start === currentStart && preset.end === currentEnd;
            return `
                <div class="gradient-preset ${isActive ? 'active' : ''}" 
                     data-start="${preset.start}" 
                     data-end="${preset.end}"
                     style="background: linear-gradient(135deg, ${preset.start}, ${preset.end})">
                    <span class="gradient-preset-name">${preset.name}</span>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.gradient-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                document.getElementById('gradient-start').value = preset.dataset.start;
                document.getElementById('gradient-end').value = preset.dataset.end;
                this.updateGradientPreview();
                
                // Update active state
                container.querySelectorAll('.gradient-preset').forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
            });
        });
    },
    
    /**
     * Update gradient preview (preview element removed - this is kept for preset click handlers)
     */
    updateGradientPreview() {
        // Preview element was removed to save space
        // This function is kept as a no-op for preset click handlers
    },
    
    /**
     * Render lists manager in settings
     */
    renderListsManager() {
        const container = document.getElementById('lists-manager');
        const quickAddListId = App.config?.quick_add_default_list || App.config?.lists?.[0]?.id;
        
        container.innerHTML = App.config.lists.map(list => {
            const completedBadge = list.is_completed_list ? `
                <span class="list-manager-completed-badge" title="Tickets here are marked as done">🏁</span>
            ` : '';
            const quickAddBadge = list.id === quickAddListId ? `
                <span class="list-manager-quickadd-badge" title="Default list for Quick Add (⌘K / Ctrl+K)">⌘K</span>
            ` : '';
            
            return `
                <div class="list-manager-item" data-list-id="${list.id}">
                    <div class="list-manager-drag-handle">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="9" cy="5" r="1"></circle>
                            <circle cx="9" cy="12" r="1"></circle>
                            <circle cx="9" cy="19" r="1"></circle>
                            <circle cx="15" cy="5" r="1"></circle>
                            <circle cx="15" cy="12" r="1"></circle>
                            <circle cx="15" cy="19" r="1"></circle>
                        </svg>
                    </div>
                    <div class="list-manager-color" style="background: ${list.color}"></div>
                    <span class="list-manager-emoji">${list.emoji || ''}</span>
                    <span class="list-manager-title">${App.escapeHtml(list.title)}</span>
                    ${quickAddBadge}
                    ${completedBadge}
                    <button class="list-manager-edit" data-list-id="${list.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.list-manager-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const listId = btn.dataset.listId;
                const list = App.config.lists.find(l => l.id === listId);
                if (list) {
                    this.openListModal(list);
                }
            });
        });
        
        // Initialize Sortable for list reordering
        this.initListsSortable();
    },
    
    /**
     * Render tags manager in settings
     */
    renderTagsManager() {
        const container = document.getElementById('tags-manager');
        const allTags = App.getAllTags();
        
        if (allTags.length === 0) {
            container.innerHTML = '<div class="settings-hint" style="font-style: normal;">No tags created yet. Tags are created when you add them to tickets.</div>';
            return;
        }
        
        container.innerHTML = allTags.map(tag => {
            const tagData = App.getTagData(tag);
            const color = tagData.color || '#6366f1';
            return `
                <div class="tag-manager-item" data-tag="${App.escapeHtml(tag)}">
                    <input type="color" class="tag-manager-color" value="${color}" data-tag="${App.escapeHtml(tag)}" title="Change color">
                    <span class="tag-manager-name" data-tag="${App.escapeHtml(tag)}" title="Double-click to rename">${App.escapeHtml(tag)}</span>
                    <button class="tag-manager-delete" data-tag="${App.escapeHtml(tag)}" title="Delete tag">✕</button>
                </div>
            `;
        }).join('');
        
        // Add event listeners for color changes
        container.querySelectorAll('.tag-manager-color').forEach(input => {
            input.addEventListener('change', async () => {
                const tag = input.dataset.tag;
                const color = input.value;
                App.setTagColor(tag, color);
                await App.saveConfig();
            });
        });
        
        // Add event listeners for delete buttons
        container.querySelectorAll('.tag-manager-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tag = btn.dataset.tag;
                await this.deleteTag(tag);
            });
        });
        
        // Add event listeners for double-click to edit tag name
        container.querySelectorAll('.tag-manager-name').forEach(span => {
            span.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.startEditingTagName(span);
            });
        });
    },
    
    /**
     * Start editing a tag name (convert span to input)
     */
    startEditingTagName(span) {
        const originalTag = span.dataset.tag;
        const item = span.closest('.tag-manager-item');
        
        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'tag-manager-name-input';
        input.value = originalTag;
        input.dataset.originalTag = originalTag;
        
        // Replace span with input
        span.replaceWith(input);
        input.focus();
        input.select();
        
        // Handle blur (finish editing)
        const finishEditing = async () => {
            const newTag = input.value.trim();
            
            if (newTag && newTag !== originalTag) {
                await this.renameTag(originalTag, newTag);
            } else {
                // Revert to original - re-render to restore the span
                this.renderTagsManager();
            }
        };
        
        input.addEventListener('blur', finishEditing);
        
        // Handle Enter key to confirm and Escape to cancel
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                input.value = originalTag; // Reset to original
                input.blur();
            }
        });
    },
    
    /**
     * Rename a tag across all tickets and config
     */
    async renameTag(oldName, newName) {
        // Check if the new tag name already exists
        const allTags = App.getAllTags();
        if (allTags.includes(newName)) {
            alert(`A tag named "${newName}" already exists. Please choose a different name.`);
            this.renderTagsManager();
            return;
        }
        
        // Rename tag in all tickets
        for (const ticket of App.tickets) {
            if (ticket.tags && ticket.tags.includes(oldName)) {
                const index = ticket.tags.indexOf(oldName);
                ticket.tags[index] = newName;
            }
        }
        
        // Transfer tag color to new name in config
        if (App.config.tag_colors && App.config.tag_colors[oldName]) {
            App.config.tag_colors[newName] = App.config.tag_colors[oldName];
            delete App.config.tag_colors[oldName];
        }
        
        // Save changes
        await App.saveConfig();
        await App.saveAllTickets();
        
        // Re-render
        this.renderTagsManager();
        App.render();
    },
    
    /**
     * Delete a tag from the system
     */
    async deleteTag(tagName) {
        if (!confirm(`Delete tag "${tagName}"? This will remove the tag from all tickets.`)) {
            return;
        }
        
        // Remove tag from all tickets
        for (const ticket of App.tickets) {
            if (ticket.tags && ticket.tags.includes(tagName)) {
                ticket.tags = ticket.tags.filter(t => t !== tagName);
            }
        }
        
        // Remove tag color from config
        if (App.config.tag_colors && App.config.tag_colors[tagName]) {
            delete App.config.tag_colors[tagName];
        }
        
        // Save changes
        await App.saveConfig();
        await App.saveAllTickets();
        
        // Re-render
        this.renderTagsManager();
        App.render();
    },
    
    /**
     * Initialize Sortable.js for lists reordering
     */
    initListsSortable() {
        const container = document.getElementById('lists-manager');
        
        // Destroy existing instance if any
        if (this.listsSortable) {
            this.listsSortable.destroy();
        }
        
        this.listsSortable = new Sortable(container, {
            animation: 150,
            handle: '.list-manager-drag-handle',
            ghostClass: 'list-manager-ghost',
            chosenClass: 'list-manager-chosen',
            dragClass: 'list-manager-drag',
            onEnd: (evt) => {
                // Reorder the lists in the config
                const newOrder = [];
                container.querySelectorAll('.list-manager-item').forEach(item => {
                    const listId = item.dataset.listId;
                    const list = App.config.lists.find(l => l.id === listId);
                    if (list) {
                        newOrder.push(list);
                    }
                });
                App.config.lists = newOrder;
            }
        });
    },
    
    /**
     * Save settings
     */
    async saveSettings() {
        // Save background for the current theme
        App.setBackground(
            document.getElementById('gradient-start').value,
            document.getElementById('gradient-end').value
        );
        
        await App.saveConfig();
        this.closeSettings();
    },
    
    // ==================== List Modal ====================
    
    /**
     * Open list modal for editing or creating a list
     */
    openListModal(list) {
        this.currentList = list;
        
        const modal = document.getElementById('list-modal');
        const title = document.getElementById('list-modal-title');
        const deleteBtn = document.getElementById('list-delete-btn');
        const colorInput = document.getElementById('list-color-input');
        const completedCheckbox = document.getElementById('list-completed-checkbox');
        const quickAddCheckbox = document.getElementById('list-quickadd-checkbox');
        const quickAddListId = App.config?.quick_add_default_list || App.config?.lists?.[0]?.id;
        
        if (list) {
            title.textContent = 'Edit List';
            document.getElementById('list-title-input').value = list.title || '';
            document.getElementById('list-emoji-input').value = list.emoji || '';
            colorInput.value = list.color || '#6366f1';
            completedCheckbox.checked = list.is_completed_list || false;
            quickAddCheckbox.checked = list.id === quickAddListId;
            deleteBtn.style.display = 'block';
        } else {
            title.textContent = 'New List';
            document.getElementById('list-title-input').value = '';
            document.getElementById('list-emoji-input').value = '';
            colorInput.value = '#6366f1';
            completedCheckbox.checked = false;
            quickAddCheckbox.checked = false;
            deleteBtn.style.display = 'none';
        }
        
        // Render color presets
        this.renderColorPresets(colorInput.value);
        
        // Listen for custom color changes
        colorInput.addEventListener('input', () => {
            this.updateColorPresetSelection(colorInput.value);
        });
        
        modal.classList.add('active');
        document.getElementById('list-title-input').focus();
    },
    
    /**
     * Render color presets for list modal
     */
    renderColorPresets(selectedColor) {
        const container = document.getElementById('list-color-presets');
        const colorInput = document.getElementById('list-color-input');
        
        container.innerHTML = this.colorPresets.map(preset => {
            const isActive = preset.color.toLowerCase() === selectedColor?.toLowerCase();
            return `
                <div class="color-preset ${isActive ? 'active' : ''}" 
                     data-color="${preset.color}"
                     style="background: ${preset.color}"
                     title="${preset.name}">
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                colorInput.value = color;
                this.updateColorPresetSelection(color);
            });
        });
    },
    
    /**
     * Update color preset selection state
     */
    updateColorPresetSelection(color) {
        const container = document.getElementById('list-color-presets');
        container.querySelectorAll('.color-preset').forEach(preset => {
            const isMatch = preset.dataset.color.toLowerCase() === color?.toLowerCase();
            preset.classList.toggle('active', isMatch);
        });
    },
    
    /**
     * Close list modal
     */
    closeListModal() {
        document.getElementById('list-modal').classList.remove('active');
        document.getElementById('emoji-picker-container').classList.remove('active');
        this.currentList = null;
    },
    
    /**
     * Toggle emoji picker visibility
     */
    toggleEmojiPicker() {
        const container = document.getElementById('emoji-picker-container');
        container.classList.toggle('active');
    },
    
    /**
     * Clear emoji input
     */
    clearEmoji() {
        document.getElementById('list-emoji-input').value = '';
    },
    
    /**
     * Save list (create or update)
     */
    async saveList() {
        const title = document.getElementById('list-title-input').value.trim();
        
        if (!title) {
            alert('Please enter a title');
            return;
        }
        
        const listData = {
            title,
            emoji: document.getElementById('list-emoji-input').value.trim(),
            color: document.getElementById('list-color-input').value,
            is_completed_list: document.getElementById('list-completed-checkbox').checked
        };
        
        const isQuickAddDefault = document.getElementById('list-quickadd-checkbox').checked;
        let listId;
        
        if (this.currentList) {
            // Update existing list
            listId = this.currentList.id;
            const list = App.config.lists.find(l => l.id === this.currentList.id);
            if (list) {
                list.title = listData.title;
                list.emoji = listData.emoji;
                list.color = listData.color;
                list.is_completed_list = listData.is_completed_list;
            }
        } else {
            // Create new list
            listId = `list-${Date.now()}`;
            const newList = {
                id: listId,
                ...listData
            };
            App.config.lists.push(newList);
        }
        
        // Update quick add default list if checkbox is checked
        if (isQuickAddDefault) {
            App.config.quick_add_default_list = listId;
        }
        
        await App.saveConfig();
        this.renderListsManager();
        this.closeListModal();
    },
    
    /**
     * Delete current list
     */
    async deleteList() {
        if (!this.currentList) return;
        
        // Check if list has tickets
        const tickets = App.getTicketsForList(this.currentList.id);
        if (tickets.length > 0) {
            alert('Cannot delete a list that contains tickets. Please move or delete the tickets first.');
            return;
        }
        
        if (confirm('Are you sure you want to delete this list?')) {
            App.config.lists = App.config.lists.filter(l => l.id !== this.currentList.id);
            await App.saveConfig();
            this.renderListsManager();
            this.closeListModal();
        }
    }
};

// Initialize modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Modal.init();
});
