import re
import pandas as pd
from collections import defaultdict

class AuditFeatureExtractor:
    def __init__(self):
        self.features = []
        # Regex patterns for fast parsing
        self.syscall_pat = re.compile(r'type=SYSCALL.*syscall=(\d+).*success=(\w+)')
        self.exec_pat = re.compile(r'type=EXECVE')
        self.path_pat = re.compile(r'type=PATH.*name="(.*?)"')
        
    def process_window(self, log_lines):
        """
        Processes a list of raw log lines (1 second window) and returns a feature dictionary.
        """
        stats = {
            'syscall_count': 0,
            'failed_syscalls': 0,
            'open_count': 0,
            'unlink_count': 0,
            'exec_count': 0,
            'clone_count': 0,
            'unique_files': set()
        }
        
        # Mapping syscall numbers to names (x86_64)
        # 2=open, 257=openat, 85=creat
        # 87=unlink, 263=unlinkat, 84=rmdir
        # 56=clone, 57=fork, 58=vfork, 59=execve
        syscall_map = {
            '2': 'open', '257': 'open', '85': 'open',
            '87': 'unlink', '263': 'unlink', '84': 'unlink',
            '56': 'clone', '57': 'clone', '58': 'clone', '59': 'exec' 
        }

        for line in log_lines:
            # Syscall Check
            m_sys = self.syscall_pat.search(line)
            if m_sys:
                syscall_nr = m_sys.group(1)
                success = m_sys.group(2)
                
                stats['syscall_count'] += 1
                if success == 'no':
                    stats['failed_syscalls'] += 1
                
                s_type = syscall_map.get(syscall_nr)
                if s_type == 'open':
                    stats['open_count'] += 1
                elif s_type == 'unlink':
                    stats['unlink_count'] += 1
                elif s_type == 'clone':
                    stats['clone_count'] += 1
                elif s_type == 'exec':
                    stats['exec_count'] += 1

            # Path Check
            m_path = self.path_pat.search(line)
            if m_path:
                stats['unique_files'].add(m_path.group(1))

        # Calculate Derived Features
        # Avoid division by zero with max(x, 1) or adding epsilon
        
        features = {
            'syscall_rate': stats['syscall_count'],
            'open_unlink_ratio': stats['open_count'] / max(stats['unlink_count'], 1),
            'unique_files_accessed': len(stats['unique_files']),
            'failed_syscall_ratio': stats['failed_syscalls'] / max(stats['syscall_count'], 1),
            'process_spawn_rate': stats['clone_count'] + stats['exec_count'],
            'file_churn_rate': stats['unlink_count']  # Absolute churn
        }
        
        return features

    def parse_file(self, file_path):
        """Helper to parse a full file for offline training data"""
        pass # Not used in streaming mode
