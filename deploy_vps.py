#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Deployment script for bhima-finance app using paramiko SSH.
"""

import paramiko
import time
import sys
import re
import socket

# Force UTF-8 output on Windows to avoid charmap encoding errors
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

HOST = "31.97.223.3"
PORT = 22
USERNAME = "root"
PASSWORD = "Dorolonda@2024#"

BACKEND_DIR = "/root/bhima-finance/app/backend"
FRONTEND_DIR = "/root/bhima-finance/app/frontend"
APP_DIR = "/root/bhima-finance"
ENV_FILE = "/root/bhima-finance/app/backend/.env"


def strip_ansi(text):
    """Remove ANSI escape sequences and collapse carriage-return progress lines."""
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    text = ansi_escape.sub('', text)
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        parts = line.split('\r')
        cleaned.append(parts[-1])
    return '\n'.join(cleaned)


def run_command(ssh, command, timeout=300, description=""):
    """
    Run a command over SSH using channel-level streaming.
    No PTY is requested; stdout/stderr are read separately via polling.
    """
    print(f"\n{'='*70}")
    print(f"STEP: {description}")
    print(f"CMD:  {command}")
    print(f"{'='*70}", flush=True)

    transport = ssh.get_transport()
    channel = transport.open_session()
    channel.set_combine_stderr(True)   # merge stderr into stdout stream
    channel.settimeout(None)           # no per-recv timeout; we poll manually

    channel.exec_command(command)

    stdout_buf = b""
    deadline = time.time() + timeout

    while True:
        # Check if command finished
        if channel.exit_status_ready():
            # Drain any remaining data
            while channel.recv_ready():
                chunk = channel.recv(4096)
                if not chunk:
                    break
                stdout_buf += chunk
            break

        # Check for timeout
        if time.time() > deadline:
            print(f"\n[TIMEOUT] Command exceeded {timeout}s — killing channel")
            channel.close()
            return strip_ansi(stdout_buf.decode("utf-8", errors="replace")), "", -1

        # Read available data
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
    return clean_text, "", exit_status


def connect():
    """Establish SSH connection."""
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
    return ssh


def check_and_update_env(ssh):
    """Check if ANTHROPIC_API_KEY exists in .env, add placeholder if not."""
    print(f"\n{'='*70}")
    print("STEP: Step 4 — Check ANTHROPIC_API_KEY in .env")
    print(f"{'='*70}", flush=True)

    env_content, _, _ = run_command(
        ssh,
        f"cat {ENV_FILE}",
        timeout=30,
        description="Reading .env file"
    )

    print("Current .env contents:")
    print("-" * 40)
    print(env_content)
    print("-" * 40, flush=True)

    if "ANTHROPIC_API_KEY" in env_content:
        print("\n[OK] ANTHROPIC_API_KEY already exists in .env")
        return True
    else:
        print("\n[NOTICE] ANTHROPIC_API_KEY not found in .env")
        print("Adding ANTHROPIC_API_KEY=YOUR_KEY_PLACEHOLDER to .env...")

        run_command(
            ssh,
            f"echo 'ANTHROPIC_API_KEY=YOUR_KEY_PLACEHOLDER' >> {ENV_FILE}",
            timeout=15,
            description="Appending ANTHROPIC_API_KEY placeholder"
        )

        print("\n*** ACTION REQUIRED ***")
        print(f"ANTHROPIC_API_KEY placeholder added to {ENV_FILE}")
        print("You MUST replace 'YOUR_KEY_PLACEHOLDER' with your actual Anthropic API key.")
        print("SSH into the server and run:")
        print(f"  nano {ENV_FILE}")
        print("Then set: ANTHROPIC_API_KEY=sk-ant-xxxxxxxx...")
        return False


def main():
    ssh = None
    try:
        ssh = connect()

        # ── Step 1: git pull (stash local changes first) ─────────────────────
        out, _, rc = run_command(
            ssh,
            f"cd {APP_DIR} && git stash && git pull 2>&1",
            timeout=120,
            description="Step 1: git stash + git pull"
        )
        if rc != 0:
            print(f"[WARNING] git stash+pull exited with code {rc} — trying reset+pull fallback")
            out, _, rc = run_command(
                ssh,
                f"cd {APP_DIR} && git reset --hard HEAD && git pull 2>&1",
                timeout=120,
                description="Step 1b: git reset --hard + git pull (fallback)"
            )
            if rc != 0:
                print(f"[WARNING] git pull fallback also exited with code {rc} — continuing anyway")

        # ── Step 2: npm install (backend) ─────────────────────────────────────
        out, _, rc = run_command(
            ssh,
            f"cd {BACKEND_DIR} && npm install 2>&1",
            timeout=300,
            description="Step 2: npm install (backend) — installs @anthropic-ai/sdk"
        )
        if rc != 0:
            print(f"[WARNING] npm install exited with code {rc} — continuing anyway")

        # ── Step 3: prisma db push ────────────────────────────────────────────
        out, _, rc = run_command(
            ssh,
            f"cd {BACKEND_DIR} && npx prisma db push 2>&1",
            timeout=300,
            description="Step 3: npx prisma db push (apply schema changes)"
        )
        if rc != 0:
            print(f"[WARNING] prisma db push exited with code {rc} — continuing anyway")

        # ── Step 4: Check / update .env for ANTHROPIC_API_KEY ────────────────
        key_exists = check_and_update_env(ssh)

        # ── Step 5: pm2 restart bhima-backend ────────────────────────────────
        out, _, rc = run_command(
            ssh,
            "pm2 restart bhima-backend 2>&1",
            timeout=60,
            description="Step 5: pm2 restart bhima-backend"
        )
        if rc != 0:
            print(f"[WARNING] pm2 restart bhima-backend exited with code {rc}")

        # ── Step 6: Build frontend ────────────────────────────────────────────
        out, _, rc = run_command(
            ssh,
            f"cd {FRONTEND_DIR} && npm run build 2>&1",
            timeout=600,
            description="Step 6: npm run build (frontend)"
        )
        if rc != 0:
            print(f"[WARNING] Frontend build exited with code {rc} — continuing anyway")

        # ── Step 7: pm2 restart bhima-frontend ───────────────────────────────
        out, _, rc = run_command(
            ssh,
            "pm2 restart bhima-frontend 2>&1",
            timeout=60,
            description="Step 7: pm2 restart bhima-frontend"
        )
        if rc != 0:
            print(f"[WARNING] pm2 restart bhima-frontend exited with code {rc}")

        # ── Final status ──────────────────────────────────────────────────────
        run_command(
            ssh,
            "pm2 list 2>&1",
            timeout=30,
            description="Final: pm2 process list"
        )

        print("\n" + "="*70)
        print("DEPLOYMENT COMPLETE")
        print("="*70)
        if not key_exists:
            print("\n*** REMINDER: Replace ANTHROPIC_API_KEY in .env on the server! ***")
            print(f"  File: {ENV_FILE}")

    except paramiko.AuthenticationException as e:
        print(f"[ERROR] Authentication failed: {e}")
        sys.exit(1)
    except paramiko.SSHException as e:
        print(f"[ERROR] SSH error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if ssh:
            ssh.close()
            print("\nSSH connection closed.")


if __name__ == "__main__":
    main()
