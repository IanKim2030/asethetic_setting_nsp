/**
 * 03_SheetSync.gs 동작 검증.
 * Apps Script 를 로컬에서 못 돌리므로 Sheet/SpreadsheetApp/DriveApp 을 흉내 낸 스텁으로 확인한다.
 * v26 실측 레이아웃을 그대로 재현해서, 수식 칸이 살아남는지를 본다.
 */
const testkit = require('./testkit.js');
const T = testkit.session();
const makeSheet = testkit.makeSheet;
const letter = testkit.letter;

const SRC = process.argv[2];
const ctx = testkit.loadGs(SRC);

T.section('06_예약상품 : 수식 열(E·I)이 살아남는가');
{
  const spec = ctx.TAB_SPEC['06_예약상품'];
  const sh = makeSheet(44, 16);
  // 5행부터 E·I 에 수식이 들어 있는 상태를 재현
  for (let r = 5; r <= 44; r++) { sh.set(r, 1, r - 4); sh.set(r, 5, '=INDEX(...)'); sh.set(r, 9, '=IFERROR(...)'); }

  // cols 순서: B C D | F G H | J K L M N O P  (13개)
  const row1 = ['첫방문 등관리 체험', '시술', '등 관리 60분', '첫방문 체험', 80000, 30000, '신규만', '1회', '상시', '상시', 40, 10000, 1];
  const row2 = ['등관리 정가', '시술', '등 관리 60분', '정가 판매', 80000, 80000, '전체', '제한없음', '상시', '상시', 60, 0, 2];
  ctx.writeTable_(sh, spec, { rows: [row1, row2] });

  T.ok('cols 개수와 행 배열 길이가 같다', spec.cols.length === row1.length,
     'cols ' + spec.cols.length + ' vs row ' + row1.length);
  T.ok('E5 수식 보존', sh.get(5, 5) === '=INDEX(...)', 'E5=' + JSON.stringify(sh.get(5, 5)));
  T.ok('I5 수식 보존', sh.get(5, 9) === '=IFERROR(...)', 'I5=' + JSON.stringify(sh.get(5, 9)));
  T.ok('A5 No 보존', sh.get(5, 1) === 1, 'A5=' + JSON.stringify(sh.get(5, 1)));
  T.ok('B5 예약상품명', sh.get(5, 2) === '첫방문 등관리 체험', 'B5=' + JSON.stringify(sh.get(5, 2)));
  T.ok('F5 판매유형', sh.get(5, 6) === '첫방문 체험', 'F5=' + JSON.stringify(sh.get(5, 6)));
  T.ok('P5 동시접수', sh.get(5, 16) === 1, 'P5=' + JSON.stringify(sh.get(5, 16)));
  T.ok('B6 두번째 행', sh.get(6, 2) === '등관리 정가', 'B6=' + JSON.stringify(sh.get(6, 2)));
  T.ok('B7 빈 행으로 정리됨', sh.get(7, 2) === '', 'B7=' + JSON.stringify(sh.get(7, 2)));
  T.ok('E44 마지막 행 수식도 보존', sh.get(44, 5) === '=INDEX(...)');
}

T.section('08_스마트콜 : 항목명 중복 처리');
{
  const spec = ctx.TAB_SPEC['08_스마트콜'];
  const sh = makeSheet(28, 6);
  const layout = [
    [5, '스마트 ARS', '스마트콜 사용'], [6, '스마트 ARS', '스마트콜 번호 (0507)'],
    [7, '스마트 ARS', '1차 연결 번호'], [8, '스마트 ARS', '2차 연결 번호'],
    [9, '스마트 ARS', '2차 전환 대기 시간'], [10, '스마트 ARS', '인사 멘트'],
    [12, '1번 통화연결', '사용 여부'], [13, '1번 통화연결', '안내 멘트'],
    [14, '2번 예약안내', '사용 여부'], [15, '2번 예약안내', '안내 멘트'],
    [16, '3번 오시는길', '사용 여부'], [17, '3번 오시는길', '안내 멘트'],
    [18, '4번 주차안내', '사용 여부'], [19, '4번 주차안내', '안내 멘트'],
    [20, '5번 영업시간', '사용 여부'], [21, '5번 영업시간', '안내 멘트']
  ];
  layout.forEach(([r, a, b]) => { sh.set(r, 1, a); sh.set(r, 2, b); });

  ctx.writeVertical_(sh, spec, {
    '스마트콜 사용': { v: 'Y', st: '입력완료' },              // 유일하므로 이름만으로 OK
    '1번 통화연결 · 사용 여부': { v: 'Y', st: '입력완료' },
    '4번 주차안내 · 사용 여부': { v: 'N', st: '입력완료' },
    '사용 여부': { v: '오염값' }                                // 중복 이름 — 무시돼야 함
  });

  T.ok('유일 항목은 이름만으로 기록', sh.get(5, 4) === 'Y', 'D5=' + JSON.stringify(sh.get(5, 4)));
  T.ok('1번 분기에 Y', sh.get(12, 4) === 'Y', 'D12=' + JSON.stringify(sh.get(12, 4)));
  T.ok('4번 분기에 N', sh.get(18, 4) === 'N', 'D18=' + JSON.stringify(sh.get(18, 4)));
  T.ok('2번 분기는 안 건드림', sh.get(14, 4) === '', 'D14=' + JSON.stringify(sh.get(14, 4)));
  T.ok('3번 분기는 안 건드림', sh.get(16, 4) === '', 'D16=' + JSON.stringify(sh.get(16, 4)));
  T.ok('5번 분기는 안 건드림', sh.get(20, 4) === '', 'D20=' + JSON.stringify(sh.get(20, 4)));
  T.ok('중복 이름이 어디에도 안 박힘',
     ![12, 14, 16, 18, 20].some(r => sh.get(r, 4) === '오염값'));
  T.ok('상태 열 E12 기록', sh.get(12, 5) === '입력완료', 'E12=' + JSON.stringify(sh.get(12, 5)));
}

T.section('03_영업시간 : 표 + 아래쪽 휴무 항목');
{
  const spec = ctx.TAB_SPEC['03_영업시간'];
  const sh = makeSheet(17, 8);
  ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일', '공휴일']
    .forEach((d, i) => sh.set(5 + i, 1, d));
  sh.set(15, 1, '정기 휴무'); sh.set(16, 1, '명절 휴무'); sh.set(17, 1, '연차·임시휴무 안내 방법');
  for (let r = 5; r <= 12; r++) sh.set(r, 8, '기존메모');   // H 비고

  ctx.writeTable_(sh, spec, {
    rows: [
      ['Y', '10:00', '21:00', '', '', '20:00'],
      ['Y', '10:00', '21:00', '13:00', '14:00', '20:00']
    ],
    tail: { '정기 휴무': '매주 월요일', '명절 휴무': '설·추석 당일' }
  });

  T.ok('A열 요일 보존', sh.get(5, 1) === '월요일');
  T.ok('B5 영업여부', sh.get(5, 2) === 'Y');
  T.ok('G6 라스트오더', sh.get(6, 7) === '20:00', 'G6=' + JSON.stringify(sh.get(6, 7)));
  T.ok('H 비고는 안 건드림', sh.get(5, 8) === '기존메모', 'H5=' + JSON.stringify(sh.get(5, 8)));
  T.ok('정기 휴무 B15 기록', sh.get(15, 2) === '매주 월요일', 'B15=' + JSON.stringify(sh.get(15, 2)));
  T.ok('명절 휴무 B16 기록', sh.get(16, 2) === '설·추석 당일');
  T.ok('안 넘긴 연차 항목은 그대로', sh.get(17, 2) === '', 'B17=' + JSON.stringify(sh.get(17, 2)));
}

T.section('09_이미지 : 3블록 분배');
{
  const spec = ctx.TAB_SPEC['09_이미지'];
  const sh = makeSheet(174, 8);
  for (let r = 6; r <= 125; r++) { sh.set(r, 1, r - 5); sh.set(r, 2, '업체 사진'); }
  sh.set(130, 1, 1); sh.set(130, 2, '예약 메인');
  for (let r = 135; r <= 174; r++) { sh.set(r, 1, r - 134); sh.set(r, 2, '예약 상품'); }

  ctx.writeImageBlocks_(sh, spec, {
    items: [
      { category: '외관', fileName: '외관_01.jpg', isMain: true, order: 1, url: 'u1' },
      { category: '내부', fileName: '내부_01.jpg', isMain: false, order: 2, url: 'u2' },
      { category: '예약메인', fileName: '예약메인_01.jpg', order: 1, url: 'u3' },
      { category: '예약상품', productName: '첫방문 등관리 체험', fileName: '상품_등관리체험.jpg', order: 1, url: 'u4' }
    ]
  });

  T.ok('업체사진 C6 용도', sh.get(6, 3) === '외관', 'C6=' + JSON.stringify(sh.get(6, 3)));
  T.ok('업체사진 D6 파일명', sh.get(6, 4) === '외관_01.jpg');
  T.ok('대표 E6 = Y', sh.get(6, 5) === 'Y');
  T.ok('G6 링크', sh.get(6, 7) === 'u1');
  T.ok('두번째 사진 C7', sh.get(7, 3) === '내부');
  T.ok('B열 고정값 보존', sh.get(6, 2) === '업체 사진', 'B6=' + JSON.stringify(sh.get(6, 2)));
  T.ok('A열 No 보존', sh.get(6, 1) === 1);
  T.ok('예약메인은 130행', sh.get(130, 4) === '예약메인_01.jpg', 'D130=' + JSON.stringify(sh.get(130, 4)));
  T.ok('예약메인 C는 —', sh.get(130, 3) === '—');
  T.ok('예약상품은 135행', sh.get(135, 4) === '상품_등관리체험.jpg', 'D135=' + JSON.stringify(sh.get(135, 4)));
  T.ok('예약상품 C는 상품명', sh.get(135, 3) === '첫방문 등관리 체험');
  T.ok('블록 경계 126~129 안 건드림',
     [126, 127, 128, 129].every(r => sh.get(r, 3) === '' && sh.get(r, 4) === ''));
  T.ok('블록 경계 131~134 안 건드림',
     [131, 132, 133, 134].every(r => sh.get(r, 3) === '' && sh.get(r, 4) === ''));
  T.ok('H 비고 열은 범위 밖', spec.cols.indexOf(8) === -1);
}

T.section('용량 초과 방어');
{
  const spec = ctx.TAB_SPEC['05_패키지'];
  const sh = makeSheet(30, 11);
  for (let r = 5; r <= 24; r++) { sh.set(r, 7, '=수식G'); sh.set(r, 11, '=수식K'); }
  const rows = [];
  for (let i = 0; i < 50; i++) rows.push(['패키지' + i, '구성', 5, 800000, 600000, 450, '3개월', '설명']);
  ctx.writeTable_(sh, spec, { rows: rows });

  T.ok('20행까지만 기록', sh.get(24, 2) === '패키지19', 'B24=' + JSON.stringify(sh.get(24, 2)));
  T.ok('범위 밖 25행은 비어 있음', sh.get(25, 2) === '', 'B25=' + JSON.stringify(sh.get(25, 2)));
  T.ok('G열 수식 보존', sh.get(5, 7) === '=수식G', 'G5=' + JSON.stringify(sh.get(5, 7)));
  T.ok('K열 수식 보존', sh.get(5, 11) === '=수식K', 'K5=' + JSON.stringify(sh.get(5, 11)));
}

T.section('cols 정의와 시트 열 폭 대조');
{
  const widths = { '03_영업시간': 8, '04_시술마스터': 10, '05_패키지': 11, '06_예약상품': 16, '09_이미지': 8 };
  Object.keys(widths).forEach(function (t) {
    const spec = ctx.TAB_SPEC[t];
    const over = spec.cols.filter(c => c > widths[t]);
    T.ok(t + ' cols 가 시트 폭(' + letter(widths[t]) + ') 안에 있다', over.length === 0,
       '초과: ' + over.map(letter).join(','));
  });
}

// ══════════════════════════════════════════════════════
// 아래부터는 SpreadsheetApp/DriveApp/shopFolder_ 등을 스텁으로 채워
// ensureShopSheet_/syncStepToSheet_/syncAllToSheet_ 를 검증한다.
// 02_Session.gs 를 실제로 로드하지 않고, 그 함수들이 하던 일만 흉내낸다.
// ══════════════════════════════════════════════════════
function baseStubs(overrides) {
  return Object.assign({
    TEMPLATE_SHEET_ID: 'TEST_TEMPLATE_ID',
    shopFolder_: (id) => ({ getUrl: () => 'https://folder/' + id }),
    withScriptLock_: (fn) => fn(),
    saveSession_: () => {},
    DriveApp: { getFileById: () => ({ makeCopy: () => ({ getId: () => 'SHEET1', getUrl: () => 'https://sheet/SHEET1' }) }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => null }) }
  }, overrides);
}

T.section('ensureShopSheet_ : 최초 생성 vs 기존 재사용');
{
  const savedCalls = [];
  const makeCopyCalls = [];
  const c = testkit.loadGs(SRC, baseStubs({
    saveSession_: (s) => savedCalls.push(s),
    DriveApp: {
      getFileById(id) {
        return {
          makeCopy(name) {
            makeCopyCalls.push(name);
            return { getId: () => 'SHEET1', getUrl: () => 'https://sheet/SHEET1' };
          }
        };
      }
    }
  }));

  const s1 = { id: 'shop1' };
  c.ensureShopSheet_(s1);
  T.ok('신규: makeCopy 호출됨', makeCopyCalls.length === 1);
  T.ok('신규: sheetId 세팅', s1.sheetId === 'SHEET1');
  T.ok('신규: sheetUrl 세팅', s1.sheetUrl === 'https://sheet/SHEET1');
  T.ok('신규: saveSession_ 1회 호출', savedCalls.length === 1 && savedCalls[0] === s1);

  const s2 = { id: 'shop2', sheetId: 'EXIST' };
  const ss2 = c.ensureShopSheet_(s2);
  T.ok('기존: makeCopy 재호출 안 함', makeCopyCalls.length === 1);
  T.ok('기존: openById 로 기존 시트를 엶', ss2 !== null);
}

T.section('syncStepToSheet_ : PROTECTED_TABS 는 건드리지 않는다');
{
  const openCalls = [];
  const c = testkit.loadGs(SRC, baseStubs({
    SpreadsheetApp: { openById: () => { openCalls.push(1); return { getSheetByName: () => null }; } }
  }));
  c.STEP_TO_TAB.basic = '00_진행현황';   // PROTECTED_TABS 에 있는 탭으로 강제 매핑
  c.syncStepToSheet_({ id: 'x', data: {} }, 'basic');
  T.ok('PROTECTED_TABS 스킵: 시트를 열지도 않는다', openCalls.length === 0);
}

T.section('syncStepToSheet_ : TAB_SPEC 에 없는 탭은 무시한다');
{
  const openCalls = [];
  const c = testkit.loadGs(SRC, baseStubs({
    SpreadsheetApp: { openById: () => { openCalls.push(1); return { getSheetByName: () => null }; } }
  }));
  c.STEP_TO_TAB.basic = '99_없는탭';
  c.syncStepToSheet_({ id: 'x', data: {} }, 'basic');
  T.ok('스펙 없는 탭 스킵: 시트를 열지도 않는다', openCalls.length === 0);
}

T.section('syncStepToSheet_ : kind 에 맞는 writer 로만 디스패치');
{
  const calls = [];
  const c = testkit.loadGs(SRC, baseStubs({
    SpreadsheetApp: { openById: () => ({ getSheetByName: (tab) => ({ tab: tab }) }) }
  }));
  c.writeVertical_ = (sh) => calls.push('vertical:' + sh.tab);
  c.writeTable_ = (sh) => calls.push('table:' + sh.tab);
  c.writeImageBlocks_ = (sh) => calls.push('blocks:' + sh.tab);

  const s = { id: 'x', sheetId: 'S1', data: { basic: {}, hours: {}, image: {} } };
  c.syncStepToSheet_(s, 'basic');   // 01_기본정보 → vertical
  c.syncStepToSheet_(s, 'hours');   // 03_영업시간 → table
  c.syncStepToSheet_(s, 'image');   // 09_이미지 → blocks

  T.ok('vertical 탭은 writeVertical_ 호출', calls.indexOf('vertical:01_기본정보') !== -1, calls.join(','));
  T.ok('table 탭은 writeTable_ 호출', calls.indexOf('table:03_영업시간') !== -1, calls.join(','));
  T.ok('blocks 탭은 writeImageBlocks_ 호출', calls.indexOf('blocks:09_이미지') !== -1, calls.join(','));
}

T.section('syncAllToSheet_ : 한 탭이 실패해도 나머지는 계속 처리한다');
{
  const processed = [];
  const c = testkit.loadGs(SRC, baseStubs());
  c.syncStepToSheet_ = (s, k) => {
    processed.push(k);
    if (k === 'hours') throw new Error('강제 실패');
  };
  c.syncAllToSheet_({ id: 'x' });
  const allKeys = Object.keys(c.STEP_TO_TAB);
  T.ok('모든 단계가 처리 시도됨', processed.length === allKeys.length,
     'processed=' + processed.join(',') + ' / expected=' + allKeys.join(','));
}

T.done();
