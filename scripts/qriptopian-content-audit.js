/* eslint-disable no-console */

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_ISSUES = ['issue-0', 'issue-1'];
const SECTIONS = [
  'home-hero',
  'latest-news',
  'second-hero',
  'pennydrops',
  'scrolls',
  '21knowdz',
];

function getBaseUrl() {
  return process.env.QRIPTO_BASE_URL || DEFAULT_BASE_URL;
}

function getIssues() {
  if (process.env.QRIPTO_ISSUES) {
    return process.env.QRIPTO_ISSUES.split(',').map((issue) => issue.trim()).filter(Boolean);
  }
  return DEFAULT_ISSUES;
}

function summarizeSection(items) {
  const summary = {
    total: items.length,
    missingImage: [],
    missingRead: [],
    missingWatch: [],
    missingAnyModality: [],
  };

  for (const item of items) {
    const hasImage = Boolean(item.image || item.cover_image_url);
    const hasRead = Boolean(item.modalities && item.modalities.read);
    const hasWatch = Boolean(item.modalities && item.modalities.watch);
    const hasListen = Boolean(item.modalities && item.modalities.listen);
    const hasLink = Boolean(item.modalities && item.modalities.link);
    const hasAny = hasRead || hasWatch || hasListen || hasLink;

    if (!hasImage) summary.missingImage.push(item);
    if (!hasRead) summary.missingRead.push(item);
    if (!hasWatch) summary.missingWatch.push(item);
    if (!hasAny) summary.missingAnyModality.push(item);
  }

  return summary;
}

function printList(label, items, limit = 5) {
  if (!items.length) return;
  const trimmed = items.slice(0, limit);
  console.log(`  - ${label}: ${items.length}`);
  for (const item of trimmed) {
    console.log(`      • ${item.id} — ${item.title}`);
  }
  if (items.length > limit) {
    console.log(`      … and ${items.length - limit} more`);
  }
}

async function run() {
  const baseUrl = getBaseUrl();
  const issues = getIssues();

  console.log(`Qriptopian content audit`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Issues: ${issues.join(', ')}`);
  console.log('');

  for (const issue of issues) {
    console.log(`Issue: ${issue}`);
    for (const section of SECTIONS) {
      const url = `${baseUrl}/api/content/section/${section}?issue=${encodeURIComponent(issue)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.log(`  ${section}: HTTP ${res.status}`);
          continue;
        }
        const payload = await res.json();
        const items = Array.isArray(payload.content) ? payload.content : [];
        const summary = summarizeSection(items);
        console.log(`  ${section}: ${summary.total} items`);
        printList('Missing image', summary.missingImage);
        printList('Missing read modality', summary.missingRead);
        printList('Missing watch modality', summary.missingWatch);
        printList('Missing any modality', summary.missingAnyModality);
      } catch (error) {
        console.log(`  ${section}: Failed to fetch (${error.message || error})`);
      }
    }
    console.log('');
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
