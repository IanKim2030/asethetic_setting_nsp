/**
 * 05_Notify.gs 의 순수 함수 검증.
 * notifySubmit_ 자체(MailApp.sendEmail 호출)는 라이브 QA 로 확인한다 — QA_CHECKLIST.md 참고.
 */
const testkit = require('./testkit.js');
const T = testkit.session();

const ctx = testkit.loadGs(['00_Config.gs', '05_Notify.gs']);
ctx.NOTIFY_EMAIL = 'test@example.com';

T.section('stepTitle_ : 키 → 제목, 모르는 키는 키 그대로');
{
  T.ok('알려진 키', ctx.stepTitle_('basic') === '기본정보');
  T.ok('모르는 키는 폴백', ctx.stepTitle_('없는키') === '없는키');
}

function baseProgress() {
  return { percent: 80, requiredDone: 4, requiredTotal: 5 };
}

T.section('buildNotifyBody_ : 비어 있으면 섹션 자체가 안 나온다');
{
  var body = ctx.buildNotifyBody_({ id: 'x' }, true, [], baseProgress(), [], '');
  T.ok('상담 필요 섹션 없음', body.indexOf('상담 필요') === -1, body);
  T.ok('주의 섹션 없음', body.indexOf('■ 주의') === -1, body);
  T.ok('변경 섹션 없음', body.indexOf('■ 변경') === -1, body);
  T.ok('완성도 요약은 항상 있음', body.indexOf('완성도    80%') !== -1, body);
}

T.section('buildNotifyBody_ : ask/warn 섹션 내용');
{
  var issues = [
    { level: 'ask', step: 'basic', msg: '상호명 확인 필요' },
    { level: 'warn', step: 'image', msg: '대표 사진 없음' }
  ];
  var body = ctx.buildNotifyBody_({ id: 'x' }, true, [], baseProgress(), issues, '');
  T.ok('상담 필요 1건 표시', body.indexOf('상담 필요 1건') !== -1, body);
  T.ok('상담 필요 항목 내용 · 단계 제목 사용', body.indexOf('[기본정보] 상호명 확인 필요') !== -1, body);
  T.ok('주의 1건 표시', body.indexOf('주의 1건') !== -1, body);
  T.ok('주의 항목 내용', body.indexOf('[이미지] 대표 사진 없음') !== -1, body);
}

T.section('buildNotifyBody_ : 첫 제출이면 변경 섹션 자체를 안 보여줌');
{
  var diff = [{ step: '기본정보', field: '상호명', before: 'A', after: 'B' }];
  var body = ctx.buildNotifyBody_({ id: 'x' }, true, diff, baseProgress(), [], '');
  T.ok('isFirst=true 면 diff 가 있어도 변경 섹션 없음', body.indexOf('■ 변경') === -1, body);
}

T.section('buildNotifyBody_ : 재제출 diff 는 30건까지, 넘으면 요약');
{
  var diff = [];
  for (var i = 0; i < 35; i++) diff.push({ step: '기본정보', field: 'f' + i, before: 'a', after: 'b' });
  var body = ctx.buildNotifyBody_({ id: 'x' }, false, diff, baseProgress(), [], '');
  T.ok('변경 35건 헤더', body.indexOf('■ 변경 35건') !== -1, body);
  T.ok('마지막 항목(f34)은 30개 제한에 안 걸림 여부와 무관하게 요약 문구 존재',
    body.indexOf('… 외 5건') !== -1, body);
  T.ok('f29(30번째)는 포함', body.indexOf('f29') !== -1);
  T.ok('f30(31번째)은 잘림', body.indexOf('f30') === -1);
}

T.section('buildNotifyBody_ : 시트·드라이브 링크 부착');
{
  var body = ctx.buildNotifyBody_({ id: 'x', sheetUrl: 'https://sheet/1' }, true, [], baseProgress(), [], 'https://folder/1');
  T.ok('세팅시트 링크', body.indexOf('세팅시트  https://sheet/1') !== -1, body);
  T.ok('드라이브 링크', body.indexOf('드라이브  https://folder/1') !== -1, body);
}
{
  var body = ctx.buildNotifyBody_({ id: 'x' }, true, [], baseProgress(), [], '');
  T.ok('링크 없으면 라인 자체가 없음', body.indexOf('세팅시트') === -1 && body.indexOf('드라이브') === -1);
}

T.done();
