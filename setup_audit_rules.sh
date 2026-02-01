#!/bin/bash

echo "Applying Auditd Rules..."

# Clear existing rules
sudo auditctl -D

# Increase buffer size to prevent lost messages under load
sudo auditctl -b 8192

# Monitor file operations
sudo auditctl -a always,exit -F arch=b64 -S open,openat,creat -k file_open
sudo auditctl -a always,exit -F arch=b64 -S unlink,unlinkat,rmdir -k file_delete
sudo auditctl -a always,exit -F arch=b64 -S stat,lstat,fstat,fstatat -k file_stat

# Monitor process operations
sudo auditctl -a always,exit -F arch=b64 -S clone,fork,vfork -k process_create
sudo auditctl -a always,exit -F arch=b64 -S execve,execveat -k process_exec

# Monitor network operations
sudo auditctl -a always,exit -F arch=b64 -S socket,connect,bind -k network

# 32-bit compatibility (Optional but good for coverage)
sudo auditctl -a always,exit -F arch=b32 -S open,openat,creat -k file_open
sudo auditctl -a always,exit -F arch=b32 -S unlink,unlinkat,rmdir -k file_delete
sudo auditctl -a always,exit -F arch=b32 -S stat,lstat,fstat,fstatat -k file_stat
sudo auditctl -a always,exit -F arch=b32 -S clone,fork,vfork -k process_create
sudo auditctl -a always,exit -F arch=b32 -S execve,execveat -k process_exec

# Make configuration immutable (Restart required to change) - DISABLED for testing
# sudo auditctl -e 2

echo "Audit rules applied successfully."
sudo auditctl -l
