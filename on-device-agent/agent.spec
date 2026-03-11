# On-Device Agent - 실행파일(.exe) 빌드 설정
# PyInstaller 사용

# === 빌드 스크립트 실행 ===
# python build_exe.py

spec_file = """
# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=[
        # 모델 파일 (있는 경우)
        # ('models/*.onnx', 'models'),
        
        # 설정 파일
        ('config.py', '.'),
    ],
    hiddenimports=[
        'flask',
        'flask_cors',
        'structlog',
        'psutil',
        'requests',
        'supabase_client',
        'tracker',
        'metrics_engine',
        'analyzer.context_analyzer',
        'analyzer.metrics_calculator',
        'capture.screen_capture',
        'privacy.data_sanitizer',
        'sync.supabase_sync',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'numpy.testing',
        'PIL.ImageTk',  # Tkinter 제외
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ProofWorkAgent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # False로 설정하면 콘솔창 숨김
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico',  # 아이콘 파일 (있는 경우)
)
"""

print(spec_file)
