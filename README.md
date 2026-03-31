# Claude Code Web

> Persistent, mobile-first Claude Code terminal. Start a task on your laptop, check progress on your phone. Never waste your 5-hour rate limit again.

[![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-blue)](https://www.python.org/downloads/)
[![React 19+](https://img.shields.io/badge/react-19%2B-blue)](https://react.dev)

---

## What is Claude Code Web?

Claude Code Web is a **browser-based remote terminal** for Claude Code that keeps running even when your browser closes.

Think of it like **tmux for Claude Code**: start an autonomous task on your laptop, close the browser, and pick it up hours later on your phone with full conversation history replayed. Perfect for multi-project workflows, rate limit management, and working remotely without terminal access.

### Key Differences from Desktop Claude Code

| Feature | Claude Code (Desktop) | Claude Code Web |
|---------|----------------------|-----------------|
| Access | Desktop/laptop only | Desktop, tablet, phone |
| Persistence | Stops when app closes | Runs in background |
| Mobile | No | Yes, full web app |
| Rate limits | Manual tracking | Real-time visibility |
| Headless execution | No | Yes, with push notifications |
| Multi-project | Local instances | Centralized with permission control |

---

## Use Cases

### 🚀 For Individual Developers

**Maximize Rate Limits** — Queue up 3 code reviews before leaving your desk. Monitor progress from your commute. Never waste your 5-hour window.

**Work From Anywhere** — Start a bug fix on your laptop. Continue reviewing from your phone in a coffee shop. Full history available on both devices.

**Autonomous Tasks** — Set a session to "headless mode" and let Claude run overnight. Get push notification when done. No need to stay at desk.

### 👥 For Teams

**Isolated Permissions** — Team member working on frontend gets read-only access. Backend engineer gets full write. Ops team gets headless automation.

**Async Code Review** — Start a code review in the morning, get Claude's suggestions. Approve tool usage via phone. Share findings with team.

**Project Organization** — Each project in separate session. Track spend per project. Reuse sessions for recurring tasks.

### 🤖 For AI Researchers & Builders

**Session Management** — Resume previous sessions, fork to explore alternatives, track cost per experiment.

**Custom Tools** — Extend with MCP servers. Integrate into your product without terminal dependency.

---

## Getting Started

### Prerequisites

- **Python 3.12+**
- **Node.js 18+** (for frontend)
- **Claude API key** (set in `ANTHROPIC_API_KEY` env var)
- **5 minutes** ⏱️

### Quick Start (Local)

```bash
# 1. Clone repo
git clone <repo>
cd my-agent

# 2. Install backend dependencies (Python 3.12+)
uv sync
# or: pip install -e .

# 3. Start backend server
uv run server.py
# Server starts on http://localhost:9282

# 4. In another terminal, install + run frontend
cd frontend
npm install
npm run dev
# Frontend on http://localhost:5173 (with hot reload)
```

Done! Open **http://localhost:5173** in your browser.

### First Session

1. **Dashboard** — Click "Create New Session" → Select a project folder (e.g., `~/Project/my-repo`)
2. **Chat** — Type your task: `"Review src/main.py and suggest optimizations"`
3. **Wait** — Claude runs, requests tool approvals as needed
4. **Results** — View cost, turns, and full conversation

Try closing the browser tab while Claude is running — come back 5 minutes later and you'll see full history replayed.

---

## Production Deployment

### Option 1: VPS (Recommended)

```bash
# On your VPS
git clone <repo>
cd my-agent
uv sync
uv run server.py --host 0.0.0.0 --port 9282

# Expose securely with Tailscale (VPN)
tailscale up
# Accessible as https://<your-name>.ts.net
```

### Option 2: Docker

```bash
docker build -t claude-code-web .
docker run -p 9282:9282 -v data:/app/data claude-code-web
```

### Option 3: Self-Hosted (Kubernetes)

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for Helm charts and multi-instance setup.

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-...          # Claude API key

# Optional
HOST=0.0.0.0                       # Bind address
PORT=9282                          # Port
PROJECT_DIR=~/Project              # Default project root
DISCORD_BOT_TOKEN=...              # For Discord integration
NTFY_TOPIC=claude-web              # ntfy.sh channel (mobile notifications)
PUBLIC_URL=https://my.domain.com   # Public URL (for notification links)
```

---

## Features

### 🚀 Core

- ✅ **Persistent Sessions** — Sessions survive browser close/refresh
- ✅ **Message Replay** — Full conversation history available on reconnect
- ✅ **Mobile-First** — Responsive web UI works great on phones
- ✅ **Push Notifications** — Get updates when browser is closed (Web Push + ntfy.sh)
- ✅ **Autonomous Mode** — Run tasks headless without browser

### 🔐 Control & Safety

- ✅ **Fine-Grained Permissions** — Different access levels per session
- ✅ **Runtime Config** — Change model, tools, system prompt mid-session
- ✅ **Cost Tracking** — Real-time spend and rate limit visibility
- ✅ **Tool Filtering** — Whitelist/blacklist tools per session

### 🛠️ Integration

- ✅ **Discord Bot** — Manage sessions from Discord, receive updates in threads
- ✅ **MCP Servers** — Extend with custom tools
- ✅ **File Browser** — Browse, drag-drop files into chat
- ✅ **Terminal Access** — Full shell (PTY + tmux) in browser

### 📱 Mobile

- ✅ **PWA Support** — Install as app on phone
- ✅ **Offline-Ready** — Works with poor connectivity
- ✅ **Touch-Optimized UI** — Proper spacing, larger buttons
- ✅ **Native Notifications** — Desktop + iOS push

---

## How It Works (30-Second Overview)

```
You (Browser)                    Server                         Claude SDK
     │                              │                              │
     ├──────── Query ────────────────┤                              │
     │                              │                              │
     │                              ├───────── Send Message ────────┤
     │                              │                              │
     │                              │◄─── Stream Response ──────────┤
     │                              │                              │
     │ ◄──────── Live Update ───────┤                              │
     │                              │                              │
     │ ──── Permission Response ────┤                              │
     │                              │                              │
     │ ◄── Result + Cost + History ─┤                              │
     │                              │                              │
  (close browser)                   │                              │
     │                              │ (session keeps running)      │
     │                              │                              │
  (reopen on phone 2 hours later)   │                              │
     │                              │                              │
     ├───── Reconnect + Replay ─────┤                              │
     │                              │                              │
     │ ◄──── Full Message History ──┤                              │
     │                              │                              │
```

All data persisted to SQLite. Sessions stored in `data/claude-code-web.db`.

---

## Architecture Highlights

### Backend
- **FastAPI** — Async Python framework
- **SQLite** — Single-file persistence (zero ops)
- **Claude Agent SDK** — Direct integration with Claude
- **WebSockets** — Real-time message streaming

### Frontend
- **React 19** — Modern UI
- **Zustand** — Lightweight state management
- **Tailwind CSS** — Utility-first styling
- **xterm.js** — Web terminal emulator

### No Servers Required For Persistence
Sessions live in your browser's WebSocket connection. Messages replayed from SQLite on reconnect. Fully self-contained.

---

## Configuration

### Permission Modes

**`acceptEdits`** (default)
- Auto-approve safe tools: Read, Glob, Grep, Edit, Write, WebSearch
- Ask for dangerous tools: Bash, sending emails, API calls

**`plan`**
- Claude plans only, no tool execution
- Good for brainstorming before giving access

**`bypassPermissions`**
- All tools auto-approved
- Enables fully autonomous execution
- Use only for trusted tasks

**`default`**
- Ask for every tool
- Maximum control

### Session Configuration

```json
{
  "permission_mode": "acceptEdits",
  "model": "claude-3-5-sonnet-20241022",
  "system_prompt": "You are a code reviewer...",
  "allowed_tools": ["Read", "Write", "Grep"],
  "max_budget_usd": 1.00,
  "max_turns": 10
}
```

Change any of these at runtime without restarting.

---

## Discord Integration

### Setup

```bash
DISCORD_BOT_TOKEN=your_token_here
DISCORD_GUILD_ID=your_server_id
uv run discord_bot.py
```

### Commands

```
/ask "Fix the bug in main.py"
→ Creates headless session, returns link to monitor

/list
→ Show all active sessions + costs

/approve request_id
→ Approve permission request from notification
```

---

## Troubleshooting

### Session Not Persistent?
- Make sure backend stays running (`uv run server.py`)
- Check that `data/` folder exists and is writable
- Backend logs to stdout — check for errors

### Push Notifications Not Working?
- Browser must be HTTPS (or localhost)
- Safari: Install as PWA from home screen
- Chrome: Enable notifications in settings
- Alternative: Use ntfy.sh for mobile notifications

### Sessions Disappearing?
- Sessions stored in SQLite (`data/claude-code-web.db`)
- Don't delete the `data/` folder
- Sessions survive server restarts

### Can't Connect to Backend?
```bash
# Check backend is running
curl http://localhost:9282/health

# Check firewall
# For remote: use Tailscale or ngrok to expose safely
```

---

## Development

### Project Structure

```
my-agent/
├── server.py                 # Entry point
├── app/
│   ├── core/                 # SessionManager, notifications
│   ├── routes/               # REST + WebSocket endpoints
│   ├── database/             # SQLite queries
│   └── discord/              # Discord bot
├── frontend/                 # React app
└── data/                     # SQLite database (created at runtime)
```

### Running Tests

```bash
pytest app/tests -v
```

### Building Frontend

```bash
cd frontend
npm run build
# Output: frontend/dist/
```

### Contributing

Contributions welcome! Areas we're looking for:
- Analytics dashboard (rate limit forecasting)
- Better terminal UX
- Slack/Teams integration
- Session branching UI
- Multi-user RBAC

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Pricing & Rate Limits

Claude Code Web doesn't add costs — you pay only for Claude API usage, same as any Claude client.

**Visibility:**
- Session shows real-time cost + turn count
- Dashboard shows total spend across all sessions
- Rate limits (5h and 7d) displayed in status bar

**Example:**
```
Total cost: $2.43 (5 sessions)
5-hour window: 2.1M tokens used of 12M available
7-day window: 15.2M tokens used of 50M available
```

---

## Limitations

- **Single-user by default** — Uses SQLite (fine for personal use)
- **Requires Claude API key** — Not free (pay-per-token)
- **No persistent WebSocket** — Requires at least occasional browser visits
- **No built-in auth** — Protect with network security (VPN, firewall)

For multi-user setup, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for Postgres migration.

---

## Roadmap

### v1.0 (Current)
- ✅ Persistent sessions
- ✅ Mobile web UI
- ✅ Push notifications
- ✅ Discord bot basics

### v1.1 (Next)
- 📝 Session branching UI
- 📝 Analytics dashboard
- 📝 Slack integration
- 📝 Session templates

### v2.0
- 📝 Multi-user with RBAC
- 📝 PostgreSQL support
- 📝 Team workspaces
- 📝 Audit logging

---

## FAQ

**Q: Is it free?**
A: You pay only for Claude API usage (same as any client).

**Q: Can I self-host?**
A: Yes. Run `uv run server.py` on any machine with Python 3.12+.

**Q: Does it work offline?**
A: Frontend works offline (cached). Backend needs internet to call Claude API.

**Q: Can I share sessions with my team?**
A: Currently single-user. Multi-user RBAC coming in v2.0. For now, run separate instances.

**Q: How do I expose it securely?**
A: Use Tailscale VPN (recommended) or ngrok. Don't expose directly without auth.

**Q: What if I lose power/restart?**
A: Sessions survive. SQLite persists all data. On restart, sessions resume from where they left off.

**Q: Can I export chat history?**
A: Yes, download JSON via CLI:
```bash
curl http://localhost:9282/api/sessions/{id}/messages > chat.json
```

---

---

## Support

- **Issues** — [GitHub Issues](https://github.com/yourusername/claude-code-web/issues)
- **Discussions** — [GitHub Discussions](https://github.com/yourusername/claude-code-web/discussions)
- **Discord** — Join our community server

---

## Built With

- [Claude API](https://claude.ai)
- [FastAPI](https://fastapi.tiangolo.com)
- [React](https://react.dev)
- [SQLite](https://sqlite.org)

---
