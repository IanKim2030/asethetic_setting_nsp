/**
 * 스마트플레이스 세팅 폼 — 공통 설정
 *
 * 배포 전에 아래 세 개만 채우면 동작합니다.
 */

// ── 반드시 채우세요 ──────────────────────────────────
/** 세션 인덱스를 기록할 스프레드시트 ID. 빈 문자열이면 첫 실행 때 자동 생성됩니다. */
const SESSION_SHEET_ID = '';

/** 업체별로 복사할 마스터 세팅시트 ID. 비워두면 시트 생성 단계를 건너뜁니다. */
const TEMPLATE_SHEET_ID = '1jwfCjhKPa7svBWNM89EH49p2M05mPVsBjMjygMkaQqk';

/** 제출·수정 알림을 받을 담당자 메일. 쉼표로 여러 명 가능. */
const NOTIFY_EMAIL = 'aesthetic.kyunyong.kim@gmail.com';


// ── 고정값 ──────────────────────────────────────────
const ROOT_FOLDER_NAME = '스마트플레이스_세팅';
const SESSION_SHEET_NAME = '세션목록';
const SESSION_FILE = '_session.json';
const SNAPSHOT_DIR = '_snapshots';

/** 서버측 업로드 방어선 (MB). 클라이언트 리사이즈가 실패해도 여기서 막힙니다. */
const MAX_UPLOAD_MB = 8;

/** 이미지 용도 — 09_이미지 탭의 세부 용도와 동일하게 유지하세요. */
const IMAGE_CATEGORIES = ['외관', '내부', '관리실', '시술', '제품', '로고', '예약메인', '예약상품'];

/**
 * 단계 정의.
 * ★ 화면 순서를 코드에 하드코딩하지 않습니다.
 *   나중에 업종 선택 단계를 앞에 끼우려면 이 배열에 한 줄만 추가하면 됩니다.
 *   key 는 URL 해시로도 쓰이므로 번호가 아니라 이름을 씁니다.
 */
const STEPS = [
  { key: 'basic',   title: '기본정보',  required: true,  scope: 'common' },
  { key: 'hours',   title: '영업시간',  required: true,  scope: 'common' },
  { key: 'extra',   title: '부가정보',  required: false, scope: 'common' },
  { key: 'menu',    title: '시술메뉴',  required: true,  scope: 'industry' },
  { key: 'package', title: '패키지',    required: false, scope: 'industry' },
  { key: 'product', title: '예약상품',  required: false, scope: 'industry' },
  { key: 'booking', title: '예약설정',  required: false, scope: 'industry' },
  { key: 'call',    title: '스마트콜',  required: false, scope: 'common' },
  { key: 'image',   title: '이미지',    required: true,  scope: 'common' },
  { key: 'review',  title: '검토·제출', required: false, scope: 'system' }
];

/** 예약 관련 단계 — "예약을 받지 않음"이면 통째로 건너뜁니다. */
const BOOKING_STEPS = ['product', 'booking'];

function getStep_(key) {
  for (var i = 0; i < STEPS.length; i++) if (STEPS[i].key === key) return STEPS[i];
  return null;
}
