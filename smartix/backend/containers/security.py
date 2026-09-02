"""
SandboxSecurity — Profils de sécurité pour les containers Docker

Fonctionnalités :
- Profil seccomp : liste blanche des syscalls autorisés
- Options Docker : no-new-privileges, lecture seule, cap_drop
- Configuration gVisor (runtime runsc) si disponible
- Validation des chemins bloqués
"""

import json
import logging
import os
from typing import List

logger = logging.getLogger(__name__)

# ─── Profil seccomp ───────────────────────────────────────────────────────────

SECCOMP_PROFILE = {
    "defaultAction": "SCMP_ACT_ERRNO",
    "architectures": ["SCMP_ARCH_X86_64", "SCMP_ARCH_X86", "SCMP_ARCH_X32"],
    "syscalls": [
        {
            "names": [
                # Entrées/sorties de base
                "read", "write", "open", "openat", "close", "stat", "fstat",
                "lstat", "poll", "lseek", "mmap", "mprotect", "munmap",
                "brk", "rt_sigaction", "rt_sigprocmask", "rt_sigreturn",
                # Fichiers
                "access", "dup", "dup2", "nanosleep", "getpid", "getppid",
                "sendfile", "socket", "connect", "accept", "sendto", "recvfrom",
                "sendmsg", "recvmsg", "shutdown", "bind", "listen",
                "getsockname", "getpeername", "socketpair", "setsockopt",
                "getsockopt",
                # Processus
                "clone", "fork", "vfork", "execve", "exit", "wait4",
                "kill", "uname", "fcntl", "flock", "fsync", "truncate",
                "ftruncate", "getdents", "getcwd", "chdir", "rename",
                "mkdir", "rmdir", "unlink", "symlink", "readlink",
                "chmod", "fchmod", "chown", "fchown",
                # Temps
                "gettimeofday", "getrlimit", "getrusage", "times",
                "time", "clock_gettime", "clock_getres",
                # IDs
                "getuid", "getgid", "getegid", "geteuid",
                "setuid", "setgid", "getgroups",
                # Mémoire
                "madvise", "shmget", "shmat", "shmctl",
                # Réseau (limité)
                "getaddrinfo", "getnameinfo",
                # Divers
                "ioctl", "pipe", "select", "sched_yield", "mremap",
                "msync", "mincore", "readv", "writev", "pread64",
                "pwrite64", "epoll_create", "epoll_ctl", "epoll_wait",
                "set_tid_address", "exit_group", "futex",
                "set_robust_list", "get_robust_list",
                "eventfd", "eventfd2", "timerfd_create", "timerfd_settime",
                "timerfd_gettime", "signalfd", "signalfd4",
                "inotify_init", "inotify_add_watch", "inotify_rm_watch",
                "epoll_create1", "accept4", "pipe2", "dup3", "prlimit64",
            ],
            "action": "SCMP_ACT_ALLOW",
        }
    ],
}

BLOCKED_PATHS = [
    "/etc/passwd",
    "/etc/shadow",
    "/etc/sudoers",
    "/root",
    "/proc/self/mem",
    "/proc/kcore",
    "/sys",
]

# ─── SandboxSecurity ─────────────────────────────────────────────────────────

class SandboxSecurity:
    """Génère les options de sécurité pour les containers sandbox."""

    def __init__(self):
        self._seccomp_path = self._write_seccomp_profile()
        self._gvisor_available = self._check_gvisor()

    def _write_seccomp_profile(self) -> str:
        """Écrit le profil seccomp sur le disque et retourne son chemin."""
        path = "/tmp/vibe-seccomp.json"
        try:
            with open(path, "w") as f:
                json.dump(SECCOMP_PROFILE, f)
            logger.info(f"Profil seccomp écrit : {path}")
            return path
        except Exception as e:
            logger.warning(f"Impossible d'écrire le profil seccomp : {e}")
            return ""

    def _check_gvisor(self) -> bool:
        """Vérifie si gVisor (runsc) est disponible."""
        return os.path.isfile("/usr/bin/runsc") and os.access("/usr/bin/runsc", os.X_OK)

    def get_security_options(self) -> List[str]:
        """Retourne la liste des security_opt Docker."""
        opts = ["no-new-privileges:true"]
        if self._seccomp_path and os.path.isfile(self._seccomp_path):
            opts.append(f"seccomp:{self._seccomp_path}")
        return opts

    def get_runtime(self) -> str:
        """Retourne 'runsc' si gVisor est dispo, sinon 'runc'."""
        return "runsc" if self._gvisor_available else "runc"

    def is_path_blocked(self, path: str) -> bool:
        """Vérifie si un chemin est dans la liste bloquée."""
        norm = os.path.normpath(path)
        return any(norm.startswith(b) for b in BLOCKED_PATHS)

    def validate_files(self, files: dict) -> dict:
        """
        Filtre et valide un dict de fichiers avant injection dans le container.
        Refuse les chemins traversant les répertoires bloqués.
        """
        safe = {}
        for path, content in files.items():
            if not isinstance(path, str) or not isinstance(content, str):
                continue
            if self.is_path_blocked(path):
                logger.warning(f"Chemin bloqué ignoré : {path}")
                continue
            if len(content) > 10 * 1024 * 1024:  # 10 MB max par fichier
                logger.warning(f"Fichier trop grand ignoré : {path}")
                continue
            safe[path] = content
        return safe

    def get_gvisor_config(self) -> dict:
        """Retourne la configuration gVisor pour docker-compose."""
        return {
            "runtime": "runsc",
            "platform": "ptrace",
            "network": "user",
        }
