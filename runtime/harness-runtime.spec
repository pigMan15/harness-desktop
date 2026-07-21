# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for Harness Desktop Runtime
# Build: py -3 -m PyInstaller runtime/harness-runtime.spec --clean --noconfirm
# Output: dist/harness-runtime.exe (single-file, ~15-20MB)

import sys
from pathlib import Path

# Ensure the runtime package is importable
_runtime_src = Path('src').resolve()
sys.path.insert(0, str(_runtime_src))

a = Analysis(
    ['launcher.py'],
    pathex=['src'],
    binaries=[],
    datas=[
        ('../schemas/state.schema.json', 'schemas'),
        ('../schemas/rpc.schema.json', 'schemas'),
        ('../fixtures/harness-v1', 'fixtures/harness-v1'),
    ],
    hiddenimports=[
        'harness_runtime',
        'harness_runtime.main',
        'harness_runtime.api',
        'harness_runtime.api.app',
        'harness_runtime.api.auth',
        'harness_runtime.api.idempotency',
        'harness_runtime.contracts',
        'harness_runtime.contracts.models',
        'harness_runtime.protocol',
        'harness_runtime.protocol.models',
        'harness_runtime.protocol.loader',
        'harness_runtime.protocol.validator',
        'harness_runtime.persistence',
        'harness_runtime.persistence.database',
        'harness_runtime.persistence.atomic_files',
        'harness_runtime.persistence.project_lock',
        'harness_runtime.persistence.state_store',
        'harness_runtime.persistence.audit',
        'harness_runtime.projects',
        'harness_runtime.projects.service',
        'harness_runtime.workflow',
        'harness_runtime.workflow.compiler',
        'harness_runtime.workflow.system_policy',
        'harness_runtime.workflow.dispatcher',
        'harness_runtime.workflow.drafts',
        'harness_runtime.workflow.versioning',
        'harness_runtime.workflow.zip_io',
        'harness_runtime.runs',
        'harness_runtime.runs.service',
        'harness_runtime.runs.identifiers',
        'harness_runtime.gates',
        'harness_runtime.gates.engine',
        'harness_runtime.gates.permissions',
        'harness_runtime.artifacts',
        'harness_runtime.artifacts.service',
        'harness_runtime.executors',
        'harness_runtime.executors.base',
        'harness_runtime.executors.fake',
        'harness_runtime.executors.codex',
        'harness_runtime.executors.codex.adapter',
        'harness_runtime.executors.codex.events',
        'harness_runtime.executors.codex.process',
        'harness_runtime.approvals',
        'harness_runtime.approvals.policy',
        'harness_runtime.recovery',
        'harness_runtime.recovery.service',
        'harness_runtime.knowledge',
        'harness_runtime.knowledge.service',
        'fastapi',
        'uvicorn',
        'uvicorn.loops',
        'uvicorn.protocols',
        'pydantic',
        'yaml',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='harness-runtime',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
