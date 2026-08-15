/**
 * 웹앱 진입점 + 클라이언트가 호출하는 API
 *
 * 배포: 배포 → 새 배포 → 웹 앱
 *   실행 계정  = 나
 *   액세스 권한 = 모든 사용자    ← 사장님이 구글 로그인 없이 들어옵니다
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('스마트플레이스 세팅 정보 입력')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Index.html 안에서 <?!= include('Css') ?> 형태로 부분 파일을 끼워 넣습니다. */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}


// ══════════════════════════════════════════════════════
// 클라이언트 API
// ══════════════════════════════════════════════════════

/** 화면이 뜰 때 필요한 정적 정보 */
function apiBootstrap() {
  return {
    steps: STEPS,
    bookingSteps: BOOKING_STEPS,
    imageCategories: IMAGE_CATEGORIES,
    maxUploadMB: MAX_UPLOAD_MB
  };
}

/**
 * 진입 · 인증
 * 신규면 세션을 만들고, 기존이면 뒷 4자리를 대조합니다.
 */
function apiEnter(req) {
  try {
    var shopName = String(req.shopName || '').trim();
    var ownerName = String(req.ownerName || '').trim();
    var phone4 = String(req.phone4 || '').trim();

    if (!shopName || !ownerName) throw new Error('상호명과 대표자명을 입력해 주세요.');
    if (!/^\d{4}$/.test(phone4)) throw new Error('휴대폰 뒷 4자리를 숫자로 입력해 주세요.');

    var id = makeSettingId_(shopName, ownerName, phone4);
    var found = findSession_(id);

    if (!found) {
      var created = createSession_(shopName, ownerName, phone4);
      return { ok: true, isNew: true, session: toClient_(created) };
    }

    // 세팅 ID 자체에 뒷 4자리가 들어 있으므로 여기까지 왔으면 일치합니다.
    // 상호+대표자명만 맞고 뒷자리가 다르면 위에서 다른 ID가 되어 신규로 갈립니다.
    var s = loadSession_(id);
    return { ok: true, isNew: false, session: toClient_(s) };

  } catch (e) {
    return { ok: false, error: errMsg_(e) };
  }
}

/** 자동저장 — 클라이언트가 10초 디바운스로 호출합니다. */
function apiSave(req) {
  try {
    var s = loadSession_(req.id);
    if (!s) throw new Error('세션을 찾을 수 없습니다. 처음 화면부터 다시 시작해 주세요.');

    if (req.stepKey) {
      // stepData 가 null 이면 "이 단계는 서버 값을 유지하라"는 뜻입니다.
      // 이미지처럼 목록의 주인이 서버인 단계가 여기 해당합니다.
      if (req.stepData !== null && req.stepData !== undefined) {
        s.data[req.stepKey] = req.stepData;
      }
      if (req.done === true) s.done[req.stepKey] = true;
      if (req.done === false) s.done[req.stepKey] = false;
      s.currentStep = req.stepKey;
    }
    s.updatedAt = nowIso_();
    saveSession_(s);

    // 단계를 마쳤을 때만 시트를 갱신합니다. 매 저장마다 쓰면 할당량이 빨리 찹니다.
    if (req.done === true && TEMPLATE_SHEET_ID) {
      try { syncStepToSheet_(s, req.stepKey); }
      catch (e2) { /* 시트 동기화 실패가 입력을 막지 않도록 삼킵니다 */ }
    }
    return { ok: true, updatedAt: s.updatedAt, progress: calcProgress_(s) };

  } catch (e) {
    return { ok: false, error: errMsg_(e) };
  }
}

/** 특정 단계 데이터 불러오기 */
function apiLoadStep(req) {
  try {
    var s = loadSession_(req.id);
    if (!s) throw new Error('세션을 찾을 수 없습니다.');
    return { ok: true, stepData: s.data[req.stepKey] || {}, progress: calcProgress_(s) };
  } catch (e) {
    return { ok: false, error: errMsg_(e) };
  }
}

/** 검토 화면용 — 전체 상태 */
function apiReview(req) {
  try {
    var s = loadSession_(req.id);
    if (!s) throw new Error('세션을 찾을 수 없습니다.');
    return { ok: true, session: toClient_(s), progress: calcProgress_(s), issues: collectIssues_(s) };
  } catch (e) {
    return { ok: false, error: errMsg_(e) };
  }
}

/** 최종 제출 */
function apiSubmit(req) {
  try {
    var s = loadSession_(req.id);
    if (!s) throw new Error('세션을 찾을 수 없습니다.');

    var p = calcProgress_(s);
    if (!p.canSubmit) throw new Error('필수 단계가 아직 남아 있습니다.');

    var isFirst = (s.version === 0);
    s.version += 1;
    s.status = (s.status === '완료') ? '변경요청' : (isFirst ? '접수' : s.status || '접수');
    s.submittedAt = s.submittedAt || nowIso_();
    s.updatedAt = nowIso_();

    var diff = isFirst ? [] : diffFromLastSnapshot_(s);
    writeSnapshot_(s);
    saveSession_(s);

    if (TEMPLATE_SHEET_ID) {
      try { syncAllToSheet_(s); } catch (e2) {}
    }
    if (NOTIFY_EMAIL) {
      try { notifySubmit_(s, isFirst, diff, p); } catch (e3) {}
    }
    return { ok: true, version: s.version, isFirst: isFirst, changes: diff.length };

  } catch (e) {
    return { ok: false, error: errMsg_(e) };
  }
}

/** 버전 목록 · 복원 */
function apiVersions(req) {
  try {
    return { ok: true, versions: listSnapshots_(req.id) };
  } catch (e) {
    return { ok: false, error: errMsg_(e) };
  }
}

function apiRestore(req) {
  try {
    var s = restoreSnapshot_(req.id, req.version);
    return { ok: true, session: toClient_(s), progress: calcProgress_(s) };
  } catch (e) {
    return { ok: false, error: errMsg_(e) };
  }
}


// ══════════════════════════════════════════════════════
// 진행률 · 검증
// ══════════════════════════════════════════════════════
function calcProgress_(s) {
  var usesBooking = !(s.data.booking && s.data.booking.useOnlineBooking === 'N');
  var active = STEPS.filter(function (st) {
    if (st.key === 'review') return false;
    if (!usesBooking && BOOKING_STEPS.indexOf(st.key) !== -1) return false;
    return true;
  });

  var doneCount = 0, reqTotal = 0, reqDone = 0;
  var missing = [];
  active.forEach(function (st) {
    var d = !!s.done[st.key];
    if (d) doneCount++;
    if (st.required) {
      reqTotal++;
      if (d) reqDone++; else missing.push(st.title);
    }
  });

  return {
    percent: active.length ? Math.round(doneCount / active.length * 100) : 0,
    doneCount: doneCount,
    totalCount: active.length,
    requiredDone: reqDone,
    requiredTotal: reqTotal,
    missingRequired: missing,
    canSubmit: reqTotal > 0 && reqDone === reqTotal,
    activeKeys: active.map(function (st) { return st.key; })
  };
}

/**
 * 교차 검증 — 단계 안에서는 안 잡히고 검토 화면에서만 보이는 문제들.
 * 골격에서는 자리만 잡아둡니다. 각 단계를 구현하면서 채우세요.
 */
function collectIssues_(s) {
  var out = [];
  var d = s.data || {};

  // 예: 예약을 쓰는데 예약상품이 하나도 없음
  if (d.booking && d.booking.useOnlineBooking === 'Y') {
    var products = (d.product && d.product.items) || [];
    if (!products.length) {
      out.push({ level: 'warn', step: 'product', msg: '예약을 받으시는데 예약 상품이 없습니다.' });
    }
  }
  // 예: 대표 사진 미지정
  var imgs = (d.image && d.image.items) || [];
  if (imgs.length && !imgs.some(function (i) { return i.isMain; })) {
    out.push({ level: 'warn', step: 'image', msg: '목록에 표시될 대표 사진을 골라주세요.' });
  }

  // "상담 필요"로 표시된 항목 모으기 — 담당자 통화 목록이 됩니다
  Object.keys(d).forEach(function (k) {
    var v = d[k] || {};
    Object.keys(v).forEach(function (f) {
      if (v[f] && v[f].__status === '상담필요') {
        out.push({ level: 'ask', step: k, msg: (v[f].__label || f) });
      }
    });
  });
  return out;
}

function errMsg_(e) { return String(e && e.message ? e.message : e); }
function nowIso_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', "yyyy-MM-dd'T'HH:mm:ss"); }
