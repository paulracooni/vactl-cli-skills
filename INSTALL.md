# vactl 설치 안내서 (AI · 사람 공용)

ValueAdd 어드민 CLI(`vactl`)와 Claude 스킬을 설치·설정하는 안내서입니다. **AI 에이전트가 이 문서를 읽고 그대로 설치**하면 됩니다. 사람도 동일하게 따라 하면 됩니다. Windows · macOS · Linux 모두 동작합니다.

## 0. 사전 요구
- **Node.js 18+** (`node --version` 으로 확인). 없으면 사용자에게 설치를 요청하세요.
- 대상 **서버 URL**, 그 서버의 **APP_ID**, **MASTER_KEY** 3가지가 필요합니다. 모르면 **사용자에게 물어보세요**(추측·창작 금지). 마스터키는 전권한이라 신뢰된 경우에만.

## 1. CLI 설치
```bash
npm install -g github:paulracooni/vactl-cli-skills
```
설치 권한이 없으면 매 호출 시 `npx github:paulracooni/vactl-cli-skills <명령>` 으로 대체.

## 2. 서버 연결 설정
사용자에게 서버 URL·APP_ID·MASTER_KEY를 받은 뒤 (OS·셸 무관 동일):
```bash
vactl config set --server <서버 URL> --app-id <APP_ID> --master-key <MASTER_KEY>
```
환경변수 대안: `VACTL_SERVER` / `VACTL_APP_ID` / `VACTL_MASTER_KEY` (셸별 문법은 README 참고).

## 3. 연결 확인
```bash
vactl ping
```
"워커 OK / Parse OK" 가 나오면 성공. 실패하면 서버 URL·키·네트워크를 점검.

## 4. Claude 스킬 설치 (자연어 호출용)

**macOS / Linux**
```bash
mkdir -p ~/.claude/skills/vactl
curl -fsSL https://raw.githubusercontent.com/paulracooni/vactl-cli-skills/main/skill/SKILL.md -o ~/.claude/skills/vactl/SKILL.md
```

**Windows (PowerShell)**
```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills\vactl" | Out-Null
curl.exe -fsSL "https://raw.githubusercontent.com/paulracooni/vactl-cli-skills/main/skill/SKILL.md" -o "$env:USERPROFILE\.claude\skills\vactl\SKILL.md"
```

## 5. 동작 확인
```bash
vactl company list
```

## 명령 요약
- `vactl --help` 로 전체 확인. 그룹: company / rules / feedback / ai / matches / ann / intake / scheduler / stats.
- `vactl company delete` 는 **차단**되어 실행되지 않음. 회사 삭제는 어드민 웹에서만.

설치가 끝나면 사용자에게 `vactl company list` 또는 Claude에게 "회사 목록 보여줘" 같은 자연어로 바로 쓸 수 있다고 알려주세요.

---
플랫폼별 상세·문제 해결: <https://github.com/paulracooni/vactl-cli-skills#readme>
