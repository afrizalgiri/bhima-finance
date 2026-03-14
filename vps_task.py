import paramiko
import time

HOST = "31.97.223.3"
USER = "root"
PASS = "Dorolonda@2024#"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=30)

def run(cmd, timeout=120):
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    stdin.close()
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out:
        print("STDOUT:", out)
    if err:
        print("STDERR:", err)
    return out, err

# 1. git pull
run("cd /root/bhima-finance && git pull", timeout=60)

# 2. npm install
run("cd /root/bhima-finance/app/backend && npm install", timeout=180)

# 3. .env manipulation
env_path = "/root/bhima-finance/app/backend/.env"

# Read current .env
out, err = run(f"cat {env_path}")
env_content = out

lines = env_content.splitlines()
has_openai = any(l.startswith("OPENAI_API_KEY=") for l in lines)
has_anthropic = any(l.startswith("ANTHROPIC_API_KEY=") for l in lines)

print(f"\n--- .env analysis ---")
print(f"Has OPENAI_API_KEY line: {has_openai}")
print(f"Has ANTHROPIC_API_KEY line: {has_anthropic}")

if has_anthropic and not has_openai:
    # Replace ANTHROPIC_API_KEY= line with OPENAI_API_KEY= line (preserve value)
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
    # Write back via heredoc
    escaped = new_content.replace("'", "'\\''")
    run(f"printf '%s' '{escaped}' > {env_path}")
    print("Replaced ANTHROPIC_API_KEY with OPENAI_API_KEY")
elif has_openai:
    print("OPENAI_API_KEY already present — no changes made")
else:
    print("Neither key found — no changes made")

# Show .env with hidden values
print("\n--- Final .env (keys only, values hidden) ---")
out, err = run(f"cat {env_path}")
for line in out.splitlines():
    if "=" in line and not line.startswith("#"):
        key = line.split("=")[0]
        print(f"{key}=***")
    else:
        print(line)

# 4. pm2 restart
run("pm2 restart bhima-backend --update-env", timeout=60)

# 5. pm2 status
run("pm2 status", timeout=30)

client.close()
print("\nDone.")
