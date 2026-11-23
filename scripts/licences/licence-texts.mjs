// Helpers for generate-licences.mjs: licence detection, text clean-up, repository links.

/** MIT text for packages published without a licence file (`<holder>` is replaced). */
export const MIT_TEMPLATE = `MIT License

Copyright (c) <holder>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

/** SPDX id from the licence text itself (the text governs, not the package.json field). */
const SIGNATURES = [
  ['OFL-1.1', /SIL Open Font License,?\s+Version 1\.1/i],
  ['Apache-2.0', /Apache License,?\s+Version 2\.0/i],
  ['MPL-2.0', /Mozilla Public License,?\s+Version 2\.0/i],
  [
    '0BSD',
    /Permission to use, copy, modify, and\/or distribute this software for any\s+purpose with or without fee is hereby granted\.\s+THE SOFTWARE/i,
  ],
  ['ISC', /Permission to use, copy, modify, and\/or distribute this software for any/i],
  ['MIT', /Permission is hereby granted, free of charge, to any person obtaining/i],
];

export function detectLicence(text) {
  return SIGNATURES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** LF line endings, no trailing spaces, one final newline. */
export function normaliseText(text) {
  const lines = text
    .replace(/^\u{FEFF}/u, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  return `${lines
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()}\n`;
}

/** `repository` / `homepage` as an https URL, or null. */
export function repositoryUrl(pkg) {
  const raw =
    typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? pkg.homepage);
  if (typeof raw !== 'string') {
    return null;
  }
  const url = raw
    .replace(/^git\+/, '')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/^git:\/\//, 'https://')
    .replace(/^http:\/\//, 'https://')
    .replace(/\.git$/, '');
  return url.startsWith('https://') ? url : null;
}
