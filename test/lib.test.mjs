// Unit tests for the small pure helpers in `src/lib`. (CQ-9)
//
// Run with the project test script (Node's built-in test runner):
//
//   npm test            # node --test test/
//
// Node >= 22 strips the TypeScript types from the `.ts` sources on import, so
// these tests exercise the real modules — no build step or transpiler needed.
// We import from the single source of truth in `src/lib` rather than
// redefining any logic here, so the tests fail if that behaviour regresses.

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { projectSlug } from '../src/lib/projects.ts';
import { normalizeHref } from '../src/lib/urls.ts';
import { isPublished, renderArticle, forbiddenTags } from '../src/lib/content.ts';

describe('projectSlug (slug)', () => {
  it('encodes the owner/repo separator as a reserved "--" token', () => {
    const slug = projectSlug('IndopenSource/awesome-indonesia');
    assert.ok(slug.includes('--'), `expected "--" separator in ${slug}`);
    assert.ok(slug.startsWith('indopensource--awesome-indonesia-'));
  });

  it('only ever emits URL-safe characters [a-z0-9-]', () => {
    for (const name of ['Foo/Bar.Baz_Qux', 'Owner/Repo Name!', 'UPPER/CASE', 'a/b.c']) {
      assert.match(projectSlug(name), /^[a-z0-9-]+$/, `unsafe chars in slug for ${name}`);
    }
  });

  it('is deterministic for the same full name', () => {
    assert.equal(projectSlug('octo/cat'), projectSlug('octo/cat'));
  });

  it('is collision-safe: inputs that normalise alike still get distinct slugs', () => {
    // `a/b-c` and `a/b.c` both flatten to the same readable base; the hash
    // suffix must keep their slugs distinct so they never clobber each other's
    // static page.
    assert.notEqual(projectSlug('a/b-c'), projectSlug('a/b.c'));
    assert.notEqual(projectSlug('a/b--c'), projectSlug('a/b-c'));
  });

  it('does not emit leading or trailing dashes around the readable base', () => {
    // The trailing hash segment is always present, so the slug as a whole never
    // ends in a dash, and stray separators from punctuation are trimmed.
    const slug = projectSlug('-weird-/.repo.-');
    assert.doesNotMatch(slug, /^-/);
    assert.doesNotMatch(slug, /--$/);
  });
});

describe('normalizeHref (urls)', () => {
  it('leaves absolute http(s) URLs untouched', () => {
    assert.equal(normalizeHref('https://example.com/x'), 'https://example.com/x');
    assert.equal(normalizeHref('http://example.com'), 'http://example.com');
  });

  it('leaves mailto: links untouched', () => {
    assert.equal(normalizeHref('mailto:hello@example.com'), 'mailto:hello@example.com');
  });

  it('leaves protocol-relative URLs untouched', () => {
    assert.equal(normalizeHref('//cdn.example.com/app.js'), '//cdn.example.com/app.js');
  });

  it('upgrades bare domains to https', () => {
    assert.equal(normalizeHref('github.com/IndopenSource'), 'https://github.com/IndopenSource');
    assert.equal(normalizeHref('example.org'), 'https://example.org');
  });
});

describe('isPublished (frontmatter)', () => {
  it('treats "draft" status as unpublished', () => {
    assert.equal(isPublished({ status: 'draft' }), false);
  });

  it('treats any non-draft status (incl. empty/missing) as published', () => {
    assert.equal(isPublished({ status: 'published' }), true);
    assert.equal(isPublished({ status: 'archived' }), true);
    assert.equal(isPublished({ status: '' }), true);
  });
});

describe('renderArticle (frontmatter content)', () => {
  it('renders Markdown to HTML', () => {
    const html = renderArticle('# Title\n\nA **bold** paragraph.');
    assert.match(html, /<h1[^>]*>Title<\/h1>/);
    assert.match(html, /<strong>bold<\/strong>/);
  });

  it('returns an empty string for empty/falsy input', () => {
    assert.equal(renderArticle(''), '');
  });

  it('strips active-content tags to prevent HTML/JS injection', () => {
    const html = renderArticle('Hello <script>alert(1)</script> world');
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /alert\(1\)/);
    for (const tag of forbiddenTags) {
      assert.doesNotMatch(html, new RegExp(`<${tag}[\\s>]`, 'i'), `${tag} leaked through`);
    }
  });

  it('drops javascript: link payloads', () => {
    const html = renderArticle('[click](javascript:alert(1))');
    assert.doesNotMatch(html, /javascript:/i);
  });

  it('strips inline event-handler attributes', () => {
    const html = renderArticle('<a href="https://example.com" onclick="steal()">x</a>');
    assert.doesNotMatch(html, /onclick/i);
  });
});
