# Claude Code Web — Design System & UI Specification

## Product Definition

A remote, persistent Claude Code terminal accessible via web. Sessions survive browser close/refresh — like tmux for Claude Code. Dashboard-first, tab-based workspace, mobile-compatible.

**Reference apps:** claude.ai (chat rendering, warm dark theme), VS Code (tabs, sidebar, activity bar), Linear (dashboard, speed, information density), Vercel (clean data display).

**Framework:** React 19 + Vite + Tailwind v4 + shadcn/ui + Radix primitives
**Icons:** Lucide React (consistent SVG, no emoji)
**Animation:** Framer Motion (layout animations, presence)
**Terminal:** xterm.js + xterm-addon-fit + xterm-addon-webgl
**Markdown:** react-markdown + rehype-highlight + remark-gfm
**State:** Zustand (UI + sessions + tabs)
**Fonts:** Geist Sans + Geist Mono (loaded locally, no CDN)

---

## Design Principles

1. **Information density without clutter** — show more per screen, but with clear hierarchy and consistent spacing
2. **Solid surfaces for scrolling content** — glass only for overlays, modals, input bar, floating elements. Never on cards inside a scrolling list.
3. **Lucide icons everywhere** — no emoji. Consistent, SVG, pixel-perfect, theme-able.
4. **Motion that communicates** — file tree pulse on change, status dot pulse when thinking. No decorative animation.
5. **Touch-first** — 44px minimum tap targets, responsive from iPhone SE to 4K
6. **Tab-based workspace** — everything is a tab. Sessions, terminals, files coexist.
7. **Context follows the active tab** — sidebar file tree, status bar, all reflect the active tab's project

---

## Color System

### Core Tokens (warm dark, claude.ai-derived)

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#2b2a27` | Page background |
| `--bg-elevated` | `#353431` | Cards, panels, sidebar |
| `--bg-surface` | `#3a3937` | Hover states, muted backgrounds |
| `--bg-overlay` | `rgba(43,42,39,0.85)` | Glass overlays, modals, input bar |
| `--text` | `#e8e4dc` | Primary text |
| `--text-secondary` | `#a09c94` | Secondary text, labels, timestamps |
| `--text-tertiary` | `#706c64` | Disabled, placeholder |
| `--accent` | `#d4845a` | Brand accent (warm coral) |
| `--accent-text` | `#1a1917` | Text on accent |
| `--border` | `rgba(255,255,255,0.08)` | Default borders |
| `--border-subtle` | `rgba(255,255,255,0.04)` | Message dividers, faint separators |
| `--destructive` | `#ef4444` | Errors, deny, destructive actions |
| `--success` | `#10b981` | Success, allow, cost display |
| `--warning` | `#f59e0b` | Warnings, pending states |
| `--info` | `#3b82f6` | Thinking, in-progress |

### Tool Category Colors (left border accent on tool cards)

| Category | Color | Tools |
|---|---|---|
| Read | `#5eead4` (teal) | Read, Glob, Grep |
| Write | `#fbbf24` (amber) | Edit, Write, NotebookEdit |
| Execute | `#86efac` (green) | Bash |
| Web | `#d4845a` (coral) | WebSearch, WebFetch |
| Agent | `#c084fc` (purple) | Agent, TaskCreate |
| Question | `#d4845a` (coral) | AskUserQuestion |

### Status Colors

| Status | Dot Color | Pulse | Label |
|---|---|---|---|
| Idle / Ready | `--success` | No | "Ready" |
| Thinking | `--info` | Yes (slow) | "Thinking..." |
| Running tool | `--info` | Yes (fast) | "Running [tool]..." |
| Waiting permission | `--warning` | Yes | "Needs approval" |
| Error | `--destructive` | No | "Error" |
| Disconnected | `--text-tertiary` | No | "Disconnected" |

---

## Typography

| Element | Font | Size | Weight | Color |
|---|---|---|---|---|
| Body text / messages | Geist Sans | 15px | 400 | `--text` |
| Code / paths / commands | Geist Mono | 13px | 400 | `--text` |
| Tool card header | Geist Sans | 13px | 600 | `--text` |
| Tool detail (path, query) | Geist Mono | 12px | 400 | `--text-secondary` |
| Tab label | Geist Sans | 12px | 500 | `--text-secondary` (active: `--text`) |
| Status bar | Geist Mono | 12px | 400 | `--text-secondary` |
| Result bar | Geist Mono | 11px | 600 | `--success` |
| Section headers (sidebar) | Geist Sans | 11px | 700 | `--text-tertiary` |
| Input placeholder | Geist Sans | 15px | 400 | `--text-tertiary` |
| Thinking preview | Geist Sans | 13px | 400 italic | `--text-secondary` |
| Timestamps | Geist Mono | 11px | 400 | `--text-tertiary` |

**Line height:** 1.6 body, 1.5 code
**Smoothing:** `-webkit-font-smoothing: antialiased`
**Letter spacing:** `-0.01em` on body, `0` on mono

---

## Layout Architecture

### Desktop (> 1024px)

```
┌──────┬──────────────────┬──────────────────────────────────────────────┐
│ Act  │ Sidebar Panel    │ Tab Bar                                      │
│ Bar  │ (260px,          │ [⚡ my-agent: Rewrite ×] [▶ Terminal ×] [+]  │
│      │  collapsible)    ├──────────────────────────────────────────────┤
│ 48px │                  │                                              │
│      │                  │  Active Tab Content                          │
│ ┌──┐ │ Project: xxx ▾  │  (chat / terminal / file viewer)             │
│ │🏠│ │                  │                                              │
│ │📁│ │ Session list     │                                              │
│ │⚡│ │ or               │                                              │
│ │⚙ │ │ Project list     │                                              │
│ └──┘ │ or               │                                              │
│      │ File tree        │                                              │
│      │ or               │                                              │
│      │ Settings         │                                              │
│      │                  ├──────────────────────────────────────────────┤
│      │                  │ Status Bar                                   │
│      │                  ├──────────────────────────────────────────────┤
│      │                  │ Input Bar (chat tabs only)                   │
└──────┴──────────────────┴──────────────────────────────────────────────┘
```

### Tablet (640-1024px)

Same layout but sidebar is 220px. Collapses to activity bar only on user toggle.

### Mobile (< 640px)

```
┌────────────────────────────────┐
│ ☰  my-agent: Rewrite   ⚙  📁 │  ← compact header
├────────────────────────────────┤
│ [Chat] [Terminal] [server.py]  │  ← scrollable tab bar
├────────────────────────────────┤
│                                │
│  Active tab content            │
│  (full width, no sidebar)      │
│                                │
├────────────────────────────────┤
│ 🟢 $0.12 · Opus 4.6           │  ← compact status
├────────────────────────────────┤
│ [+]  Message Claude...   [↑]  │  ← input (safe-area-bottom)
└────────────────────────────────┘

☰ → sidebar slides in as full-screen overlay (left, 85vw)
📁 → file tree as bottom sheet
⚙  → config as bottom sheet
```

---

## View 1: Dashboard

The landing screen. Answers: "What's happening across all my sessions?"

Always the first tab. Pinned, unclosable.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ACTIVE SESSIONS                                      [+ New]   │
│                                                                  │
│  ┌──────────────────────────────┐  ┌───────────────────────────┐│
│  │ 🟢  my-agent                 │  │ 🔵  api-server            ││
│  │                              │  │                           ││
│  │ "Rewrite the backend with    │  │ "Add rate limiting to     ││
│  │  proper persistence..."      │  │  all API endpoints"       ││
│  │                              │  │                           ││
│  │ Idle · $0.12 · 3 min ago    │  │ Thinking · $0.04 · now    ││
│  │                              │  │                           ││
│  │ [Open]          [⋮]         │  │ [Open]          [⋮]      ││
│  └──────────────────────────────┘  └───────────────────────────┘│
│                                                                  │
│  COMPLETED                                         [Show all →] │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ ✓  job-tracker   "Fix auth bug"          $0.03   2h ago     ││
│  │ ✓  my-agent      "Add push notifications" $0.08   5h ago    ││
│  │ ✗  docs-site     "Update API docs"        $0.01   1d ago    ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  PROJECTS                                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐          │
│  │my-agent │ │api-srvr │ │job-track│ │ + Add       │          │
│  │ 2 sess  │ │ 1 active│ │ done    │ │   project   │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────────┘          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Active Session Card

```
┌──────────────────────────────────┐
│ [StatusDot] [ProjectName]        │  ← header: dot + name
│                                  │
│ "First 80 chars of last prompt"  │  ← text-secondary, italic, 2 lines max
│                                  │
│ Status · $cost · time ago        │  ← footer: mono, text-tertiary
│                                  │
│ [Open]                    [⋮]   │  ← actions: open in tab, menu (rename/delete)
└──────────────────────────────────┘
```

- `bg-[var(--bg-elevated)]` with `border border-[var(--border)]`
- Hover: `border-[var(--accent)]` transition 200ms
- Active (thinking/running): subtle left border accent pulse
- Click anywhere on card = Open
- `[⋮]` menu: Rename, Delete, Copy session ID

### Completed Session Row

Single line: `[icon] project · prompt · cost · time`
- `✓` green for success, `✗` red for error
- Click → opens as tab with full message replay

### Project Card

Small card with project name, session count, quick action.
- Click → sidebar opens to Projects panel with that project expanded
- `[+ New Session]` on hover

### Mobile Dashboard

Same content, single column. Active sessions as full-width cards. Completed as a list. Projects as horizontal scroll.

---

## View 2: Session (Chat)

The primary view. 90% of time spent here.

### Chat Area

Messages in a scrollable container. `max-w-3xl mx-auto` centering (like claude.ai). Scroll anchored to bottom when new messages arrive. "Jump to bottom" fab when scrolled up.

### Message: User (right-aligned, bubble)

```
                                    ┌──────────────────────────┐
                                    │ Rewrite the backend with │
                                    │ proper persistence and   │
                                    │ clean architecture       │
                                    │                          │
                                    │ [FileIcon server.py]     │
                                    │ [ImageIcon screenshot]   │
                                    └──────────────────────────┘
```

**Container:** `flex justify-end`
**Bubble:** `bg-[var(--bg-elevated)] rounded-2xl px-4 py-3 max-w-[80%]`
**Text:** 15px, `--text`, full markdown rendering
**Attachments:** Inside bubble, below text. Chips with file icon + name. Clickable (opens as tab).
**Image attachments:** Thumbnail (max 200px wide) inside bubble. Clickable to view full.
**Bottom border:** None (bubble provides visual separation)

### Message: Claude (left-aligned, no bubble)

```
┌─ Claude ─────────────────────────────────────────────────┐
│                                                          │
│  I'll restructure the backend. Let me start by reading   │
│  the current files to understand what we have.           │
│                                                          │
│  Here's my plan:                                         │
│  1. Create `db.py` with SQLite schema                    │
│  2. Rewrite `session_manager.py`                         │
│  3. Clean up routes                                      │
│                                                          │
│  ```python                                               │
│  import aiosqlite                                        │
│  async def init_db():                                    │
│      ...                                                 │
│  ```                                                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Container:** `flex justify-start`
**No bubble** — text sits directly on `--bg` background
**Label:** "Claude" in `text-xs font-semibold text-[var(--text-secondary)]` above first block
**Content area:** `max-w-full` (uses full chat width)
**Text:** Full markdown: headings, lists, bold, italic, links, tables
**Code blocks:** `bg-[var(--bg-elevated)] rounded-lg p-4 overflow-x-auto`, syntax highlighted via rehype-highlight, copy button top-right on hover
**Inline code:** `bg-[var(--bg-surface)] px-1.5 py-0.5 rounded text-[0.9em] font-mono`
**Links:** `color: var(--accent)`, underline on hover, `target="_blank"`
**Tables:** `border-collapse`, `border-[var(--border)]`, alternating row bg
**Separator between user/Claude groups:** `py-6` spacing, no visible line

### Thinking Block

Appears within Claude's message area, left-aligned.

**Streaming (active):**
```
┌──────────────────────────────────────────────────────────┐
│  [BrainIcon]  Thinking...                                │  ← shimmer bg animation
└──────────────────────────────────────────────────────────┘
```

- `bg-[var(--bg-elevated)]` with shimmer gradient animation left-to-right
- `BrainIcon` from Lucide, animated pulse
- Text: "Thinking..." in italic, `--text-secondary`

**Collapsed (done):**
```
┌──────────────────────────────────────────────────────────┐
│  [ChevronRight] [BrainIcon]  Let me analyze the code... │
└──────────────────────────────────────────────────────────┘
```

- Click to expand
- Shows first 80 chars of thinking text, truncated
- `text-xs text-[var(--text-secondary)]`

**Expanded:**
```
┌──────────────────────────────────────────────────────────┐
│  [ChevronDown] [BrainIcon]  Thinking                     │
├──────────────────────────────────────────────────────────┤
│  First I'll check the project layout. The file           │
│  structure suggests a FastAPI backend with vanilla        │
│  JS frontend. I need to understand the session           │
│  manager before I can refactor it properly...            │
│                                                          │  ← max-h-[300px] overflow-y-auto
└──────────────────────────────────────────────────────────┘
```

- `bg-[var(--bg-elevated)] rounded-lg`
- Body: `font-mono text-xs text-[var(--text-secondary)] max-h-[300px] overflow-y-auto`
- Chevron rotates 0 → 90deg on expand (150ms, ease)

### Tool Cards

Every tool use gets a collapsible card. Left-aligned within Claude's message area.

**Collapsed (default for most tools):**
```
┌─────────────────────────────────────────────────────────┐
│  [ToolIcon]  ToolName  detail/path              [Chev] │
└─────────────────────────────────────────────────────────┘
```

**Expanded:**
```
┌─────────────────────────────────────────────────────────┐
│  [ToolIcon]  ToolName  detail/path              [Chev] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Tool-specific body content                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Card structure:**
- `bg-[var(--bg-elevated)] rounded-lg border-l-[3px] border-l-[CATEGORY_COLOR]`
- Header: `flex items-center gap-2 px-3 py-2 cursor-pointer`
  - Tool icon: Lucide icon, 16x16, `color: CATEGORY_COLOR`
  - Tool name: `text-[13px] font-semibold`
  - Detail: `text-[12px] font-mono text-[var(--text-secondary)] truncate flex-1`
  - Chevron: `ChevronRight` icon, rotates on expand
- Body: `border-t border-[var(--border-subtle)] px-3 py-2`
- Expand/collapse: Framer Motion `AnimatePresence`, height animation

#### Tool: Read

- **Icon:** `FileText` (Lucide) | **Border:** teal
- **Detail:** file path (`src/server.py`)
- **Body:** "Read N lines" or file content preview (first 20 lines, syntax highlighted)
- **Auto-expand:** No (collapsed by default)

#### Tool: Glob

- **Icon:** `Search` (Lucide) | **Border:** teal
- **Detail:** pattern (`**/*.py`)
- **Body:** List of matched files (max 20, "and N more...")

#### Tool: Grep

- **Icon:** `FileSearch` (Lucide) | **Border:** teal
- **Detail:** pattern + path
- **Body:** Matching lines with context, file paths as links

#### Tool: Edit

- **Icon:** `Pencil` (Lucide) | **Border:** amber
- **Detail:** file path (basename)
- **Auto-expand:** Yes (user wants to see diffs)
- **Body — unified diff:**

```
┌─ server.py ─────────────────────────────────────────────┐
│  12  │ − old_line_here                                   │
│  12  │ + new_line_here                                   │
│  13  │ + another_new_line                                │
└──────────────────────────────────────────────────────────┘
```

- File path header: `text-xs font-mono text-[var(--text-secondary)]`
- Line numbers: `w-8 text-right text-[var(--text-tertiary)] select-none`
- Deletions: `bg-[rgba(239,68,68,0.08)] text-[#fca5a5] border-l-[3px] border-l-[var(--destructive)]`
- Additions: `bg-[rgba(16,185,129,0.08)] text-[#86efac] border-l-[3px] border-l-[var(--success)]`

#### Tool: Write

- **Icon:** `FilePlus` (Lucide) | **Border:** amber
- **Detail:** file path
- **Auto-expand:** Yes for small files (< 30 lines), collapsed for large
- **Body:** Line count badge + syntax highlighted content preview

#### Tool: Bash

- **Icon:** `Terminal` (Lucide) | **Border:** green
- **Detail:** command (truncated 80 chars)
- **Auto-expand:** Yes
- **Body:**

```
┌──────────────────────────────────────────────────────────┐
│ $ npm install framer-motion                               │
└──────────────────────────────────────────────────────────┘
```

- `font-mono text-[13px]`, `$` prefix in `--text-secondary`
- Dangerous commands (`rm -rf`, `--force`, `sudo`, `DROP`): amber warning banner above command: `[AlertTriangle] Potentially destructive command`

#### Tool: WebSearch

- **Icon:** `Globe` (Lucide) | **Border:** coral
- **Detail:** search query
- **Body:** `"query text"` in quotes

#### Tool: WebFetch

- **Icon:** `ExternalLink` (Lucide) | **Border:** coral
- **Detail:** URL (truncated)
- **Body:** Clickable URL link, `target="_blank"`

#### Tool: Agent (subagent)

- **Icon:** `Bot` (Lucide) | **Border:** purple
- **Detail:** agent description
- **Body:** Agent type, description. Nested messages from subagent render indented within a subtle container with a purple left border, visually nesting the subagent's work.

#### Tool: Unknown / MCP Tools

- **Icon:** `Wrench` (Lucide) | **Border:** `--text-tertiary`
- **Detail:** tool name
- **Body:** Key-value display if <= 5 fields, otherwise formatted JSON

### Tool Result

Appears directly below its tool card with no gap.

```
┌──────────────────────────────────────────────────────────┐
│  stdout content here...                                   │
│  more output lines...                                     │
│                                        [Show all (5000)] │
└──────────────────────────────────────────────────────────┘
```

- `bg-[var(--bg-surface)] rounded-b-lg px-3 py-2 text-xs font-mono`
- `max-h-[200px] overflow-y-auto`
- Error results: `text-[var(--destructive)] bg-[rgba(239,68,68,0.05)]`
- Truncation: first 3000 chars, "Show all (N chars)" link to expand in-place
- Joins visually with tool card above (no rounded top corners, shares border)

### Permission Cards

Prominent cards that demand attention. Appear in the chat flow, left-aligned.

**General structure:**
```
┌─────────── [accent color] top bar (3px) ─────────────────┐
│                                                           │
│  [ToolIcon]  Claude wants to [action description]         │
│                                                           │
│  [Content preview — command / diff / file path]           │
│                                                           │
│  [Allow]  [Always allow X]  [Deny]                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- `bg-[var(--bg-elevated)] rounded-lg border border-[var(--border)]`
- Top accent bar: `3px` of category color
- Title: `text-sm font-semibold`
- Content: same rendering as the tool card body (diff for Edit, command for Bash, etc.)
- Buttons:
  - **Allow:** `bg-[var(--success)] text-[var(--accent-text)]` filled, prominent
  - **Always allow [pattern]:** `bg-transparent border border-[var(--border)] text-[var(--text-secondary)]` outlined
  - **Deny:** `bg-transparent text-[var(--destructive)]` ghost
- Deny expander: clicking Deny reveals a textarea "Tell Claude what to do instead..." + "Send & Deny" + "Cancel"

#### Bash Permission

- Top bar: green
- Title: "Claude wants to run a command"
- Warning badge for dangerous commands: `[AlertTriangle] Potentially destructive`
- Content: command in mono block
- Always allow option: "Always allow `git` commands" (extracts command prefix)

#### Edit Permission

- Top bar: amber
- Title: "Claude wants to edit `filename`"
- Content: unified diff (same rendering as Edit tool card body)
- Always allow options: "Allow all edits this session" / "Allow edits in `dir/`"

#### Write Permission

- Top bar: amber
- Title: "Claude wants to create `filename`"
- Content: syntax-highlighted preview of file content
- Always allow option: "Allow all writes this session"

#### Read / Glob / Grep Permission

- Top bar: teal
- Title: "Claude wants to read `filepath`" / "Claude wants to search files"
- Content: file path chip or search pattern
- Always allow option: "Always allow Read" / "Always allow Grep"

#### WebSearch / WebFetch Permission

- Top bar: coral
- Title: "Claude wants to search the web" / "Claude wants to fetch a URL"
- Content: search query or URL

#### Resolved Permission (collapsed after decision)

```
│  [ToolIcon] Edit server.py  ✓ Allowed                    │
```
or
```
│  [TerminalIcon] Bash npm test  ✗ Denied: "use jest"      │
```

- Single line, `text-xs`, `opacity-60`
- `✓` in `--success`, `✗` in `--destructive`
- Shows denial reason if provided

### AskUserQuestion Card

When Claude uses the `AskUserQuestion` tool. Rendered as a prominent card, left-aligned.

#### Single Question

```
┌─────────── coral top bar ────────────────────────────────┐
│                                                           │
│  [HelpCircle]  Claude has a question                     │
│                                                           │
│  Would you like to add Docker support?                   │  ← question text
│                                                           │
│  ┌─────────────────────────────┐  ┌────────────────────┐ │
│  │  Options                    │  │  Preview            │ │  ← side-by-side desktop
│  │                             │  │                     │ │
│  │  ◉ Dockerfile only          │  │  ```dockerfile      │ │
│  │    Simple Dockerfile        │  │  FROM node:18       │ │
│  │                             │  │  WORKDIR /app       │ │
│  │  ○ Docker Compose           │  │  COPY . .           │ │
│  │    Full stack setup         │  │  RUN npm install    │ │
│  │                             │  │  ```                │ │
│  │  ○ No Docker                │  │                     │ │
│  │    Skip setup               │  │                     │ │
│  │                             │  │                     │ │
│  │  ○ Other...                 │  │                     │ │
│  │    [Type answer: ___]       │  │                     │ │
│  │                             │  │                     │ │
│  └─────────────────────────────┘  └────────────────────┘ │
│                                                           │
│  ───────────────────────────────────────────────────────  │
│  [Skip]                                        [Submit]  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

- `bg-[var(--bg-elevated)] rounded-lg border border-[var(--border)]`
- Coral top bar (3px)
- Question text: `text-[15px] font-semibold`
- Options: radio buttons (single select) or checkboxes (multi-select)
- Option cards: `bg-[var(--bg-surface)] rounded-lg px-3 py-2 cursor-pointer border border-transparent`
- Selected: `border-[var(--accent)] bg-[rgba(212,132,90,0.06)]`
- Custom radio/checkbox: `w-5 h-5 rounded-full border-2 border-[var(--border)]`, filled with `--accent` when selected
- "Other..." option: auto-added at bottom, reveals text input on click
- Preview panel: right side on desktop (50/50 split), below on mobile. Full markdown rendering. Shows when selected option has preview content.
- Multi-select hint: "Select all that apply" in `text-xs italic text-[var(--text-secondary)]`
- Submit button: `bg-[var(--accent)] text-[var(--accent-text)]`, disabled until selection made
- Skip button: ghost, `text-[var(--text-secondary)]`

#### Multi-Question (Wizard)

```
│  ● ○ ○                                         1 of 3  │  ← progress dots
│                                                          │
│  (question content as above)                             │
│                                                          │
│  [← Back]                            [Skip all] [Next →]│
```

- Progress dots: `w-2 h-2 rounded-full`
  - Current: `bg-[var(--accent)]` with glow shadow
  - Completed: `bg-[var(--success)]`
  - Pending: `bg-[var(--bg-surface)]`
- Navigation slides questions left/right (Framer Motion, `translateX`)
- Last step: "Next" becomes "Submit"

#### Resolved AskUserQuestion

```
│  [CheckCircle]  Answered: Dockerfile only                │
```
- Single line, `text-xs`, `opacity-60`

### Result Bar

Appears after Claude finishes a query response.

```
│  ┌── $0.0142 · 1.2s · 3 turns · end_turn ──────────┐   │
│  └──────────────────────────────────────────────────┘   │
```

- `inline-flex gap-3 px-4 py-1.5 bg-[var(--bg-elevated)] rounded-full text-[11px] font-mono`
- Cost: `text-[var(--success)] font-semibold`
- Duration: `text-[var(--text-secondary)]`
- Turns: `text-[var(--text-secondary)]`
- Error result: `text-[var(--destructive)]` instead of success green, shows error message

### Streaming State

While Claude is generating text, show character-by-character with cursor:

```
│  I'll help you with that. Let me first check the▋       │
```

- Blinking cursor: `::after { content: '▋' }`, blink animation `opacity 0↔1` every 530ms
- Text renders as plain text during streaming (no markdown yet)
- On message completion: streaming text replaced by full markdown-rendered `AssistantMessage`
- Smooth transition: no visual jump (pre-compute layout)

### System Dividers

```
│  ──────────── Session resumed ────────────              │
```

- `flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] py-4`
- Lines: `flex-1 h-px bg-[var(--border-subtle)]`
- Used for: "Session resumed", "Session started", "Reconnected"

---

## Status Bar

Bottom of the main content area, above the input bar. Shows session metadata.

```
┌──────────────────────────────────────────────────────────────────┐
│ 🟢 Ready  │  $0.12  │  Opus 4.6 ▾  │  my-agent  │  3 turns   │
└──────────────────────────────────────────────────────────────────┘
```

- `flex items-center gap-4 px-4 py-1.5 text-[12px] font-mono border-t border-[var(--border-subtle)]`
- `bg-[var(--bg)]`
- Height: 32px
- Status dot: `w-2 h-2 rounded-full` with category color
- Cost: `text-[var(--success)]`
- Model: clickable dropdown → model picker popover
- Project: `text-[var(--text-secondary)]`
- Turns: `text-[var(--text-secondary)]`

### Model Picker (popover from status bar)

```
┌─────────────────────────┐
│ MODEL                   │
│                         │
│ ◉ Claude Opus 4.6       │
│ ○ Claude Sonnet 4.6     │
│ ○ Claude Haiku 4.5      │
└─────────────────────────┘
```

- Radix Popover, `bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg shadow-lg`
- Radio buttons, change takes effect immediately (fires WebSocket `config` message)

### Config Popover (from ⚙ button in header or status bar)

Accessed via gear icon. Opens as a popover on desktop, bottom sheet on mobile.

```
┌─────────────────────────────────┐
│ SESSION CONFIG                  │
│                                 │
│ PERMISSION MODE                 │
│ ┌─────────────────────────────┐ │
│ │ ○ Ask for everything        │ │
│ │ ● Accept file edits         │ │
│ │ ○ Bypass all permissions    │ │
│ │ ○ Plan only (no execution)  │ │
│ └─────────────────────────────┘ │
│                                 │
│ TOOLS                           │
│ [✓] Read  [✓] Edit  [✓] Write │
│ [✓] Bash  [✓] Glob  [✓] Grep  │
│ [✓] Web   [✓] Agent           │
│                                 │
│ LIMITS                          │
│ Max cost:  [$5.00        ]     │
│ Max turns: [50           ]     │
│                                 │
│ SYSTEM PROMPT                   │
│ ┌─────────────────────────────┐ │
│ │ You are a senior Python     │ │
│ │ developer...                │ │
│ └─────────────────────────────┘ │
│                                 │
│ MCP SERVERS                     │
│ playwright  🟢                  │
│ [+ Add server]                  │
│                                 │
│ NOTIFICATIONS                   │
│ Push: 🟢 Enabled  [Test]       │
│                                 │
└─────────────────────────────────┘
```

- All changes are instant (no "Save" button). Each change fires immediately.
- Permission mode: radio group
- Tools: checkbox grid
- Limits: number inputs with validation
- System prompt: auto-expanding textarea
- MCP servers: list with add/remove
- Push notifications: toggle + test button

---

## Input Bar

Sticky at the bottom of chat views.

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ [FileIcon server.py ×]  [ImageIcon screenshot.png ×]        ││  ← attachment chips
│  ├──────────────────────────────────────────────────────────────┤│
│  │                                                              ││
│  │ Message Claude...                                    [Send] ││  ← textarea + button
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│  [+]  [/]                                                       │  ← action buttons
└──────────────────────────────────────────────────────────────────┘
```

**Container:** `border-t border-[var(--border-subtle)]`, `max-w-3xl mx-auto`, `px-4 py-3`
**Input pill:** `bg-[var(--bg-overlay)] backdrop-blur-md rounded-xl border border-[var(--border)]` — this is where glass IS appropriate (floating element, not in scroll)
**Textarea:** `bg-transparent border-none outline-none resize-none text-[15px]`, auto-expand up to 200px
**Send button:** `w-8 h-8 rounded-lg`
- Empty input: `bg-[var(--bg-surface)] text-[var(--text-tertiary)]` (disabled)
- Has text: `bg-[var(--accent)] text-[var(--accent-text)]` (enabled, ArrowUp icon)
- Session running: `bg-[var(--destructive)] text-white` (Square/stop icon, sends interrupt)

**Action buttons below input:**
- `[+]` — opens attachment picker (file browser, upload, camera on mobile)
- `[/]` — opens slash command palette

**Attachment chips:**
- `bg-[var(--bg-surface)] rounded-md px-2 py-1 text-xs flex items-center gap-1`
- File icon (from Lucide, based on extension) + filename + `[X]` remove button
- Image attachments: small thumbnail (32x32) instead of icon
- Drag-over state: `ring-2 ring-[var(--accent)] ring-inset` on the input container

**Keyboard:**
- `Enter` — send
- `Shift+Enter` — newline
- `Ctrl+V` / `Cmd+V` — paste image as attachment
- `Escape` — clear input (if empty, deselect)

**Slash command palette:**
When user types `/` or clicks `[/]`:
```
┌─────────────────────────────────┐
│ /commit     Create a git commit │
│ /review     Review code changes │
│ /test       Run tests           │
│ /fix        Fix a specific bug  │
└─────────────────────────────────┘
```
- Popover above input, filters as user types
- Loaded from `.claude/commands/*.md` via backend API

---

## Activity Bar

Always visible. 48px wide strip on the left edge.

```
┌────┐
│    │
│ 🏠 │  Home / Dashboard
│    │
│ 📁 │  Projects
│    │
│ ⚡ │  File Explorer (active tab's project)
│    │
│    │
│    │  (spacer)
│    │
│ ⚙  │  Settings
│    │
└────┘
```

- `w-12 bg-[var(--bg)] border-r border-[var(--border-subtle)] flex flex-col items-center py-2 gap-1`
- Each icon: `w-10 h-10 rounded-lg flex items-center justify-center`
- Active: `bg-[var(--bg-surface)] text-[var(--text)]`
- Inactive: `text-[var(--text-tertiary)]`
- Hover: `text-[var(--text-secondary)]`
- Clicking active icon toggles sidebar panel open/closed

**Mobile:** Activity bar becomes bottom navigation bar:
```
┌─────────────────────────────────────┐
│  🏠 Home  │  📁 Projects  │  ⚙ More │
└─────────────────────────────────────┘
```
- `fixed bottom-0` with `safe-area-inset-bottom` padding
- 56px height, `bg-[var(--bg-overlay)] backdrop-blur-md border-t`

---

## Sidebar Panel

260px wide, sits between activity bar and main content. Collapsible.

Content depends on active activity bar icon:

### 🏠 Home Panel (session list)

```
┌──────────────────────┐
│ Sessions         [+] │
│ ─────────────────── │
│                      │
│ ACTIVE               │
│ ● my-agent           │
│   Rewrite backend    │
│   $0.12 · 3m ago     │
│                      │
│ 🔵 api-server         │
│   Rate limiting      │
│   $0.04 · now        │
│                      │
│ RECENT               │
│ ✓ job-tracker        │
│   Fix auth · $0.03   │
│                      │
│ ✓ my-agent           │
│   Push notifs · $0.08│
│                      │
└──────────────────────┘
```

- Click session → opens as tab (or focuses if already open)
- `[+]` → project picker to create new session
- Active sessions have status dot + pulse animation
- Right-click → context menu: Rename, Delete, Copy ID

### 📁 Projects Panel

```
┌──────────────────────┐
│ Projects             │
│ ┌──────────────────┐ │
│ │ 🔍 Search...     │ │
│ └──────────────────┘ │
│                      │
│ ★ my-agent           │
│   ~/Project/my-agent │
│   2 sessions         │
│   [+ New Session]    │
│                      │
│ ★ api-server         │
│   ~/Project/api-srvr │
│   1 active           │
│   [+ New Session]    │
│                      │
│ job-tracker          │
│   ~/Project/job-trkr │
│   [+ New Session]    │
│                      │
│ ─────────────────── │
│ [+ Add project]      │
│ [📂 Browse...]       │
│                      │
└──────────────────────┘
```

- `★` = pinned project (click star to toggle)
- `[+ New Session]` appears on hover/focus for each project
- Clicking it creates a new session + opens as tab (existing tabs untouched)
- `[+ Add project]` → text input for path
- `[Browse...]` → server-side directory listing in a modal

### ⚡ File Explorer Panel

Shows file tree for the **active tab's project**. Updates when you switch tabs.

```
┌──────────────────────┐
│ my-agent         [↻] │  ← project name + refresh
│ ─────────────────── │
│                      │
│ ▶ routes/            │
│ ▶ static/            │
│ ▶ utils/             │
│ ▶ docs/              │
│   agent.py           │
│   db.py         🆕   │  ← new file indicator
│   server.py     ★    │  ← recently modified
│   pyproject.toml     │
│                      │
│ ─────────────────── │
│ Drag files to chat   │
│ to attach them       │
└──────────────────────┘
```

- File items: `py-[6px] px-3 text-[13px] cursor-pointer`
- Hover: `bg-[var(--bg-surface)]`
- Directories: Lucide `Folder` / `FolderOpen` icon, click to expand with animation
- Files: extension-based Lucide icon (`FileCode`, `FileJson`, `FileImage`, etc.)
- Click file → opens as tab (read-only viewer)
- Drag file → drag preview shows filename chip, drop on chat input to attach
- `★` modified indicator: amber dot, fades after 5 seconds
- `🆕` new file indicator: green "NEW" badge, fades after 10 seconds
- Deleted file: brief red flash + slide out animation

**Realtime updates:**
- `fs_change` WebSocket events update the tree without full refresh
- Added file: insert into tree at correct position, slide-in animation
- Removed file: slide-out animation, remove from tree
- Modified file: amber pulse on the row, 5-second fade

### ⚙ Settings Panel

Global settings (not per-session — per-session config is in the config popover).

```
┌──────────────────────┐
│ Settings             │
│ ─────────────────── │
│                      │
│ DEFAULT PERMISSION   │
│ ● Accept edits       │
│ ○ Ask for everything │
│ ○ Bypass all         │
│                      │
│ DEFAULT MODEL        │
│ [Claude Opus 4.6  ▾] │
│                      │
│ PROJECT DIRECTORY    │
│ [~/Project         ] │
│                      │
│ NOTIFICATIONS        │
│ Push: [Enabled  ▾]   │
│ [Send test push]     │
│                      │
│ APPEARANCE           │
│ [Use system font ▾]  │
│                      │
└──────────────────────┘
```

---

## Tab Bar

Horizontal tab strip above the main content area.

```
┌─[🏠 Dashboard]─[⚡ my-agent: Rewrite ×]─[▶ Terminal ×]─[📄 server.py ×]─[+]─────┐
```

- `h-9 bg-[var(--bg)] border-b border-[var(--border-subtle)] flex items-center overflow-x-auto`
- Scrolls horizontally when tabs overflow (no wrapping)
- Each tab: `px-3 h-full flex items-center gap-1.5 text-[12px] border-r border-[var(--border-subtle)] cursor-pointer whitespace-nowrap`
- Active tab: `bg-[var(--bg-elevated)] text-[var(--text)] border-b-2 border-b-[var(--accent)]`
- Inactive tab: `text-[var(--text-secondary)]`
- Hover (inactive): `bg-[var(--bg-surface)]`
- Close button: `[X]` icon, 16x16, appears on hover or always on active tab
- `[+]` at end: opens new session (project picker)
- Tab icon matches content type: `Home` / `Zap` / `Terminal` / `FileText` / `Image`
- Drag to reorder
- Middle-click to close
- Right-click context menu: Close, Close Others, Close All, Close to the Right, Pin

### Tab Persistence

Stored in `localStorage`:
```json
{
  "tabs": [
    {"id": "dashboard", "type": "dashboard", "pinned": true},
    {"id": "uuid-1", "type": "session", "sessionId": "uuid", "project": "my-agent", "label": "Rewrite backend"},
    {"id": "uuid-2", "type": "terminal", "cwd": "/home/user/Project/my-agent"},
    {"id": "uuid-3", "type": "file", "projectPath": "/home/user/Project/my-agent", "filePath": "server.py"}
  ],
  "activeTabId": "uuid-1"
}
```

On page reload: tabs restore, sessions reconnect via WebSocket, terminals reconnect, file viewers re-fetch.

---

## View 3: Terminal

Full xterm.js terminal. Renders when a Terminal tab is active.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  hemanth@machine:~/Project/my-agent$                             │
│  hemanth@machine:~/Project/my-agent$ npm run dev                 │
│  Server running at http://localhost:9282                         │
│  hemanth@machine:~/Project/my-agent$ █                           │
│                                                                  │
│                                                                  │
│                                                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

- Full height of main content area (no status bar, no input bar)
- `xterm.js` with `xterm-addon-fit` (auto-resize to container)
- `xterm-addon-webgl` for GPU-accelerated rendering
- Theme matches app: `bg: var(--bg)`, `foreground: var(--text)`, `cursor: var(--accent)`
- WebSocket: `/ws/terminal?cwd=PROJECT_PATH`
- Resize events sent to server on container resize
- Multiple terminals allowed (one per tab)
- Copy: select text → auto-copy (or Ctrl+Shift+C)
- Paste: Ctrl+Shift+V or right-click

---

## View 4: File Viewer

Read-only file viewer. Opens when clicking a file in the file tree.

### Code Files

```
┌──────────────────────────────────────────────────────────────────┐
│  server.py                                        [Copy] [Open] │
├──────────────────────────────────────────────────────────────────┤
│   1  │ """                                                       │
│   2  │ Project Wiki — Modular Web Server                         │
│   3  │ """                                                       │
│   4  │                                                           │
│   5  │ import os                                                 │
│   6  │ import time                                               │
│   7  │                                                           │
│   8  │ from fastapi import FastAPI, Request                      │
└──────────────────────────────────────────────────────────────────┘
```

- Syntax highlighted via `rehype-highlight`
- Line numbers: `text-[var(--text-tertiary)] select-none w-12 text-right`
- `[Copy]` — copy full file content
- `[Open]` — opens in default system editor (if accessible)
- Read-only (no editing — Claude does the editing)

### Images

Full image viewer with zoom/pan. `object-contain` in the available space.

### Markdown

Rendered markdown (same renderer as chat messages).

### Binary / Other

"Binary file — cannot preview" message with file size and type info.

---

## Push Notification UI

### First-Time Onboarding

On first visit (or when push is not subscribed), show a non-intrusive banner:

```
┌──────────────────────────────────────────────────────────────────┐
│ [BellIcon]  Enable notifications to approve permissions          │
│             when you're away from this tab.            [Enable] │
└──────────────────────────────────────────────────────────────────┘
```

- Appears at top of Dashboard view
- `bg-[var(--bg-elevated)] border border-[var(--accent)] rounded-lg px-4 py-3`
- Dismissable (shows again next visit if not enabled)
- `[Enable]` → triggers browser `Notification.requestPermission()` → on grant, subscribes to push

### Notification Center

When user returns to the app after being away, show missed events:

```
┌──────────────────────────────────────────────────────────────────┐
│ While you were away:                                             │
│                                                                  │
│ ✓ my-agent: Task completed ($0.12)                    5 min ago │
│ ⚠ api-server: Permission auto-approved (Bash: npm i)  3 min ago│
│ ✗ docs-site: Task failed (rate limit)                 1 min ago │
│                                                                  │
│                                                      [Dismiss] │
└──────────────────────────────────────────────────────────────────┘
```

- Appears at top of active view on reconnection
- Click any item → navigates to that session tab
- Auto-dismisses after 30 seconds

---

## Reconnection UI

WebSocket drops are common, especially on mobile.

**Banner (non-intrusive):**
```
┌──────────────────────────────────────────────────────────────────┐
│ [WifiOff]  Reconnecting...                                       │
└──────────────────────────────────────────────────────────────────┘
```

- `fixed top-0 w-full bg-[var(--warning)] text-[var(--accent-text)] text-xs py-1 text-center z-50`
- Appears after 2 seconds of disconnect
- Shows retry count: "Reconnecting (attempt 3)..."
- On reconnect: flashes green "Connected" for 2 seconds, then hides
- Sessions auto-replay missed messages on reconnect

---

## Animation Reference

| Element | Animation | Duration | Easing |
|---|---|---|---|
| Message appear | `opacity: 0→1, y: 8→0` | 200ms | `ease-out` |
| Tool card expand | `height: 0→auto, opacity: 0→1` | 200ms | `ease-out` |
| Thinking chevron | `rotate: 0→90deg` | 150ms | `ease-out` |
| Sidebar panel | `width: 0→260px` | 250ms | `[0.22, 1, 0.36, 1]` |
| Tab switch content | `opacity: 0→1` | 150ms | `ease` |
| Permission card | `opacity: 0→1, y: 12→0, scale: 0.98→1` | 300ms | `[0.22, 1, 0.36, 1]` |
| File tree item add | `opacity: 0→1, height: 0→auto` | 200ms | `ease-out` |
| File tree item remove | `opacity: 1→0, height: auto→0` | 200ms | `ease-in` |
| File modified pulse | `bg-amber flash` | 300ms | `ease`, then 5s fade |
| Status dot pulse | `scale: 1→1.3→1, opacity: 0.5→1→0.5` | 2000ms | `ease-in-out`, loop |
| Drag-over ring | `ring-2 appear` | 150ms | `ease` |
| Notification banner slide | `y: -100%→0` | 300ms | `[0.22, 1, 0.36, 1]` |
| Bottom sheet (mobile) | `y: 100%→0` | 300ms | `[0.22, 1, 0.36, 1]` |
| Popover | `opacity: 0→1, scale: 0.95→1` | 150ms | `ease-out` |

---

## Responsive Breakpoints

| Breakpoint | Layout Changes |
|---|---|
| `< 640px` (mobile) | Activity bar → bottom nav. Sidebar → full-screen overlay. Config/files → bottom sheets. Tab bar compact. Chat full-width. AskUserQuestion stacked vertically. |
| `640-1024px` (tablet) | Sidebar 220px (collapsible). AskUserQuestion side-by-side. |
| `> 1024px` (desktop) | Sidebar 260px (collapsible). Full layout. |

---

## Accessibility

- All interactive elements: `min-h-[44px] min-w-[44px]` touch target
- Focus visible: `focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]`
- Reduced motion: `@media (prefers-reduced-motion: reduce)` → all animations to 0.01ms
- Semantic HTML: `<button>` for actions, `<a>` for links, `<pre><code>` for code
- ARIA: `aria-expanded` on collapsibles, `aria-label` on icon-only buttons, `aria-live="polite"` on status updates, `role="tablist"` / `role="tab"` on tab bar
- Color contrast: all text meets WCAG AA (4.5:1 minimum)
- Keyboard navigation: Tab through all interactive elements, Enter/Space to activate, Escape to close overlays

---

## Data Flow Architecture

### Zustand Stores

```typescript
// Session store
interface SessionStore {
  sessions: Map<string, Session>          // all known sessions (from DB)
  activeMessages: Map<string, Message[]>  // messages per session (in-memory)
  streamingText: Map<string, string>      // partial text being streamed per session
  pendingPermissions: Map<string, PermissionRequest>

  // Actions
  connectSession(sessionId: string): void
  sendQuery(sessionId: string, prompt: string, attachments?: File[]): void
  resolvePermission(sessionId: string, requestId: string, decision: string): void
  interrupt(sessionId: string): void
  updateConfig(sessionId: string, config: Partial<SessionConfig>): void
}

// Tab store
interface TabStore {
  tabs: Tab[]
  activeTabId: string

  openTab(tab: Tab): void
  closeTab(tabId: string): void
  setActive(tabId: string): void
  reorderTabs(fromIndex: number, toIndex: number): void
}

// UI store
interface UIStore {
  sidebarOpen: boolean
  sidebarPanel: 'home' | 'projects' | 'files' | 'settings'
  configOpen: boolean            // config popover
  pushEnabled: boolean
  reconnecting: boolean
  missedEvents: MissedEvent[]
}
```

### WebSocket Message Flow

```
1. Tab opens for session → useEffect connects WebSocket
2. Server sends session_info → update SessionStore
3. Server sends replay_start → set loading state
4. Server sends replayed messages → append to activeMessages
5. Server sends replay_end → clear loading, scroll to bottom
6. Live messages arrive → append to activeMessages, auto-scroll
7. Stream events → update streamingText (partial rendering)
8. AssistantMessage → clear streamingText, append full message
9. Permission request → add to pendingPermissions, show card in chat
10. ResultMessage → update session cost/turns, clear "thinking" status
11. WebSocket closes → set reconnecting, auto-retry with backoff
12. WebSocket reconnects → send last seen seq, get incremental replay
```

### Tab ↔ Sidebar Relationship

```
Active tab changes → TabStore.activeTabId updates
  → If tab is session type: sidebar file tree switches to that session's CWD
  → Status bar updates to that session's status/cost/model
  → If tab is terminal type: sidebar file tree switches to terminal's CWD
  → If tab is file type: sidebar file tree switches to file's project
  → If tab is dashboard: sidebar shows home panel
```

---

## File Structure

```
frontend/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx                    ← layout shell (activity bar + sidebar + tabs + content)
│   │
│   ├── components/
│   │   ├── ui/                    ← shadcn/ui primitives (Button, Input, Popover, Sheet, etc.)
│   │   │
│   │   ├── layout/
│   │   │   ├── ActivityBar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SidebarHome.tsx
│   │   │   ├── SidebarProjects.tsx
│   │   │   ├── SidebarFiles.tsx
│   │   │   ├── SidebarSettings.tsx
│   │   │   ├── TabBar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── MobileNav.tsx
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatView.tsx       ← main chat container (message list + input)
│   │   │   ├── MessageUser.tsx
│   │   │   ├── MessageClaude.tsx
│   │   │   ├── ThinkingBlock.tsx
│   │   │   ├── ToolCard.tsx       ← generic wrapper, delegates to tool-specific renderers
│   │   │   ├── ToolResult.tsx
│   │   │   ├── PermissionCard.tsx
│   │   │   ├── AskUserQuestion.tsx
│   │   │   ├── ResultBar.tsx
│   │   │   ├── StreamingText.tsx
│   │   │   ├── SystemDivider.tsx
│   │   │   └── ChatInput.tsx
│   │   │
│   │   ├── tools/                 ← tool-specific body renderers
│   │   │   ├── ToolRead.tsx
│   │   │   ├── ToolEdit.tsx       ← unified diff renderer
│   │   │   ├── ToolWrite.tsx
│   │   │   ├── ToolBash.tsx
│   │   │   ├── ToolGlob.tsx
│   │   │   ├── ToolGrep.tsx
│   │   │   ├── ToolWebSearch.tsx
│   │   │   ├── ToolWebFetch.tsx
│   │   │   ├── ToolAgent.tsx
│   │   │   └── ToolGeneric.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── DashboardView.tsx
│   │   │   ├── ActiveSessionCard.tsx
│   │   │   ├── CompletedSessionRow.tsx
│   │   │   └── ProjectCard.tsx
│   │   │
│   │   ├── terminal/
│   │   │   └── TerminalView.tsx   ← xterm.js wrapper
│   │   │
│   │   ├── fileviewer/
│   │   │   ├── FileViewer.tsx     ← routes to CodeViewer / ImageViewer / MarkdownViewer
│   │   │   ├── CodeViewer.tsx
│   │   │   ├── ImageViewer.tsx
│   │   │   └── MarkdownViewer.tsx
│   │   │
│   │   └── notifications/
│   │       ├── NotificationBanner.tsx
│   │       ├── PushOnboarding.tsx
│   │       └── ReconnectionBanner.tsx
│   │
│   ├── stores/
│   │   ├── sessionStore.ts
│   │   ├── tabStore.ts
│   │   └── uiStore.ts
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts        ← WebSocket connection + auto-reconnect
│   │   ├── useSession.ts          ← session-specific logic (query, permission, interrupt)
│   │   ├── useScrollAnchor.ts     ← auto-scroll + "jump to bottom" detection
│   │   ├── useFileTree.ts         ← file tree state + realtime updates
│   │   ├── usePushNotifications.ts ← push subscription management
│   │   └── useKeyboard.ts         ← global keyboard shortcuts
│   │
│   ├── lib/
│   │   ├── types.ts               ← all TypeScript interfaces
│   │   ├── api.ts                 ← REST API calls (fetch wrappers)
│   │   ├── constants.ts           ← tool colors, categories, defaults
│   │   └── utils.ts               ← cn(), formatCost(), formatTime(), etc.
│   │
│   └── styles/
│       └── globals.css            ← CSS variables, base styles, xterm overrides
│
├── public/
│   ├── sw.js                      ← service worker for push notifications
│   ├── manifest.json              ← PWA manifest (for mobile "Add to Home Screen")
│   ├── icon-192.png
│   └── icon-512.png
```
