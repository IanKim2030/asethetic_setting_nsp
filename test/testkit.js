/**
 * 공용 테스트 도구.
 * Apps Script 는 로컬 실행이 안 되므로, .gs 파일을 vm 컨텍스트에 로드해
 * 그 안의 순수/근사순수 함수를 직접 불러 검증하는 방식을 여러 테스트 파일이 공유한다.
 */
const fs = require('fs');
const vm = require('vm');

/**
 * .gs 파일(들)을 새 vm 컨텍스트에 순서대로 로드한다.
 * extraGlobals 로 넘긴 값은 로드 전에 컨텍스트에 미리 심어 두므로,
 * 파일 안에서 참조하는 전역(SpreadsheetApp 등)을 이 방식으로 스텁할 수 있다.
 */
function loadGs(files, extraGlobals) {
  const list = Array.isArray(files) ? files : [files];
  const ctx = Object.assign({}, extraGlobals);
  vm.createContext(ctx);
  list.forEach(function (f) {
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx);
  });
  return ctx;
}

/** Js.html 의 <script>...</script> 본문만 잘라내 .gs 와 같은 방식으로 vm 로드한다. */
function loadHtmlScript(path, extraGlobals) {
  const html = fs.readFileSync(path, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(path + ' 안에 <script> 블록을 찾을 수 없습니다.');
  const ctx = Object.assign({}, extraGlobals);
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx);
  return ctx;
}

/** 통과/실패를 세면서 출력하는 러너. 파일 하나에서 여러 섹션에 걸쳐 재사용한다. */
function session() {
  let pass = 0, fail = 0;
  return {
    section(title) { console.log('\n── ' + title + ' ──'); },
    ok(name, cond, detail) {
      if (cond) { pass++; console.log('  OK   ' + name); }
      else { fail++; console.log('  FAIL ' + name + (detail ? '\n         ' + detail : '')); }
    },
    done() {
      console.log('\n결과: ' + pass + ' 통과, ' + fail + ' 실패\n');
      process.exit(fail ? 1 : 0);
    }
  };
}

/** 격자 기반 가짜 시트. 03_SheetSync.gs 의 getRange().getValues()/.setValues() 를 흉내낸다. */
function makeSheet(nRows, nCols) {
  const g = [];
  for (let r = 0; r <= nRows; r++) g.push(new Array(nCols + 1).fill(''));
  return {
    _g: g,
    get(r, c) { return g[r][c]; },
    set(r, c, v) { g[r][c] = v; },
    getMaxRows() { return nRows; },
    getLastRow() { return nRows; },
    getRange(r, c, nr, nc) {
      return {
        getValues() {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const line = [];
            for (let j = 0; j < nc; j++) line.push(g[r + i][c + j]);
            out.push(line);
          }
          return out;
        },
        setValues(vals) {
          for (let i = 0; i < nr; i++)
            for (let j = 0; j < nc; j++) g[r + i][c + j] = vals[i][j];
        }
      };
    }
  };
}

/**
 * 최상위 const/let 은 vm 컨텍스트 안에서는 다른 파일 코드가 정상적으로 볼 수 있지만
 * (Apps Script 가 파일들을 한 전역 스코프로 합치는 것과 같은 동작), var/function 과 달리
 * 컨텍스트 객체의 프로퍼티로는 노출되지 않아 Node 쪽 테스트 코드에서 ctx.NAME 으로 못 읽는다.
 * 그런 이름들을 명시적으로 컨텍스트 객체 프로퍼티로 복사해 밖에서 읽을 수 있게 한다.
 */
function bridge(ctx, names) {
  const src = names.map(function (n) {
    return 'this[' + JSON.stringify(n) + '] = (typeof ' + n + ' !== "undefined") ? ' + n + ' : undefined;';
  }).join('\n');
  vm.runInContext(src, ctx);
  return ctx;
}

function letter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

module.exports = { loadGs, loadHtmlScript, session, makeSheet, letter, bridge };
