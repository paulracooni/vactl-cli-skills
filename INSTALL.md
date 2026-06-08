# vactl 설치 안내서 (AI · 사람 공용)

ValueAdd 어드민 CLI(`vactl`)와 Claude 스킬을 설치·설정하는 안내서입니다. **AI 에이전트가 이 문서를 읽고 그대로 설치**하면 됩니다. 사람도 동일하게 따라 하면 됩니다. Windows · macOS · Linux 모두 동작합니다.

## 0. 사전 요구
- **Node.js 18+** (`node --version` 으로 확인). 없으면 사용자에게 설치를 요청하세요.
- 대상 **환경**(`prod` 또는 `local`)과 그 환경의 **MASTER_KEY**가 필요합니다. 서버 URL·APP_ID는 환경마다 CLI에 **내장**돼 있습니다(prod=`https://34-50-38-51.nip.io`/`valueadd-prod`, local=localhost/`valueadd-poc`). 모르면 **사용자에게 물어보세요**(추측·창작 금지). 마스터키는 전권한이라 신뢰된 경우에만.

## 1. CLI 설치
```bash
npm install -g github:paulracooni/vactl-cli-skills
```
설치 권한이 없으면 매 호출 시 `npx github:paulracooni/vactl-cli-skills <명령>` 으로 대체.

## 2. 서버 연결 (환경 내장 — 마스터키만)
환경(prod/local)별 서버 URL·APP_ID는 내장돼 있으니 **마스터키만** 설정합니다. 사용자에게 대상 환경과 그 MASTER_KEY를 물어본 뒤:
```bash
# 프로덕션(기본)
vactl config set --master-key <MASTER_KEY>
# 로컬이면
vactl config set --env local --master-key <MASTER_KEY>
```
대화형: `vactl login`(prod) / `vactl login --env local`.
프로젝트마다 환경 고정: 그 폴더에서 `vactl env use <prod|local> --project`.

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
