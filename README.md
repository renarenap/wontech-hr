# WONTECH HR 관리 시스템

승진포인트 관리 + 인사관리(입사/온보딩/발령/퇴사) + 채용현황을 한 곳에서 보는 사내 HR 대시보드.
Vite + React + React Router + Supabase(Auth/DB)로 구성되어 있고, GitHub Pages에 배포합니다.

**배포 완료**: https://renarenap.github.io/wontech-hr/
저장소: https://github.com/renarenap/wontech-hr — `main` 브랜치에 push할 때마다 자동 재배포됩니다.

## 0. 진행 상태 (전부 완료)

- ✅ Node.js / npm 설치, `npm install` / `npm run build` 정상 동작 확인
- ✅ Supabase 테이블 생성(`schema.sql`) + 샘플 데이터(`seed.sql`) 적재
- ✅ 관리자 계정 생성 (wowbagger12@gmail.com)
- ✅ admin-users Edge Function 배포 및 동작 확인
- ✅ GitHub 저장소 연결, Secrets 등록, Pages(GitHub Actions) 설정
- ✅ 실제 배포 사이트에서 로그인 → 대시보드 → 계정 관리까지 동작 확인 완료

## 1. Supabase 설정

1. Supabase 대시보드 → 해당 프로젝트 → **SQL Editor**에서 [supabase/schema.sql](supabase/schema.sql) 전체 내용을 실행해 테이블 생성 + RLS 정책까지 한 번에 적용합니다. *(이미 완료됨)*
2. (선택) [supabase/seed.sql](supabase/seed.sql)로 샘플 데이터를 채울 수 있습니다. *(이미 완료됨 — 실제 운영 전엔 지우고 시작하세요)*
3. 이미 확인된 연결 정보 (로컬 `.env`에 반영되어 있음):
   - Project URL: `https://ybkkvuuvkyqkylzsrgny.supabase.co`
   - anon(publishable) key: `.env` 파일 참고 (git에는 커밋되지 않음)

> 계정(로그인 아이디/비번) 생성은 더 이상 Supabase 대시보드에서 하지 않습니다 — 앱에 로그인한 뒤 왼쪽 사이드바 **관리자 → 계정 관리**에서 직접 추가/삭제/비밀번호 재설정을 합니다. 이 기능을 쓰려면 아래 3번의 Edge Function 배포가 먼저 되어 있어야 합니다.
>
> **단, 맨 처음 로그인할 관리자 계정 1개는 예외적으로 Supabase 대시보드에서 만들어야 합니다** (앱에 로그인된 사람이 아무도 없으니 "계정 관리" 페이지 자체를 열 수 없기 때문). Authentication → Users → **Add user**에서 이메일/비밀번호를 직접 입력해 1명만 만드세요. (자동 이메일 초대(Invite)가 아니라 "Add user"로 즉시 비밀번호까지 설정하는 방식을 쓰면 별도 이메일 인증 없이 바로 로그인할 수 있습니다.) 이후 계정부터는 앱 안에서 이 계정으로 추가하면 됩니다.

## 2. 로컬 실행

```bash
npm install
npm run dev
```

`.env` 파일에 이미 Supabase URL/key가 채워져 있습니다. 브라우저에서 로그인 화면이 뜨면 위에서 만든 관리자 계정으로 로그인하세요.

## 3. 계정 관리 기능(Edge Function) 배포 — 꼭 필요, 직접 실행

"계정 관리" 페이지는 [supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts)라는 서버 함수를 호출합니다. 이 함수 안에서만 관리자 권한(service role) 키를 쓰기 때문에, 브라우저(정적 사이트)에는 그 키가 절대 노출되지 않습니다. 이 배포 단계는 계정 인증(로그인)이 필요해서 대신 해드릴 수 없어요 — 아래 3줄만 실행하면 됩니다.

```bash
npx supabase login
npx supabase link --project-ref ybkkvuuvkyqkylzsrgny
npx supabase functions deploy admin-users
```

- `npx supabase login`은 브라우저가 열리면서 Supabase 계정으로 로그인/승인하는 화면입니다.
- 함수 안에서 쓰는 `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 배포 시 자동으로 주입해주므로 따로 설정할 게 없습니다.
- 배포 후 앱에서 로그인 → **관리자 → 계정 관리**로 들어가면 바로 사용 가능합니다. (배포 전에는 이 페이지가 오류를 표시합니다.)
- 코드를 수정하면 `npx supabase functions deploy admin-users`만 다시 실행하면 됩니다.

## 4. GitHub 저장소 연결 & 배포 (완료됨 — 참고용)

- 저장소: https://github.com/renarenap/wontech-hr (연결 완료)
- Secrets 등록 완료: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Pages source: **GitHub Actions**로 설정 완료
- 배포 URL: **https://renarenap.github.io/wontech-hr/**

앞으로는 이 폴더에서 코드를 수정하고 `main` 브랜치에 push만 하면 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)이 자동으로 빌드 + 배포합니다.

```bash
git add .
git commit -m "설명"
git push
```

## 5. 폴더 구조

```
src/
  supabaseClient.js   Supabase 클라이언트 초기화
  lib/
    auth.jsx           로그인 상태 Context (AuthProvider/useAuth)
    constants.js        브랜드 컬러, 등급 환산, 포인트 계산 로직
    adminApi.js          admin-users Edge Function 호출 헬퍼
  components/
    ui.jsx              공통 UI (Bd, GB, SB, Prog, KpiRow, Check, DdayBd 등)
    Layout.jsx           사이드바 + 헤더
  pages/
    Login.jsx
    Dashboard.jsx        승진포인트 대시보드 (/)
    EmployeeList.jsx      포인트 현황 (/employees)
    EmployeeDetail.jsx    직원 상세 (/employees/:id)
    Criteria.jsx          기준표 (/criteria, 정적 참고자료)
    Hire.jsx               입사 관리 (/hire)
    Onboarding.jsx          온보딩 (/onboarding)
    Transfer.jsx            발령 관리 (/transfer)
    Resign.jsx               퇴사 관리 (/resign)
    Recruit.jsx               채용현황 (/recruit)
    AccountManage.jsx         계정 관리 (/accounts, 관리자 전용 그룹)
supabase/
  schema.sql            테이블 + RLS 정책
  seed.sql               (선택) 샘플 데이터
  functions/
    admin-users/index.ts  계정 조회/생성/역할변경/비밀번호재설정/삭제 서버 함수
```

## 6. 설계 메모

- **라우팅**: `HashRouter`를 사용합니다 (`/#/employees` 형태 URL). GitHub Pages는 서버 라우팅이 없어서 `BrowserRouter` + 새로고침 시 404 문제를 피하려고 이 방식을 택했습니다.
- **직원 포인트 계산**: `evaluations.points` 합계 + `employees.base_pts`(연차) + `eng_pts`/`eng2_pts`/`cert_pts`/`award_pts`(가점 항목들). 정확한 가점 항목 명칭은 회사 규정에 맞게 [EmployeeDetail.jsx](src/pages/EmployeeDetail.jsx)의 `breakdown` 라벨을 수정하면 됩니다.
- **입사/온보딩/퇴사 체크리스트**는 클릭하면 바로 Supabase에 반영됩니다 (읽기 전용이 아님).
- **계정 관리**: 회원가입 화면 없음. 로그인된 사람만 볼 수 있는 사이드바 **관리자 → 계정 관리** 페이지에서 이메일/임시비밀번호로 계정을 추가·역할(관리자/팀장/팀원) 변경·비밀번호 재설정·삭제합니다. 실제 계정 생성/삭제는 [supabase/functions/admin-users/index.ts](supabase/functions/admin-users/index.ts) Edge Function이 service role 권한으로 수행하며, 이 키는 서버에서만 쓰이고 프론트엔드 번들에는 절대 포함되지 않습니다. 현재는 "로그인한 사람이면 누구나 관리자 페이지 접근 가능" 수준이며, 역할별로 화면 접근을 더 세밀하게 막고 싶으면 말씀해주세요.
