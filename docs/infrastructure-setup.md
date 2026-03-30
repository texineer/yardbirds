# Infrastructure Setup: Proxmox + Cloudflare Tunnel

Hosting multiple web apps at subdomains of texineer.com

---

## Overview

This document walks through setting up a scalable self-hosted infrastructure on Proxmox for hosting multiple web applications (e.g., `yardbirds.texineer.com`, `app2.texineer.com`) with secure external access via a Cloudflare Tunnel — no open firewall ports required.

### Architecture

```text
Internet
   │
   ▼
Cloudflare (DNS + Tunnel endpoint)
   │   Routes by hostname:
   │   yardbirds.texineer.com ─┐
   │   app2.texineer.com ──────┤
   ▼                           │
cloudflared daemon             │ (outbound tunnel, no open ports)
   │                           │
   ▼                           │
Nginx Proxy Manager (Proxy LXC)◄─┘
   │  192.168.1.10
   │  Routes by hostname to backend LXCs:
   ├──▶ Yardbirds LXC  192.168.1.11:3000
   ├──▶ App2 LXC       192.168.1.12:3000
   └──▶ AppN LXC       ...
```

### Why this approach?

- **One Cloudflare Tunnel** handles all apps — just add entries per hostname
- **Nginx Proxy Manager** routes traffic by subdomain with a simple web UI
- **Isolated LXC per app** — lightweight, snapshotable, easy to rebuild
- **No open firewall/router ports** — cloudflared uses outbound connections only
- **Automatic HTTPS** — Cloudflare handles TLS for all subdomains

---

## Prerequisites

- Proxmox VE installed and accessible on your local network
- Cloudflare account already managing `texineer.com` ✓ *(already done)*
- Local machine with a browser for Cloudflare and Proxmox web UIs

---

## Part 1 — Transfer DNS to Cloudflare

Cloudflare Tunnels require Cloudflare to manage your domain's DNS. Squarespace remains your **domain registrar** (you keep paying them for the domain), but DNS resolution moves to Cloudflare. Your existing Squarespace website at `www.texineer.com` will continue to work — Cloudflare imports all existing records before you switch.

### 1.1 — Add texineer.com to Cloudflare

1. Log in to <https://cloudflare.com>
2. Click **Add a Site** → enter `texineer.com` → click **Continue**
3. Select the **Free** plan → click **Continue**
4. Cloudflare scans and imports your existing DNS records automatically
5. Review the imported list — confirm you see your Squarespace `www` record (A or CNAME)
6. Click **Continue** — Cloudflare shows you two nameservers, for example:

```text
aria.ns.cloudflare.com
bob.ns.cloudflare.com
```

Copy both nameservers — you need them in the next step.

### 1.2 — Update Nameservers at Squarespace

1. Log in to Squarespace → **Domains** → click `texineer.com`
2. Click **DNS Settings** (or **Advanced Settings**)
3. Find **Nameservers** → click **Use Custom Nameservers**
4. Delete the existing Squarespace nameservers
5. Enter the two Cloudflare nameservers from step 1.1
6. Save changes

> **Propagation time:** Changes take 5 minutes to a few hours. Cloudflare emails you when the domain becomes active.

### 1.3 — Verify DNS is Active

1. Return to the Cloudflare dashboard — the status changes from **Pending** to **Active** (green checkmark)
2. Test that your Squarespace site still works: visit `https://www.texineer.com`

Once active, the `yardbirds.texineer.com` CNAME record will be added automatically in Part 6 — no further DNS changes are needed.

---

## Part 2 — Create Proxmox LXC Containers

You will create two LXC containers:

- **proxy** — runs Nginx Proxy Manager + cloudflared
- **yardbirds** — runs the Yardbirds Node.js application

### 2.1 — Download Ubuntu LXC Template

1. In the Proxmox web UI, go to your node → **local** storage → **CT Templates**
2. Click **Templates** button
3. Search for `ubuntu-22.04` → click **Download**
4. Wait for download to complete

### 2.2 — Create the Proxy LXC

1. Click **Create CT** (top right)
2. Fill in the wizard:

**General tab:**

| Field | Value |
| --- | --- |
| CT ID | `100` (or next available) |
| Hostname | `proxy` |
| Password | Choose a strong root password |
| SSH public key | Optional: paste your public key for key-based login |

**Template tab:** Select the `ubuntu-22.04` template you downloaded

**Disks tab:**

| Field | Value |
| --- | --- |
| Storage | `local-lvm` (or your storage pool) |
| Disk size | `8 GB` |

**CPU tab:**

| Field | Value |
| --- | --- |
| Cores | `1` |

**Memory tab:**

| Field | Value |
| --- | --- |
| Memory | `512 MB` |
| Swap | `512 MB` |

**Network tab:**

| Field | Value |
| --- | --- |
| Bridge | `vmbr0` |
| IPv4 | `Static` |
| IPv4/CIDR | `192.168.1.10/24` *(adjust to your network)* |
| Gateway | `192.168.1.1` *(your router IP)* |

**DNS tab:** Leave as default (inherits from Proxmox host)

1. **Uncheck "Start after created"** → click **Finish**
2. Select the `proxy` container → **Options** → **Start at boot** → set to `Yes`
3. Start the container: click **Start**

### 2.3 — Create the Yardbirds App LXC

Repeat the same process with these values:

| Field | Value |
| --- | --- |
| CT ID | `101` |
| Hostname | `yardbirds` |
| Disk size | `10 GB` |
| CPU Cores | `2` |
| Memory | `1024 MB` |
| IPv4/CIDR | `192.168.1.11/24` |
| Gateway | `192.168.1.1` |

Enable **Start at boot** and start the container.

### 2.4 — Verify Network Connectivity

Open a shell in each LXC (Proxmox web UI → select container → **Console**):

```bash
ping -c 3 8.8.8.8          # Should get replies
ping -c 3 google.com        # Should resolve and get replies
```

If DNS doesn't work, set it manually:

```bash
echo "nameserver 1.1.1.1" > /etc/resolv.conf
```

---

## Part 3 — Install Nginx Proxy Manager (Proxy LXC)

Open a shell on the `proxy` LXC.

### 3.1 — Install Docker

```bash
apt update && apt upgrade -y

# Install Docker
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify
docker --version
```

### 3.2 — Create Nginx Proxy Manager Compose File

```bash
mkdir -p /opt/npm && cd /opt/npm

cat > docker-compose.yml << 'EOF'
version: '3'
services:
  app:
    image: jc21/nginx-proxy-manager:latest
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
EOF
```

### 3.3 — Start Nginx Proxy Manager

```bash
cd /opt/npm
docker compose up -d

# Check it started successfully
docker compose ps
# Should show: app   Up   0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp, 0.0.0.0:81->81/tcp
```

### 3.4 — Log In to NPM Admin UI

1. From any browser on your local network, go to: `http://192.168.1.10:81`
2. Log in with default credentials:
   - Email: `admin@example.com`
   - Password: `changeme`
3. **Immediately change your password and email** when prompted

### 3.5 — Make NPM Start on Boot

```bash
# Enable Docker to start on boot
systemctl enable docker

# Optionally create a systemd service for explicit control:
cat > /etc/systemd/system/npm.service << 'EOF'
[Unit]
Description=Nginx Proxy Manager
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/npm
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable npm
```

---

## Part 4 — Deploy the Yardbirds App (Yardbirds LXC)

Open a shell on the `yardbirds` LXC.

### 4.1 — Install Node.js

```bash
apt update && apt upgrade -y

# Install Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git

# Verify
node --version   # Should show v20.x.x
npm --version
```

### 4.2 — Deploy the Application

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/yardbirds.git /opt/yardbirds

cd /opt/yardbirds
npm install

# Create a production .env file if needed
cp .env.example .env   # or create manually
nano .env              # Set DB paths, ports, etc.
```

### 4.3 — Run with PM2 (Process Manager)

```bash
npm install -g pm2

# Start the app (adjust entry point as needed)
pm2 start server/index.js --name yardbirds

# Save PM2 config so it restarts after reboot
pm2 startup
# PM2 will print a command — copy and run it, e.g.:
#   sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

pm2 save

# Verify it's running
pm2 status
pm2 logs yardbirds
```

### 4.4 — Verify the App is Accessible Locally

From the `proxy` LXC shell:

```bash
curl http://192.168.1.11:3000
# Should return your app's HTML/JSON response
```

---

## Part 5 — Configure Nginx Proxy Manager Routing

### 5.1 — Add Proxy Host for Yardbirds

1. Open NPM admin UI at `http://192.168.1.10:81`
2. Go to **Hosts** → **Proxy Hosts** → **Add Proxy Host**
3. Fill in the form:

**Details tab:**

| Field | Value |
| --- | --- |
| Domain Names | `yardbirds.texineer.com` |
| Scheme | `http` |
| Forward Hostname/IP | `192.168.1.11` |
| Forward Port | `3000` |
| Cache Assets | Off (toggle on later if desired) |
| Block Common Exploits | On |
| Websockets Support | On (if your app uses WebSockets) |

**SSL tab:** Leave SSL as **None** — Cloudflare handles TLS externally

1. Click **Save**

The proxy host status should show **Online** (green).

---

## Part 6 — Create and Configure Cloudflare Tunnel

> **Order matters:** All commands in this section run on the **proxy LXC** after it has been created (Part 2) and NPM is running (Part 3). The tunnel is created on the proxy LXC — Cloudflare doesn't know the tunnel exists until you run `cloudflared tunnel create` from that machine.

### Summary of what happens in this part

```text
Step 6.1  Install cloudflared binary on proxy LXC
Step 6.2  Log in — links this machine to your Cloudflare account
Step 6.3  Create a named tunnel — Cloudflare registers it and gives you a UUID + credentials file
Step 6.4  Write config file — tells cloudflared where to send traffic for each hostname
Step 6.5  Create DNS record — adds CNAME in your Cloudflare DNS pointing to the tunnel
Step 6.6  Install as system service — starts automatically on boot
```

---

### 6.1 — Install cloudflared on the Proxy LXC

Open a shell on the **proxy LXC** (Proxmox web UI → select proxy container → **Console**).

```bash
# Download the cloudflared binary
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared

# Make it executable
chmod +x /usr/local/bin/cloudflared

# Confirm it works — should print version info
cloudflared --version
```

Expected output:

```text
cloudflared version 2024.x.x (built ...)
```

---

### 6.2 — Authenticate cloudflared with Your Cloudflare Account

This step links the proxy LXC to your Cloudflare account and stores a certificate that authorizes it to create tunnels.

```bash
cloudflared tunnel login
```

The terminal will print a long URL like:

```text
Please open the following URL and log in with your Cloudflare account:

https://dash.cloudflare.com/argotunnel?t=...&callback=https%3A%2F%2Flogin.argotunnel.com%2F...
```

**What to do:**

1. Copy the entire URL from the terminal
2. Paste it into a browser on your local machine (not inside the LXC)
3. Log in to Cloudflare if prompted
4. You will see a list of domains — click **texineer.com**
5. Click **Authorize**
6. The browser will show: *"You have successfully authorized cloudflared."*
7. Return to the proxy LXC terminal — it should now print:

```text
You have successfully logged in.
If you wish to copy your credentials to a server, they have been saved to:
/root/.cloudflared/cert.pem
```

> The `cert.pem` file stays on the proxy LXC — it's what proves this machine is allowed to create and manage tunnels for `texineer.com`.

---

### 6.3 — Create the Tunnel

This registers a new named tunnel in your Cloudflare account and generates a credentials file on the proxy LXC.

```bash
cloudflared tunnel create texineer-apps
```

Expected output:

```text
Tunnel credentials written to /root/.cloudflared/abc12345-1234-1234-1234-abcdef012345.json.
Created tunnel texineer-apps with id abc12345-1234-1234-1234-abcdef012345
```

**Important:** Copy the UUID (the long string after `with id`). You will use it in the next two steps.

To verify the tunnel was created and find the UUID later:

```bash
cloudflared tunnel list
```

Output:

```text
ID                                   NAME           CREATED              CONNECTIONS
abc12345-1234-1234-1234-abcdef012345 texineer-apps  2024-01-01T12:00:00Z 0
```

You can also confirm it in the Cloudflare dashboard:

- Go to **Zero Trust** (left sidebar) → **Networks** → **Tunnels**
- `texineer-apps` should appear with status **Inactive** (it becomes Active once cloudflared is running)

---

### 6.4 — Write the Tunnel Config File

This file tells cloudflared which local service to send traffic to for each hostname.

```bash
mkdir -p /etc/cloudflared
```

Open the config file for editing:

```bash
nano /etc/cloudflared/config.yml
```

Paste the following content — replace **both** instances of `<TUNNEL_UUID>` with the UUID from step 6.3:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: yardbirds.texineer.com
    service: http://localhost:80
  # To add more apps later, insert lines here before the catch-all:
  # - hostname: app2.texineer.com
  #   service: http://localhost:80
  - service: http_status:404
```

Save and exit: `Ctrl+O` → `Enter` → `Ctrl+X`

**What this means:**

- Traffic arriving at `yardbirds.texineer.com` gets forwarded to `http://localhost:80` — which is Nginx Proxy Manager running on this same LXC
- NPM then looks at the hostname header and routes to the correct backend LXC
- The final `http_status:404` is a required catch-all for any unmatched hostname

Validate the config file has no syntax errors:

```bash
cloudflared tunnel ingress validate
```

Expected output:

```text
Validating rules from /etc/cloudflared/config.yml
OK
```

---

### 6.5 — Create the DNS Record in Cloudflare

This adds the CNAME record to your Cloudflare DNS automatically — no need to touch the Cloudflare dashboard manually.

```bash
cloudflared tunnel route dns texineer-apps yardbirds.texineer.com
```

Expected output:

```text
2024/01/01 12:00:00 INF Added CNAME yardbirds.texineer.com which will route to this tunnel
tunnelID=abc12345-1234-1234-1234-abcdef012345
```

**Verify in Cloudflare dashboard:**

1. Go to <https://dash.cloudflare.com> → click `texineer.com` → **DNS** → **Records**
2. You should see a new entry:

```text
Type    Name        Content                                      Proxied
CNAME   yardbirds   abc12345-...cfargotunnel.com                 Yes (orange cloud)
```

> The orange cloud (Proxied) means traffic goes through Cloudflare — this is correct and required for the tunnel to work.

---

### 6.6 — Copy Credentials and Install as a System Service

The `cloudflared service install` command reads config from `/etc/cloudflared/`, so the credentials JSON needs to be there too.

```bash
# Copy the credentials file to /etc/cloudflared/
cp /root/.cloudflared/<TUNNEL_UUID>.json /etc/cloudflared/

# Update the config.yml credentials-file path to match
sed -i 's|credentials-file: /root/.cloudflared/|credentials-file: /etc/cloudflared/|' \
  /etc/cloudflared/config.yml

# Verify the path was updated
grep credentials-file /etc/cloudflared/config.yml
# Should show: credentials-file: /etc/cloudflared/<TUNNEL_UUID>.json
```

Install and start the service:

```bash
cloudflared service install

systemctl enable cloudflared
systemctl start cloudflared
```

Check it's running:

```bash
systemctl status cloudflared
```

Look for `Active: active (running)` in green. If it shows an error, check logs:

```bash
journalctl -u cloudflared -n 50 --no-pager
```

**Verify the tunnel is active in Cloudflare:**

1. Go to **Zero Trust** → **Networks** → **Tunnels**
2. `texineer-apps` should now show **Healthy** with a green indicator
3. It will also show the proxy LXC's hostname as a connected connector

---

## Part 7 — End-to-End Verification

### 7.1 — Check All Services

**On proxy LXC:**

```bash
systemctl status cloudflared       # Should be active
docker compose -f /opt/npm/docker-compose.yml ps  # Should show npm app Up
```

**On yardbirds LXC:**

```bash
pm2 status    # Should show yardbirds as online
```

### 7.2 — Verify Cloudflare Tunnel is Healthy

1. Open Cloudflare dashboard → **Zero Trust** (left sidebar) → **Networks** → **Tunnels**
2. Find `texineer-apps` → status should be **Healthy** (green)

### 7.3 — Test the Full Stack

1. Open a browser (not on your local network if possible — use phone data or a VPN to simulate external access)
2. Navigate to `https://yardbirds.texineer.com`
3. The Yardbirds app should load with a valid HTTPS certificate

**If it doesn't work**, use this debugging checklist:

```text
[ ] cloudflared running on proxy LXC?         → systemctl status cloudflared
[ ] NPM proxy host showing Online?            → http://192.168.1.10:81
[ ] Yardbirds app responding on LXC?          → curl http://192.168.1.11:3000
[ ] Cloudflare CNAME record exists?           → Cloudflare DNS dashboard
[ ] Cloudflare tunnel shows Healthy?          → Zero Trust → Tunnels
[ ] cloudflared config.yml hostname correct?  → cat /etc/cloudflared/config.yml
```

---

## Part 8 — Adding Future Apps

When you're ready to add `app2.texineer.com` (or any new subdomain):

### Step A — Create a New App LXC

Follow Part 2, using the next available IP (e.g., `192.168.1.12`) and a new CT ID.

### Step B — Deploy the App

Follow Part 4 for the new LXC.

### Step C — Add NPM Proxy Host

Follow Part 5 with the new subdomain and new LXC IP.

### Step D — Add Tunnel Ingress Rule

On the proxy LXC, edit the cloudflared config:

```bash
nano /etc/cloudflared/config.yml
```

Add a new ingress entry **before** the catch-all `http_status:404` line:

```yaml
ingress:
  - hostname: yardbirds.texineer.com
    service: http://localhost:80
  - hostname: app2.texineer.com        # ← add this
    service: http://localhost:80       # ← and this
  - service: http_status:404
```

### Step E — Create DNS Record and Restart

```bash
cloudflared tunnel route dns texineer-apps app2.texineer.com
systemctl restart cloudflared
```

That's it — the new app is live at `https://app2.texineer.com`.

---

## Maintenance & Tips

### Updating the Yardbirds App

```bash
# On yardbirds LXC
cd /opt/yardbirds
git pull
npm install
pm2 restart yardbirds
```

### Updating Nginx Proxy Manager

```bash
# On proxy LXC
cd /opt/npm
docker compose pull
docker compose up -d
```

### Proxmox Snapshots (Highly Recommended Before Major Changes)

1. In Proxmox web UI, select the LXC → **Snapshots** tab
2. Click **Take Snapshot** → give it a name (e.g., `before-update-2024-01-15`)
3. To roll back: select snapshot → **Rollback**

### Viewing cloudflared Logs

```bash
journalctl -u cloudflared -f        # Live logs
journalctl -u cloudflared --since "1 hour ago"
```

### Security Recommendations

- **Keep cloudflared updated** — it auto-updates if installed via the service installer
- **Enable Cloudflare Access** (Zero Trust → Access) to add authentication in front of any subdomain
- **Use Cloudflare WAF** (Web Application Firewall) on the free plan for basic protection
- **Snapshot LXCs** before any significant changes
- **Do not expose port 81** (NPM admin) externally — only access it from your local network

---

## Quick Reference

| Service | Location | Access |
| --- | --- | --- |
| Proxmox web UI | `https://YOUR_PROXMOX_IP:8006` | Local network |
| NPM admin UI | `http://192.168.1.10:81` | Local network |
| Yardbirds app (internal) | `http://192.168.1.11:3000` | Local network |
| Yardbirds app (external) | `https://yardbirds.texineer.com` | Internet |
| Cloudflare dashboard | <https://dash.cloudflare.com> | Browser |
| Cloudflare Zero Trust | <https://one.dash.cloudflare.com> | Browser |

| LXC | CT ID | IP | Purpose |
| --- | --- | --- | --- |
| proxy | 100 | 192.168.1.10 | NPM + cloudflared |
| yardbirds | 101 | 192.168.1.11 | Yardbirds Node app |
| *(next app)* | 102 | 192.168.1.12 | *(future app)* |
