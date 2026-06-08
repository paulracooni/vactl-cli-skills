---
name: vactl
description: Operate the ValueAdd (va) admin backend from anywhere via the standalone vactl CLI — companies, matching rules, feedback (평가·메모), AI guide proposals, matching results/snapshots, scheduler, announcement search. Triggers on 회사 추가/수정, 키워드/가이드/지역/면허/인증 변경, 피드백/메모, 재매칭, 추천 이력, 공고 검색, 스케줄러, vactl.
---

# vactl — ValueAdd 어드민 CLI 스킬

독립 `vactl` CLI로 원격 va 서버를 조작한다. 서버 스택을 로컬에 설치할 필요 없이 CLI만 있으면 된다.

## 사전 점검

CLI가 설치·설정됐는지 확인:

```bash
vactl ping || npx -y github:paulracooni/vactl-cli-skills ping
```

- 명령이 없으면: `npm install -g github:paulracooni/vactl-cli-skills` (또는 `npx github:paulracooni/vactl-cli-skills` 로 매번 실행).
- "설정이 비어 있습니다" 가 나오면: `vactl login` (대화형) 또는
  `vactl config set --server <url> --app-id <id> --master-key <key>`.

## 호출 패턴

설치돼 있으면 `vactl <명령>`, 아니면 `npx github:paulracooni/vactl-cli-skills <명령>`.
회사 `<ref>` = objectId(10자) 또는 정확한 회사명(공백 시 큰따옴표). 이름 중복이면 후보 objectId 출력 후 중단.

## 명령 카탈로그

### company — 회사
- `company list [--status active|paused|churned] [-n 50] [--json]` — 목록
- `company show <ref> [--json]` — 상세(가이드·프로필·면허·인증·AI키워드)
- `company create --name X [--email Y] [--address "..."] [--match-frequency daily|weekly|manual] [--enabled/--disabled]` — 생성(주소 주면 지역 자동추론)
- `company edit <ref> [--name|--email|--status|--address|--match-frequency ...] [--enabled/--disabled]` — 부분 수정
- `company rematch <ref>` — 즉시 재매칭(스냅샷 생성)
- `company delete` — 🚫 CLI 차단. 삭제는 어드민 웹에서만

### rules — 매칭 규칙
- `rules show <ref>` — profile + 가이드
- `rules guide <ref> "<텍스트>"` — 가이드 교체("" 로 제거)
- `rules set <ref> --keywords-in|--keywords-out|--region-pref|--licenses|--certifications|--bid-divisions|--categories-must|--categories-want|--categories-avoid|--industry-codes|--presmpt-min|--presmpt-max` — 부분 set
- `rules kw-add <ref> in|out <키워드들...>` — 추가(가중치 `단어×N`)
- `rules kw-remove <ref> in|out <키워드들...>` — 제거

### feedback — 평가·메모
- `feedback list <ref> [--json]` — 모든 평가·메모
- `feedback set <ref> <target_class> <target_id> [--eval up|down|star|think|""] [--memo "..."]` — 저장(이력 기록)
- `feedback history <ref> <target_class> <target_id>` — 변경 이력

### ai — 피드백→가이드 (Gemini)
- `ai refresh <ref>` — 피드백·메모 분석 → 가이드·제외규칙 초안
- `ai show <ref>` — 제안 확인
- `ai apply-guide <ref>` — 안전: 가이드 교체 + 제외어 추가 병합
- `ai apply-profile <ref>` — 제안 프로필 전체 적용(덮어쓰기)

### matches / ann / intake / scheduler / stats
- `matches list <ref> [--kind grant|bid|both] [-n 20]` — 현재 매칭(마감 지난 건 제외)
- `matches runs <ref> [-n 10]` — 추천 스냅샷 이력
- `ann search [-q "검색어"] [--source bizinfo|kstartup|bojo|g2b] [-n 20]` — 공고 검색
- `ann show <클래스> <objectId> [--json]` — 상세(g2b는 면허제한 포함)
- `intake list [-c <ref>] [-n 30]` · `intake show <intake-id> [--json]` — 고객 폼
- `scheduler jobs` · `scheduler run <job_id>` — 백그라운드 잡
- `stats` — KPI 요약

## 자연어 → 명령

| 사용자 발화 | 명령 |
|---|---|
| "포이 회사 정보 보여줘" | `company show "포이"` |
| "X 회사 지금 다시 매칭" | `company rematch "X"` |
| "X 가이드를 '...'로" | `rules guide "X" "..."` |
| "X 키워드 AI 가중치 3" | `rules kw-add "X" in "AI×3"` |
| "X 면허에 소프트웨어사업자" | `rules set "X" --licenses 소프트웨어사업자` |
| "X 피드백 보여줘" | `feedback list "X"` |
| "이 공고 제외+메모" | `feedback set "X" <class> <id> --eval down --memo "..."` |
| "X 피드백 반영 가이드 만들어줘" | `ai refresh "X"` → `ai show "X"` → `ai apply-guide "X"` |
| "X 매칭 결과/추천 이력" | `matches list "X"` / `matches runs "X"` |
| "통번역 공고 찾아줘" | `ann search -q 통번역` |

## 삭제는 차단됨

`company delete` 는 CLI/스킬에서 **절대 실행되지 않는다**. 회사 삭제를 요청받으면 어드민 웹(`/admin/companies/<id>` → [🗑 삭제])에서만 가능하다고 안내한다. 우회(직접 Parse 호출 등)로 삭제 시도 금지.
