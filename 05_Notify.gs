/**
 * 담당자 메일 알림
 *
 * 일반 계정은 하루 100통, Workspace 는 1,500통입니다.
 * 담당자 알림만으로도 일반 계정은 금방 차므로 Workspace 계정을 쓰세요.
 */

function notifySubmit_(s, isFirst, diff, progress) {
  if (!NOTIFY_EMAIL) return;

  var tag = isFirst ? '[신규]' : (s.status === '변경요청' ? '[변경요청]' : '[수정]');
  var subject = tag + ' ' + s.shopName + ' (' + s.ownerName + ') 세팅 정보 ' +
                (isFirst ? '제출' : '수정 — v' + s.version);

  var issues = collectIssues_(s);
  var asks = issues.filter(function (i) { return i.level === 'ask'; });
  var warns = issues.filter(function (i) { return i.level === 'warn'; });

  var lines = [];
  lines.push('세팅 ID   ' + s.id);
  lines.push('완성도    ' + progress.percent + '%  ·  필수 ' +
             progress.requiredDone + '/' + progress.requiredTotal + ' 완료');
  lines.push('');

  if (asks.length) {
    lines.push('■ 상담 필요 ' + asks.length + '건  (통화로 함께 정해야 하는 항목)');
    asks.forEach(function (a) { lines.push('   · [' + stepTitle_(a.step) + '] ' + a.msg); });
    lines.push('');
  }
  if (warns.length) {
    lines.push('■ 주의 ' + warns.length + '건');
    warns.forEach(function (w) { lines.push('   · [' + stepTitle_(w.step) + '] ' + w.msg); });
    lines.push('');
  }
  if (!isFirst && diff && diff.length) {
    lines.push('■ 변경 ' + diff.length + '건');
    diff.slice(0, 30).forEach(function (d) {
      lines.push('   · ' + d.step + ' > ' + d.field + '   ' + (d.before || '(빈값)') + ' → ' + (d.after || '(빈값)'));
    });
    if (diff.length > 30) lines.push('   … 외 ' + (diff.length - 30) + '건');
    lines.push('');
  }

  var folderUrl = '';
  try { folderUrl = shopFolder_(s.id).getUrl(); } catch (e) {}
  if (s.sheetUrl) lines.push('세팅시트  ' + s.sheetUrl);
  if (folderUrl) lines.push('드라이브  ' + folderUrl);

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: subject,
    body: lines.join('\n')
  });
}

function stepTitle_(key) {
  var st = getStep_(key);
  return st ? st.title : key;
}

/** 남은 메일 할당량 확인 — 운영 중 점검용 */
function checkMailQuota() {
  Logger.log('남은 메일 수신자: ' + MailApp.getRemainingDailyQuota());
}
