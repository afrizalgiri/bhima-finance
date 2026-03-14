#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Frontend-only deployment: git pull, npm run build, pm2 restart bhima-frontend, pm2 status
"""

import paramiko
import time
import sys
import re

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

HOST = "31.97.223.3"
PORT = 22
USERNAME = "root"
PASSWORD = "Dorolonda@2024#"

APP_DIR = "/root/bhima-finance"
FRONTEND_DIR = "/root/bhima-finance/app/frontend"


def strip_ansi(text):
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    text = ansi_escape.sub('', text)
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        parts = line.split('\r')
        cleaned.append(parts[-1])
    return '\n'.join(cleaned)


def run_command(ssh, command, timeout=600, description=""):
    print(f"\n{'='*70}")
    print(f"STEP: {description}")
    print(f"CMD:  {command}")
    print(f"{'='*70}", flush=True)

    transport = ssh.get_transport()
    channel = transport.open_session()
    channel.set_combine_stderr(True)
    channel.settimeout(None)
    channel.exec_command(command)

    stdout_buf = b""
    deadline = time.time() + timeout

    while True:
        if channel.exit_status_ready():
            while channel.recv_ready():
                chunk = channel.recv(4096)
                if not chunk:
                    break
                stdout_buf += chunk
            break

        if time.time() > deadline:
            print(f"\n[TIMEOUT] Command exceeded {timeout}s — killing channel")
            channel.close()
            return strip_ansi(stdout_buf.decode("utf-8", errors="replace")), -1

        if channel.recv_ready():
            chunk = channel.recv(4096)
            if chunk:
                stdout_buf += chunk
        else:
            time.sleep(0.5)

    exit_status = channel.recv_exit_status()
    channel.close()

    raw_text = stdout_buf.decode("utf-8", errors="replace")
    clean_text = strip_ansi(raw_text)
    print(clean_text, flush=True)
    print(f"\n[Exit status: {exit_status}]", flush=True)
    return clean_text, exit_status


def main():
    print(f"Connecting to {HOST}:{PORT} as {USERNAME}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        hostname=HOST,
        port=PORT,
        username=USERNAME,
        password=PASSWORD,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    print("Connected successfully.\n")

    try:
        # Step 1: git pull
        run_command(
            ssh,
            f"cd {APP_DIR} && git pull 2>&1",
            timeout=120,
            description="Step 1: git pull"
        )

        # Step 2: npm run build (frontend)
        run_command(
            ssh,
            f"cd {FRONTEND_DIR} && npm run build 2>&1",
            timeout=600,
            description="Step 2: npm run build (frontend)"
        )

        # Step 3: pm2 restart bhima-frontend
        run_command(
            ssh,
            "pm2 restart bhima-frontend 2>&1",
            timeout=60,
            description="Step 3: pm2 restart bhima-frontend"
        )

        # Step 4: pm2 status
        run_command(
            ssh,
            "pm2 list 2>&1",
            timeout=30,
            description="Step 4: pm2 status"
        )

        print("\n" + "="*70)
        print("DONE")
        print("="*70)

    finally:
        ssh.close()
        print("\nSSH connection closed.")


if __name__ == "__main__":
    main()
