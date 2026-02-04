export function showSocialSharingDialog(metadata: any, personaId?: string) {
  alert(`Share: ${metadata.url}`);
  window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(metadata.url)}&text=${encodeURIComponent(metadata.description)}`, '_blank');
}
