/**
 * 01_WebApp.gs 의 순수 함수 검증.
 * calcProgress_ / collectIssues_ 는 s(세션 객체)만 받아 계산하므로 Google 서비스 스텁이 필요 없다.
 */
const testkit = require('./testkit.js');
const T = testkit.session();

const ctx = testkit.loadGs(['00_Config.gs', '01_WebApp.gs']);
// 00_Config.gs 의 STEPS/BOOKING_STEPS 는 const 라 vm 컨텍스트 객체 프로퍼티로 안 나오므로 명시적으로 꺼낸다.
testkit.bridge(ctx, ['STEPS', 'BOOKING_STEPS']);
// 실제 운영값에 절대 의존하지 않는다.
ctx.TEMPLATE_SHEET_ID = 'TEST_TEMPLATE_ID';
ctx.NOTIFY_EMAIL = 'test@example.com';

function baseSession() {
  var done = {};
  ctx.STEPS.forEach(function (st) { done[st.key] = false; });
  return { data: {}, done: done };
}

T.section('calcProgress_ : 예약 미사용이면 예약 관련 단계 제외');
{
  var s = baseSession();
  s.data.booking = { useOnlineBooking: 'N' };
  var p = ctx.calcProgress_(s);
  T.ok('product 가 activeKeys 에서 빠짐', p.activeKeys.indexOf('product') === -1, p.activeKeys.join(','));
  T.ok('booking 이 activeKeys 에서 빠짐', p.activeKeys.indexOf('booking') === -1, p.activeKeys.join(','));
  T.ok('review 는 애초에 제외', p.activeKeys.indexOf('review') === -1);
}

T.section('calcProgress_ : 예약 사용이면 예약 관련 단계 포함');
{
  var s = baseSession();
  s.data.booking = { useOnlineBooking: 'Y' };
  var p = ctx.calcProgress_(s);
  T.ok('product 포함', p.activeKeys.indexOf('product') !== -1);
  T.ok('booking 포함', p.activeKeys.indexOf('booking') !== -1);
}

T.section('calcProgress_ : booking 데이터 자체가 없을 때도 기본은 사용으로 침');
{
  var s = baseSession();
  var p = ctx.calcProgress_(s);
  T.ok('product 포함 (기본값)', p.activeKeys.indexOf('product') !== -1);
}

T.section('calcProgress_ : percent · canSubmit · missingRequired 계산');
{
  var s = baseSession();
  s.data.booking = { useOnlineBooking: 'N' };   // 예약 단계 제외 → 필수: basic, hours, menu, image
  var p1 = ctx.calcProgress_(s);
  T.ok('아무것도 안 했으면 canSubmit=false', p1.canSubmit === false);
  T.ok('missingRequired 에 필수 단계 제목이 담김', p1.missingRequired.length === p1.requiredTotal);

  ctx.STEPS.forEach(function (st) {
    if (st.key !== 'review' && ctx.BOOKING_STEPS.indexOf(st.key) === -1) s.done[st.key] = true;
  });
  var p2 = ctx.calcProgress_(s);
  T.ok('필수 단계를 모두 마치면 canSubmit=true', p2.canSubmit === true);
  T.ok('missingRequired 가 빔', p2.missingRequired.length === 0);
  T.ok('percent 는 100', p2.percent === 100, 'percent=' + p2.percent);
}

T.section('collectIssues_ : 현재 구현된 규칙만 핀(§6 전체 표는 별도 작업)');
{
  var s = baseSession();
  s.data.booking = { useOnlineBooking: 'Y' };
  s.data.product = { items: [] };
  var issues = ctx.collectIssues_(s);
  T.ok('예약 사용 + 예약상품 없음 → warn', issues.some(function (i) {
    return i.level === 'warn' && i.step === 'product';
  }), JSON.stringify(issues));
}
{
  var s = baseSession();
  s.data.product = { items: [{ name: 'x' }] };
  var issues = ctx.collectIssues_(s);
  T.ok('예약 미사용이면 예약상품 경고 없음', !issues.some(function (i) { return i.step === 'product'; }));
}
{
  var s = baseSession();
  s.data.image = { items: [{ fileName: 'a.jpg', isMain: false }, { fileName: 'b.jpg', isMain: false }] };
  var issues = ctx.collectIssues_(s);
  T.ok('대표 사진 없음 → warn', issues.some(function (i) { return i.level === 'warn' && i.step === 'image'; }));
}
{
  var s = baseSession();
  s.data.image = { items: [{ fileName: 'a.jpg', isMain: true }] };
  var issues = ctx.collectIssues_(s);
  T.ok('대표 사진 있으면 image 경고 없음', !issues.some(function (i) { return i.step === 'image'; }));
}
{
  var s = baseSession();
  s.data.basic = { '상호명': { v: '', __status: '상담필요', __label: '상호명' } };
  var issues = ctx.collectIssues_(s);
  T.ok('상담필요 상태가 ask 로 수집됨', issues.some(function (i) {
    return i.level === 'ask' && i.step === 'basic' && i.msg === '상호명';
  }), JSON.stringify(issues));
}

T.section('errMsg_');
{
  T.ok('Error 객체는 message 를 뽑는다', ctx.errMsg_(new Error('문제 발생')) === '문제 발생');
  T.ok('문자열은 그대로', ctx.errMsg_('원시 문자열') === '원시 문자열');
}

T.done();
