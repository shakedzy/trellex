"""
Trellex - Lightweight Personal Kanban Board
Flask application with YAML-based storage
"""
import os
import yaml
import uuid
import json
import argparse
import threading
from datetime import datetime
from dotenv import load_dotenv
from flask import Flask, render_template, jsonify, request, redirect, session
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


load_dotenv(override=True)

# Allow OAuth over HTTP for local development
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', os.urandom(24))

# Default configuration
DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5000

# Data file paths
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
SESSION_DIR = os.path.join(os.path.dirname(__file__), 'session')
CONFIG_FILE = os.path.join(DATA_DIR, 'config.yaml')
TICKETS_FILE = os.path.join(DATA_DIR, 'tickets.yaml')
GOOGLE_TOKENS_FILE = os.path.join(SESSION_DIR, 'google_tokens.json')

# File locks to prevent concurrent writes
_tickets_lock = threading.Lock()
_config_lock = threading.Lock()

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/directory.readonly',
]


def ensure_data_files():
    """Ensure data directory and files exist."""
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(SESSION_DIR, exist_ok=True)
    
    if not os.path.exists(CONFIG_FILE):
        default_config = {
            'lists': [
                {'id': 'backlog', 'title': 'Backlog', 'emoji': '📋', 'color': '#6366f1', 'is_completed_list': False},
                {'id': 'in-progress', 'title': 'In Progress', 'emoji': '🚀', 'color': '#f59e0b', 'is_completed_list': False},
                {'id': 'done', 'title': 'Done', 'emoji': '✅', 'color': '#10b981', 'is_completed_list': True}
            ],
            'background': {
                'gradient_start': '#1e1b4b',
                'gradient_end': '#0f172a'
            }
        }
        save_config(default_config)
    
    if not os.path.exists(TICKETS_FILE):
        save_tickets({'tickets': []})


def load_config():
    """Load configuration from YAML file."""
    with _config_lock:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}


def save_config(config):
    """Save configuration to YAML file."""
    with _config_lock:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, allow_unicode=True, default_flow_style=False, width=10000)


def load_tickets():
    """Load tickets from YAML file."""
    with _tickets_lock:
        with open(TICKETS_FILE, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
            return data.get('tickets', [])


def save_tickets(tickets_data):
    """Save tickets to YAML file."""
    with _tickets_lock:
        if isinstance(tickets_data, list):
            tickets_data = {'tickets': tickets_data}
        with open(TICKETS_FILE, 'w', encoding='utf-8') as f:
            yaml.dump(tickets_data, f, allow_unicode=True, default_flow_style=False, width=10000)


def generate_ticket_id():
    """Generate a unique ticket ID."""
    return f"ticket-{uuid.uuid4().hex[:8]}"


# ==================== Google OAuth Functions ====================

def get_google_client_config():
    """Get Google OAuth client configuration."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return None
    return {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:5000/api/google/callback"],
        }
    }


def save_google_tokens(credentials):
    """Save Google OAuth tokens to file."""
    tokens = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': list(credentials.scopes) if credentials.scopes else GOOGLE_SCOPES,
    }
    with open(GOOGLE_TOKENS_FILE, 'w') as f:
        json.dump(tokens, f)


def load_google_credentials():
    """Load Google OAuth credentials from file."""
    if not os.path.exists(GOOGLE_TOKENS_FILE):
        return None
    
    try:
        with open(GOOGLE_TOKENS_FILE, 'r') as f:
            tokens = json.load(f)
        
        credentials = Credentials(
            token=tokens.get('token'),
            refresh_token=tokens.get('refresh_token'),
            token_uri=tokens.get('token_uri'),
            client_id=tokens.get('client_id'),
            client_secret=tokens.get('client_secret'),
            scopes=tokens.get('scopes'),
        )
        
        # Refresh if expired
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
            save_google_tokens(credentials)
        
        return credentials
    except Exception as e:
        print(f"Error loading Google credentials: {e}")
        return None


def delete_google_tokens():
    """Delete stored Google OAuth tokens."""
    if os.path.exists(GOOGLE_TOKENS_FILE):
        os.remove(GOOGLE_TOKENS_FILE)


def get_people_service():
    """Get Google People API service."""
    credentials = load_google_credentials()
    if not credentials:
        return None
    return build('people', 'v1', credentials=credentials)


def search_directory_contacts(service, query, page_size=10):
    """Search Google Workspace directory for contacts."""
    try:
        results = service.people().searchDirectoryPeople(
            query=query,
            readMask='names,emailAddresses,photos',
            sources=['DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE'],
            pageSize=page_size,
        ).execute()
        
        contacts = []
        for person in results.get('people', []):
            names = person.get('names', [])
            emails = person.get('emailAddresses', [])
            photos = person.get('photos', [])
            
            name = names[0].get('displayName', '') if names else ''
            email = emails[0].get('value', '') if emails else ''
            photo_url = None
            if photos:
                # Get the first non-default photo
                for photo in photos:
                    if not photo.get('default', False):
                        photo_url = photo.get('url', '')
                        break
                # If all are default, use the first one
                if not photo_url and photos:
                    photo_url = photos[0].get('url', '')
            
            if name or email:
                contacts.append({
                    'name': name or email.split('@')[0],
                    'email': email,
                    'photo': photo_url,
                })
        
        return contacts
    except HttpError as e:
        print(f"Error searching directory: {e}")
        return []


def search_all_contacts(service, query, page_size=10):
    """Search all Google contacts (personal + directory)."""
    contacts = []
    
    # Search personal contacts
    try:
        results = service.people().searchContacts(
            query=query,
            readMask='names,emailAddresses,photos',
            pageSize=page_size,
        ).execute()
        
        for result in results.get('results', []):
            person = result.get('person', {})
            names = person.get('names', [])
            emails = person.get('emailAddresses', [])
            photos = person.get('photos', [])
            
            name = names[0].get('displayName', '') if names else ''
            email = emails[0].get('value', '') if emails else ''
            photo_url = None
            if photos:
                for photo in photos:
                    if not photo.get('default', False):
                        photo_url = photo.get('url', '')
                        break
                if not photo_url and photos:
                    photo_url = photos[0].get('url', '')
            
            if name or email:
                contacts.append({
                    'name': name or email.split('@')[0],
                    'email': email,
                    'photo': photo_url,
                    'source': 'personal',
                })
    except HttpError as e:
        print(f"Error searching personal contacts: {e}")
    
    # Also search directory
    try:
        directory_contacts = search_directory_contacts(service, query, page_size)
        for contact in directory_contacts:
            contact['source'] = 'directory'
            # Avoid duplicates by email
            if not any(c['email'] == contact['email'] for c in contacts):
                contacts.append(contact)
    except Exception as e:
        print(f"Error searching directory contacts: {e}")
    
    return contacts[:page_size]


# Initialize data files
ensure_data_files()


# Routes
@app.route('/')
def index():
    """Serve the main application page."""
    return render_template('index.html')


# API Routes - Config
@app.route('/api/config', methods=['GET'])
def get_config():
    """Get application configuration."""
    config = load_config()
    return jsonify(config)


@app.route('/api/config', methods=['PUT'])
def update_config():
    """Update application configuration."""
    config = request.json
    save_config(config)
    return jsonify(config)


# API Routes - Tickets
@app.route('/api/tickets', methods=['GET'])
def get_tickets():
    """Get all tickets."""
    tickets = load_tickets()
    return jsonify(tickets)


@app.route('/api/tickets', methods=['POST'])
def create_ticket():
    """Create a new ticket."""
    ticket = request.json
    ticket['id'] = generate_ticket_id()
    ticket['created_at'] = datetime.now().isoformat()
    ticket['archived'] = False
    
    # Set defaults for optional fields
    ticket.setdefault('description', '')
    ticket.setdefault('status', '')
    ticket.setdefault('tags', [])
    ticket.setdefault('repo_link', None)
    ticket.setdefault('docs_link', None)
    ticket.setdefault('tasks', [])
    ticket.setdefault('contacts', [])
    ticket.setdefault('due_date', None)
    ticket.setdefault('priority', 'none')  # 'high', 'none', or 'low'
    
    tickets = load_tickets()
    tickets.append(ticket)
    save_tickets(tickets)
    
    return jsonify(ticket), 201


@app.route('/api/tickets/<ticket_id>', methods=['GET'])
def get_ticket(ticket_id):
    """Get a specific ticket."""
    tickets = load_tickets()
    ticket = next((t for t in tickets if t['id'] == ticket_id), None)
    if ticket is None:
        return jsonify({'error': 'Ticket not found'}), 404
    return jsonify(ticket)


@app.route('/api/tickets/<ticket_id>', methods=['PUT'])
def update_ticket(ticket_id):
    """Update a ticket."""
    tickets = load_tickets()
    ticket_index = next((i for i, t in enumerate(tickets) if t['id'] == ticket_id), None)
    
    if ticket_index is None:
        return jsonify({'error': 'Ticket not found'}), 404
    
    updated_ticket = request.json
    updated_ticket['id'] = ticket_id  # Preserve ID
    updated_ticket['created_at'] = tickets[ticket_index].get('created_at')  # Preserve creation date
    
    tickets[ticket_index] = updated_ticket
    save_tickets(tickets)
    
    return jsonify(updated_ticket)


@app.route('/api/tickets/<ticket_id>', methods=['DELETE'])
def delete_ticket(ticket_id):
    """Delete a ticket."""
    tickets = load_tickets()
    tickets = [t for t in tickets if t['id'] != ticket_id]
    save_tickets(tickets)
    return jsonify({'success': True})


@app.route('/api/tickets/bulk', methods=['PUT'])
def bulk_update_tickets():
    """Update multiple tickets in a single request."""
    updated_tickets_data = request.json
    if not isinstance(updated_tickets_data, list):
        return jsonify({'error': 'Expected array of tickets'}), 400
    
    tickets = load_tickets()
    tickets_by_id = {t['id']: t for t in tickets}
    
    for updated_ticket in updated_tickets_data:
        ticket_id = updated_ticket.get('id')
        if ticket_id and ticket_id in tickets_by_id:
            # Preserve creation date
            updated_ticket['created_at'] = tickets_by_id[ticket_id].get('created_at')
            tickets_by_id[ticket_id] = updated_ticket
    
    # Convert back to list
    tickets = list(tickets_by_id.values())
    save_tickets(tickets)
    
    return jsonify({'success': True, 'updated': len(updated_tickets_data)})


@app.route('/api/tickets/<ticket_id>/move', methods=['PUT'])
def move_ticket(ticket_id):
    """Move a ticket to a different list."""
    tickets = load_tickets()
    ticket = next((t for t in tickets if t['id'] == ticket_id), None)
    
    if ticket is None:
        return jsonify({'error': 'Ticket not found'}), 404
    
    data = request.json
    ticket['list_id'] = data['list_id']
    save_tickets(tickets)
    
    return jsonify(ticket)


@app.route('/api/tickets/<ticket_id>/archive', methods=['PUT'])
def archive_ticket(ticket_id):
    """Archive or unarchive a ticket."""
    tickets = load_tickets()
    ticket = next((t for t in tickets if t['id'] == ticket_id), None)
    
    if ticket is None:
        return jsonify({'error': 'Ticket not found'}), 404
    
    data = request.json
    ticket['archived'] = data.get('archived', True)
    save_tickets(tickets)
    
    return jsonify(ticket)


@app.route('/api/tickets/reorder', methods=['PUT'])
def reorder_tickets():
    """Reorder tickets within and between lists."""
    data = request.json
    ticket_orders = data.get('orders', [])  # [{id, list_id, position}]
    
    tickets = load_tickets()
    ticket_map = {t['id']: t for t in tickets}
    
    for order in ticket_orders:
        if order['id'] in ticket_map:
            ticket_map[order['id']]['list_id'] = order['list_id']
    
    # Sort tickets by list_id and position
    position_map = {o['id']: o['position'] for o in ticket_orders}
    tickets = list(ticket_map.values())
    tickets.sort(key=lambda t: (t.get('list_id', ''), position_map.get(t['id'], 999)))
    
    save_tickets(tickets)
    return jsonify(tickets)


# ==================== Google OAuth Routes ====================

@app.route('/api/google/status', methods=['GET'])
def google_status():
    """Check if Google account is connected."""
    client_config = get_google_client_config()
    if not client_config:
        return jsonify({
            'connected': False,
            'configured': False,
            'message': 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.'
        })
    
    credentials = load_google_credentials()
    if credentials and credentials.valid:
        return jsonify({
            'connected': True,
            'configured': True,
        })
    
    return jsonify({
        'connected': False,
        'configured': True,
    })


@app.route('/api/google/auth', methods=['GET'])
def google_auth():
    """Initiate Google OAuth flow."""
    client_config = get_google_client_config()
    if not client_config:
        return jsonify({'error': 'Google OAuth not configured'}), 400
    
    # Get the current host for dynamic redirect URI
    host = request.host_url.rstrip('/')
    redirect_uri = f"{host}/api/google/callback"
    
    # Update client config with dynamic redirect URI
    client_config['web']['redirect_uris'] = [redirect_uri]
    
    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri,
    )
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
    )
    
    session['oauth_state'] = state
    session['redirect_uri'] = redirect_uri
    
    return redirect(authorization_url)


@app.route('/api/google/callback', methods=['GET'])
def google_callback():
    """Handle Google OAuth callback."""
    client_config = get_google_client_config()
    if not client_config:
        return jsonify({'error': 'Google OAuth not configured'}), 400
    
    # Get the redirect URI from session or reconstruct it
    redirect_uri = session.get('redirect_uri')
    if not redirect_uri:
        host = request.host_url.rstrip('/')
        redirect_uri = f"{host}/api/google/callback"
    
    # Update client config with the redirect URI
    client_config['web']['redirect_uris'] = [redirect_uri]
    
    flow = Flow.from_client_config(
        client_config,
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri,
    )
    
    # Use the authorization response to get credentials
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    
    # Save the credentials
    save_google_tokens(credentials)
    
    # Redirect back to the app
    return redirect('/')


@app.route('/api/google/disconnect', methods=['POST'])
def google_disconnect():
    """Disconnect Google account."""
    delete_google_tokens()
    return jsonify({'success': True})


# ==================== Contacts Routes ====================

@app.route('/api/contacts/search', methods=['GET'])
def search_contacts():
    """Search Google contacts."""
    query = request.args.get('q', '').strip()
    source = request.args.get('source', 'directory')  # 'directory' or 'all'
    
    if not query:
        return jsonify([])
    
    if len(query) < 2:
        return jsonify([])
    
    service = get_people_service()
    if not service:
        return jsonify({'error': 'Google account not connected'}), 401
    
    try:
        if source == 'directory':
            contacts = search_directory_contacts(service, query)
        else:
            contacts = search_all_contacts(service, query)
        
        return jsonify(contacts)
    except Exception as e:
        print(f"Error searching contacts: {e}")
        return jsonify({'error': str(e)}), 500


def main():
    """Entry point for the application."""
    parser = argparse.ArgumentParser(description='Trellex - Personal Kanban Board')
    parser.add_argument('--host', '-H', 
                        default=os.environ.get('TRELLEX_HOST', DEFAULT_HOST),
                        help=f'Host to bind to (default: {DEFAULT_HOST}, env: TRELLEX_HOST)')
    parser.add_argument('--port', '-p', 
                        type=int,
                        default=int(os.environ.get('TRELLEX_PORT', DEFAULT_PORT)),
                        help=f'Port to bind to (default: {DEFAULT_PORT}, env: TRELLEX_PORT)')
    parser.add_argument('--debug', '-d',
                        action='store_true',
                        default=os.environ.get('TRELLEX_DEBUG', 'false').lower() == 'true',
                        help='Enable debug mode (default: false, env: TRELLEX_DEBUG)')
    
    args = parser.parse_args()
    
    print(f"🚀 Starting Trellex on http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == '__main__':
    main()
