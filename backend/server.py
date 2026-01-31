"""
SENTINEL OVERWATCH - Enhanced Security Dashboard Backend (FastAPI)
Features: API Auth, AI Threat Analysis, Slack/Email Alerts, Historical Analytics
"""
import os
import sys
import time
import json
import asyncio
import sqlite3
import hashlib
import secrets
import csv
import io
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import jwt
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv('/app/.env')

app = FastAPI(title="SENTINEL OVERWATCH API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.environ.get('SECRET_KEY', secrets.token_hex(32))
DB_FILE = "/app/events.db"
CONFIG_FILE = "/app/sentinel_config.json"

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
def create_token(user_id: int, username: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': int((datetime.now(timezone.utc) + timedelta(hours=24)).timestamp())
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Token is missing')
    
    token = auth_header.split(' ')[1]
    
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return data
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token has expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

# ============ PYDANTIC MODELS ============
class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = ''
    role: Optional[str] = 'analyst'

class ConfigUpdate(BaseModel):
    detection_threshold: Optional[float] = None
    alert_cooldown_minutes: Optional[int] = None
    email_enabled: Optional[bool] = None
    slack_enabled: Optional[bool] = None
    email_recipients: Optional[List[str]] = None
    slack_webhook_url: Optional[str] = None
    slack_bot_token: Optional[str] = None
    slack_channel: Optional[str] = None
    attack_patterns: Optional[Dict[str, Any]] = None

class AlertRequest(BaseModel):
    event: Dict[str, Any]
    channels: Optional[List[str]] = ['email', 'slack']

class AnalyzeRequest(BaseModel):
    event: Dict[str, Any]

# ============ AUTH ROUTES ============
@app.post('/api/auth/login')
async def login(request: LoginRequest):
    username = request.username
    password = request.password
    
    if not username or not password:
        raise HTTPException(status_code=400, detail='Username and password required')
    
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    if user['password_hash'] != password_hash:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    token = create_token(user['id'], user['username'], user['role'])
    return {
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
            'email': user['email']
        }
    }

@app.get('/api/auth/me')
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return {'user': current_user}

# ============ DASHBOARD ROUTES ============
@app.get('/api/stats')
async def get_stats(current_user: dict = Depends(get_current_user)):
    if not os.path.exists(DB_FILE):
        return {"status": "Waiting for data..."}
        
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
        return {
            "status": latest['status'],
            "probability": latest['probability'],
            "timestamp": latest['timestamp'],
            "syscall_rate": latest['syscall_rate'],
            "churn_rate": latest['churn_rate'],
            "total_anomalies": total_anomalies,
            "total_events": total_events,
            "today_anomalies": today_anomalies,
            "ai_analysis": latest['ai_analysis'] or ''
        }
    else:
        return {"status": "No data yet"}

@app.get('/api/history')
async def get_history(limit: int = 100, current_user: dict = Depends(get_current_user)):
    if not os.path.exists(DB_FILE):
        return []
        
    conn = get_db_connection()
    events = conn.execute('SELECT * FROM events ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    
    data = [dict(row) for row in reversed(events)]
    return data

@app.get('/api/analytics')
async def get_analytics(period: str = 'week', current_user: dict = Depends(get_current_user)):
    """Get historical analytics data"""
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
    
    return {
        'daily_stats': [dict(row) for row in daily_stats],
        'hourly_distribution': [dict(row) for row in hourly_dist],
        'summary': dict(threat_summary) if threat_summary else {},
        'period': period
    }

# ============ AI THREAT ANALYSIS ============
@app.post('/api/analyze-threat')
async def analyze_threat(request: AnalyzeRequest, current_user: dict = Depends(get_current_user)):
    """AI-powered threat analysis using Gemini 3 Flash"""
    event_data = request.event
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail='AI service not configured')
    
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
        
        response = await chat.send_message(user_message)
        
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
        
        return {'analysis': analysis}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'AI analysis failed: {str(e)}')

# ============ ALERTS ============
@app.post('/api/alerts/send')
async def send_alert(request: AlertRequest, current_user: dict = Depends(get_current_user)):
    """Send alert via configured channels"""
    event_data = request.event
    channels = request.channels
    
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
    
    return {'results': results}

@app.get('/api/alerts/history')
async def get_alert_history(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    alerts = conn.execute('SELECT * FROM alert_history ORDER BY id DESC LIMIT 50').fetchall()
    conn.close()
    return [dict(row) for row in alerts]

# ============ CONFIG ROUTES ============
@app.get('/api/config')
async def get_config(current_user: dict = Depends(get_current_user)):
    config = load_config()
    # Don't expose sensitive tokens
    safe_config = {**config}
    if 'slack_bot_token' in safe_config:
        safe_config['slack_bot_token'] = '***' if safe_config['slack_bot_token'] else ''
    return safe_config

@app.put('/api/config')
async def update_config(request: ConfigUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    config = load_config()
    
    # Update allowed fields
    update_data = request.model_dump(exclude_none=True)
    for field, value in update_data.items():
        # Don't overwrite token if placeholder
        if field == 'slack_bot_token' and value == '***':
            continue
        config[field] = value
    
    save_config(config)
    return {'message': 'Configuration updated', 'config': config}

# ============ EXPORT ROUTES ============
@app.get('/api/export/csv')
async def export_csv(start: Optional[str] = None, end: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Export events to CSV"""
    conn = get_db_connection()
    
    query = "SELECT * FROM events"
    params = []
    
    if start and end:
        query += " WHERE timestamp BETWEEN ? AND ?"
        params = [start, end]
    
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
    filename = f'sentinel_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

@app.get('/api/export/pdf')
async def export_pdf(current_user: dict = Depends(get_current_user)):
    """Export threat report to PDF"""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        from reportlab.lib import colors
    except ImportError:
        raise HTTPException(status_code=500, detail='PDF export requires reportlab library')
    
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
    
    filename = f'sentinel_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
    
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )

# ============ ATTACK PATTERNS ============
@app.get('/api/patterns')
async def get_attack_patterns(current_user: dict = Depends(get_current_user)):
    """Get configured attack detection patterns"""
    config = load_config()
    return config.get('attack_patterns', {})

@app.put('/api/patterns')
async def update_attack_patterns(patterns: Dict[str, Any], current_user: dict = Depends(get_current_user)):
    """Update attack detection patterns"""
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    config = load_config()
    config['attack_patterns'] = patterns
    save_config(config)
    return {'message': 'Patterns updated', 'patterns': patterns}

# ============ USER MANAGEMENT ============
@app.get('/api/users')
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    conn = get_db_connection()
    users = conn.execute('SELECT id, username, email, role, created_at FROM users').fetchall()
    conn.close()
    return [dict(row) for row in users]

@app.post('/api/users')
async def create_user(request: UserCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    
    if not request.username or not request.password:
        raise HTTPException(status_code=400, detail='Username and password required')
    
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    
    conn = get_db_connection()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)",
            (request.username, password_hash, request.email, request.role)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail='Username already exists')
    finally:
        conn.close()
    
    return {'message': 'User created'}

# Health check endpoint
@app.get('/api/health')
async def health_check():
    return {'status': 'healthy', 'timestamp': datetime.now().isoformat()}
