/**
 * .gs 파일 간 최상위 선언 중복 검사.
 * Apps Script는 모든 파일이 하나의 전역 스코프를 공유하므로,
 * 같은 이름의 최상위 function/const/let/var가 여러 파일에 있으면 조용히 덮어써진다.
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.gs'));

const declRe = /^(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)/;

const owners = {};

for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = declRe.exec(lines[i]);
    if (!m) continue;
    const name = m[1] || m[2];
    (owners[name] = owners[name] || []).push({ file: f, line: i + 1 });
  }
}

let fail = 0;
for (const name of Object.keys(owners)) {
  const locs = owners[name];
  if (locs.length > 1) {
    fail++;
    console.log('  FAIL 중복 선언: ' + name);
    for (const loc of locs) console.log('         ' + loc.file + ':' + loc.line);
  }
}

if (fail === 0) console.log('  OK   중복 최상위 선언 없음 (' + files.length + '개 파일 검사)');
else process.exit(1);
