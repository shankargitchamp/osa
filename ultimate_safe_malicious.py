import os
import time
import random
from multiprocessing import Process

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
            
            # Create and Write (Encrypted-like content)
            try:
                with open(filename, "w") as f:
                    f.write("EncryptedContent" * 100)
                
                # Immediate Delete (Wiper behavior / Ransomware cleanup)
                if os.path.exists(filename):
                    os.remove(filename)
            except FileNotFoundError:
                # Directory removed during cleanup, stop loop
                break
                
            time.sleep(0.01) # Very fast churn
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
            # Fork a child
            p = Process(target=child_task)
            p.start()
            p.join() # Wait for it to finish immediately to keep it safe but noisy in logs
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("[ForkBomb] Stopping...")

def child_task():
    """Short lived task for child process"""
    x = 0
    for i in range(1000):
        x += 1

if __name__ == "__main__":
    print("Starting Ultimate Safe Malicious Simulator...")
    print("Features triggered: Ransomware (High I/O Churn), ForkBomb (High Process Spawn)")
    print("Press CTRL+C to stop.")
    
    # Run both simulations in parallel
    p1 = Process(target=ransomware_simulator)
    p2 = Process(target=fork_bomb_simulator)
    
    p1.start()
    p2.start()
    
    try:
        p1.join()
        p2.join()
    except KeyboardInterrupt:
        print("\nStopping attack simulation...")
        p1.terminate()
        p2.terminate()
        # Cleanup
        if os.path.exists("dummy_files"):
            for f in os.listdir("dummy_files"):
                os.remove(os.path.join("dummy_files", f))
            os.rmdir("dummy_files")
        print("Cleaned up.")