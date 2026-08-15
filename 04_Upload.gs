/**
 * 이미지 업로드
 *
 * 20MB 원본을 그대로 받지 않습니다.
 * base64 인코딩으로 33% 늘어나고 실행 제한이 6분이라 현실성이 없습니다.
 * 클라이언트에서 2048px로 리사이즈한 뒤 한 장씩 순차 전송합니다.
 */

/**
 * @param {Object} p
 *   id          {string} 세팅 ID
 *   category    {string} 외관 / 내부 / ...
 *   mimeType    {string}
 *   dataBase64  {string} 데이터 URL 접두어를 뺀 순수 base64
 *   originalKB  {number} 리사이즈 전 크기 (측정·기록용)
 *   productName {string} 예약상품 이미지일 때 대상 상품명
 */
function apiUploadImage(p) {
  var t0 = Date.now();
  try {
    if (!p || !p.id) throw new Error('업체 정보가 없습니다.');
    if (IMAGE_CATEGORIES.indexOf(p.category) === -1) throw new Error('알 수 없는 용도: ' + p.category);
    if (!p.dataBase64) throw new Error('파일 데이터가 비어 있습니다.');

    var bytes = Utilities.base64Decode(p.dataBase64);
    var sizeKB = Math.round(bytes.length / 1024);
    if (bytes.length > MAX_UPLOAD_MB * 1024 * 1024) {
      throw new Error('파일이 너무 큽니다 (' + sizeKB + 'KB). ' + MAX_UPLOAD_MB + 'MB 이하로 줄여주세요.');
    }

    var folder = shopSubFolder_(p.id, categoryFolder_(p.category));
    var fileName = nextFileName_(folder, p.category, p.productName);
    var blob = Utilities.newBlob(bytes, p.mimeType || 'image/jpeg', fileName);
    var file = folder.createFile(blob);
    file.setDescription('원본 ' + (p.originalKB || '?') + 'KB → 저장 ' + sizeKB + 'KB');

    // 세션에 기록해 두면 재진입 시 목록이 그대로 뜹니다.
    var s = loadSession_(p.id);
    if (s) {
      s.data.image = s.data.image || { items: [] };
      s.data.image.items = s.data.image.items || [];
      s.data.image.items.push({
        fileId: file.getId(),
        fileName: fileName,
        category: p.category,
        productName: p.productName || '',
        url: file.getUrl(),
        sizeKB: sizeKB,
        isMain: false,
        order: s.data.image.items.length + 1
      });
      s.updatedAt = nowIso_();
      saveSession_(s);
    }

    return {
      ok: true, fileName: fileName, fileId: file.getId(), url: file.getUrl(),
      savedKB: sizeKB, serverMs: Date.now() - t0
    };
  } catch (e) {
    return { ok: false, error: errMsg_(e), serverMs: Date.now() - t0 };
  }
}

/** 용도별 폴더명 — 담당자가 폴더만 보고도 알 수 있게 번호를 붙입니다. */
function categoryFolder_(cat) {
  var map = {
    '외관': '01_외관사진', '내부': '02_내부사진', '관리실': '03_관리실사진',
    '시술': '04_시술사진', '제품': '05_제품사진', '로고': '06_로고',
    '예약메인': '07_예약메인', '예약상품': '08_예약상품'
  };
  return map[cat] || '99_기타';
}

/**
 * 파일명 자동 생성.
 * 폰 원본 IMG_4821.jpg 를 그대로 두면 담당자가 뭐가 뭔지 모릅니다.
 */
function nextFileName_(folder, category, productName) {
  if (category === '예약상품' && productName) {
    return '상품_' + String(productName).replace(/[\\/:*?"<>|\s]/g, '') + '.jpg';
  }
  var n = 0;
  var it = folder.getFiles();
  while (it.hasNext()) { it.next(); n++; }
  return category + '_' + String(n + 1).padStart(2, '0') + '.jpg';
}

/** 대표 사진 지정 · 순서 변경 */
function apiUpdateImageMeta(p) {
  try {
    var s = loadSession_(p.id);
    if (!s || !s.data.image) throw new Error('이미지 정보가 없습니다.');
    var items = s.data.image.items || [];

    items.forEach(function (it) {
      if (it.fileId === p.fileId) {
        if (p.isMain !== undefined) it.isMain = !!p.isMain;
        if (p.order !== undefined) it.order = Number(p.order);
      } else if (p.isMain && it.category === p.category) {
        it.isMain = false;   // 용도별 대표는 하나만
      }
    });
    s.updatedAt = nowIso_();
    saveSession_(s);
    return { ok: true, items: items };
  } catch (e) {
    return { ok: false, error: errMsg_(e) };
  }
}

function apiDeleteImage(p) {
  try {
    var s = loadSession_(p.id);
    if (!s || !s.data.image) throw new Error('이미지 정보가 없습니다.');
    try { DriveApp.getFileById(p.fileId).setTrashed(true); } catch (e) {}
    s.data.image.items = (s.data.image.items || []).filter(function (i) { return i.fileId !== p.fileId; });
    s.updatedAt = nowIso_();
    saveSession_(s);
    return { ok: true, items: s.data.image.items };
  } catch (e) {
    return { ok: false, error: errMsg_(e) };
  }
}
