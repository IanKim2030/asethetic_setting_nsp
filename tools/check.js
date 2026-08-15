/**
 * 모든 .gs 파일 구문 검사.
 * Apps Script는 로컬 실행이 안 되므로, .gs를 임시 .js로 복사해 `node --check`만 돌린다.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const files = fs.readdirSync(rootDir).filter(f => f.endsWith('.gs'));

let fail = 0;
for (const f of files) {
  const src = path.join(rootDir, f);
  const tmp = path.join(os.tmpdir(), 'checkgs-' + process.pid + '-' + f.replace(/\.gs$/, '.js'));
  fs.copyFileSync(src, tmp);
  try {
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    console.log('  OK   ' + f);
  } catch (e) {
    fail++;
    console.log('  FAIL ' + f);
    console.log('         ' + e.stderr.toString().trim().split('\n').join('\n         '));
  } finally {
    fs.unlinkSync(tmp);
  }
}

console.log('\n' + (files.length - fail) + '/' + files.length + ' passed');
if (fail > 0) process.exit(1);
