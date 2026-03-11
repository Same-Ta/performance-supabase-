# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=['win32gui', 'win32con', 'win32api', 'win32process', 'win32security', 'pywintypes', 'firebase_client', 'tracker', 'metrics_engine', 'config', 'privacy.data_sanitizer', 'sync.firebase_sync', 'pydantic.v1', 'pydantic_core', 'requests.packages.urllib3', 'requests.packages.urllib3.util.ssl_', 'certifi', 'structlog._frames', 'structlog._log_levels', 'psutil._pswindows', 'psutil._psutil_windows'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['flask', 'flask_cors', 'werkzeug', 'jinja2', 'click', 'itsdangerous', 'google.generativeai', 'google.ai', 'google.protobuf', 'grpc', 'grpcio', 'googleapis_common_protos', 'numpy', 'cv2', 'mss', 'PIL', 'Pillow', 'pystray', 'matplotlib', 'scipy', 'sklearn', 'pandas', 'seaborn', 'tkinter', 'wx', 'PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'IPython', 'jupyter', 'notebook', 'pytest', 'setuptools', 'distutils', 'docutils', 'cryptography', 'Crypto', 'lxml', 'xml.etree.ElementTree', 'email', 'html.parser', 'http.server', 'xmlrpc', 'unittest', 'test'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ProofWorkAgent',
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
