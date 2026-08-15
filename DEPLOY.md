# 배포 운영서 (clasp + GitHub Actions)

편집기에 손으로 붙여넣지 않습니다. 로컬에서 `clasp` 로 밀어 올리고,
`main` 에 push 하면 GitHub Actions 가 검증 후 자동 배포합니다.

---

## 한 번만 하는 준비

### 0. Apps Script API 켜기
<https://script.google.com/home/usersettings> → **Apps Script API: 사용** (안 켜면 push 실패)

### 1. clasp 로그인 (계정 주인만)
```bash
clasp login
```
브라우저 승인 후 `~/.clasprc.json` 에 인증 정보가 저장됩니다. (Windows: `%USERPROFILE%\.clasprc.json`)

### 2. 스크립트 ID 연결
Apps Script 편집기 → ⚙️ 프로젝트 설정 → **스크립트 ID** 복사 →
`.clasp.json` 의 `PASTE_YOUR_SCRIPT_ID_HERE` 자리에 붙여넣기.

확인:
```bash
clasp status
```
`Tracked files` 에 `.gs` 6개 + `.html` 3개 + `appsscript.json` **딱 10개**만 나오면 정상입니다.

---

## 매일 쓰는 로컬 흐름

```bash
npm run verify        # 구문 · 중복 선언 · 동기화 테스트
```
```bash
clasp push -f         # 로컬 → Apps Script 업로드
```
```bash
clasp push -w         # 저장할 때마다 자동 업로드 (작업 중 켜두면 편함)
```

배포(같은 웹앱 URL 유지):
```bash
clasp deployments                       # deploymentId 확인 (- AKfyc... 로 시작)
```
```bash
clasp deploy -i <deploymentId> -d "설명"  # 그 배포를 새 버전으로 갱신 → /exec URL 그대로
```
> `-i` 없이 `clasp deploy` 하면 **새 URL** 이 생깁니다. 반드시 기존 id 로 갱신하세요.

작업 중에는 `clasp push -w` + Apps Script 편집기의 **테스트 배포(/dev URL)** 조합이면
배포조차 필요 없이 최신 코드가 바로 반영됩니다.

---

## GitHub Actions 자동 배포

`main` 에 push → `.github/workflows/deploy.yml` 이 검증 후 배포합니다.

### 리포 위치 (중요)
git 저장소는 **`내 드라이브` 밖**(예: `C:\dev\naver_smartplace`)에 두세요.
Drive 안에서 `git`·`node_modules` 를 쓰면 동기화가 충돌 사본을 만듭니다.

### 필요한 Secret 2개
GitHub 리포 → Settings → Secrets and variables → Actions → **New repository secret**

| 이름 | 값 |
|---|---|
| `CLASPRC_JSON` | `~/.clasprc.json` 파일 **내용 전체**. Windows: `Get-Content $env:USERPROFILE\.clasprc.json -Raw` 출력 |
| `DEPLOYMENT_ID` | `clasp deployments` 로 확인한 배포 id (`AKfyc...`) |

### 절대 하지 말 것
- `.clasprc.json` / `clasprc.json` 을 **커밋 금지** (`.gitignore` 로 이미 막아둠). 리프레시 토큰입니다.
- Secret 값을 코드·문서에 붙여넣기 금지.

> 토큰이 만료되면(가끔 있음) 로컬에서 `clasp login` 다시 하고
> `CLASPRC_JSON` Secret 을 새 내용으로 갱신하면 됩니다.

---

## 파일 역할

| 파일 | 역할 | 커밋 | Apps Script push |
|---|---|---|---|
| `*.gs` `*.html` `appsscript.json` | 실제 코드 | O | **O** |
| `.clasp.json` | 스크립트 ID·rootDir | O | X |
| `.claspignore` | push 대상 allowlist | O | X |
| `package.json` `tools/` `test/` `QA_CHECKLIST.md` | 검증 도구·QA 절차 | O | X |
| `.clasprc.json` | 인증 토큰 | **X** | X |
