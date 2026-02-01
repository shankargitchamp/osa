import time
import pandas as pd
import pickle
import os
import sys
from feature_extractor import AuditFeatureExtractor
import sqlite3

LOG_FILE = "/var/log/audit/audit.log"
DB_FILE = "events.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            status TEXT,
            probability REAL,
            syscall_rate INTEGER,
            churn_rate INTEGER
        )
    ''')
    conn.commit()
    conn.close()

def follow(file_path):
    """
    Generator that yields new lines from a file, handling log rotation.
    """
    if not os.path.exists(file_path):
        print(f"Waiting for {file_path} to exist...")
        while not os.path.exists(file_path):
            time.sleep(1)

    f = open(file_path, 'r')
    f.seek(0, 2) # Go to end
    
    inode = os.fstat(f.fileno()).st_ino
    
    while True:
        line = f.readline()
        if not line:
            time.sleep(0.1)
            # Check for rotation
            try:
                if os.stat(file_path).st_ino != inode:
                    print("\n[INFO] Log rotation detected! Reopening file...")
                    f.close()
                    f = open(file_path, 'r')
                    inode = os.fstat(f.fileno()).st_ino
            except FileNotFoundError:
                pass # Log might briefly disappear during rotation
            continue
            
        yield line

def main():
    init_db() # Initialize Database
    if not os.path.exists("ensemble_model.pkl"):
        print("Error: Model not found. Train the model first using train_supervised.py")
        sys.exit(1)
        
    print("Loading Model...")
    with open("ensemble_model.pkl", "rb") as f:
        data = pickle.load(f)
        model = data['ensemble'] if isinstance(data, dict) and 'ensemble' in data else data
        print("Loaded model type:", type(model))
        if isinstance(model, dict):
            print("Model dict keys:", model.keys())
            sys.exit(1)
    extractor = AuditFeatureExtractor()
    buffer = []
    last_check = time.time()
    
    print("\n[*] Starting Real-Time Anomaly Detection...")
    print(f"[*] Monitoring {LOG_FILE}")
    print("-" * 65)
    print(f"{'TIMESTAMP':<25} | {'STATUS':<15} | {'PROBABILITY':<12}")
    print("-" * 65)
    
    try:
        for line in follow(LOG_FILE):
            buffer.append(line)
            
            # Check every 1 second
            if time.time() - last_check >= 1.0:
                if buffer:
                    features = extractor.process_window(buffer)
                    df = pd.DataFrame([features])
                    
                    # Predict
                    prob = model.predict_proba(df)[0][1] # Probability of Class 1 (Malicious)
                    pred = model.predict(df)[0]
                    
                    status = "\033[91mCRITICAL\033[0m" if pred == 1 else "\033[92mSAFE\033[0m"
                    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                    
                    
                    # Print log line (scrolling)
                    print(f"{timestamp:<25} | {status:<24} | {prob:.4f}")
                    
                    # Write to DB
                    try:
                        conn = sqlite3.connect(DB_FILE)
                        conn.execute("INSERT INTO events (timestamp, status, probability, syscall_rate, churn_rate) VALUES (?, ?, ?, ?, ?)",
                                     (timestamp, "CRITICAL" if pred == 1 else "SAFE", float(prob), features['syscall_rate'], features['file_churn_rate']))
                        conn.commit()
                        conn.close()
                    except Exception as e:
                        print(f"DB Error: {e}")
                    
                    buffer = []
                last_check = time.time()
                
    except KeyboardInterrupt:
        print("\n\nStopping detector...")

if __name__ == "__main__":
    main()
