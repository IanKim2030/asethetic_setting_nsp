/**
 * 구글 시트 동기화
 *
 * 원칙
 *  - 시트는 저장소가 아니라 산출물입니다. 작성 중 데이터는 드라이브 JSON에 있습니다.
 *  - 마스터 템플릿을 복사해서 씁니다. 매번 새로 만들면 서식·수식이 어긋납니다.
 *  - 앱은 TAB_SPEC 에 적힌 칸만 씁니다. 여기 없는 칸은 무슨 일이 있어도 건드리지 않습니다.
 *
 * v26 시트에서 실측한 규칙
 *  - 노란 칸(FFFFF2CC) = 입력칸.  앱이 쓰는 곳입니다.
 *  - 회색 칸(FFE7E6E6) = 자동 계산 수식 또는 고정값(No·구분).  덮으면 수식이 죽습니다.
 *  - 자동 수식 열이 데이터 열 사이에 끼어 있습니다 (06_예약상품 E·I 등).
 *    그래서 시작 열부터 연속으로 쓰면 안 되고, 열 목록을 받아 끊어서 써야 합니다.
 */

/**
 * 앱이 절대 쓰지 않는 탭. 담당자 기입란과 이력이라 통째로 제외합니다.
 * TAB_SPEC 에 없으면 어차피 안 쓰이지만, 의도를 코드에 남겨 둡니다.
 */
var PROTECTED_TABS = ['00_진행현황', '10_변경이력'];

/**
 * 각 탭의 `비고` 열도 앱이 쓰지 않습니다.
 * 사장님 메모이자 담당자 메모라, 재제출 때 지워지면 곤란합니다.
 * → 아래 cols 배열에 비고 열 번호를 넣지 않는 것으로 지킵니다.
 */

/**
 * 단계 key → 시트 탭 이름.
 * 시트 구조가 바뀌면 여기와 TAB_SPEC 만 고치면 됩니다.
 */
var STEP_TO_TAB = {
  basic: '01_기본정보',
  extra: '02_부가정보',
  hours: '03_영업시간',
  menu: '04_시술마스터',
  'package': '05_패키지',
  product: '06_예약상품',
  booking: '07_예약설정',
  call: '08_스마트콜',
  image: '09_이미지'
};

/**
 * 탭별 쓰기 규격. v26 실측값입니다.
 *
 *  kind        vertical  세로형 — B열 항목명으로 찾아 D(값)·E(상태)에 씁니다
 *              table     표형   — startRow 부터 cols 에 적힌 열에만 씁니다
 *              blocks    09_이미지 전용 — 한 탭 안에 표가 세 덩어리입니다
 *  cols        앱이 쓰는 열 번호. 사이가 비어 있으면 그 열은 수식이라 건너뜁니다.
 *  tail        표 아래에 따로 붙은 세로형 항목 (03_영업시간의 휴무 3줄)
 */
var TAB_SPEC = {
  '01_기본정보': { kind: 'vertical', startRow: 4, endRow: 29 },
  '02_부가정보': { kind: 'vertical', startRow: 4, endRow: 38 },
  '07_예약설정': { kind: 'vertical', startRow: 4, endRow: 48 },

  // 08 은 B열 항목명이 겹칩니다. `사용 여부`·`안내 멘트`가 분기마다 반복되므로
  // A열(구분)까지 합쳐야 행이 하나로 정해집니다.
  '08_스마트콜': { kind: 'vertical', startRow: 4, endRow: 28 },

  '03_영업시간': {
    kind: 'table', startRow: 5, endRow: 12,
    cols: [2, 3, 4, 5, 6, 7],              // B~G. A(요일)는 고정, H(비고)는 제외
    tail: { startRow: 15, endRow: 17, labelCol: 1, valueCol: 2 }   // 정기휴무·명절휴무·연차안내
  },
  '04_시술마스터': {
    kind: 'table', startRow: 5, endRow: 44,
    cols: [2, 3, 4, 5, 6, 7, 8, 9]          // B~I. J(사용 현황)는 수식
  },
  '05_패키지': {
    kind: 'table', startRow: 5, endRow: 24,
    cols: [2, 3, 4, 5, 6, 8, 9, 10]         // G(할인율)·K(사용 현황) 수식 건너뜀
  },
  '06_예약상품': {
    kind: 'table', startRow: 5, endRow: 44,
    cols: [2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16]   // E(포함 시술)·I(할인율) 수식 건너뜀
  },
  '09_이미지': {
    kind: 'blocks',
    cols: [3, 4, 5, 6, 7],                  // C~G. A·B는 고정값, H(비고)는 제외
    blocks: [
      { key: '업체사진', startRow: 6,   endRow: 125 },
      { key: '예약메인', startRow: 130, endRow: 130 },
      { key: '예약상품', startRow: 135, endRow: 174 }
    ]
  }
};

/** 09_이미지 ①업체 사진 블록에 들어가는 용도들 */
var SHOP_PHOTO_CATEGORIES = ['외관', '내부', '관리실', '시술', '제품', '로고'];


// ══════════════════════════════════════════════════════
// 시트 준비
// ══════════════════════════════════════════════════════
function ensureShopSheet_(s) {
  if (s.sheetId) {
    try { return SpreadsheetApp.openById(s.sheetId); } catch (e) { /* 삭제됐으면 새로 만듭니다 */ }
  }
  if (!TEMPLATE_SHEET_ID) throw new Error('TEMPLATE_SHEET_ID 가 설정되지 않았습니다.');

  // ★ 잠금을 겹쳐 잡지 않습니다.
  //   shopFolder_ 와 saveSession_ 은 스스로 잠그므로 잠금 밖에서 부릅니다.
  var folder = shopFolder_(s.id);
  var copy = withScriptLock_(function () {
    return DriveApp.getFileById(TEMPLATE_SHEET_ID).makeCopy('세팅시트_' + s.id, folder);
  });

  s.sheetId = copy.getId();
  s.sheetUrl = copy.getUrl();
  saveSession_(s);
  return SpreadsheetApp.openById(s.sheetId);
}


// ══════════════════════════════════════════════════════
// 동기화 진입점
// ══════════════════════════════════════════════════════
/**
 * 한 단계만 시트에 반영.
 * 단계 완료 시점에만 호출합니다. 매 저장마다 쓰면 API 할당량이 빨리 찹니다.
 */
function syncStepToSheet_(s, stepKey) {
  var tab = STEP_TO_TAB[stepKey];
  if (!tab) return;
  if (PROTECTED_TABS.indexOf(tab) !== -1) return;

  var spec = TAB_SPEC[tab];
  if (!spec) return;

  var ss = ensureShopSheet_(s);
  var sh = ss.getSheetByName(tab);
  if (!sh) return;

  var payload = (s.data && s.data[stepKey]) || {};

  if (spec.kind === 'vertical') writeVertical_(sh, spec, payload);
  else if (spec.kind === 'table') writeTable_(sh, spec, payload);
  else if (spec.kind === 'blocks') writeImageBlocks_(sh, spec, payload);
}

function syncAllToSheet_(s) {
  Object.keys(STEP_TO_TAB).forEach(function (k) {
    try { syncStepToSheet_(s, k); } catch (e) {}
  });
}


// ══════════════════════════════════════════════════════
// 세로형 (01 · 02 · 07 · 08)
// ══════════════════════════════════════════════════════
/**
 * B열 항목명으로 행을 찾아 D(입력값)·E(상태)에 씁니다.
 *
 * payload 예: { "상호명": {v:"라온에스테틱", st:"입력완료"}, ... }
 *
 * 항목명이 탭 안에서 겹치면(08_스마트콜의 `사용 여부` 등) 이름만으로는 행이 정해지지
 * 않습니다. 이때는 `구분 · 항목` 형태의 조합 키만 받습니다.
 * 겹치는데 이름만 온 경우는 **쓰지 않고 건너뜁니다.** 5개 분기에 같은 값이 박히는 것보다
 * 비어 있는 편이 낫습니다.
 */
function writeVertical_(sh, spec, payload) {
  var lastRow = Math.min(spec.endRow, sh.getLastRow());
  var n = lastRow - spec.startRow + 1;
  if (n < 1) return;

  var groups = sh.getRange(spec.startRow, 1, n, 1).getValues();   // A열 구분
  var labels = sh.getRange(spec.startRow, 2, n, 1).getValues();   // B열 항목
  var cells = sh.getRange(spec.startRow, 4, n, 2).getValues();    // D열 값 · E열 상태

  // 항목명이 몇 번 나오는지 먼저 셉니다
  var seen = {};
  for (var i = 0; i < labels.length; i++) {
    var t = String(labels[i][0] || '').trim();
    if (t) seen[t] = (seen[t] || 0) + 1;
  }

  var changed = false;
  for (var r = 0; r < labels.length; r++) {
    var label = String(labels[r][0] || '').trim();
    if (!label) continue;

    var group = String(groups[r][0] || '').trim();
    var composite = group ? (group + ' · ' + label) : label;
    var key = null;

    if (has_(payload, composite)) key = composite;
    else if (seen[label] === 1 && has_(payload, label)) key = label;
    if (key === null) continue;

    var cell = payload[key];
    var v = (cell && typeof cell === 'object') ? cell.v : cell;
    var st = (cell && typeof cell === 'object') ? cell.st : '';

    v = (v === undefined || v === null) ? '' : v;
    if (cells[r][0] !== v) { cells[r][0] = v; changed = true; }
    if (st && cells[r][1] !== st) { cells[r][1] = st; changed = true; }
  }
  if (changed) sh.getRange(spec.startRow, 4, n, 2).setValues(cells);
}

function has_(o, k) {
  return o && Object.prototype.hasOwnProperty.call(o, k);
}


// ══════════════════════════════════════════════════════
// 표형 (03 · 04 · 05 · 06)
// ══════════════════════════════════════════════════════
/**
 * payload 예: { rows: [ ['바디','등 관리 60분',60,80000,...], ... ] }
 *
 * rows 의 각 배열은 **spec.cols 순서와 1:1로 맞춰** 보내야 합니다.
 * 수식 열은 cols 에 없으므로 배열에서도 빼야 합니다.
 * 예) 06_예약상품 → [예약상품명, 대상구분, 대상명, 판매유형, 정가, 판매가, 구매대상, ...]
 *     (포함 시술·할인율은 시트가 계산하므로 넣지 않습니다)
 *
 * 03_영업시간처럼 표 아래 따로 붙은 항목은 spec.tail 로 처리합니다.
 */
function writeTable_(sh, spec, payload) {
  var rows = (payload && payload.rows) || [];
  var capacity = spec.endRow - spec.startRow + 1;
  if (rows.length > capacity) rows = rows.slice(0, capacity);

  writeCols_(sh, spec.startRow, spec.endRow, spec.cols, rows);

  if (spec.tail) writeTail_(sh, spec.tail, payload);
}

/**
 * 표 아래 별도 항목 (03_영업시간 15~17행: 정기 휴무 · 명절 휴무 · 연차 안내)
 * 라벨이 B열이 아니라 A열에 있고, 입력칸은 B:E 병합이라 B열에 씁니다.
 * payload.tail 예: { "정기 휴무": "매주 월요일" }
 */
function writeTail_(sh, tail, payload) {
  var data = (payload && payload.tail) || {};
  var n = tail.endRow - tail.startRow + 1;
  if (n < 1) return;

  var labels = sh.getRange(tail.startRow, tail.labelCol, n, 1).getValues();
  var vals = sh.getRange(tail.startRow, tail.valueCol, n, 1).getValues();
  var changed = false;

  for (var i = 0; i < labels.length; i++) {
    var label = String(labels[i][0] || '').trim();
    if (!label || !has_(data, label)) continue;
    var cell = data[label];
    var v = (cell && typeof cell === 'object') ? cell.v : cell;
    v = (v === undefined || v === null) ? '' : v;
    if (vals[i][0] !== v) { vals[i][0] = v; changed = true; }
  }
  if (changed) sh.getRange(tail.startRow, tail.valueCol, n, 1).setValues(vals);
}


// ══════════════════════════════════════════════════════
// 09_이미지 — 한 탭에 표가 셋
// ══════════════════════════════════════════════════════
/**
 * payload 는 업로드가 쌓아둔 { items: [...] } 입니다.
 * 용도에 따라 세 블록으로 갈라서 각자의 행 범위에 씁니다.
 *
 * 열: C 세부용도·연결대상 · D 파일명 · E 대표여부 · F 노출순서 · G 드라이브링크
 *     (A No · B 구분은 템플릿 고정값, H 비고는 메모라 건드리지 않습니다)
 */
function writeImageBlocks_(sh, spec, payload) {
  var items = (payload && payload.items) || [];

  var bucket = { '업체사진': [], '예약메인': [], '예약상품': [] };
  items.forEach(function (it) {
    var cat = it.category || '';
    if (SHOP_PHOTO_CATEGORIES.indexOf(cat) !== -1) bucket['업체사진'].push(it);
    else if (cat === '예약메인') bucket['예약메인'].push(it);
    else if (cat === '예약상품') bucket['예약상품'].push(it);
  });

  Object.keys(bucket).forEach(function (k) {
    bucket[k].sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  });

  spec.blocks.forEach(function (b) {
    var list = bucket[b.key] || [];
    var capacity = b.endRow - b.startRow + 1;
    if (list.length > capacity) list = list.slice(0, capacity);

    var rows = list.map(function (it) {
      return [
        b.key === '예약상품' ? (it.productName || '') : (b.key === '예약메인' ? '—' : (it.category || '')),
        it.fileName || '',
        it.isMain ? 'Y' : '',
        it.order || '',
        it.url || ''
      ];
    });
    writeCols_(sh, b.startRow, b.endRow, spec.cols, rows);
  });
}


// ══════════════════════════════════════════════════════
// 공통 쓰기 — 열을 건너뛰며 씁니다
// ══════════════════════════════════════════════════════
/**
 * cols 에 적힌 열에만 값을 넣고, 목록에 없는 열은 손대지 않습니다.
 * 연속된 열끼리 묶어 한 번에 써서 API 호출을 줄입니다.
 *
 * rows 보다 아래쪽 행은 비웁니다. 사장님이 시술을 지우고 재제출했는데
 * 예전 행이 시트에 남아 있으면 담당자가 지운 줄 모르고 그대로 옮겨 심습니다.
 */
function writeCols_(sh, startRow, endRow, cols, rows) {
  var maxRow = Math.min(endRow, sh.getMaxRows());
  var height = maxRow - startRow + 1;
  if (height < 1 || !cols || !cols.length) return;

  // 값이 있는 행 + 아래 빈 행까지 통째로 만들어 둡니다
  var grid = [];
  for (var r = 0; r < height; r++) {
    var src = rows[r] || [];
    var line = [];
    for (var c = 0; c < cols.length; c++) {
      var v = src[c];
      line.push((v === undefined || v === null) ? '' : v);
    }
    grid.push(line);
  }

  // 연속된 열 묶음(run)으로 나눠 씁니다
  var run = [];
  for (var i = 0; i < cols.length; i++) {
    if (run.length && cols[i] !== cols[i - 1] + 1) {
      flushRun_(sh, startRow, height, cols, run, grid);
      run = [];
    }
    run.push(i);
  }
  if (run.length) flushRun_(sh, startRow, height, cols, run, grid);
}

function flushRun_(sh, startRow, height, cols, run, grid) {
  var firstCol = cols[run[0]];
  var width = run.length;
  var block = grid.map(function (line) {
    return run.map(function (idx) { return line[idx]; });
  });
  sh.getRange(startRow, firstCol, height, width).setValues(block);
}
