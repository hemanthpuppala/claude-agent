"""
Discord bot for Claude Code Web.

Connects to the same backend DB and session manager.
Provides: slash commands, permission buttons, chat, notifications.

Run: uv run python -m app.discord.bot
"""

import asyncio
import json
import logging
import os
import textwrap

import discord
from discord import app_commands
from discord.ext import tasks

from app.config import (
    DISCORD_BOT_TOKEN, DISCORD_GUILD_ID,
    DEFAULT_PROJECT_ROOT, DEFAULT_PERMISSION_MODE,
)
from app.database.connection import init_db, close_db
from app.database.queries.sessions import (
    list_sessions, get_session, create_session as db_create_session,
    update_session,
)
from app.database.queries.messages import get_messages
from app.core.notifications import NotificationManager
from app.core.session_manager import SessionManager

log = logging.getLogger(__name__)

# ===== Formatting helpers =====

def truncate(text: str, max_len: int = 1900) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len] + "\n... [truncated]"


def format_cost(usd: float) -> str:
    if usd == 0:
        return "$0.00"
    if usd < 0.01:
        return f"${usd:.4f}"
    return f"${usd:.2f}"


def tool_summary(tool_name: str, tool_input: dict) -> str:
    if tool_name == "Bash":
        return f"`$ {truncate(str(tool_input.get('command', '')), 200)}`"
    if tool_name in ("Read", "Write", "Edit"):
        return f"`{tool_input.get('file_path', '')}`"
    if tool_name == "Glob":
        return f"`{tool_input.get('pattern', '')}`"
    if tool_name == "Grep":
        return f"`{tool_input.get('pattern', '')}` in `{tool_input.get('path', '.')}`"
    if tool_name == "WebSearch":
        return f'"{tool_input.get("query", tool_input.get("prompt", ""))}"'
    return f"`{tool_name}`"


def session_display_name(s: dict) -> str:
    project = s.get("cwd", "").split("/")[-1] or "project"
    prompt = s.get("last_prompt", "") or s.get("name", "") or "New session"
    return f"**{project}**: {truncate(prompt, 60)}"


STATUS_EMOJI = {
    "idle": "🟢",
    "thinking": "🔵",
    "waiting_permission": "🟡",
    "error": "🔴",
    "dead": "⚫",
}


# ===== Permission button views =====

class PermissionView(discord.ui.View):
    """Buttons for permission approval in Discord."""

    def __init__(self, manager: SessionManager, session_id: str, request_id: str):
        super().__init__(timeout=300)  # 5 minute timeout
        self.manager = manager
        self.session_id = session_id
        self.request_id = request_id

    @discord.ui.button(label="Allow", style=discord.ButtonStyle.success, emoji="✅")
    async def allow(self, interaction: discord.Interaction, button: discord.ui.Button):
        session = self.manager.get(self.session_id)
        if session:
            self.manager.resolve_permission(session, self.request_id, "allow")
            await interaction.response.edit_message(
                content=interaction.message.content + "\n\n✅ **Allowed**",
                view=None,
            )
        else:
            await interaction.response.send_message("Session not found.", ephemeral=True)

    @discord.ui.button(label="Allow All", style=discord.ButtonStyle.primary, emoji="🔓")
    async def allow_all(self, interaction: discord.Interaction, button: discord.ui.Button):
        session = self.manager.get(self.session_id)
        if session:
            self.manager.resolve_permission(session, self.request_id, "allow_always")
            await interaction.response.edit_message(
                content=interaction.message.content + "\n\n🔓 **All permissions bypassed for this session**",
                view=None,
            )
        else:
            await interaction.response.send_message("Session not found.", ephemeral=True)

    @discord.ui.button(label="Deny", style=discord.ButtonStyle.danger, emoji="❌")
    async def deny(self, interaction: discord.Interaction, button: discord.ui.Button):
        session = self.manager.get(self.session_id)
        if session:
            self.manager.resolve_permission(session, self.request_id, "deny", "Denied via Discord")
            await interaction.response.edit_message(
                content=interaction.message.content + "\n\n❌ **Denied**",
                view=None,
            )
        else:
            await interaction.response.send_message("Session not found.", ephemeral=True)

    @discord.ui.button(label="Accept Edits", style=discord.ButtonStyle.secondary, emoji="📝")
    async def accept_edits(self, interaction: discord.Interaction, button: discord.ui.Button):
        session = self.manager.get(self.session_id)
        if session:
            self.manager.resolve_permission(session, self.request_id, "allow_session")
            await interaction.response.edit_message(
                content=interaction.message.content + "\n\n📝 **Accept edits mode for this session**",
                view=None,
            )
        else:
            await interaction.response.send_message("Session not found.", ephemeral=True)


# ===== Bot class =====

class ClaudeCodeBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True  # Required to read messages in channels
        super().__init__(intents=intents)

        self.tree = app_commands.CommandTree(self)
        self.db = None
        self.notifications = None
        self.manager: SessionManager | None = None
        # Channel → project path mapping
        self._channel_projects: dict[int, str] = {}  # channel_id → project_path
        # Thread → session mapping
        self._thread_sessions: dict[int, str] = {}  # thread_id → session_id
        # Category ID for auto-created channels
        self._category_id: int | None = None
        self._setup_commands()

    def _get_project_for_channel(self, channel_id: int) -> str | None:
        """Get the project path linked to a channel (or thread's parent channel)."""
        return self._channel_projects.get(channel_id)

    def _get_session_for_thread(self, thread_id: int) -> str | None:
        """Get the session ID for a thread."""
        return self._thread_sessions.get(thread_id)

    async def _get_or_create_category(self, guild: discord.Guild) -> discord.CategoryChannel:
        """Get or create the 'Claude Code' category."""
        if self._category_id:
            cat = guild.get_channel(self._category_id)
            if cat:
                return cat

        # Find existing
        for cat in guild.categories:
            if cat.name.lower() in ("claude code", "claude-code", "claude code web"):
                self._category_id = cat.id
                return cat

        # Create new
        cat = await guild.create_category("Claude Code", reason="Auto-created for Claude Code Web")
        self._category_id = cat.id
        print(f"[DISCORD] Created category: {cat.name}")
        return cat

    async def _get_or_create_project_channel(self, guild: discord.Guild, project_name: str, project_path: str) -> discord.TextChannel:
        """Get or create a channel for a project under the Claude Code category."""
        # Check if we already have it mapped
        for ch_id, path in self._channel_projects.items():
            if path == project_path:
                ch = guild.get_channel(ch_id)
                if ch:
                    return ch

        category = await self._get_or_create_category(guild)
        channel_name = project_name.lower().replace(" ", "-").replace("_", "-")

        # Find existing channel in category
        for ch in category.channels:
            if isinstance(ch, discord.TextChannel) and ch.name == channel_name:
                self._channel_projects[ch.id] = project_path
                return ch

        # Create new channel
        ch = await guild.create_text_channel(
            channel_name,
            category=category,
            topic=f"Claude Code · {project_path}",
            reason=f"Auto-created for project: {project_name}",
        )
        self._channel_projects[ch.id] = project_path
        print(f"[DISCORD] Created channel: #{channel_name}")

        # Post welcome message
        embed = discord.Embed(
            title=f"📁 {project_name}",
            description=(
                f"**Path:** `{project_path}`\n\n"
                f"Use `/ask <prompt>` to chat with Claude.\n"
                f"Each conversation creates a thread automatically."
            ),
            color=0xD4845A,
        )
        await ch.send(embed=embed)
        return ch

    async def _create_session_thread(self, channel: discord.TextChannel, project_path: str, first_prompt: str) -> tuple:
        """Create a new thread for a Claude session."""
        # Create session in backend
        session = await self.manager.create(project_path)

        # Create thread
        thread_name = truncate(first_prompt, 95)  # Discord thread name limit
        thread = await channel.create_thread(
            name=thread_name,
            type=discord.ChannelType.public_thread,
            reason="New Claude session",
        )
        self._thread_sessions[thread.id] = session.id
        print(f"[DISCORD] Created thread: {thread_name} → session {session.id[:8]}")
        return session, thread

    def _setup_commands(self):
        """Register all slash commands."""

        @self.tree.command(name="status", description="Show all active sessions")
        async def cmd_status(interaction: discord.Interaction):
            sessions = await list_sessions(self.db)
            if not sessions:
                await interaction.response.send_message("No sessions.", ephemeral=True)
                return

            lines = []
            for s in sessions[:15]:
                emoji = STATUS_EMOJI.get(s["status"], "⚪")
                cost = format_cost(s["total_cost_usd"])
                name = session_display_name(s)
                lines.append(f"{emoji} {name} — {cost} · {s['total_turns']} turns")

            embed = discord.Embed(
                title="📊 Sessions",
                description="\n".join(lines),
                color=0xD4845A,
            )
            await interaction.response.send_message(embed=embed)

        @self.tree.command(name="sessions", description="List sessions for a project")
        @app_commands.describe(project="Project name (e.g. my-agent)")
        async def cmd_sessions(interaction: discord.Interaction, project: str = ""):
            sessions = await list_sessions(self.db)
            if project:
                sessions = [s for s in sessions if project.lower() in s["cwd"].lower()]
            if not sessions:
                await interaction.response.send_message(f"No sessions found{f' for {project}' if project else ''}.", ephemeral=True)
                return

            lines = []
            for s in sessions[:20]:
                emoji = STATUS_EMOJI.get(s["status"], "⚪")
                cost = format_cost(s["total_cost_usd"])
                prompt = truncate(s.get("last_prompt") or "New session", 50)
                lines.append(f"{emoji} `{s['id'][:8]}` {prompt} — {cost}")

            embed = discord.Embed(
                title=f"Sessions{f' — {project}' if project else ''}",
                description="\n".join(lines),
                color=0xD4845A,
            )
            await interaction.response.send_message(embed=embed)

        @self.tree.command(name="query", description="Send a prompt to Claude")
        @app_commands.describe(
            project="Project directory name",
            prompt="Your prompt for Claude",
        )
        async def cmd_query(interaction: discord.Interaction, project: str, prompt: str):
            await interaction.response.defer()

            # Find project path
            project_path = os.path.join(DEFAULT_PROJECT_ROOT, project)
            if not os.path.isdir(project_path):
                await interaction.followup.send(f"❌ Project `{project}` not found in `{DEFAULT_PROJECT_ROOT}`")
                return

            # Find or create session
            sessions = await list_sessions(self.db, cwd=project_path)
            if sessions:
                session_row = sessions[0]
                session = self.manager.get(session_row["id"])
                if not session:
                    try:
                        session = await self.manager.restore(session_row["id"])
                    except Exception:
                        session = None
            else:
                session = None

            if not session:
                session = await self.manager.create(project_path)

            await interaction.followup.send(f"🔵 Sending to **{project}**: _{truncate(prompt, 100)}_")
            await self.manager.send_query(session, prompt)

            # Wait for result
            for _ in range(120):  # 2 minute timeout
                await asyncio.sleep(1)
                if session.status == "idle":
                    break
                if session.status == "waiting_permission":
                    # Post permission request
                    for msg in reversed(session.message_log):
                        if msg.get("type") == "permission_request":
                            await self._post_permission(interaction.channel, session, msg)
                            break
                    # Wait for resolution
                    while session.status == "waiting_permission":
                        await asyncio.sleep(1)

            # Post results
            await self._post_session_messages(interaction.channel, session)

        @self.tree.command(name="permissions", description="Change permission mode")
        @app_commands.describe(mode="Permission mode")
        @app_commands.choices(mode=[
            app_commands.Choice(name="Accept Edits", value="acceptEdits"),
            app_commands.Choice(name="Ask Everything", value="default"),
            app_commands.Choice(name="Bypass All", value="bypassPermissions"),
            app_commands.Choice(name="Plan Only", value="plan"),
        ])
        async def cmd_permissions(interaction: discord.Interaction, mode: str, project: str = ""):
            sessions = await list_sessions(self.db)
            if project:
                sessions = [s for s in sessions if project.lower() in s["cwd"].lower()]

            count = 0
            for s in sessions:
                managed = self.manager.get(s["id"])
                if managed:
                    await self.manager.update_config(managed, permission_mode=mode)
                    count += 1
                else:
                    await update_session(self.db, s["id"], permission_mode=mode)
                    count += 1

            mode_labels = {
                "acceptEdits": "Accept Edits",
                "default": "Ask Everything",
                "bypassPermissions": "⚠️ Bypass All",
                "plan": "Plan Only",
            }
            await interaction.response.send_message(
                f"🛡️ Permission mode set to **{mode_labels.get(mode, mode)}** for {count} session(s)."
            )

        @self.tree.command(name="interrupt", description="Stop the current query")
        @app_commands.describe(project="Project name")
        async def cmd_interrupt(interaction: discord.Interaction, project: str = ""):
            sessions = await list_sessions(self.db)
            interrupted = 0
            for s in sessions:
                if project and project.lower() not in s["cwd"].lower():
                    continue
                managed = self.manager.get(s["id"])
                if managed and managed.status in ("thinking", "waiting_permission"):
                    await self.manager.interrupt(managed)
                    interrupted += 1

            if interrupted:
                await interaction.response.send_message(f"⏹️ Interrupted {interrupted} session(s).")
            else:
                await interaction.response.send_message("No active sessions to interrupt.", ephemeral=True)

        @self.tree.command(name="cost", description="Show total cost across all sessions")
        async def cmd_cost(interaction: discord.Interaction):
            sessions = await list_sessions(self.db)
            total = sum(s.get("total_cost_usd", 0) for s in sessions)
            by_project: dict[str, float] = {}
            for s in sessions:
                proj = s["cwd"].split("/")[-1]
                by_project[proj] = by_project.get(proj, 0) + s.get("total_cost_usd", 0)

            lines = [f"**Total: {format_cost(total)}**\n"]
            for proj, cost in sorted(by_project.items(), key=lambda x: -x[1]):
                lines.append(f"📁 {proj}: {format_cost(cost)}")

            embed = discord.Embed(
                title="💰 Cost Summary",
                description="\n".join(lines),
                color=0x10B981,
            )
            await interaction.response.send_message(embed=embed)

        @self.tree.command(name="projects", description="List available projects")
        async def cmd_projects(interaction: discord.Interaction):
            root = DEFAULT_PROJECT_ROOT
            if not os.path.isdir(root):
                await interaction.response.send_message(f"Project root `{root}` not found.", ephemeral=True)
                return

            projects = sorted([
                name for name in os.listdir(root)
                if os.path.isdir(os.path.join(root, name)) and not name.startswith(".")
            ])

            # Show which project this channel is linked to
            current = self._get_project_for_channel(interaction.channel_id)
            current_name = current.split("/")[-1] if current else None

            lines = []
            for name in projects:
                indicator = "→ " if name == current_name else "  "
                path = os.path.join(root, name)
                # Count sessions for this project
                sessions = await list_sessions(self.db, cwd=path)
                active = sum(1 for s in sessions if s["status"] in ("thinking", "waiting_permission"))
                total = len(sessions)
                status = f"🔵 {active} active" if active else f"{total} sessions" if total else "no sessions"
                lines.append(f"{indicator}📁 **{name}** — {status}")

            embed = discord.Embed(
                title="📁 Projects",
                description="\n".join(lines) + f"\n\n_Use `/start <project>` to begin_",
                color=0x5EEAD4,
            )
            if current_name:
                embed.set_footer(text=f"This channel → {current_name}")
            await interaction.response.send_message(embed=embed)

        @self.tree.command(name="init", description="Set up ALL projects — creates channels for each")
        async def cmd_init(interaction: discord.Interaction):
            root = DEFAULT_PROJECT_ROOT
            if not os.path.isdir(root):
                await interaction.response.send_message(f"❌ `{root}` not found.", ephemeral=True)
                return

            await interaction.response.defer()
            try:
                projects = sorted([
                    name for name in os.listdir(root)
                    if os.path.isdir(os.path.join(root, name)) and not name.startswith(".")
                ])

                created = []
                for name in projects:
                    path = os.path.join(root, name)
                    try:
                        ch = await self._get_or_create_project_channel(interaction.guild, name, path)
                        created.append(ch.mention)
                    except Exception as e:
                        print(f"[DISCORD] Failed to create channel for {name}: {e}")
                        created.append(f"❌ {name} (failed)")

                embed = discord.Embed(
                    title="⚡ All projects initialized",
                    description="\n".join(f"📁 {ch}" for ch in created) + "\n\n_Type a message in any channel to start chatting with Claude._",
                    color=0xD4845A,
                )
                await interaction.followup.send(embed=embed)
            except Exception as e:
                print(f"[DISCORD] /init error: {e}")
                import traceback; traceback.print_exc()
                await interaction.followup.send(f"❌ Error: {e}")

        @self.tree.command(name="start", description="Set up a project — creates a channel and links it")
        @app_commands.describe(project="Project directory name")
        async def cmd_start(interaction: discord.Interaction, project: str):
            project_path = os.path.join(DEFAULT_PROJECT_ROOT, project)
            if not os.path.isdir(project_path):
                await interaction.response.send_message(f"❌ Project `{project}` not found in `{DEFAULT_PROJECT_ROOT}`", ephemeral=True)
                return

            await interaction.response.defer()

            # Auto-create project channel
            channel = await self._get_or_create_project_channel(interaction.guild, project, project_path)

            embed = discord.Embed(
                title=f"⚡ Project ready — {project}",
                description=(
                    f"**Channel:** {channel.mention}\n"
                    f"**Path:** `{project_path}`\n\n"
                    f"Go to {channel.mention} and use `/ask <prompt>` to chat with Claude.\n"
                    f"Each conversation creates a new thread."
                ),
                color=0xD4845A,
            )
            await interaction.followup.send(embed=embed)

        @self.tree.command(name="ask", description="Send a prompt to Claude (uses this channel's project)")
        @app_commands.describe(prompt="Your prompt for Claude")
        async def cmd_ask(interaction: discord.Interaction, prompt: str):
            project_path = self._get_project_for_channel(interaction.channel_id)
            session_id = self._get_session_for_channel(interaction.channel_id)

            if not project_path:
                await interaction.response.send_message(
                    "❌ No project linked to this channel. Use `/start <project>` first.",
                    ephemeral=True,
                )
                return

            await interaction.response.defer()
            project = project_path.split("/")[-1]

            # Get or restore session
            session = None
            if session_id:
                session = self.manager.get(session_id)
                if not session:
                    try:
                        session = await self.manager.restore(session_id)
                    except Exception:
                        session = None

            if not session:
                # Find most recent session for this project
                sessions = await list_sessions(self.db, cwd=project_path)
                if sessions:
                    try:
                        session = await self.manager.restore(sessions[0]["id"])
                    except Exception:
                        session = None

            if not session:
                session = await self.manager.create(project_path)

            self._channel_sessions[interaction.channel_id] = session.id

            # Show user prompt
            await interaction.followup.send(f"**You:** {truncate(prompt, 500)}")

            # Send query
            prev_count = len(session.message_log)
            await self.manager.send_query(session, prompt)

            # Wait for result
            for _ in range(180):  # 3 minute timeout
                await asyncio.sleep(1)
                if session.status == "idle" and len(session.message_log) > prev_count:
                    break
                if session.status == "waiting_permission":
                    for msg in reversed(session.message_log):
                        if msg.get("type") == "permission_request":
                            await self._post_permission(interaction.channel, session, msg)
                            break
                    while session.status == "waiting_permission":
                        await asyncio.sleep(1)

            # Post Claude's response
            await self._post_session_messages(interaction.channel, session, after=prev_count)

        @self.tree.command(name="switch", description="Switch this channel to a different project")
        @app_commands.describe(project="Project directory name")
        async def cmd_switch(interaction: discord.Interaction, project: str):
            project_path = os.path.join(DEFAULT_PROJECT_ROOT, project)
            if not os.path.isdir(project_path):
                await interaction.response.send_message(f"❌ Project `{project}` not found.", ephemeral=True)
                return

            self._channel_projects[interaction.channel_id] = project_path

            # Find existing session
            sessions = await list_sessions(self.db, cwd=project_path)
            if sessions:
                self._channel_sessions[interaction.channel_id] = sessions[0]["id"]
                prompt_preview = truncate(sessions[0].get("last_prompt") or "Session", 60)
                await interaction.response.send_message(
                    f"📁 Switched to **{project}** — resumed session: _{prompt_preview}_"
                )
            else:
                self._channel_sessions.pop(interaction.channel_id, None)
                await interaction.response.send_message(
                    f"📁 Switched to **{project}** — no existing sessions. Use `/ask` to start."
                )

        @self.tree.command(name="whoami", description="Show which project this channel is linked to")
        async def cmd_whoami(interaction: discord.Interaction):
            project_path = self._get_project_for_channel(interaction.channel_id)
            session_id = self._get_session_for_channel(interaction.channel_id)

            if not project_path:
                await interaction.response.send_message(
                    "This channel is not linked to any project.\nUse `/start <project>` or `/switch <project>`.",
                    ephemeral=True,
                )
                return

            project = project_path.split("/")[-1]
            session = self.manager.get(session_id) if session_id else None

            embed = discord.Embed(
                title=f"📁 {project}",
                color=0xD4845A,
            )
            embed.add_field(name="Path", value=f"`{project_path}`", inline=False)
            if session:
                emoji = STATUS_EMOJI.get(session.status, "⚪")
                embed.add_field(name="Session", value=f"{emoji} `{session.id[:8]}` — {session.status}", inline=True)
                embed.add_field(name="Cost", value=format_cost(session.total_cost), inline=True)
                embed.add_field(name="Mode", value=session.permission_mode, inline=True)
            else:
                embed.add_field(name="Session", value="None active", inline=False)

            await interaction.response.send_message(embed=embed)

    async def _post_permission(self, channel, session, perm_msg: dict):
        """Post a permission request with buttons."""
        tool_name = perm_msg.get("tool_name", "Unknown")
        tool_input = perm_msg.get("tool_input", {})
        request_id = perm_msg.get("request_id", "")
        project = session.cwd.split("/")[-1]

        summary = tool_summary(tool_name, tool_input)

        embed = discord.Embed(
            title=f"🔔 Claude wants to use {tool_name}",
            description=f"**Project:** {project}\n\n{summary}",
            color=0xF59E0B,
        )

        view = PermissionView(self.manager, session.id, request_id)
        await channel.send(embed=embed, view=view)

    async def _post_session_messages(self, channel, session, after: int = -10):
        """Post recent assistant messages as embeds."""
        recent = session.message_log[after:] if after >= 0 else session.message_log[after:]
        text_parts = []
        tool_parts = []

        for msg in recent:
            if msg.get("type") == "assistant":
                for block in msg.get("content", []):
                    if block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                    elif block.get("type") == "tool_use":
                        name = block.get("name", "")
                        tool_parts.append(f"🔧 {name}: {tool_summary(name, block.get('input', {}))}")
                    elif block.get("type") == "tool_result":
                        content = block.get("content", "")
                        if content:
                            tool_parts.append(f"```\n{truncate(content, 500)}\n```")
            elif msg.get("type") == "result":
                cost = format_cost(msg.get("total_cost_usd", 0))
                turns = msg.get("num_turns", 0)
                text_parts.append(f"\n_{cost} · {turns} turns_")

        full_text = "\n\n".join(text_parts) if text_parts else "No text response."
        if tool_parts:
            full_text = "\n".join(tool_parts) + "\n\n" + full_text

        # Split into 2000-char chunks (Discord limit)
        chunks = textwrap.wrap(full_text, 1900, break_long_words=False, break_on_hyphens=False)
        if not chunks:
            chunks = [full_text[:1900]]

        for i, chunk in enumerate(chunks[:5]):  # Max 5 messages
            embed = discord.Embed(
                description=chunk,
                color=0xD4845A,
            )
            if i == 0:
                project = session.cwd.split("/")[-1]
                embed.set_author(name=f"Claude · {project}")
            await channel.send(embed=embed)

    async def setup_hook(self):
        """Called when bot starts — init DB, session manager, sync commands."""
        self.db = await init_db()
        self.notifications = NotificationManager(self.db)
        await self.notifications.init()
        self.manager = SessionManager(self.db, self.notifications)
        await self.manager.restore_active_sessions()

        # Sync commands to guild (instant) or global (takes ~1 hour)
        if DISCORD_GUILD_ID:
            guild = discord.Object(id=int(DISCORD_GUILD_ID))
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            print(f"[DISCORD] Synced commands to guild {DISCORD_GUILD_ID}")
        else:
            await self.tree.sync()
            print("[DISCORD] Synced commands globally")

        print("[DISCORD] Bot ready!")

    async def on_ready(self):
        print(f"[DISCORD] Logged in as {self.user}")

    async def on_message(self, message: discord.Message):
        """Handle natural chat — no /ask needed."""
        # Ignore bot's own messages
        if message.author == self.user:
            return
        # Ignore slash commands
        if message.content.startswith("/"):
            return
        # Ignore empty messages
        if not message.content.strip():
            return

        channel = message.channel
        print(f"[DISCORD] Message in {channel} ({type(channel).__name__}): {message.content[:60]}")

        try:
            await self._handle_message(message, channel)
        except Exception as e:
            print(f"[DISCORD] on_message error: {e}")
            import traceback; traceback.print_exc()
            try:
                await channel.send(f"❌ Error: {e}")
            except Exception:
                pass

    async def _handle_message(self, message: discord.Message, channel):
        """Process a user message — create thread or continue session."""
        # Case 1: Message in a THREAD → continue that session
        if isinstance(channel, discord.Thread):
            session_id = self._thread_sessions.get(channel.id)
            parent_id = channel.parent_id
            project_path = self._channel_projects.get(parent_id) if parent_id else None

            if not session_id or not project_path:
                return  # Not a Claude thread

            session = self.manager.get(session_id)
            if not session:
                try:
                    session = await self.manager.restore(session_id)
                except Exception:
                    await channel.send("❌ Session expired. Start a new conversation in the project channel.")
                    return

            # Send prompt
            async with channel.typing():
                prev_count = len(session.message_log)
                await self.manager.send_query(session, message.content)

                # Wait for result
                for _ in range(180):
                    await asyncio.sleep(1)
                    if session.status == "idle" and len(session.message_log) > prev_count:
                        break
                    if session.status == "waiting_permission":
                        for msg in reversed(session.message_log):
                            if msg.get("type") == "permission_request":
                                await self._post_permission(channel, session, msg)
                                break
                        while session.status == "waiting_permission":
                            await asyncio.sleep(1)

                await self._post_session_messages(channel, session, after=prev_count)
            return

        # Case 2: Message in a PROJECT CHANNEL → create new thread/session
        if isinstance(channel, discord.TextChannel):
            project_path = self._channel_projects.get(channel.id)
            if not project_path:
                return  # Not a project channel

            # Create thread + session
            session, thread = await self._create_session_thread(channel, project_path, message.content)

            # Move the conversation to the thread
            async with thread.typing():
                prev_count = len(session.message_log)
                await self.manager.send_query(session, message.content)

                for _ in range(180):
                    await asyncio.sleep(1)
                    if session.status == "idle" and len(session.message_log) > prev_count:
                        break
                    if session.status == "waiting_permission":
                        for msg in reversed(session.message_log):
                            if msg.get("type") == "permission_request":
                                await self._post_permission(thread, session, msg)
                                break
                        while session.status == "waiting_permission":
                            await asyncio.sleep(1)

                await self._post_session_messages(thread, session, after=prev_count)

    async def close(self):
        if self.db:
            await close_db(self.db)
        await super().close()


def run_bot():
    if not DISCORD_BOT_TOKEN:
        print("[DISCORD] No DISCORD_BOT_TOKEN set. Skipping bot startup.")
        return

    bot = ClaudeCodeBot()
    bot.run(DISCORD_BOT_TOKEN, log_handler=None)


if __name__ == "__main__":
    run_bot()
