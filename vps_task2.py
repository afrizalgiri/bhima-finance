import paramiko
import sys

# Force UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

HOST = "31.97.223.3"
USER = "root"
PASS = "Dorolonda@2024#"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

def run(cmd, timeout=180):
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    stdin.close()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print("STDOUT:", out)
    if err:
        print("STDERR:", err)
    return out, err

# 1. git pull — stash local changes first, then pull, then stash drop
run("cd /root/bhima-finance && git stash", timeout=30)
run("cd /root/bhima-finance && git pull", timeout=60)
run("cd /root/bhima-finance && git stash drop 2>/dev/null || true", timeout=15)

# 2. npm install
run("cd /root/bhima-finance/app/backend && npm install", timeout=300)

# 3. .env manipulation
env_path = "/root/bhima-finance/app/backend/.env"

out, err = run(f"cat {env_path}")
env_content = out

lines = env_content.splitlines()
has_openai = any(l.startswith("OPENAI_API_KEY=") for l in lines)
has_anthropic = any(l.startswith("ANTHROPIC_API_KEY=") for l in lines)

print(f"\n--- .env analysis ---")
print(f"Has OPENAI_API_KEY line: {has_openai}")
print(f"Has ANTHROPIC_API_KEY line: {has_anthropic}")

if has_anthropic and not has_openai:
    new_lines = []
    for l in lines:
        if l.startswith("ANTHROPIC_API_KEY="):
            val = l[len("ANTHROPIC_API_KEY="):]
            new_lines.append(f"OPENAI_API_KEY={val}")
        else:
            new_lines.append(l)
    new_content = "\n".join(new_lines)
    if env_content.endswith("\n"):
        new_content += "\n"
    # Write via python on the remote to avoid shell escaping issues
    py_script = f"""
import base64, sys
content = base64.b64decode(sys.argv[1]).decode('utf-8')
with open('{env_path}', 'w') as f:
    f.write(content)
print("Written OK")
"""
    import base64
    encoded = base64.b64encode(new_content.encode('utf-8')).decode('ascii')
    run(f"python3 -c \"{py_script.strip().replace(chr(10), ';')}\" \"{encoded}\"")
    print("Replaced ANTHROPIC_API_KEY with OPENAI_API_KEY")
elif has_openai:
    print("OPENAI_API_KEY already present — no changes made")
else:
    print("Neither key found — no changes made")

# Show .env with hidden values
print("\n--- Final .env (key names only, values hidden) ---")
out, err = run(f"cat {env_path}")
for line in out.splitlines():
    stripped = line.strip()
    if stripped and not stripped.startswith("#") and "=" in stripped:
        key = stripped.split("=")[0]
        print(f"  {key}=***")
    else:
        print(f"  {line}")

# 4. pm2 restart
run("pm2 restart bhima-backend --update-env", timeout=60)

# 5. pm2 status
run("pm2 status", timeout=30)

client.close()
print("\nDone.")
