"""
SENTINEL OVERWATCH - Enhanced Security Dashboard Backend
Features: API Auth, AI Threat Analysis, Slack/Email Alerts, Historical Analytics
"""
import os
import time
import json
import asyncio
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
load_dotenv('/app/.env')

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))

DB_FILE = "events.db"
CONFIG_FILE = "sentinel_config.json"

# ============ DATABASE SETUP ============
def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    # Events table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            status TEXT,
            probability REAL,
            syscall_rate INTEGER,
            churn_rate INTEGER,
            ai_analysis TEXT
        )
    ''')
    # Users table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            role TEXT DEFAULT 'analyst',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Alert history
    conn.execute('''
        CREATE TABLE IF NOT EXISTS alert_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            alert_type TEXT,
            recipient TEXT,
            sent_at TEXT,
            status TEXT
        )
    ''')
    conn.commit()
    
    # Create default admin user if not exists
    cursor = conn.execute("SELECT * FROM users WHERE username = 'admin'")
    if not cursor.fetchone():
        password_hash = hashlib.sha256('sentinel123'.encode()).hexdigest()
        conn.execute("INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)",
                    ('admin', password_hash, 'admin@sentinel.local', 'admin'))
        conn.commit()
    conn.close()

init_db()

# ============ CONFIG MANAGEMENT ============
def load_config():
    default_config = {
        "detection_threshold": 0.7,
        "alert_cooldown_minutes": 5,
        "email_enabled": False,
        "slack_enabled": False,
        "email_recipients": [],
        "slack_webhook_url": "",
        "slack_bot_token": "",
        "slack_channel": "",
        "attack_patterns": {
            "ransomware": {"enabled": True, "churn_threshold": 100},
            "fork_bomb": {"enabled": True, "spawn_threshold": 50},
            "crypto_miner": {"enabled": True, "cpu_threshold": 80},
            "privilege_escalation": {"enabled": True},
            "reverse_shell": {"enabled": True}
        }
    }
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            return {**default_config, **json.load(f)}
    return default_config

def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

# ============ JWT AUTH ============
import jwt

def create_token(user_id, username, role):
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            request.user = data
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

# ============ AUTH ROUTES ============
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if user['password_hash'] != password_hash:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    token = create_token(user['id'], user['username'], user['role'])
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'email': user['email']
        }
    })

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user():
    return jsonify({'user': request.user})

# ============ DASHBOARD ROUTES ============
@app.route('/api/stats', methods=['GET'])
@token_required
def get_stats():
    if not os.path.exists(DB_FILE):
        return jsonify({"status": "Waiting for data..."})
        
    conn = get_db_connection()
    latest = conn.execute('SELECT * FROM events ORDER BY id DESC LIMIT 1').fetchone()
    total_anomalies = conn.execute("SELECT COUNT(*) FROM events WHERE status = 'CRITICAL'").fetchone()[0]
    total_events = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    
    # Get today's stats
    today = datetime.now().strftime('%Y-%m-%d')
    today_anomalies = conn.execute(
        "SELECT COUNT(*) FROM events WHERE status = 'CRITICAL' AND timestamp LIKE ?", 
        (f'{today}%',)
    ).fetchone()[0]
    
    conn.close()
    
    if latest:
        return jsonify({
            "status": latest['status'],
            "probability": latest['probability'],
            "timestamp": latest['timestamp'],
            "syscall_rate": latest['syscall_rate'],
            "churn_rate": latest['churn_rate'],
            "total_anomalies": total_anomalies,
            "total_events": total_events,
            "today_anomalies": today_anomalies,
            "ai_analysis": latest.get('ai_analysis','')
        })
    else:
        return jsonify({"status": "No data yet"})

@app.route('/api/history', methods=['GET'])
@token_required
def get_history():
    limit = request.args.get('limit', 100, type=int)
    
    if not os.path.exists(DB_FILE):
        return jsonify([])
        
    conn = get_db_connection()
    events = conn.execute('SELECT * FROM events ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    
    data = [dict(row) for row in reversed(events)]
    return jsonify(data)

@app.route('/api/analytics', methods=['GET'])
@token_required
def get_analytics():
    """Get historical analytics data"""
    period = request.args.get('period', 'week')  # week, month, year
    
    conn = get_db_connection()
    
    if period == 'week':
        days = 7
    elif period == 'month':
        days = 30
    else:
        days = 365
    
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    
    # Daily threat counts
    daily_stats = conn.execute('''
        SELECT 
            date(timestamp) as date,
            COUNT(*) as total_events,
            SUM(CASE WHEN status = 'CRITICAL' THEN 1 ELSE 0 END) as threats,
            AVG(probability) as avg_probability,
            AVG(syscall_rate) as avg_syscall_rate,
            AVG(churn_rate) as avg_churn_rate
        FROM events 
        WHERE timestamp >= ?
        GROUP BY date(timestamp)
        ORDER BY date(timestamp)
    ''', (start_date,)).fetchall()
    
    # Threat distribution by hour
    hourly_dist = conn.execute('''
        SELECT 
            strftime('%H', timestamp) as hour,
            COUNT(*) as count
        FROM events 
        WHERE status = 'CRITICAL' AND timestamp >= ?
        GROUP BY strftime('%H', timestamp)
    ''', (start_date,)).fetchall()
    
    # Top threat patterns
    threat_summary = conn.execute('''
        SELECT 
            COUNT(*) as total_threats,
            AVG(probability) as avg_threat_prob,
            MAX(probability) as max_threat_prob
        FROM events 
        WHERE status = 'CRITICAL' AND timestamp >= ?
    ''', (start_date,)).fetchone()
    
    conn.close()
    
    return jsonify({
        'daily_stats': [dict(row) for row in daily_stats],
        'hourly_distribution': [dict(row) for row in hourly_dist],
        'summary': dict(threat_summary) if threat_summary else {},
        'period': period
    })

# ============ AI THREAT ANALYSIS ============
@app.route('/api/analyze-threat', methods=['POST'])
@token_required
def analyze_threat():
    """AI-powered threat analysis using Gemini 3 Flash"""
    data = request.get_json()
    event_data = data.get('event', {})
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        return jsonify({'error': 'AI service not configured'}), 500
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"threat-analysis-{int(time.time())}",
            system_message="""You are a cybersecurity threat analyst AI. Analyze system events and provide:
1. Threat Classification (ransomware, fork bomb, crypto miner, privilege escalation, reverse shell, or other)
2. Severity Assessment (Critical, High, Medium, Low)
3. Brief explanation of why this pattern is suspicious
4. Recommended actions
Keep responses concise and actionable. Format as JSON."""
        ).with_model("gemini", "gemini-3-flash-preview")
        
        prompt = f"""Analyze this system event for potential security threats:
- Status: {event_data.get('status', 'Unknown')}
- Threat Probability: {event_data.get('probability', 0):.2%}
- Syscall Rate: {event_data.get('syscall_rate', 0)}/sec
- File Churn Rate: {event_data.get('churn_rate', 0)}/sec
- Timestamp: {event_data.get('timestamp', 'Unknown')}

Provide a threat analysis in JSON format with keys: classification, severity, explanation, recommendations"""

        user_message = UserMessage(text=prompt)
        
        # Run async in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        response = loop.run_until_complete(chat.send_message(user_message))
        loop.close()
        
        # Try to parse as JSON
        try:
            # Clean response if it has markdown code blocks
            clean_response = response.strip()
            if clean_response.startswith('```'):
                clean_response = clean_response.split('```')[1]
                if clean_response.startswith('json'):
                    clean_response = clean_response[4:]
            analysis = json.loads(clean_response)
        except:
            analysis = {
                "classification": "Unknown",
                "severity": "Medium",
                "explanation": response,
                "recommendations": ["Review system logs", "Monitor for recurring patterns"]
            }
        
        return jsonify({'analysis': analysis})
        
    except Exception as e:
        return jsonify({'error': f'AI analysis failed: {str(e)}'}), 500

# ============ ALERTS ============
@app.route('/api/alerts/send', methods=['POST'])
@token_required
def send_alert():
    """Send alert via configured channels"""
    data = request.get_json()
    event_data = data.get('event', {})
    channels = data.get('channels', ['email', 'slack'])
    
    config = load_config()
    results = {'email': None, 'slack': None}
    
    alert_message = f"""🚨 SENTINEL OVERWATCH - THREAT DETECTED

Status: {event_data.get('status', 'CRITICAL')}
Probability: {event_data.get('probability', 0):.2%}
Syscall Rate: {event_data.get('syscall_rate', 0)}/sec
File Churn: {event_data.get('churn_rate', 0)}/sec
Time: {event_data.get('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))}

Immediate investigation recommended."""
    
    # Send Email
    if 'email' in channels and config.get('email_enabled'):
        try:
            import resend
            resend.api_key = os.environ.get('RESEND_API_KEY')
            
            for recipient in config.get('email_recipients', []):
                resend.Emails.send({
                    "from": os.environ.get('SENDER_EMAIL', 'alerts@sentinel.local'),
                    "to": [recipient],
                    "subject": "🚨 SENTINEL ALERT: Threat Detected",
                    "html": f"<pre>{alert_message}</pre>"
                })
            results['email'] = 'sent'
        except Exception as e:
            results['email'] = f'error: {str(e)}'
    
    # Send Slack
    if 'slack' in channels and config.get('slack_enabled'):
        try:
            from slack_sdk import WebClient
            slack_token = config.get('slack_bot_token') or os.environ.get('SLACK_BOT_TOKEN')
            slack_channel = config.get('slack_channel', '#security-alerts')
            
            if slack_token:
                client = WebClient(token=slack_token)
                client.chat_postMessage(
                    channel=slack_channel,
                    text=alert_message,
                    blocks=[
                        {
                            "type": "header",
                            "text": {"type": "plain_text", "text": "🚨 SENTINEL ALERT"}
                        },
                        {
                            "type": "section",
                            "text": {"type": "mrkdwn", "text": alert_message}
                        }
                    ]
                )
                results['slack'] = 'sent'
            else:
                results['slack'] = 'not configured'
        except Exception as e:
            results['slack'] = f'error: {str(e)}'
    
    # Log alert
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO alert_history (event_id, alert_type, recipient, sent_at, status) VALUES (?, ?, ?, ?, ?)",
        (event_data.get('id'), json.dumps(channels), json.dumps(config.get('email_recipients', [])), 
         datetime.now().isoformat(), json.dumps(results))
    )
    conn.commit()
    conn.close()
    
    return jsonify({'results': results})

@app.route('/api/alerts/history', methods=['GET'])
@token_required
def get_alert_history():
    conn = get_db_connection()
    alerts = conn.execute('SELECT * FROM alert_history ORDER BY id DESC LIMIT 50').fetchall()
    conn.close()
    return jsonify([dict(row) for row in alerts])

# ============ CONFIG ROUTES ============
@app.route('/api/config', methods=['GET'])
@token_required
def get_config():
    config = load_config()
    # Don't expose sensitive tokens
    safe_config = {**config}
    if 'slack_bot_token' in safe_config:
        safe_config['slack_bot_token'] = '***' if safe_config['slack_bot_token'] else ''
    return jsonify(safe_config)

@app.route('/api/config', methods=['PUT'])
@token_required
@admin_required
def update_config():
    data = request.get_json()
    config = load_config()
    
    # Update allowed fields
    allowed_fields = [
        'detection_threshold', 'alert_cooldown_minutes', 
        'email_enabled', 'slack_enabled', 'email_recipients',
        'slack_webhook_url', 'slack_bot_token', 'slack_channel',
        'attack_patterns'
    ]
    
    for field in allowed_fields:
        if field in data:
            # Don't overwrite token if placeholder
            if field == 'slack_bot_token' and data[field] == '***':
                continue
            config[field] = data[field]
    
    save_config(config)
    return jsonify({'message': 'Configuration updated', 'config': config})

# ============ EXPORT ROUTES ============
@app.route('/api/export/csv', methods=['GET'])
@token_required
def export_csv():
    """Export events to CSV"""
    import csv
    import io
    
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    
    conn = get_db_connection()
    
    query = "SELECT * FROM events"
    params = []
    
    if start_date and end_date:
        query += " WHERE timestamp BETWEEN ? AND ?"
        params = [start_date, end_date]
    
    query += " ORDER BY id DESC"
    events = conn.execute(query, params).fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Timestamp', 'Status', 'Probability', 'Syscall Rate', 'Churn Rate', 'AI Analysis'])
    
    for event in events:
        writer.writerow([
            event['id'], event['timestamp'], event['status'],
            event['probability'], event['syscall_rate'], event['churn_rate'],
            event['ai_analysis'] or ''
        ])
    
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'sentinel_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    )

@app.route('/api/export/pdf', methods=['GET'])
@token_required
def export_pdf():
    """Export threat report to PDF"""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    import io
    
    conn = get_db_connection()
    
    # Get summary stats
    total_events = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    total_threats = conn.execute("SELECT COUNT(*) FROM events WHERE status = 'CRITICAL'").fetchone()[0]
    recent_threats = conn.execute(
        "SELECT * FROM events WHERE status = 'CRITICAL' ORDER BY id DESC LIMIT 10"
    ).fetchall()
    conn.close()
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Header
    c.setFillColor(colors.darkblue)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 50, "SENTINEL OVERWATCH")
    c.setFont("Helvetica", 12)
    c.drawString(50, height - 70, f"Threat Report - Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Summary
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, height - 110, "Summary")
    c.setFont("Helvetica", 11)
    c.drawString(50, height - 130, f"Total Events Analyzed: {total_events}")
    c.drawString(50, height - 145, f"Threats Detected: {total_threats}")
    c.drawString(50, height - 160, f"Threat Rate: {(total_threats/max(total_events,1))*100:.2f}%")
    
    # Recent Threats
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, height - 200, "Recent Threats")
    
    y = height - 225
    c.setFont("Helvetica", 9)
    for threat in recent_threats:
        if y < 100:
            c.showPage()
            y = height - 50
        c.drawString(50, y, f"{threat['timestamp']} | Prob: {threat['probability']:.2%} | Syscalls: {threat['syscall_rate']} | Churn: {threat['churn_rate']}")
        y -= 15
    
    c.save()
    buffer.seek(0)
    
    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f'sentinel_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
    )

# ============ ATTACK PATTERNS ============
@app.route('/api/patterns', methods=['GET'])
@token_required
def get_attack_patterns():
    """Get configured attack detection patterns"""
    config = load_config()
    return jsonify(config.get('attack_patterns', {}))

@app.route('/api/patterns', methods=['PUT'])
@token_required
@admin_required
def update_attack_patterns():
    """Update attack detection patterns"""
    data = request.get_json()
    config = load_config()
    config['attack_patterns'] = data
    save_config(config)
    return jsonify({'message': 'Patterns updated', 'patterns': data})

# ============ USER MANAGEMENT ============
@app.route('/api/users', methods=['GET'])
@token_required
@admin_required
def get_users():
    conn = get_db_connection()
    users = conn.execute('SELECT id, username, email, role, created_at FROM users').fetchall()
    conn.close()
    return jsonify([dict(row) for row in users])

@app.route('/api/users', methods=['POST'])
@token_required
@admin_required
def create_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email', '')
    role = data.get('role', 'analyst')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)",
            (username, password_hash, email, role)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 400
    finally:
        conn.close()
    
    return jsonify({'message': 'User created'})

if __name__ == '__main__':
    print("Starting SENTINEL OVERWATCH Backend on port 5000...")
    app.run(debug=True, port=5000, host='0.0.0.0')
