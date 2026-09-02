import ast
import os
import subprocess
import tempfile
from typing import Dict, List


class CodeValidator:
    def __init__(self):
        self.validators = {
            'javascript': self._validate_javascript,
            'python': self._validate_python,
        }

    async def validate(self, code: str, language: str, tests: List[str]) -> Dict:
        """Valide le code utilisateur avec une liste de tests."""
        validator = self.validators.get(language)
        if not validator:
            return {
                'success': False,
                'error': f'Language "{language}" non supporté',
                'results': [],
                'passed_count': 0,
                'total_count': len(tests),
            }
        return await validator(code, tests)

    # ──────────────────────────────────────────────────────────────────────────
    # JavaScript
    # ──────────────────────────────────────────────────────────────────────────

    async def _validate_javascript(self, code: str, tests: List[str]) -> Dict:
        """Valide du code JavaScript dans un sandbox Node.js."""
        results = []

        for test in tests:
            exec_result = await self._run_javascript(code, test)
            results.append({
                'test': test,
                'passed': exec_result['passed'],
                'output': exec_result.get('output', ''),
                'error': exec_result.get('error', ''),
            })

        passed_count = sum(1 for r in results if r['passed'])
        return {
            'success': passed_count == len(results),
            'results': results,
            'passed_count': passed_count,
            'total_count': len(results),
        }

    async def _run_javascript(self, code: str, test: str) -> Dict:
        """Exécute du code JavaScript + un test dans un processus Node.js isolé."""
        js_source = f"""{code}

;(function() {{
  try {{
    var __result__ = Boolean({test});
    if (__result__) {{
      process.stdout.write('TEST_PASSED: true\\n');
    }} else {{
      process.stdout.write('TEST_FAILED: assertion returned false\\n');
    }}
  }} catch(e) {{
    process.stderr.write('TEST_FAILED: ' + e.message + '\\n');
  }}
}})();
"""
        tmp = tempfile.NamedTemporaryFile(
            mode='w', suffix='.js', delete=False, encoding='utf-8'
        )
        try:
            tmp.write(js_source)
            tmp.close()

            proc = subprocess.run(
                ['node', tmp.name],
                capture_output=True,
                text=True,
                timeout=5,
            )
            stdout = proc.stdout
            stderr = proc.stderr

            if 'TEST_PASSED: true' in stdout:
                return {'passed': True, 'output': stdout}
            else:
                error_msg = stderr.strip() or stdout.strip()
                return {'passed': False, 'output': stdout, 'error': error_msg}

        except subprocess.TimeoutExpired:
            return {'passed': False, 'error': 'Timeout: le code a mis trop de temps à s\'exécuter'}
        except FileNotFoundError:
            return {'passed': False, 'error': 'Node.js non disponible sur ce serveur'}
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    # ──────────────────────────────────────────────────────────────────────────
    # Python
    # ──────────────────────────────────────────────────────────────────────────

    async def _validate_python(self, code: str, tests: List[str]) -> Dict:
        """Valide du code Python dans un sous-processus isolé."""
        results = []

        for test in tests:
            exec_result = await self._run_python(code, test)
            results.append({
                'test': test,
                'passed': exec_result['passed'],
                'output': exec_result.get('output', ''),
                'error': exec_result.get('error', ''),
            })

        passed_count = sum(1 for r in results if r['passed'])
        return {
            'success': passed_count == len(results),
            'results': results,
            'passed_count': passed_count,
            'total_count': len(results),
        }

    async def _run_python(self, code: str, test: str) -> Dict:
        """Exécute du code Python + un test dans un sous-processus."""
        py_source = f"""{code}

import sys
try:
    __result__ = bool({test})
    if __result__:
        sys.stdout.write('TEST_PASSED: true\\n')
    else:
        sys.stdout.write('TEST_FAILED: assertion returned False\\n')
except Exception as e:
    sys.stderr.write('TEST_FAILED: ' + str(e) + '\\n')
"""
        tmp = tempfile.NamedTemporaryFile(
            mode='w', suffix='.py', delete=False, encoding='utf-8'
        )
        try:
            tmp.write(py_source)
            tmp.close()

            proc = subprocess.run(
                ['python3', tmp.name],
                capture_output=True,
                text=True,
                timeout=5,
            )
            stdout = proc.stdout
            stderr = proc.stderr

            if 'TEST_PASSED: true' in stdout:
                return {'passed': True, 'output': stdout}
            else:
                error_msg = stderr.strip() or stdout.strip()
                return {'passed': False, 'output': stdout, 'error': error_msg}

        except subprocess.TimeoutExpired:
            return {'passed': False, 'error': 'Timeout: le code a mis trop de temps à s\'exécuter'}
        finally:
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    # ──────────────────────────────────────────────────────────────────────────
    # Syntaxe uniquement (sans exécution)
    # ──────────────────────────────────────────────────────────────────────────

    def check_syntax_python(self, code: str) -> Dict:
        """Vérifie la syntaxe Python sans l'exécuter."""
        try:
            ast.parse(code)
            return {'valid': True}
        except SyntaxError as e:
            return {
                'valid': False,
                'error': str(e),
                'line': e.lineno,
            }
