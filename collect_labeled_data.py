import argparse
import time
import subprocess
import pandas as pd
import os
from feature_extractor import AuditFeatureExtractor

def collect_data(label, duration, output_file="labeled_data.csv"):
    extractor = AuditFeatureExtractor()
    data_points = []
    
    print(f"[*] Starting Data Collection for LABEL={label}...")
    print(f"[*] Duration: {duration} seconds")
    
    # Start tailing audit.log
    # We use tail -f -n 0 to only get NEW lines
    proc = subprocess.Popen(['tail', '-F', '-n', '0', '/var/log/audit/audit.log'], 
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    
    start_time = time.time()
    
    # If Label=1 (Malicious), launch the attack script
    attack_proc = None
    if label == 1:
        print("[!] Launching Attack Simulation...")
        # Assume venv python is available or use system python if compatible
        # Using the same python interpreter as this script
        import sys
        attack_proc = subprocess.Popen([sys.executable, 'ultimate_safe_malicious.py'])
    
    try:
        buffer = []
        last_flush = time.time()
        
        while time.time() - start_time < duration:
            line = proc.stdout.readline()
            if line:
                buffer.append(line)
            
            # Process every 1 second
            if time.time() - last_flush >= 1.0:
                if buffer:
                    features = extractor.process_window(buffer)
                    features['label'] = label
                    data_points.append(features)
                    buffer = [] # Clear buffer
                    print(f"Captured window: {features['syscall_rate']} syscalls")
                last_flush = time.time()
                
    except KeyboardInterrupt:
        print("\nStopping collection...")
    finally:
        proc.terminate()
        if attack_proc:
            print("[!] Stopping Attack Simulation...")
            attack_proc.terminate()
            # Clean up dummy files if any remain
            subprocess.run(['rm', '-rf', 'dummy_files'])
            
    # Save to CSV
    df = pd.DataFrame(data_points)
    
    # Append if file exists, else create
    if os.path.exists(output_file):
        df.to_csv(output_file, mode='a', header=False, index=False)
        print(f"[+] Appended {len(df)} rows to {output_file}")
    else:
        df.to_csv(output_file, index=False)
        print(f"[+] Created {output_file} with {len(df)} rows")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", type=int, required=True, choices=[0, 1], help="0 for Normal, 1 for Malicious")
    parser.add_argument("--duration", type=int, default=60, help="Duration in seconds")
    args = parser.parse_args()
    
    collect_data(args.label, args.duration)
