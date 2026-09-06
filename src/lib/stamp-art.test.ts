import assert from 'node:assert/strict';
import { test } from 'node:test';

import { monochrome, prefixIds, prepareArt, removeGroups, seasonOf } from './stamp-art.ts';

const SAMPLE =
  '<defs><filter id="ink"><feTurbulence/></filter><linearGradient id="t"><stop stop-color="#fff"/></linearGradient></defs>' +
  '<g class="stamp-art"><g class="textured" filter="url(#ink)">' +
  '<g class="ridge-back" opacity=".6"><path fill="#ACA394" d="M0 0"/></g>' +
  '<g class="ridge"><path fill="url(#t)" d="M1 1"/></g>' +
  '<g class="motif"><use href="#motif-x"/><g class="lg-only collected-only"><path fill="#f00" d="M2 2"/></g></g>' +
  '<g class="snow collected-only"><path fill="#FCFBF7" d="M3 3"/></g>' +
  '</g></g>';

test('removeGroups는 중첩된 그룹을 짝 맞춰 지운다', () => {
  const out = removeGroups(SAMPLE, 'lg-only');
  assert.ok(!out.includes('M2 2'));
  assert.ok(out.includes('M3 3'), '형제 그룹은 남는다');
  assert.ok(out.includes('<use href="#motif-x"/>'), '부모 그룹은 남는다');
  assert.equal((out.match(/<g\b/g) ?? []).length, (out.match(/<\/g>/g) ?? []).length, '태그 짝이 맞는다');
});

test('removeGroups는 부분 일치하는 class를 지우지 않는다', () => {
  const out = removeGroups('<g class="lg-only-ish"><path/></g>', 'lg-only');
  assert.ok(out.includes('<path/>'));
});

test('prefixIds는 정의·url·href를 함께 바꾼다', () => {
  const out = prefixIds(SAMPLE, 's1-');
  assert.ok(out.includes('id="s1-ink"'));
  assert.ok(out.includes('filter="url(#s1-ink)"'));
  assert.ok(out.includes('fill="url(#s1-t)"'));
  assert.ok(out.includes('href="#s1-motif-x"'));
});

test('monochrome은 none을 빼고 모든 색과 불투명도를 없앤다', () => {
  const out = monochrome('<path fill="none" stroke="#123" opacity=".5"/><path fill="url(#t)"/>', '#D4DACE');
  assert.equal(out, '<path fill="none" stroke="#D4DACE"/><path fill="#D4DACE"/>');
});

test('40px 모음은 lg-only와 필터만 빠진다', () => {
  const out = prepareArt(SAMPLE, { prefix: 'p-', size: 40, collected: true });
  assert.ok(!out.includes('M2 2'));
  assert.ok(out.includes('M3 3'));
  assert.ok(!out.includes('filter="'));
  assert.ok(out.includes('fill="url(#p-t)"'), '색은 유지');
});

test('미모음은 모음 전용이 빠지고 단색이 된다', () => {
  const out = prepareArt(SAMPLE, { prefix: 'p-', size: 160, collected: false });
  assert.ok(!out.includes('M3 3'));
  assert.ok(!out.includes('#ACA394'));
  assert.ok(!out.includes('opacity='));
  assert.ok(out.includes('fill="#D4DACE"'));
});

test('seasonOf는 한국 시간 기준이다', () => {
  assert.equal(seasonOf('2026-02-28T15:30:00Z'), 'spring', 'UTC 2월 말 = KST 3월 1일');
  assert.equal(seasonOf('2026-09-05T12:00:00Z'), 'autumn');
  assert.equal(seasonOf('2026-12-01T00:00:00Z'), 'winter');
});
