# SENTINEL OVERWATCH — Quickstart

This repository contains tooling to collect auditd data, train ML models for anomaly detection, and run a dashboard (frontend + backend).

**Overview**
- **Audit data** is collected from `auditd` logs and converted to features by `feature_extractor.py`.
- **Data collection** uses `collect_labeled_data.py` to build `labeled_data.csv`.
- **Training** is available via `train_supervised.py` (single XGBoost) and `train_ensemble.py` (ensemble).
- **Backend** API server is in `backend/server.py` (FastAPI). Frontend is in the `frontend/` folder (Vite + React).

## Prerequisites
- Linux (root or sudo access required for auditd rules)
- Python 3.8+
- Node.js + npm/yarn for the frontend
- `auditd` installed and running

Install auditd (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install -y auditd audispd-plugins
sudo systemctl enable --now auditd
```

Install Node and Python runtime/tools as needed.

## 1) Apply Auditd Rules
The repo includes `setup_audit_rules.sh` which configures audit rules used by the feature extractor.

Run the script (requires sudo):

```bash
sudo bash setup_audit_rules.sh
```

Verify rules:

```bash
sudo auditctl -l
sudo ausearch -m ALL --start recent
```

Note: The script uses `auditctl` and will apply rules immediately. For production, persist rules in your distribution's audit conf.

## 2) Create Python Virtualenv and Install ML deps
Run the provided environment script to create a `venv` and install common ML packages:

```bash
bash setup_env.sh
source ./venv/bin/activate
```

If you plan to run the backend, install its requirements too:

```bash
pip install -r backend/requirements.txt
# plus the Slack SDK etc. if you plan to use alerts
pip install slack_sdk resend
```

## 3) Collect Labeled Data (Normal and Malicious)
Use `collect_labeled_data.py` to capture features windows from `/var/log/audit/audit.log`.

Examples (from repo root):

```bash
# Collect 5 minutes of Normal data (label 0)
python3 collect_labeled_data.py --label 0 --duration 300

# Collect 5 minutes of Malicious data (label 1) — this will launch the local simulation
python3 collect_labeled_data.py --label 1 --duration 300
```

- The script appends/creates `labeled_data.csv` in the repo root.
- `feature_extractor.py` is used internally by the collector to convert audit lines into numeric features.

## 4) Train Models
After you have sufficient labeled data (both classes present), train models.

Single XGBoost model:

```bash
source ./venv/bin/activate
python3 train_supervised.py
```

Ensemble trainer (saves multiple model files and `ensemble_model.pkl`):

```bash
python3 train_ensemble.py
```

Models are saved in the current working directory (e.g. `xgboost_model.pkl`, `ensemble_model.pkl`).

## 5) Run Real-time Detector (optional)
To run a simple real-time detector that tails `audit.log` and writes events to a local DB:

```bash
source ./venv/bin/activate
# Ensure ensemble_model.pkl exists (from training)
python3 run_supervised_detection.py
```

This script writes events to `events.db` (SQLite) which the backend can also read.

## 6) Start Backend API
Install backend dependencies (see `backend/requirements.txt`) then start Uvicorn from the repo root:

```bash
source ./venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.server:app --reload --host 0.0.0.0 --port 8000
```

The API endpoints are available under `http://localhost:8000/api/...`. Health: `/api/health`.

## Environment variables
Create a `.env` file at the repo root (or export these variables) before starting the backend. An example `.env.example` is included.

Recommended variables:

```
# SECRET used for signing tokens/session (generate a long random value)
SECRET_KEY=replace_with_a_secure_random_hex

# Gemini LLM API key (used by backend AI analysis)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3-flash-preview

# Email / Resend
RESEND_API_KEY=your_resend_api_key_here
SENDER_EMAIL=alerts@yourdomain.com

# Slack
SLACK_BOT_TOKEN=your_slack_bot_token_here
SLACK_CHANNEL=#security-alerts
```

- `SECRET_KEY` is a secret string used to sign tokens and session data. Use a secure random value (e.g. `python -c "import secrets; print(secrets.token_hex(32))"`).
- For the frontend (Vite), create `frontend/.env` or use `frontend/.env.local` with variables prefixed by `VITE_`, for example:

```
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=SentinelOverwatch
```

### What is "Flask secret" / `SECRET_KEY`?
- Historically Flask apps use `SECRET_KEY` to sign cookies and sessions. In this project the `SECRET_KEY` environment variable is also used to sign JWT tokens in `backend/server.py` (so it must remain secret).
- Generate a secure key with:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Set that value in your `.env` before starting the backend.

## 7) Start Frontend
From the `frontend/` folder:

```bash
cd frontend
npm install
# start dev server (Vite)
npm run start
```

The dev server defaults to port `3000` (or as configured). If the backend is on `8000`, the frontend will call the API endpoints (CORS is enabled in the backend).

## 8) Quick End-to-End (recommended order)
1. Ensure `auditd` is running and apply rules: `sudo bash setup_audit_rules.sh`.
2. Create venv: `bash setup_env.sh && source ./venv/bin/activate`.
3. Collect Normal then Malicious data with `collect_labeled_data.py`.
4. Train models with `train_ensemble.py` (or `train_supervised.py`).
5. Start backend: `uvicorn backend.server:app --reload --host 0.0.0.0 --port 8000`.
6. Start frontend: `cd frontend && npm run start`.

## Notes & Tips
- The collector reads `/var/log/audit/audit.log`. Ensure `auditd` is configured to write there.
- The backend expects an SQLite DB (default `events.db` or `/app/events.db` depending on environment). Confirm the path in `backend/server.py` (`DB_FILE`).
- Adjust detection thresholds and alert settings via the backend config endpoint or `sentinel_config.json`.
- For experimentation, `ultimate_safe_malicious.py` provides a safe attack simulation used by the collector.

## Files of interest
- `collect_labeled_data.py` — collects windows and writes `labeled_data.csv`
- `feature_extractor.py` — converts audit lines to features
- `train_supervised.py` / `train_ensemble.py` — training entrypoints
- `run_supervised_detection.py` — real-time detection tailing `audit.log`
- `backend/server.py` — FastAPI backend server
- `frontend/` — React + Vite dashboard

## Want me to…
- Run the backend locally and open the frontend? (I can run the server here.)
- Commit this README to a branch and create a PR?

---
Generated by the repo assistant.
