# vactl — ValueAdd 어드민 CLI

ValueAdd(va) 서버를 **로컬에서 원격으로 조작**하는 독립 CLI. 회사·매칭 규칙·피드백·AI 가이드·매칭 결과를 터미널 또는 Claude 스킬(자연어)로 다룹니다.

- 데이터 조작(회사/규칙/피드백/매칭/공고)은 **Parse REST**를 마스터키로 직접 호출
- 컴퓨트(재매칭·AI 가이드 생성)는 **워커 `/api`** 를 마스터키로 호출
- 서버 스택을 로컬에 설치할 필요 없음. CLI만 설치하면 됨

## 설치

Node.js 18+ 필요. 깃에서 바로 실행(설치 없이):

```bash
npx github:paulracooni/vactl-cli-skills --help
```

전역 설치:

```bash
npm install -g github:paulracooni/vactl-cli-skills
vactl --help
```

## 설정

대화형:

```bash
vactl login
# 서버 URL, APP_ID, MASTER_KEY 입력 → ~/.vactl/config.json 저장
```

또는 한 번에:

```bash
vactl config set --server https://<서버> --app-id <APP_ID> --master-key <MASTER_KEY>
vactl ping     # 연결 확인
```

환경변수로도 가능(설정 파일보다 우선):

```bash
export VACTL_SERVER=https://<서버>        # parseUrl=<서버>/parse, workerUrl=<서버>
export VACTL_APP_ID=<APP_ID>
export VACTL_MASTER_KEY=<MASTER_KEY>
# 필요 시 개별 지정
export VACTL_PARSE_URL=...  VACTL_WORKER_URL=...
```

마스터키는 전권한입니다. `~/.vactl/config.json` 은 본인만 읽도록 권한이 제한됩니다(0600).

## 명령

```
company list|show|create|edit|rematch        회사
rules   show|guide|set|kw-add|kw-remove       매칭 규칙
feedback list|set|history                     평가·메모
ai      refresh|show|apply-guide|apply-profile 피드백→가이드(Gemini)
matches list|runs                             매칭 결과·스냅샷
ann     search|show                           공고/입찰 조회
intake  list|show                             고객 폼
scheduler jobs|run                            백그라운드 잡
stats                                          KPI 요약
```

도움말: `vactl <그룹> --help`

### 예시

```bash
vactl company list --status active
vactl company show "포이"                       # objectId 또는 정확한 회사명
vactl company create --name "테스트" --address "부산광역시"   # 지역 자동추론
vactl rules kw-add "포이" in "AI×3" 디지털전환
vactl rules guide "포이" "뿌리기업 우대 최우선. 직생 필수 제외."
vactl feedback list "포이"
vactl feedback set "포이" G2bBid <id> --eval down --memo "지역 안맞음"
vactl ai refresh "포이"      # → vactl ai show → vactl ai apply-guide
vactl company rematch "포이"
vactl matches list "포이"
vactl ann search -q 통번역 --source g2b
```

## 안전장치

- `company delete` 는 **CLI에서 차단**됩니다(파괴적). 삭제는 어드민 웹에서만.
- AI 토큰을 쓰는 외부 자동화에는 마스터키 대신 스코프 제한 토큰을 권장(어드민 웹 토큰 페이지에서 발급).

## Claude 스킬

`skill/SKILL.md` 를 `~/.claude/skills/vactl/SKILL.md` 에 두면 Claude Code에서 자연어로 호출됩니다. 자세한 건 서버 어드민의 **스킬 가이드** 페이지(`/admin/cli`) 참고.

> 저장소: https://github.com/paulracooni/vactl-cli-skills
