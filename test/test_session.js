/**
 * 02_Session.gs 의 순수/근사순수 함수 검증.
 * Drive/Sheets 를 실제로 부르는 부분은 스텁으로 대체한다.
 */
const testkit = require('./testkit.js');
const T = testkit.session();

T.section('makeSettingId_ : 특수문자 제거');
{
  const ctx = testkit.loadGs('02_Session.gs');
  T.ok('일반 조합', ctx.makeSettingId_('라온에스테틱', '홍길동', '1234') === '라온에스테틱_홍길동_1234');
  T.ok('금지문자 제거', ctx.makeSettingId_('라온/에스테틱', '홍*길동', '1234') === '라온에스테틱_홍길동_1234');
  T.ok('phone4 가 다르면 다른 id',
    ctx.makeSettingId_('라온', '홍길동', '1234') !== ctx.makeSettingId_('라온', '홍길동', '5678'));
}

T.section('trim_ : 따옴표 제거 + 60자 말줄임');
{
  const ctx = testkit.loadGs('02_Session.gs');
  T.ok('JSON.stringify 결과 따옴표 제거', ctx.trim_('"abc"') === 'abc');
  const longStr = 'a'.repeat(80);
  const out = ctx.trim_(JSON.stringify(longStr));
  T.ok('60자 넘으면 잘리고 …가 붙음', out.length === 61 && out.endsWith('…'), 'out.length=' + out.length);
  const shortStr = JSON.stringify('짧은값');
  T.ok('60자 이하면 안 잘림', ctx.trim_(shortStr) === '짧은값');
}

T.section('diffFromLastSnapshot_ : 두 버전 사이 바뀐 필드만 추림');
{
  const ctx = testkit.loadGs(['00_Config.gs', '02_Session.gs'], { nowIso_: function () { return '2026-01-01T00:00:00'; } });
  const prev = { data: { basic: { 상호명: 'A상점' }, hours: { 정기휴무: '월요일' } } };
  ctx.readSnapshot_ = function () { return prev; };

  const s = { id: 'x', version: 2, data: { basic: { 상호명: 'B상점' }, hours: { 정기휴무: '월요일' } } };
  const diff = ctx.diffFromLastSnapshot_(s);

  T.ok('바뀐 필드만 담김 (상호명)', diff.some(function (d) { return d.field === '상호명'; }), JSON.stringify(diff));
  T.ok('안 바뀐 필드는 제외 (정기휴무)', !diff.some(function (d) { return d.field === '정기휴무'; }), JSON.stringify(diff));
  T.ok('before/after 값이 담김', diff.find(function (d) { return d.field === '상호명'; }).after === 'B상점');
}
{
  const ctx = testkit.loadGs(['00_Config.gs', '02_Session.gs'], { nowIso_: function () { return '2026-01-01T00:00:00'; } });
  ctx.readSnapshot_ = function () { return null; };   // 첫 제출 등 이전 스냅샷이 없을 때
  const diff = ctx.diffFromLastSnapshot_({ id: 'x', version: 1, data: {} });
  T.ok('이전 스냅샷 없으면 빈 배열', Array.isArray(diff) && diff.length === 0);
}

T.section('restoreSnapshot_ : 복원은 새 버전으로, 상태는 현재 것을 유지');
{
  const ctx = testkit.loadGs(['00_Config.gs', '02_Session.gs'], { nowIso_: function () { return '2026-01-01T00:00:00'; } });
  const savedCalls = [];
  const writtenCalls = [];
  const snapV2 = { id: 'x', version: 2, status: '접수', data: { basic: { 상호명: 'V2값' } } };
  const cur = { id: 'x', version: 5, status: '변경요청', data: { basic: { 상호명: 'V5값' } } };

  ctx.readSnapshot_ = function (id, version) { return version === 2 ? snapV2 : null; };
  ctx.loadSession_ = function () { return cur; };
  ctx.writeSnapshot_ = function (s) { writtenCalls.push(s); };
  ctx.saveSession_ = function (s) { savedCalls.push(s); };

  const restored = ctx.restoreSnapshot_('x', 2);

  T.ok('버전은 현재+1', restored.version === 6, 'version=' + restored.version);
  T.ok('상태는 현재 세션 것을 유지 (스냅샷 상태 아님)', restored.status === '변경요청', 'status=' + restored.status);
  T.ok('restoredFrom 기록', restored.restoredFrom === 2);
  T.ok('데이터는 복원 대상 스냅샷 것', restored.data.basic.상호명 === 'V2값');
  T.ok('writeSnapshot_ 1회 호출 (새 버전 파일 생성)', writtenCalls.length === 1 && writtenCalls[0].version === 6);
  T.ok('saveSession_ 1회 호출 (현재 세션으로 반영)', savedCalls.length === 1 && savedCalls[0].version === 6);
}
{
  const ctx = testkit.loadGs(['00_Config.gs', '02_Session.gs'], { nowIso_: function () { return '2026-01-01T00:00:00'; } });
  ctx.readSnapshot_ = function () { return null; };
  ctx.loadSession_ = function () { return { id: 'x', version: 1 }; };
  let threw = false;
  try { ctx.restoreSnapshot_('x', 99); } catch (e) { threw = true; }
  T.ok('없는 버전 복원 시도하면 예외', threw);
}

T.done();
