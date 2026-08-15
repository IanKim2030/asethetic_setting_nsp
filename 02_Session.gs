/**
 * 세션 저장소
 *
 * 설계 원칙
 *  - 작성 중 데이터는 드라이브의 JSON 파일에 둡니다.
 *    PropertiesService 는 전체 500KB 제한이라 업체 몇 개면 터집니다.
 *  - 스프레드시트는 "누가 어디까지 했나"를 보는 인덱스 역할만 합니다.
 *  - 스냅샷은 버전마다 전체를 통째로 저장합니다.
 *    변경분만 쌓아 역산하면 하나만 어긋나도 복원이 깨집니다.
 */

function makeSettingId_(shopName, ownerName, phone4) {
  return [shopName, ownerName, phone4].join('_').replace(/[\\/:*?"<>|]/g, '');
}


// ── 잠금 ────────────────────────────────────────────
/**
 * ★ 잠금은 절대 겹쳐 잡지 않습니다.
 *
 * LockService 는 같은 실행 안에서 다시 잡는 것을 보장하지 않습니다.
 * 잠금을 쥔 채 또 잠그는 함수를 부르면 30초를 기다린 뒤 Lock timeout 으로 죽습니다.
 * 그래서 withScriptLock_ 안에서는 잠금을 잡는 다른 함수를 부르지 않습니다.
 * (내부용 ...Raw_ 함수를 따로 둔 이유입니다)
 */
function withScriptLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}


// ── 폴더 ────────────────────────────────────────────
function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** 잠금 없이 폴더를 확보하는 내부 구현. 반드시 잠금 안에서만 부르세요. */
function shopFolderRaw_(id) {
  var root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
  return getOrCreateFolder_(root, id);
}

/**
 * 한 번의 실행 안에서 같은 폴더를 여러 번 찾습니다.
 * 드라이브 조회는 느리고 잠금까지 걸리므로 실행 단위로 캐시합니다.
 * (실행이 끝나면 사라지므로 오래된 값이 남을 걱정은 없습니다)
 */
var _folderCache = {};

/** 폴더 생성은 동시 요청 시 중복될 수 있어 Lock 으로 감쌉니다. */
function shopFolder_(id) {
  if (_folderCache[id]) return _folderCache[id];
  var f = withScriptLock_(function () { return shopFolderRaw_(id); });
  _folderCache[id] = f;
  return f;
}

function shopSubFolder_(id, name) {
  var key = id + '/' + name;
  if (_folderCache[key]) return _folderCache[key];
  // shopFolder_ 를 부르면 잠금이 겹치므로 Raw 를 씁니다
  var f = withScriptLock_(function () {
    return getOrCreateFolder_(shopFolderRaw_(id), name);
  });
  _folderCache[key] = f;
  return f;
}


// ── 세션 CRUD ───────────────────────────────────────
function newSessionObject_(shopName, ownerName, phone4) {
  var done = {};
  STEPS.forEach(function (s) { done[s.key] = false; });
  return {
    id: makeSettingId_(shopName, ownerName, phone4),
    shopName: shopName,
    ownerName: ownerName,
    phone4: phone4,
    createdAt: nowIso_(),
    updatedAt: nowIso_(),
    submittedAt: '',
    version: 0,
    status: '작성중',
    currentStep: STEPS[0].key,
    data: {},
    done: done
  };
}

function createSession_(shopName, ownerName, phone4) {
  var s = newSessionObject_(shopName, ownerName, phone4);
  saveSession_(s);
  upsertIndexRow_(s);
  return s;
}

function sessionFile_(id, createIfMissing) {
  var folder = shopFolder_(id);
  var it = folder.getFilesByName(SESSION_FILE);
  if (it.hasNext()) return it.next();
  if (!createIfMissing) return null;
  return folder.createFile(SESSION_FILE, '{}', MimeType.PLAIN_TEXT);
}

function loadSession_(id) {
  if (!id) return null;
  var f = sessionFile_(id, false);
  if (!f) return null;
  var txt = f.getBlob().getDataAsString('UTF-8');
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return null; }
}

function findSession_(id) {
  return sessionFile_(id, false) !== null;
}

function saveSession_(s) {
  var f = sessionFile_(s.id, true);
  f.setContent(JSON.stringify(s));
  upsertIndexRow_(s);
}

/** 클라이언트로 내보낼 때는 통째로 보냅니다. 민감정보가 따로 없어 가공하지 않습니다. */
function toClient_(s) { return s; }


// ── 인덱스 스프레드시트 ──────────────────────────────
var INDEX_HEADERS = ['세팅ID', '업체명', '대표자명', '뒷4자리', '생성일시', '최종수정',
                     '현재단계', '버전', '처리상태', '완성도', '폴더', '세팅시트'];

function indexSheet_() {
  var ss;
  if (SESSION_SHEET_ID) {
    ss = SpreadsheetApp.openById(SESSION_SHEET_ID);
  } else {
    // 설정을 비워둔 경우 루트 폴더에 하나 만들어 씁니다.
    var name = ROOT_FOLDER_NAME + '_세션인덱스';
    var files = DriveApp.getFilesByName(name);
    ss = files.hasNext()
      ? SpreadsheetApp.open(files.next())
      : SpreadsheetApp.create(name);
  }
  var sh = ss.getSheetByName(SESSION_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SESSION_SHEET_NAME);
    sh.getRange(1, 1, 1, INDEX_HEADERS.length).setValues([INDEX_HEADERS])
      .setFontWeight('bold').setBackground('#1F3864').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function upsertIndexRow_(s) {
  // ★ 잠그기 전에 준비를 끝냅니다.
  //   shopFolder_ 는 스스로 잠금을 잡으므로 잠금 안에서 부르면 겹칩니다.
  var p = calcProgress_(s);
  var folderUrl = '';
  try { folderUrl = shopFolder_(s.id).getUrl(); } catch (e) { /* 링크는 없어도 됩니다 */ }

  var values = [[s.id, s.shopName, s.ownerName, s.phone4, s.createdAt, s.updatedAt,
                 s.currentStep, s.version, s.status, p.percent + '%',
                 folderUrl, s.sheetUrl || '']];

  withScriptLock_(function () {
    var sh = indexSheet_();
    var last = sh.getLastRow();
    var row = -1;
    if (last >= 2) {
      var ids = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (ids[i][0] === s.id) { row = i + 2; break; }
    }
    if (row === -1) sh.appendRow(values[0]);
    else sh.getRange(row, 1, 1, INDEX_HEADERS.length).setValues(values);
  });
}


// ── 스냅샷 · 복원 ───────────────────────────────────
function snapshotFolder_(id) { return shopSubFolder_(id, SNAPSHOT_DIR); }

function writeSnapshot_(s) {
  var name = 'v' + s.version + '.json';
  var folder = snapshotFolder_(s.id);
  var it = folder.getFilesByName(name);
  if (it.hasNext()) it.next().setTrashed(true);
  folder.createFile(name, JSON.stringify(s), MimeType.PLAIN_TEXT);
}

function readSnapshot_(id, version) {
  var it = snapshotFolder_(id).getFilesByName('v' + version + '.json');
  if (!it.hasNext()) return null;
  return JSON.parse(it.next().getBlob().getDataAsString('UTF-8'));
}

function listSnapshots_(id) {
  var out = [];
  var it = snapshotFolder_(id).getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var m = f.getName().match(/^v(\d+)\.json$/);
    if (!m) continue;
    var snap = null;
    try { snap = JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) {}
    out.push({
      version: Number(m[1]),
      savedAt: snap ? snap.updatedAt : '',
      status: snap ? snap.status : '',
      percent: snap ? calcProgress_(snap).percent : 0
    });
  }
  out.sort(function (a, b) { return b.version - a.version; });
  return out;
}

/**
 * 복원 — 이전 버전을 덮어쓰지 않고 새 버전으로 만듭니다.
 * 이래야 복원의 복원이 되고, 담당자가 보던 버전이 사라지지 않습니다.
 */
function restoreSnapshot_(id, version) {
  var snap = readSnapshot_(id, version);
  if (!snap) throw new Error('v' + version + ' 스냅샷을 찾을 수 없습니다.');

  var cur = loadSession_(id);
  if (!cur) throw new Error('세션을 찾을 수 없습니다.');

  var restored = JSON.parse(JSON.stringify(snap));
  restored.version = cur.version + 1;
  restored.updatedAt = nowIso_();
  restored.status = cur.status;
  restored.restoredFrom = version;

  writeSnapshot_(restored);
  saveSession_(restored);
  return restored;
}

/** 직전 스냅샷과 비교해 변경 목록을 만듭니다. */
function diffFromLastSnapshot_(s) {
  var prev = readSnapshot_(s.id, s.version - 1);
  if (!prev) return [];
  var out = [];
  STEPS.forEach(function (st) {
    var a = (prev.data && prev.data[st.key]) || {};
    var b = (s.data && s.data[st.key]) || {};
    var keys = {};
    Object.keys(a).forEach(function (k) { keys[k] = 1; });
    Object.keys(b).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var va = JSON.stringify(a[k] === undefined ? '' : a[k]);
      var vb = JSON.stringify(b[k] === undefined ? '' : b[k]);
      if (va !== vb) out.push({ step: st.title, field: k, before: trim_(va), after: trim_(vb) });
    });
  });
  return out;
}

function trim_(v) {
  var t = String(v).replace(/^"|"$/g, '');
  return t.length > 60 ? t.slice(0, 60) + '…' : t;
}
