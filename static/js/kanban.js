/**
 * Trellex - Kanban Board Module
 * Handles Kanban board rendering and drag-drop functionality
 */

const Kanban = {
    sortableInstances: [],
    activeTasksPopover: null,
    
    /**
     * Get initials from a name
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
     * Open Slack profile for contact
     */
    openContactSlack(element) {
        const email = element.dataset.email;
        const username = email.split('@')[0];
        const slackUrl = `https://jfrog.enterprise.slack.com/team/${username}`;
        window.open(slackUrl, '_blank');
    },
    
    /**
     * Render the Kanban board
     */
    render() {
        const board = document.getElementById('kanban-board');
        
        // Destroy existing sortable instances
        this.sortableInstances.forEach(s => s.destroy());
        this.sortableInstances = [];
        
        // Render lists
        board.innerHTML = App.config.lists.map(list => this.renderList(list)).join('');
        
        // Initialize drag and drop
        this.initSortable();
        
        // Add event listeners
        this.setupListeners();
    },
    
    /**
     * Render a single list
     */
    renderList(list) {
        const tickets = App.getTicketsForList(list.id);
        
        return `
            <div class="kanban-list" data-list-id="${list.id}">
                <div class="list-color-bar" style="background: ${list.color}"></div>
                <div class="list-header" data-list-id="${list.id}">
                    <div class="list-title">
                        ${list.emoji ? `<span class="list-emoji">${list.emoji}</span>` : ''}
                        <span>${App.escapeHtml(list.title)}</span>
                    </div>
                    <span class="list-count">${tickets.length}</span>
                </div>
                <div class="list-cards" data-list-id="${list.id}">
                    ${tickets.map(ticket => this.renderCard(ticket)).join('')}
                </div>
                <button class="add-card-btn" data-list-id="${list.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Card
                </button>
            </div>
        `;
    },
    
    /**
     * Format a due date for display
     */
    formatDueDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Check if it's today
        if (date.toDateString() === now.toDateString()) {
            return 'Today';
        }
        // Check if it's tomorrow
        if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        }
        // Otherwise show date
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    
    /**
     * Format a creation date for display
     */
    formatCreationDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    
    /**
     * Get priority icon SVG
     */
    getPriorityIcon(priority) {
        if (priority === 'high') {
            // Double chevron up (Citroën-style) in dark red
            return `
                <div class="priority-icon priority-high" title="High Priority">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="17 11 12 6 7 11"></polyline>
                        <polyline points="17 18 12 13 7 18"></polyline>
                    </svg>
                </div>
            `;
        } else if (priority === 'low') {
            // Double chevron down (flipped) in blue
            return `
                <div class="priority-icon priority-low" title="Low Priority">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="7 13 12 18 17 13"></polyline>
                        <polyline points="7 6 12 11 17 6"></polyline>
                    </svg>
                </div>
            `;
        }
        return '';
    },
    
    /**
     * Render a ticket card
     */
    renderCard(ticket) {
        const tasks = ticket.tasks || [];
        const doneTasks = tasks.filter(t => t.done).length;
        const totalTasks = tasks.length;
        const allDone = totalTasks > 0 && doneTasks === totalTasks;
        
        // Due date status for card border styling
        const dueDateStatus = App.getDueDateStatus(ticket);
        const cardClasses = ['ticket-card'];
        if (dueDateStatus && dueDateStatus !== 'normal' && dueDateStatus !== 'completed') {
            cardClasses.push(`due-${dueDateStatus}`);
        }
        
        // Priority icon
        const priorityIcon = this.getPriorityIcon(ticket.priority);
        
        // Status as text
        let statusContent = '';
        if (ticket.status) {
            statusContent = `<div class="ticket-status">Status: ${App.escapeHtml(ticket.status)}</div>`;
        }
        
        // Due date display
        let dueDateContent = '';
        if (ticket.due_date) {
            const formattedDate = this.formatDueDate(ticket.due_date);
            const isCompleted = dueDateStatus === 'completed';
            const checkIcon = isCompleted ? `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="due-date-check">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            ` : '';
            const dueDateClass = dueDateStatus ? `due-date-${dueDateStatus}` : '';
            dueDateContent = `
                <div class="ticket-due-date ${dueDateClass}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    Due: ${formattedDate}
                    ${checkIcon}
                </div>
            `;
        }
        
        // Build meta line with separate groups for tags and links
        let badgeItems = [];  // Tasks badge
        let tagItems = [];    // Tags
        let linkItems = [];   // Repo + Docs links
        
        // Tasks count - clickable to show incomplete tasks
        if (totalTasks > 0) {
            const taskClass = allDone ? 'all-done' : 'incomplete';
            const clickable = !allDone ? 'clickable' : '';
            badgeItems.push(`
                <span class="ticket-tasks ${taskClass} ${clickable}" data-ticket-id="${ticket.id}" onclick="event.stopPropagation(); Kanban.showTasksPopover(event, '${ticket.id}');">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    ${doneTasks}/${totalTasks}
                </span>
            `);
        }
        
        // Tags with colors
        if (ticket.tags && ticket.tags.length > 0) {
            ticket.tags.forEach(tag => {
                const tagData = App.getTagData(tag);
                const colorStyle = tagData.color ? `background: ${tagData.color}; color: white;` : '';
                tagItems.push(`<span class="ticket-tag" style="${colorStyle}">${App.escapeHtml(tag)}</span>`);
            });
        }
        
        // Repo links (support both old single link and new array format)
        const repoLinks = ticket.repo_links || (ticket.repo_link?.url ? [ticket.repo_link] : []);
        repoLinks.forEach(repo => {
            if (repo.url) {
                linkItems.push(`
                    <a href="${App.escapeHtml(repo.url)}" class="ticket-link" target="_blank" onclick="event.stopPropagation()">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                        </svg>
                        ${App.escapeHtml(repo.title || 'Repo')}
                    </a>
                `);
            }
        });
        
        // Docs links (support both old single link and new array format)
        const docsLinks = ticket.docs_links || (ticket.docs_link?.url ? [ticket.docs_link] : []);
        docsLinks.forEach(doc => {
            if (doc.url) {
                linkItems.push(`
                    <a href="${App.escapeHtml(doc.url)}" class="ticket-link" target="_blank" onclick="event.stopPropagation()" title="${App.escapeHtml(doc.title || 'Docs')}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        ${App.escapeHtml(App.truncate(doc.title || 'Docs', 20))}
                    </a>
                `);
            }
        });
        
        // Contacts
        let contactItems = [];
        const contacts = ticket.contacts || [];
        contacts.forEach(contact => {
            if (contact.name || contact.email) {
                const roleText = contact.role ? `${contact.role} - ` : '';
                const tooltip = `${roleText}${contact.email}`;
                const initials = this.getInitials(contact.name || contact.email);
                
                const photoHtml = contact.photo 
                    ? `<img src="${App.escapeHtml(contact.photo)}" alt="" class="ticket-contact-photo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                       <span class="ticket-contact-initials" style="display:none;">${initials}</span>`
                    : `<span class="ticket-contact-initials">${initials}</span>`;
                
                contactItems.push(`
                    <span class="ticket-contact" data-email="${App.escapeHtml(contact.email)}" title="${App.escapeHtml(tooltip)}" onclick="event.stopPropagation(); Kanban.openContactSlack(this);">
                        ${photoHtml}
                        <span class="ticket-contact-name">${App.escapeHtml(contact.name || contact.email.split('@')[0])}</span>
                    </span>
                `);
            }
        });
        
        // Build meta content with grouped elements
        let metaContent = '';
        const hasNonLinks = badgeItems.length > 0 || tagItems.length > 0;
        const hasLinks = linkItems.length > 0;
        const hasContacts = contactItems.length > 0;
        
        if (hasNonLinks || hasLinks || hasContacts) {
            if (hasNonLinks) {
                metaContent += `<span class="ticket-meta-group ticket-meta-badges">${badgeItems.join('')}${tagItems.join('')}</span>`;
            }
            if (hasLinks) {
                metaContent += `<span class="ticket-meta-group ticket-meta-links">${linkItems.join('')}</span>`;
            }
            if (hasContacts) {
                metaContent += `<span class="ticket-meta-group ticket-meta-contacts">${contactItems.join('')}</span>`;
            }
        }
        
        // Build tooltip with description if available
        const descriptionTooltip = ticket.description ? `title="${App.escapeHtml(ticket.description)}"` : '';
        
        // Creation date display (hidden by default, toggled with Ctrl+D/Cmd+D)
        const creationDateContent = ticket.created_at ? `
            <div class="ticket-creation-date">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Created: ${this.formatCreationDate(ticket.created_at)}
            </div>
        ` : '';
        
        return `
            <div class="${cardClasses.join(' ')}" data-ticket-id="${ticket.id}" data-tags="${(ticket.tags || []).join(',')}" data-priority="${ticket.priority || 'none'}" ${descriptionTooltip}>
                ${priorityIcon}
                <div class="ticket-title">${App.escapeHtml(ticket.title)}</div>
                ${statusContent}
                ${dueDateContent}
                ${metaContent ? `<div class="ticket-meta">${metaContent}</div>` : ''}
                ${creationDateContent}
            </div>
        `;
    },
    
    /**
     * Initialize Sortable.js for drag and drop
     */
    initSortable() {
        const listContainers = document.querySelectorAll('.list-cards');
        
        listContainers.forEach(container => {
            const sortable = new Sortable(container, {
                group: 'tickets',
                animation: 200,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                handle: '.ticket-card',
                
                onStart: (evt) => {
                    this.handleDragStart(evt);
                },
                
                onEnd: (evt) => {
                    this.handleDragEnd(evt);
                }
            });
            
            this.sortableInstances.push(sortable);
        });
        
        // Initialize archive drop zones
        this.initArchiveDropZones();
    },
    
    /**
     * Initialize archive drop zones on add-card buttons
     */
    initArchiveDropZones() {
        document.querySelectorAll('.add-card-btn').forEach(btn => {
            // Create a sortable instance for the archive zone wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'archive-drop-wrapper';
            wrapper.innerHTML = '<div class="archive-drop-zone" style="display: none;"></div>';
            btn.parentNode.insertBefore(wrapper, btn);

            const dropZone = wrapper.querySelector('.archive-drop-zone');
            
            // Add highlight on dragenter/dragleave
            dropZone.addEventListener('dragenter', () => {
                dropZone.classList.add('archive-highlight');
            });
            
            dropZone.addEventListener('dragleave', (e) => {
                // Only remove if leaving the zone entirely (not entering a child)
                if (!dropZone.contains(e.relatedTarget)) {
                    dropZone.classList.remove('archive-highlight');
                }
            });

            const sortable = new Sortable(dropZone, {
                group: 'tickets',
                animation: 200,
                ghostClass: 'archive-ghost',

                onAdd: async (evt) => {
                    const ticketId = evt.item.dataset.ticketId;
                    // Remove highlight
                    dropZone.classList.remove('archive-highlight');
                    // Remove the card from DOM immediately
                    evt.item.remove();
                    // Archive the ticket
                    await this.archiveTicket(ticketId);
                }
            });

            this.sortableInstances.push(sortable);
        });
    },
    
    /**
     * Handle drag start - show archive zones
     */
    handleDragStart(evt) {
        // Show all archive drop zones and hide add-card buttons
        document.querySelectorAll('.add-card-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        document.querySelectorAll('.archive-drop-zone').forEach(zone => {
            zone.style.display = 'flex';
            zone.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8"></polyline>
                    <rect x="1" y="3" width="22" height="5"></rect>
                    <line x1="10" y1="12" x2="14" y2="12"></line>
                </svg>
                Archive
            `;
        });
    },
    
    /**
     * Handle drag end event
     */
    async handleDragEnd(evt) {
        // Hide archive zones and show add-card buttons
        this.hideArchiveZones();
        
        // If dropped on archive zone, the onAdd handler already took care of it
        if (evt.to.classList.contains('archive-drop-zone')) {
            return;
        }
        
        const ticketId = evt.item.dataset.ticketId;
        const newListId = evt.to.dataset.listId;
        const oldListId = evt.from.dataset.listId;
        
        // If moved to a different list
        if (newListId !== oldListId) {
            await App.moveTicket(ticketId, newListId);
            
            // Update the card's due date styling based on new list's completed status
            this.updateCardDueDateStyling(evt.item, ticketId);
        }
        
        // Build order data for all visible tickets
        const orders = [];
        document.querySelectorAll('.list-cards').forEach(container => {
            const listId = container.dataset.listId;
            container.querySelectorAll('.ticket-card').forEach((card, index) => {
                orders.push({
                    id: card.dataset.ticketId,
                    list_id: listId,
                    position: index
                });
            });
        });
        
        await App.reorderTickets(orders);
        
        // Re-render to ensure cards are sorted by priority
        this.render();
    },
    
    /**
     * Hide archive zones and show add-card buttons
     */
    hideArchiveZones() {
        document.querySelectorAll('.add-card-btn').forEach(btn => {
            btn.style.display = 'flex';
        });
        document.querySelectorAll('.archive-drop-zone').forEach(zone => {
            zone.style.display = 'none';
            zone.innerHTML = '';
            zone.classList.remove('archive-highlight');
        });
    },
    
    /**
     * Archive a ticket
     */
    async archiveTicket(ticketId) {
        try {
            await fetch(`/api/tickets/${ticketId}/archive`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ archived: true })
            });
            
            // Update local data
            const ticket = App.tickets.find(t => t.id === ticketId);
            if (ticket) {
                ticket.archived = true;
            }
            
            // Update list counters
            this.updateListCounters();
        } catch (error) {
            console.error('Error archiving ticket:', error);
            // Re-render to restore the card if archive failed
            this.render();
        }
    },
    
    /**
     * Update the ticket count displayed on each list header
     */
    updateListCounters() {
        document.querySelectorAll('.kanban-list').forEach(list => {
            const listId = list.dataset.listId;
            const cardsContainer = list.querySelector('.list-cards');
            const counter = list.querySelector('.list-count');
            if (cardsContainer && counter) {
                const count = cardsContainer.querySelectorAll('.ticket-card').length;
                counter.textContent = count;
            }
        });
    },
    
    /**
     * Update a card's due date styling after it's moved to a new list
     */
    updateCardDueDateStyling(cardElement, ticketId) {
        const ticket = App.tickets.find(t => t.id === ticketId);
        if (!ticket || !ticket.due_date) return;
        
        // Remove old due date classes from card
        cardElement.classList.remove('due-soon', 'due-warning', 'due-critical', 'due-overdue');
        
        // Get new status
        const dueDateStatus = App.getDueDateStatus(ticket);
        
        // Add new class if needed
        if (dueDateStatus && dueDateStatus !== 'normal' && dueDateStatus !== 'completed') {
            cardElement.classList.add(`due-${dueDateStatus}`);
        }
        
        // Update the due date badge inside the card
        const dueDateBadge = cardElement.querySelector('.ticket-due-date');
        if (dueDateBadge) {
            // Remove old status classes
            dueDateBadge.classList.remove('due-date-soon', 'due-date-warning', 'due-date-critical', 'due-date-overdue', 'due-date-completed', 'due-date-normal');
            
            // Add new class
            if (dueDateStatus) {
                dueDateBadge.classList.add(`due-date-${dueDateStatus}`);
            }
            
            // Update checkmark visibility
            let checkIcon = dueDateBadge.querySelector('.due-date-check');
            if (dueDateStatus === 'completed') {
                if (!checkIcon) {
                    // Add checkmark
                    const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    checkSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    checkSvg.setAttribute('width', '12');
                    checkSvg.setAttribute('height', '12');
                    checkSvg.setAttribute('viewBox', '0 0 24 24');
                    checkSvg.setAttribute('fill', 'none');
                    checkSvg.setAttribute('stroke', 'currentColor');
                    checkSvg.setAttribute('stroke-width', '2');
                    checkSvg.setAttribute('stroke-linecap', 'round');
                    checkSvg.setAttribute('stroke-linejoin', 'round');
                    checkSvg.classList.add('due-date-check');
                    checkSvg.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
                    dueDateBadge.appendChild(checkSvg);
                }
            } else {
                // Remove checkmark if exists
                if (checkIcon) {
                    checkIcon.remove();
                }
            }
        }
    },
    
    /**
     * Set up event listeners for Kanban elements
     */
    setupListeners() {
        // Click on card to open modal
        document.querySelectorAll('.ticket-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open modal if clicking a link or tasks badge
                if (e.target.closest('a')) return;
                if (e.target.closest('.ticket-tasks')) return;
                
                const ticketId = card.dataset.ticketId;
                const ticket = App.tickets.find(t => t.id === ticketId);
                if (ticket) {
                    Modal.openTicket(ticket);
                }
            });
        });
        
        // Click on list header to edit list
        document.querySelectorAll('.list-header').forEach(header => {
            header.addEventListener('click', () => {
                const listId = header.dataset.listId;
                const list = App.config.lists.find(l => l.id === listId);
                if (list) {
                    Modal.openListModal(list);
                }
            });
        });
        
        // Add card buttons
        document.querySelectorAll('.add-card-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const listId = btn.dataset.listId;
                Modal.openTicket(null, listId);
            });
        });
        
        // Close tasks popover when clicking outside
        document.addEventListener('click', (e) => {
            if (this.activeTasksPopover && !e.target.closest('.tasks-popover') && !e.target.closest('.ticket-tasks')) {
                this.closeTasksPopover();
            }
        });
    },
    
    /**
     * Show tasks popover for a ticket
     */
    showTasksPopover(event, ticketId) {
        event.preventDefault();
        event.stopPropagation();
        
        const ticket = App.tickets.find(t => t.id === ticketId);
        if (!ticket || !ticket.tasks || ticket.tasks.length === 0) return;
        
        // Get incomplete tasks
        const incompleteTasks = ticket.tasks.filter(t => !t.done);
        if (incompleteTasks.length === 0) return;
        
        // Close any existing popover
        this.closeTasksPopover();
        
        // Create popover
        const popover = document.createElement('div');
        popover.className = 'tasks-popover';
        popover.innerHTML = `
            <div class="tasks-popover-header">
                <span class="tasks-popover-title">Remaining Tasks</span>
                <button class="tasks-popover-close" onclick="event.stopPropagation(); Kanban.closeTasksPopover();">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="tasks-popover-list">
                ${ticket.tasks.map((task, index) => {
                    if (task.done) return '';
                    return `
                        <div class="tasks-popover-item">
                            <input type="checkbox" class="tasks-popover-checkbox" 
                                   data-ticket-id="${ticketId}" 
                                   data-task-index="${index}"
                                   onclick="event.stopPropagation(); Kanban.toggleTaskFromPopover('${ticketId}', ${index}, this);">
                            <span class="tasks-popover-text">${App.escapeHtml(task.text)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // Position popover relative to the clicked element
        const targetRect = event.target.closest('.ticket-tasks').getBoundingClientRect();
        document.body.appendChild(popover);
        
        // Calculate position
        const popoverRect = popover.getBoundingClientRect();
        let left = targetRect.left;
        let top = targetRect.bottom + 8;
        
        // Adjust if going off-screen to the right
        if (left + popoverRect.width > window.innerWidth - 16) {
            left = window.innerWidth - popoverRect.width - 16;
        }
        
        // Adjust if going off-screen to the bottom
        if (top + popoverRect.height > window.innerHeight - 16) {
            top = targetRect.top - popoverRect.height - 8;
        }
        
        popover.style.left = `${left}px`;
        popover.style.top = `${top}px`;
        
        this.activeTasksPopover = popover;
    },
    
    /**
     * Close tasks popover
     */
    closeTasksPopover() {
        if (this.activeTasksPopover) {
            this.activeTasksPopover.remove();
            this.activeTasksPopover = null;
        }
    },
    
    /**
     * Toggle task completion from popover
     */
    async toggleTaskFromPopover(ticketId, taskIndex, checkbox) {
        const ticket = App.tickets.find(t => t.id === ticketId);
        if (!ticket || !ticket.tasks || !ticket.tasks[taskIndex]) return;
        
        // Toggle the task
        ticket.tasks[taskIndex].done = true;
        
        // Add visual feedback
        const item = checkbox.closest('.tasks-popover-item');
        item.classList.add('completing');
        
        // Update the ticket on the server
        try {
            await App.updateTicket(ticketId, ticket);
            
            // Remove the item after animation
            setTimeout(() => {
                item.remove();
                
                // Check if popover is now empty
                const remainingItems = this.activeTasksPopover?.querySelectorAll('.tasks-popover-item');
                if (!remainingItems || remainingItems.length === 0) {
                    this.closeTasksPopover();
                }
            }, 300);
        } catch (error) {
            console.error('Error updating task:', error);
            // Revert on error
            ticket.tasks[taskIndex].done = false;
            checkbox.checked = false;
            item.classList.remove('completing');
        }
    }
};
