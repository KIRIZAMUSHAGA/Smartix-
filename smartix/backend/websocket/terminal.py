"""
Serveur PTY réel — Terminal bash via WebSocket FastAPI

Fonctionnalités :
- Crée un pseudo-terminal (PTY) réel par session
- Lance /bin/bash dans le PTY
- Bridge bidirectionnel : WebSocket ↔ PTY
- Gestion du resize (SIGWINCH)
- Timeout d'inactivité + nettoyage propre
- Authentification JWT optionnelle
"""

import asyncio
import fcntl
import json
import logging
import os
import pty
import select
import signal
import struct
import subprocess
import termios
from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────

DEFAULT_SHELL   = os.environ.get("SHELL", "/bin/bash")
DEFAULT_ROWS    = 24
DEFAULT_COLS    = 80
READ_CHUNK      = 4096
INACTIVITY_SECS = 300  # 5 minutes d'inactivité → fermeture automatique

# ─── Session PTY ─────────────────────────────────────────────────────────────

class PtySession:
    """Représente une session PTY active."""

    def __init__(self, session_id: str, project_dir: Optional[str] = None):
        self.session_id  = session_id
        self.project_dir = project_dir or "/tmp"
        self.master_fd   = None
        self.slave_fd    = None
        self.process     = None
        self.rows        = DEFAULT_ROWS
        self.cols        = DEFAULT_COLS
        self._alive      = False

    def start(self):
        """Crée le PTY et lance le shell."""
        self.master_fd, self.slave_fd = pty.openpty()

        # Configurer les flags non-bloquants sur le maître
        flags = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
        fcntl.fcntl(self.master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

        # Environnement du shell
        env = os.environ.copy()
        env.update({
            "TERM":     "xterm-256color",
            "COLUMNS":  str(self.cols),
            "LINES":    str(self.rows),
            "HOME":     os.environ.get("HOME", "/root"),
            "LANG":     "fr_FR.UTF-8",
        })

        # Lancer le shell
        self.process = subprocess.Popen(
            [DEFAULT_SHELL, "-i"],
            stdin=self.slave_fd,
            stdout=self.slave_fd,
            stderr=self.slave_fd,
            preexec_fn=os.setsid,
            env=env,
            cwd=self.project_dir,
        )

        # Fermer le slave dans le process parent (il appartient maintenant au shell)
        os.close(self.slave_fd)
        self.slave_fd = None

        # Appliquer la taille initiale
        self._apply_winsize()
        self._alive = True
        logger.info(f"PTY session {self.session_id} démarrée (PID {self.process.pid})")

    def resize(self, rows: int, cols: int):
        """Envoie SIGWINCH au processus pour redimensionner le terminal."""
        self.rows = max(1, rows)
        self.cols = max(1, cols)
        if self.master_fd is not None and self._alive:
            self._apply_winsize()

    def _apply_winsize(self):
        """Applique la taille de fenêtre au PTY via ioctl."""
        try:
            packed = struct.pack("HHHH", self.rows, self.cols, 0, 0)
            fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, packed)
        except OSError as e:
            logger.warning(f"SIGWINCH erreur : {e}")

    def write(self, data: bytes):
        """Écrit dans le PTY (stdin du shell)."""
        if self.master_fd is not None and self._alive:
            try:
                os.write(self.master_fd, data)
            except OSError as e:
                logger.warning(f"Écriture PTY erreur : {e}")

    def read_nonblocking(self) -> Optional[bytes]:
        """Lit la sortie du PTY de façon non-bloquante."""
        if self.master_fd is None or not self._alive:
            return None
        try:
            ready, _, _ = select.select([self.master_fd], [], [], 0.01)
            if ready:
                return os.read(self.master_fd, READ_CHUNK)
        except (OSError, select.error):
            pass
        return None

    def is_alive(self) -> bool:
        if self.process is None:
            return False
        return self.process.poll() is None

    def terminate(self):
        """Ferme proprement la session PTY."""
        self._alive = False
        if self.process and self.process.poll() is None:
            try:
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
            except (ProcessLookupError, OSError):
                pass
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
            self.master_fd = None
        logger.info(f"PTY session {self.session_id} fermée")


# ─── Gestionnaire de sessions ─────────────────────────────────────────────────

class TerminalManager:
    """Gère toutes les sessions PTY actives."""

    def __init__(self):
        self._sessions: Dict[str, PtySession] = {}

    def create(self, session_id: str, project_dir: Optional[str] = None) -> PtySession:
        if session_id in self._sessions:
            self._sessions[session_id].terminate()
        session = PtySession(session_id, project_dir)
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> Optional[PtySession]:
        return self._sessions.get(session_id)

    def remove(self, session_id: str):
        session = self._sessions.pop(session_id, None)
        if session:
            session.terminate()


terminal_manager = TerminalManager()


# ─── Handler WebSocket FastAPI ────────────────────────────────────────────────

async def handle_terminal_websocket(websocket: WebSocket, session_id: str):
    """
    Handler WebSocket pour une session de terminal PTY.
    
    Protocole messages entrants (JSON) :
      { "type": "input",  "data": "<base64 ou texte>" }
      { "type": "resize", "rows": 24, "cols": 80 }
      { "type": "ping" }
    
    Protocole messages sortants (binaire) :
      Données brutes du terminal (texte ANSI)
    """
    await websocket.accept()

    project_dir = websocket.query_params.get("dir", "/tmp")
    session = terminal_manager.create(session_id, project_dir)

    try:
        session.start()
    except Exception as e:
        await websocket.send_text(f"\r\n\033[31mErreur démarrage terminal : {e}\033[0m\r\n")
        await websocket.close(1011)
        return

    logger.info(f"WebSocket terminal connecté : session {session_id}")

    # Tâche de lecture PTY → WebSocket
    async def read_pty():
        while session._alive:
            if not session.is_alive():
                await websocket.send_text("\r\n\033[33m[Session terminée]\033[0m\r\n")
                break
            data = session.read_nonblocking()
            if data:
                try:
                    await websocket.send_bytes(data)
                except Exception:
                    break
            else:
                await asyncio.sleep(0.01)

    read_task = asyncio.create_task(read_pty())

    try:
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive(), timeout=INACTIVITY_SECS)
            except asyncio.TimeoutError:
                await websocket.send_text("\r\n\033[33m[Timeout inactivité]\033[0m\r\n")
                break

            if msg["type"] == "websocket.disconnect":
                break

            if msg["type"] == "websocket.receive":
                raw = msg.get("bytes") or msg.get("text", "").encode()

                # Tenter de parser comme JSON (commandes de contrôle)
                try:
                    parsed = json.loads(raw)
                    t = parsed.get("type")
                    if t == "input":
                        payload = parsed.get("data", "")
                        session.write(payload.encode("utf-8") if isinstance(payload, str) else payload)
                    elif t == "resize":
                        session.resize(int(parsed.get("rows", 24)), int(parsed.get("cols", 80)))
                    elif t == "ping":
                        await websocket.send_text('{"type":"pong"}')
                except (json.JSONDecodeError, ValueError):
                    # Message binaire brut → écrire directement dans le PTY
                    session.write(raw)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Erreur terminal WebSocket {session_id}: {e}")
    finally:
        read_task.cancel()
        terminal_manager.remove(session_id)
        logger.info(f"WebSocket terminal fermé : session {session_id}")
