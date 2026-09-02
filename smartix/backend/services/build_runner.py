"""
BuildRunner - Service de build réel via subprocess Node.js
Remplace _simulate_build par une exécution réelle.

Contraintes :
- Timeout : 30 secondes par phase
- Taille max projet : 5 MB
- Isolation : tempfile.TemporaryDirectory (nettoyage automatique)
- Projets HTML statiques : bundling direct, sans npm
"""

import os
import asyncio
import tempfile
import json
import shutil
from pathlib import Path

NODE_BIN_DIR = "/nix/store/1lagpgadaybvs1n2312gysg2phjk89y8-nodejs-20.20.0-wrapped/bin"
NPM  = os.path.join(NODE_BIN_DIR, "npm")
NODE = os.path.join(NODE_BIN_DIR, "node")

MAX_PROJECT_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
INSTALL_TIMEOUT = 30
BUILD_TIMEOUT   = 30

STATIC_TYPES = {"html", "static"}
BUILDABLE_TYPES = {"react", "vue", "angular", "next", "gatsby", "node"}


class BuildError(Exception):
    pass


class BuildRunner:
    """
    Exécute un vrai build Node.js dans un répertoire temporaire isolé.
    Supporte : html (statique), react, vue, node.
    """

    async def run_build(
        self,
        project_files: dict,
        project_id: str,
        project_type: str = "react"
    ) -> dict:
        """
        Point d'entrée principal.

        Args:
            project_files : dict {chemin_relatif: contenu_string}
            project_id    : ID du projet (utilisé pour nommer le répertoire temp)
            project_type  : type de projet (html, react, vue, node, …)

        Returns:
            dict { success, type, logs, message, error? }
        """
        total_size = sum(len(str(v)) for v in project_files.values())
        if total_size > MAX_PROJECT_SIZE_BYTES:
            return {
                "success": False,
                "error": (
                    f"Taille totale ({total_size:,} bytes) dépasse la limite "
                    f"de {MAX_PROJECT_SIZE_BYTES:,} bytes (5 MB)"
                ),
                "logs": []
            }

        if project_type in STATIC_TYPES:
            return self._bundle_static(project_files)

        if not os.path.exists(NPM):
            return {
                "success": False,
                "error": f"npm introuvable à {NPM}",
                "logs": []
            }

        with tempfile.TemporaryDirectory(prefix=f"vc_{project_id[:8]}_") as tmpdir:
            try:
                self._write_files(tmpdir, project_files)
                return await self._run_npm_build(tmpdir, project_type)
            except Exception as e:
                return {"success": False, "error": str(e), "logs": []}

    def _write_files(self, tmpdir: str, files: dict):
        """Écrit tous les fichiers du projet dans le répertoire temporaire."""
        for rel_path, content in files.items():
            abs_path = os.path.join(tmpdir, rel_path)
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, "w", encoding="utf-8", errors="replace") as f:
                f.write(str(content))

    def _bundle_static(self, files: dict) -> dict:
        """
        Projets HTML/CSS statiques : pas de build nécessaire.
        Retourne directement la liste des fichiers.
        """
        return {
            "success": True,
            "type": "static",
            "files": list(files.keys()),
            "logs": ["Projet statique — aucun build requis"],
            "message": f"{len(files)} fichier(s) prêts à être servis directement"
        }

    async def _run_npm_build(self, tmpdir: str, project_type: str) -> dict:
        """
        Exécute npm install puis npm run build dans tmpdir.
        Retourne le résultat avec logs et code de retour.
        """
        logs = []

        pkg_json = os.path.join(tmpdir, "package.json")
        if not os.path.exists(pkg_json):
            return {
                "success": False,
                "error": "package.json absent — build impossible sans déclaration de dépendances",
                "logs": logs
            }

        env = {
            **os.environ,
            "NODE_ENV": "production",
            "CI": "false",
            "PATH": f"{NODE_BIN_DIR}:{os.environ.get('PATH', '')}",
        }

        install_ok, install_out, install_err = await self._exec(
            [NPM, "install", "--prefer-offline", "--no-audit", "--loglevel=error"],
            cwd=tmpdir,
            timeout=INSTALL_TIMEOUT,
            env=env
        )
        if install_out:
            logs.append(f"[npm install] {install_out[:800]}")
        if not install_ok:
            return {
                "success": False,
                "error": f"npm install échoué : {install_err[:1000]}",
                "logs": logs
            }
        logs.append("✅ npm install terminé")

        build_cmd = ["run", "build"] if project_type != "node" else ["run", "start", "--", "--dry-run"]
        build_ok, build_out, build_err = await self._exec(
            [NPM] + build_cmd,
            cwd=tmpdir,
            timeout=BUILD_TIMEOUT,
            env=env
        )
        if build_out:
            logs.append(f"[build] {build_out[:800]}")

        if not build_ok:
            return {
                "success": False,
                "error": f"build échoué : {build_err[:1000]}",
                "logs": logs
            }

        build_dir = self._find_build_output(tmpdir)
        logs.append("✅ Build terminé")
        return {
            "success": True,
            "type": project_type,
            "logs": logs,
            "outputDir": build_dir,
            "message": "Build réel réussi via npm"
        }

    async def _exec(
        self,
        cmd: list,
        cwd: str,
        timeout: int,
        env: dict
    ):
        """Lance un subprocess async et retourne (ok, stdout, stderr)."""
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
                ok = proc.returncode == 0
                return ok, stdout_b.decode("utf-8", errors="replace"), stderr_b.decode("utf-8", errors="replace")
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                return False, "", f"Timeout dépassé ({timeout}s)"
        except Exception as e:
            return False, "", str(e)

    def _find_build_output(self, tmpdir: str) -> str:
        """Cherche le répertoire de sortie standard (dist, build, out)."""
        for candidate in ("dist", "build", "out", ".next"):
            full = os.path.join(tmpdir, candidate)
            if os.path.isdir(full):
                return candidate
        return "unknown"


build_runner = BuildRunner()
