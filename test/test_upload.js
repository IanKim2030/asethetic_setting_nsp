/**
 * 04_Upload.gs 의 순수 함수 검증.
 */
const testkit = require('./testkit.js');
const T = testkit.session();

const ctx = testkit.loadGs('04_Upload.gs');

T.section('categoryFolder_ : 용도 → 폴더명 매핑');
{
  T.ok('외관', ctx.categoryFolder_('외관') === '01_외관사진');
  T.ok('내부', ctx.categoryFolder_('내부') === '02_내부사진');
  T.ok('관리실', ctx.categoryFolder_('관리실') === '03_관리실사진');
  T.ok('시술', ctx.categoryFolder_('시술') === '04_시술사진');
  T.ok('제품', ctx.categoryFolder_('제품') === '05_제품사진');
  T.ok('로고', ctx.categoryFolder_('로고') === '06_로고');
  T.ok('예약메인', ctx.categoryFolder_('예약메인') === '07_예약메인');
  T.ok('예약상품', ctx.categoryFolder_('예약상품') === '08_예약상품');
  T.ok('알 수 없는 용도는 99_기타로', ctx.categoryFolder_('없는용도') === '99_기타');
}

T.section('nextFileName_ : 예약상품은 상품명 기반, 순수하게 결정됨');
{
  T.ok('상품명 정상 케이스', ctx.nextFileName_(null, '예약상품', '첫방문 등관리 체험') === '상품_첫방문등관리체험.jpg');
  T.ok('상품명에 금지문자·공백 제거',
    ctx.nextFileName_(null, '예약상품', '등/관리 60분*체험') === '상품_등관리60분체험.jpg');
}

T.done();
