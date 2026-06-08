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

## 3. 설정 (모든 OS 공통 — 권장)

서버 주소·APP_ID·마스터키를 한 줄로 저장합니다. **OS·셸과 무관하게 동일**합니다:

```bash
vactl config set --server https://<서버> --app-id <APP_ID> --master-key <MASTER_KEY>
vactl ping
```

대화형으로 입력하려면:

```bash
vactl login
```

`vactl ping` 이 "워커 OK / Parse OK" 면 성공입니다.

> 설정은 홈 폴더의 `config.json` 에 저장되며, 가능한 OS에서는 본인만 읽도록 권한이 제한됩니다.
>
> | OS | 설정 파일 경로 |
> |---|---|
> | macOS / Linux | `~/.vactl/config.json` |
> | Windows | `%USERPROFILE%\.vactl\config.json` |
>
> 현재 경로는 `vactl config path`, 내용 확인은 `vactl config show` (마스터키는 가려져 표시).

### (선택) 환경변수로 설정

설정 파일 대신 환경변수를 써도 됩니다(설정 파일보다 **우선** 적용). 셸마다 문법이 다릅니다:

**macOS / Linux (bash·zsh)**
```bash
export VACTL_SERVER=https://<서버>
export VACTL_APP_ID=<APP_ID>
export VACTL_MASTER_KEY=<MASTER_KEY>
```

**Windows — PowerShell**
```powershell
$env:VACTL_SERVER   = "https://<서버>"
$env:VACTL_APP_ID   = "<APP_ID>"
$env:VACTL_MASTER_KEY = "<MASTER_KEY>"
```

**Windows — 명령 프롬프트(cmd)**
```cmd
set VACTL_SERVER=https://<서버>
set VACTL_APP_ID=<APP_ID>
set VACTL_MASTER_KEY=<MASTER_KEY>
```

> `VACTL_SERVER` 를 주면 `parseUrl=<서버>/parse`, `workerUrl=<서버>` 로 자동 설정됩니다.
> Parse와 워커가 다른 주소면 `VACTL_PARSE_URL` / `VACTL_WORKER_URL` 를 개별 지정하세요.

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
