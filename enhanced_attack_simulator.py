"""
ENHANCED ATTACK SIMULATOR
Simulates various attack patterns for training security detection models:
- Ransomware (file churn)
- Fork Bomb (process spawning)
- Crypto Miner (CPU intensive operations)
- Privilege Escalation (permission changes)
- Reverse Shell (network connections)
"""
import os
import time
import random
import socket
import threading
from multiprocessing import Process, cpu_count

def ransomware_simulator(directory="dummy_files", count=100):
    """
    Simulates ransomware behavior by rapidly creating, writing to, and deleting files.
    High file churn: count(open/creat) and count(unlink/rmdir)
    """
    if not os.path.exists(directory):
        os.makedirs(directory)
    
    print(f"[Ransomware] Starting file churn in {directory}...")
    
    try:
        while True:
            filename = os.path.join(directory, f"file_{random.randint(0, 10000)}.txt")
            
            try:
                # Create and Write (Encrypted-like content)
                with open(filename, "w") as f:
                    f.write("EncryptedContent" * 100)
                
                # Simulate reading original file
                with open(filename, "r") as f:
                    _ = f.read()
                
                # Immediate Delete (Wiper behavior / Ransomware cleanup)
                if os.path.exists(filename):
                    os.remove(filename)
            except FileNotFoundError:
                break
                
            time.sleep(0.01)  # Very fast churn
    except KeyboardInterrupt:
        print("[Ransomware] Stopping...")

def fork_bomb_simulator(max_children=10):
    """
    Simulates a controlled fork bomb by spawning short-lived processes.
    High process activity: count(clone/fork/exec)
    """
    print(f"[ForkBomb] Spawning processes (Max concurrent: {max_children})...")
    
    try:
        while True:
            p = Process(target=child_task)
            p.start()
            p.join()
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("[ForkBomb] Stopping...")

def child_task():
    """Short lived task for child process"""
    x = 0
    for i in range(1000):
        x += 1

def crypto_miner_simulator(duration=None):
    """
    Simulates crypto mining behavior with high CPU usage and specific patterns.
    Characteristics:
    - High CPU utilization across multiple cores
    - Repetitive mathematical operations (hash-like)
    - Memory access patterns similar to mining
    """
    print(f"[CryptoMiner] Starting CPU-intensive operations...")
    
    def mining_worker(worker_id):
        """Simulates mining work with hash-like operations"""
        nonce = 0
        start = time.time()
        
        while duration is None or (time.time() - start) < duration:
            # Simulate hash computation (SHA-256 like workload)
            data = f"block_{nonce}_{worker_id}".encode()
            hash_result = 0
            for byte in data:
                hash_result = ((hash_result << 5) + hash_result) ^ byte
                hash_result &= 0xFFFFFFFF
            
            # Simulate difficulty check
            if hash_result < 0x1000000:
                nonce = 0  # "Found a block"
            else:
                nonce += 1
            
            # Memory-intensive operation
            buffer = bytearray(1024 * 64)  # 64KB buffer
            for i in range(len(buffer)):
                buffer[i] = (hash_result >> (i % 32)) & 0xFF
    
    try:
        # Spawn workers on multiple cores
        num_workers = max(2, cpu_count() - 1)
        workers = []
        
        for i in range(num_workers):
            t = threading.Thread(target=mining_worker, args=(i,))
            t.daemon = True
            t.start()
            workers.append(t)
        
        # Keep main thread alive
        while True:
            time.sleep(1)
            print(f"[CryptoMiner] Mining in progress... ({num_workers} workers)")
            
    except KeyboardInterrupt:
        print("[CryptoMiner] Stopping...")

def privilege_escalation_simulator():
    """
    Simulates privilege escalation attempts.
    Characteristics:
    - Attempts to access protected files
    - Creates files in system directories
    - Changes file permissions
    - Reads sensitive files
    """
    print("[PrivEsc] Simulating privilege escalation patterns...")
    
    sensitive_paths = [
        "/etc/passwd",
        "/etc/shadow",
        "/etc/sudoers",
        "/root/.ssh/id_rsa",
        "/proc/1/environ",
    ]
    
    try:
        while True:
            # Attempt to read sensitive files
            for path in sensitive_paths:
                try:
                    with open(path, 'r') as f:
                        _ = f.read(100)
                except PermissionError:
                    pass  # Expected - generates audit logs
                except FileNotFoundError:
                    pass
            
            # Attempt to create files in protected areas
            test_paths = [
                "/tmp/.hidden_backdoor",
                "/var/tmp/.cache_exploit",
            ]
            
            for path in test_paths:
                try:
                    with open(path, 'w') as f:
                        f.write("test")
                    os.chmod(path, 0o777)  # Suspicious permission change
                    os.remove(path)
                except:
                    pass
            
            # Attempt setuid-like operations (will fail but generates logs)
            try:
                os.setuid(0)
            except:
                pass
            
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("[PrivEsc] Stopping...")

def reverse_shell_simulator(target_host="127.0.0.1", ports=None):
    """
    Simulates reverse shell connection attempts.
    Characteristics:
    - Outbound connection attempts to various ports
    - Socket creation and connection patterns
    - Typical C2 callback behavior
    """
    if ports is None:
        ports = [4444, 5555, 6666, 8080, 8443, 9001, 31337]
    
    print(f"[ReverseShell] Simulating outbound connection attempts...")
    
    try:
        while True:
            for port in ports:
                try:
                    # Create socket (generates syscalls)
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(0.1)
                    
                    # Attempt connection (will fail but generates logs)
                    sock.connect((target_host, port))
                    
                except (socket.timeout, ConnectionRefusedError, OSError):
                    pass  # Expected
                finally:
                    try:
                        sock.close()
                    except:
                        pass
                
                time.sleep(0.1)
            
            # Also simulate DNS lookups (command execution patterns)
            try:
                socket.gethostbyname("malicious-c2-server.evil")
            except:
                pass
                
            time.sleep(0.5)
            
    except KeyboardInterrupt:
        print("[ReverseShell] Stopping...")

def data_exfiltration_simulator(data_dir="dummy_data"):
    """
    Simulates data exfiltration patterns.
    Characteristics:
    - Large file reads
    - Data compression
    - Network transfer attempts
    """
    print("[DataExfil] Simulating data exfiltration patterns...")
    
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        # Create some test data
        for i in range(10):
            with open(os.path.join(data_dir, f"sensitive_data_{i}.txt"), 'w') as f:
                f.write("Sensitive data content " * 1000)
    
    try:
        while True:
            # Read all files in directory
            for filename in os.listdir(data_dir):
                filepath = os.path.join(data_dir, filename)
                try:
                    with open(filepath, 'rb') as f:
                        data = f.read()
                    
                    # Simulate compression
                    import zlib
                    compressed = zlib.compress(data)
                    
                except:
                    pass
            
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("[DataExfil] Stopping...")
        # Cleanup
        import shutil
        shutil.rmtree(data_dir, ignore_errors=True)

def run_all_attacks(duration=60):
    """Run all attack simulations concurrently"""
    print(f"Starting Enhanced Attack Simulation for {duration} seconds...")
    print("Features: Ransomware, ForkBomb, CryptoMiner, PrivEsc, ReverseShell")
    print("Press CTRL+C to stop early.\n")
    
    processes = [
        Process(target=ransomware_simulator),
        Process(target=fork_bomb_simulator),
        Process(target=crypto_miner_simulator),
        Process(target=privilege_escalation_simulator),
        Process(target=reverse_shell_simulator),
    ]
    
    for p in processes:
        p.start()
    
    try:
        time.sleep(duration)
    except KeyboardInterrupt:
        print("\nStopping all attack simulations...")
    finally:
        for p in processes:
            p.terminate()
        
        # Cleanup
        if os.path.exists("dummy_files"):
            import shutil
            shutil.rmtree("dummy_files", ignore_errors=True)
        
        print("All attack simulations stopped and cleaned up.")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced Attack Simulator")
    parser.add_argument("--attack", type=str, default="all",
                       choices=["all", "ransomware", "forkbomb", "cryptominer", 
                               "privesc", "reverseshell", "exfil"],
                       help="Attack type to simulate")
    parser.add_argument("--duration", type=int, default=60,
                       help="Duration in seconds (for 'all' mode)")
    
    args = parser.parse_args()
    
    if args.attack == "all":
        run_all_attacks(args.duration)
    elif args.attack == "ransomware":
        ransomware_simulator()
    elif args.attack == "forkbomb":
        fork_bomb_simulator()
    elif args.attack == "cryptominer":
        crypto_miner_simulator()
    elif args.attack == "privesc":
        privilege_escalation_simulator()
    elif args.attack == "reverseshell":
        reverse_shell_simulator()
    elif args.attack == "exfil":
        data_exfiltration_simulator()
