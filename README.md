# vactl — ValueAdd 어드민 CLI

ValueAdd(va) 서버를 **내 컴퓨터에서 원격으로 조작**하는 독립 CLI. 회사·매칭 규칙·피드백·AI 가이드·매칭 결과를 터미널 또는 Claude 스킬(자연어)로 다룹니다. **Windows · macOS · Linux** 모두 동작합니다.

- 데이터 조작(회사/규칙/피드백/매칭/공고)은 **Parse REST**를 마스터키로 직접 호출
- 컴퓨트(재매칭·AI 가이드 생성)는 서버 **워커 `/api`** 를 마스터키로 호출
- 서버 스택을 로컬에 설치할 필요 없음 — CLI만 설치하면 됨

---

## 1. 요구사항

- **Node.js 18 이상** (`node --version` 으로 확인)
  - Windows: <https://nodejs.org> 설치 관리자 (또는 `winget install OpenJS.NodeJS.LTS`)
  - macOS: <https://nodejs.org> (또는 `brew install node`)
  - Linux: 배포판 패키지 또는 [nodesource](https://github.com/nodesource/distributions) (또는 `nvm`)
- 이 서버의 **APP_ID** 와 **MASTER_KEY** (운영자에게 받으세요. 마스터키는 전권한이라 신뢰된 사람만)

> 명령은 OS와 무관하게 동일합니다. 셸 문법이 갈리는 곳(**환경변수**, **파일 경로**, **스킬 설치**)만 아래에서 OS별로 표기합니다.

---

## 2. 설치 (모든 OS 공통)

깃에서 바로 실행 — 설치 없이:

```bash
npx github:paulracooni/vactl-cli-skills --help
```

또는 전역 설치(권장 — 이후 `vactl` 로 호출):

```bash
npm install -g github:paulracooni/vactl-cli-skills
vactl --help
```

> 전역 설치 후 `vactl` 이 "command not found / 인식할 수 없는" 이면 npm 전역 bin 경로가 PATH에 없는 경우입니다. → [문제 해결](#7-문제-해결) 참고. 급하면 `npx github:paulracooni/vactl-cli-skills <명령>` 으로 대체.

---

## 3. 설정 — 환경(env)은 내장, 마스터키만 넣으면 됨

서버 URL과 APP_ID는 **환경마다 CLI에 내장**돼 있습니다. 사용자는 **마스터키만** 넣으면 됩니다.

| 환경 | server | appId |
|---|---|---|
| `prod` (기본) | `https://34-50-38-51.nip.io` | `valueadd-prod` |
| `local` | `http://localhost:8000` (+Parse :1337) | `valueadd-poc` |

### 프로덕션 (기본)
```bash
vactl login          # 마스터키만 물어봄
vactl ping           # "워커 OK / Parse OK" 면 성공
```
(비대화형: `vactl config set --master-key <MASTER_KEY>`)

### 로컬
```bash
vactl login --env local
vactl --env local ping
```

### 환경 보기 · 전환
```bash
vactl env                    # 환경 목록 + 활성 환경 + 키 설정 여부
vactl env use local          # 기본 환경을 local 로 (전역)
vactl --env prod company list # 특정 명령만 다른 환경으로
```

### 프로젝트마다 환경 고정 (`.vactl.json`)
프로젝트 폴더에서 한 번:
```bash
vactl env use local --project   # 이 폴더에 .vactl.json {"env":"local"} 생성
```
이후 그 폴더(및 하위)에서 `vactl ...` 은 자동으로 `local` 을 씁니다. CLI는 현재 위치에서 위로 올라가며 `.vactl.json` 을 찾습니다.

> 마스터키는 **항상 전역**(`~/.vactl/config.json`, 환경별 보관)에만 저장됩니다. `.vactl.json` 에는 환경 이름만 들어가서 **git에 커밋해도 안전**합니다.
>
> | OS | 전역 설정 경로 |
> |---|---|
> | macOS / Linux | `~/.vactl/config.json` |
> | Windows | `%USERPROFILE%\.vactl\config.json` |
>
> 확인: `vactl config show` (env·URL·appId·키 마스킹) / `vactl config path`.

### (선택) 환경변수 override

설정보다 **우선** 적용됩니다. `VACTL_ENV`(prod|local), `VACTL_MASTER_KEY`, 그리고 커스텀 서버용 `VACTL_SERVER`/`VACTL_APP_ID` 등.

| OS / 셸 | 예 |
|---|---|
| macOS/Linux (bash·zsh) | `export VACTL_ENV=local` |
| Windows PowerShell | `$env:VACTL_ENV = "local"` |
| Windows CMD | `set VACTL_ENV=local` |

---

## 4. 명령

```
company  list|show|create|edit|rematch          회사
rules    show|guide|set|kw-add|kw-remove         매칭 규칙
feedback list|set|history                        평가·메모
ai       refresh|show|apply-guide|apply-profile  피드백→가이드(Gemini)
matches  list|runs                               매칭 결과·스냅샷
ann      search|show                             공고/입찰 조회
intake   list|show                               고객 폼
scheduler jobs|run                               백그라운드 잡
stats                                             KPI 요약
```

전체·하위 도움말: `vactl --help`, `vactl <그룹> --help`

### 예시 (모든 OS 동일)

```bash
vactl company list --status active
vactl company show "포이"                          # objectId 또는 정확한 회사명
vactl company create --name "테스트" --address "부산광역시"   # 지역 자동추론
vactl rules kw-add "포이" in "AI×3" 디지털전환
vactl rules guide "포이" "뿌리기업 우대 최우선. 직생 필수 제외."
vactl feedback set "포이" G2bBid <id> --eval down --memo "지역 안맞음"
vactl ai refresh "포이"          # → vactl ai show → vactl ai apply-guide
vactl company rematch "포이"
vactl matches list "포이"
vactl ann search -q 통번역 --source g2b
```

> **Windows에서 한글 인자**: PowerShell은 UTF-8이라 보통 잘 됩니다. 만약 한글이 깨지면 회사를 **objectId**(10자)로 지정하거나, cmd 대신 PowerShell을 쓰세요.

---

## 5. 안전장치

- `vactl company delete` 는 **CLI에서 차단**됩니다(파괴적). 회사 삭제는 어드민 웹에서만.
- 외부 자동화·AI에는 마스터키 대신 **스코프 제한 토큰**을 권장 — 어드민 웹의 토큰 페이지(`/admin/tokens`)에서 발급.

---

## 6. Claude 스킬 설치 (자연어 호출용, 선택)

스킬 파일(`SKILL.md`)을 전역 스킬 폴더에 두면 Claude Code에서 *"포이 회사 키워드에 AI 추가해줘"* 처럼 부를 수 있습니다.

| OS | 스킬 파일 경로 |
|---|---|
| macOS / Linux | `~/.claude/skills/vactl/SKILL.md` |
| Windows | `%USERPROFILE%\.claude\skills\vactl\SKILL.md` |

이 저장소의 `skill/SKILL.md` 를 위 경로로 복사하거나, 서버에서 받아 저장합니다:

**macOS / Linux**
```bash
mkdir -p ~/.claude/skills/vactl
curl -fsSL https://<서버>/admin/cli/skill.md -o ~/.claude/skills/vactl/SKILL.md
```

**Windows — PowerShell**
```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills\vactl" | Out-Null
curl.exe -fsSL "https://<서버>/admin/cli/skill.md" -o "$env:USERPROFILE\.claude\skills\vactl\SKILL.md"
```

> Windows 10/11에는 `curl.exe` 가 기본 포함입니다. 없으면 PowerShell `Invoke-WebRequest "https://<서버>/admin/cli/skill.md" -OutFile "$env:USERPROFILE\.claude\skills\vactl\SKILL.md"`.

### AI가 직접 설치하게 하려면

Claude Code에 이 한 줄이면 CLI·스킬을 스스로 설치·설정합니다(APP_ID·MASTER_KEY는 당신에게 물어봄):

```
이 안내서를 따라 vactl CLI와 스킬을 설치해줘: https://<서버>/admin/cli/install.md
```

---

## 7. 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| `vactl` 명령을 못 찾음 (전역 설치 후) | npm 전역 bin이 PATH에 없음. `npm config get prefix` 로 경로 확인 후 PATH에 추가하거나, `npx github:paulracooni/vactl-cli-skills <명령>` 사용. macOS/Linux는 `~/.zshrc`·`~/.bashrc` 에, Windows는 시스템 환경변수 PATH에 추가. |
| `설정이 비어 있습니다` | `vactl config set ...` 또는 `vactl login` 먼저 실행. |
| `워커 연결 실패` / `서버 연결 실패` | `--server` URL·네트워크·방화벽 확인. Parse와 워커 주소가 다르면 `VACTL_PARSE_URL`/`VACTL_WORKER_URL` 개별 지정. |
| `401` (워커 컴퓨트) | 마스터키가 틀림. `vactl config show` 로 확인 후 다시 설정. |
| Windows에서 한글 인자 깨짐 | PowerShell 사용(UTF-8) 또는 회사를 objectId로 지정. |
| `npx` 가 매번 느림 | `npm install -g github:paulracooni/vactl-cli-skills` 로 전역 설치하면 빨라짐. |

---

저장소: <https://github.com/paulracooni/vactl-cli-skills>
