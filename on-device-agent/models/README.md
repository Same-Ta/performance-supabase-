# On-Device AI 모델 디렉토리

이 디렉토리에 ONNX 모델 파일을 배치하세요.

## 필요 모델

### 1. 장면 분류 모델 (Scene Classifier)
- **파일명**: `scene_classifier.onnx`
- **입력**: 224×224 RGB 이미지
- **출력**: 13가지 장면 레이블 확률
- **레이블**: vscode_editor, jetbrains_ide, browser_docs, browser_search,
  terminal_cli, slack_teams, figma_design, jira_pm, google_workspace, 
  ms_office, zoom_meet, idle_lockscreen, other

### 2. OCR 텍스트 인식 모델 (Text Recognition)
- **파일명**: `text_recognition.onnx`
- **입력**: 가변 크기 텍스트 영역 이미지
- **출력**: 인식된 문자 시퀀스

## 모델 다운로드

사내 모델 레지스트리에서 다운로드하거나, 직접 학습할 수 있습니다.

### 장면 분류 모델 직접 학습

```bash
# 1. 학습 데이터 수집 (스크린샷 + 레이블)
# 2. MobileNetV3 또는 EfficientNet-Lite 기반으로 Fine-tuning
# 3. ONNX로 변환

pip install torch torchvision onnx

# PyTorch → ONNX
python -c "
import torch
import torchvision.models as models

model = models.mobilenet_v3_small(pretrained=True)
model.classifier[-1] = torch.nn.Linear(1024, 13)  # 13 classes
model.eval()

dummy_input = torch.randn(1, 3, 224, 224)
torch.onnx.export(model, dummy_input, 'models/scene_classifier.onnx',
                   input_names=['input'], output_names=['output'],
                   dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}})
"
```

### 모델 없이 실행

모델 파일이 없어도 에이전트는 Fallback 모드로 동작합니다:
- 색상 분포 기반 간이 분류기 사용
- 정확도는 떨어지지만 기본적인 분석 가능
- `python main.py --demo` 로 모델 없이 데모 실행 가능

## 디렉토리 구조

```
models/
├── README.md              ← 현재 파일
├── scene_classifier.onnx  ← 장면 분류 모델 (직접 배치)
└── text_recognition.onnx  ← OCR 모델 (직접 배치)
```
