// node tests/test_ics_github.mjs
import assert from 'node:assert/strict';
import { buildIcs, fold } from '../site/js/ics.js';
import { themeIndex, matchFor } from '../site/js/github.js';

// Folding: no physical line over 75 octets, unfolding restores the original
const long = 'DESCRIPTION:' + 'Ä'.repeat(120);
const folded = fold(long);
for (const l of folded.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, 'line too long');
assert.equal(folded.replace(/\r\n /g, ''), long);

// Calendar: one event per row with a deadline, UTC times, reminder, CRLF endings
const rows = [
  { h: { id: 7, title: 'Tiny Hack, with commas; and semicolons', url: 'https://tiny.devpost.com/', deadline: '2026-10-26T17:00:00-04:00' }, oneIn: 6 },
  { h: { id: 8, title: 'No deadline', url: 'https://x.devpost.com/', deadline: null }, oneIn: 2 },
];
const ics = buildIcs(rows, new Date('2026-10-14T12:00:00Z'));
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
assert.ok(ics.includes('DTEND:20261026T210000Z'), 'deadline converted to UTC');
assert.ok(ics.includes('DTSTART:20261026T203000Z'));
assert.ok(ics.includes('TRIGGER:-P2D'));
assert.ok(ics.includes('Tiny Hack\\, with commas\\; and semicolons'));
assert.ok(!/[^\r]\n/.test(ics), 'all line endings are CRLF');

// GitHub themes: languages, topics and words map to Devpost themes
const repos = [
  { name: 'nutrimap', language: 'JavaScript', topics: ['nutrition'], description: 'Weekly meal plans priced at nearby supermarkets' },
  { name: 'robot-atlas', language: 'Python', topics: [], description: '3D map of robotics projects' },
];
const index = themeIndex(repos);
assert.deepEqual(index.Health, ['nutrimap']);
assert.ok(index.Web.includes('nutrimap'));
assert.ok(index.IoT.includes('robot-atlas'));
const m = matchFor({ themes: ['Health', 'Open Ended'] }, index);
assert.deepEqual(m.themes, ['Health']);
assert.deepEqual(m.repos, ['nutrimap']);
assert.deepEqual(matchFor({ themes: ['Open Ended'] }, index).repos, [], 'open ended alone never matches');

console.log('ics and github tests: all passed');
