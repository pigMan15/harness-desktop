# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for Harness Desktop Runtime
# Build: py -3 -m PyInstaller runtime/harness-runtime.spec --clean --noconfirm
# Output: dist/harness-runtime.exe (~10-15MB single-file)

a = Analysis(
    ['src/harness_runtime/main.py'],
    pathex=['runtime'],
    binaries=[],
    datas=[
        ('../schemas/state.schema.json', 'schemas'),
        ('../schemas/rpc.schema.json', 'schemas'),
        ('../fixtures/harness-v1', 'fixtures/harness-v1'),
    ],
    hiddenimports=[
        'fastapi',
        'uvicorn',
        'pydantic',
        'yaml',
        'harness_runtime.protocol.models',
        'harness_runtime.protocol.loader',
        'harness_runtime.protocol.validator',
        'harness_runtime.api.app',
        'harness_runtime.api.auth',
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
