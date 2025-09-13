import { NextRequest, NextResponse } from 'next/server';

// Similarity detection for auto-fork logic
export async function POST(request: NextRequest) {
  try {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Supabase env not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { blakqubeLabels, metaExtras } = body;

    if (!blakqubeLabels || !metaExtras) {
      return NextResponse.json({ error: 'blakqubeLabels and metaExtras required' }, { status: 400 });
    }

    // Fetch all existing templates for comparison
    const endpoint = `${url}/rest/v1/iqube_templates?select=id,name,blakqube_labels,metaqube_extras`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch templates for comparison' }, { status: 500 });
    }

    const templates = await res.json();
    
    // Calculate similarity for each template
    const similarities: Array<{ templateId: string; templateName: string; similarity: number }> = templates.map((template: any) => {
      const similarity = calculateSimilarity(
        { blakqubeLabels, metaExtras },
        { 
          blakqubeLabels: template.blakqube_labels || [], 
          metaExtras: template.metaqube_extras || [] 
        }
      );
      
      return {
        templateId: template.id,
        templateName: template.name,
        similarity,
      };
    });

    // Find templates with >= 90% similarity
    const highSimilarity = similarities.filter((s: { similarity: number }) => s.similarity >= 0.9);
    
    if (highSimilarity.length > 0) {
      // Return the most similar template
      const mostSimilar = highSimilarity.reduce((max, current) => 
        current.similarity > max.similarity ? current : max
      );
      
      return NextResponse.json({
        isFork: true,
        parentTemplate: mostSimilar,
        message: "This iQube appears to be a fork of a pre-existing iQube. You can proceed minting it as a fork of its predecessor"
      });
    }

    return NextResponse.json({ isFork: false });
  } catch (error: any) {
    console.error('Error checking similarity:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

function calculateSimilarity(template1: any, template2: any): number {
  // Calculate BlakQube similarity (structural + semantic)
  const blakSimilarity = calculateBlakQubeSimilarity(
    template1.blakqubeLabels || [],
    template2.blakqubeLabels || []
  );

  // Calculate MetaQube Additional Records similarity (semantic only)
  const metaSimilarity = calculateMetaExtrasSimilarity(
    template1.metaExtras || [],
    template2.metaExtras || []
  );

  // Weight: 60% BlakQube, 40% MetaExtras
  return (blakSimilarity * 0.6) + (metaSimilarity * 0.4);
}

function calculateBlakQubeSimilarity(labels1: any[], labels2: any[]): number {
  if (labels1.length === 0 && labels2.length === 0) return 1.0;
  if (labels1.length === 0 || labels2.length === 0) return 0.0;

  // Structural similarity: compare keys and types
  const keys1 = new Set(labels1.map(l => l.key));
  const keys2 = new Set(labels2.map(l => l.key));
  const intersection = new Set([...keys1].filter(k => keys2.has(k)));
  const union = new Set([...keys1, ...keys2]);
  const structuralSim = intersection.size / union.size;

  // Semantic similarity: compare labels and examples
  let semanticMatches = 0;
  let totalComparisons = 0;

  for (const label1 of labels1) {
    const match = labels2.find(l => l.key === label1.key);
    if (match) {
      totalComparisons++;
      const labelSim = calculateTextSimilarity(label1.label || '', match.label || '');
      const exampleSim = calculateTextSimilarity(label1.example || '', match.example || '');
      if (labelSim > 0.8 || exampleSim > 0.8) {
        semanticMatches++;
      }
    }
  }

  const semanticSim = totalComparisons > 0 ? semanticMatches / totalComparisons : 0;

  // Combine structural and semantic (70% structural, 30% semantic)
  return (structuralSim * 0.7) + (semanticSim * 0.3);
}

function calculateMetaExtrasSimilarity(extras1: any[], extras2: any[]): number {
  if (extras1.length === 0 && extras2.length === 0) return 1.0;
  if (extras1.length === 0 || extras2.length === 0) return 0.0;

  // Only semantic similarity for Additional Records
  let semanticMatches = 0;
  let totalComparisons = 0;

  for (const extra1 of extras1) {
    for (const extra2 of extras2) {
      totalComparisons++;
      const keySim = calculateTextSimilarity(extra1.k || '', extra2.k || '');
      const valueSim = calculateTextSimilarity(extra1.v || '', extra2.v || '');
      if (keySim > 0.8 && valueSim > 0.8) {
        semanticMatches++;
      }
    }
  }

  return totalComparisons > 0 ? semanticMatches / totalComparisons : 0;
}

function calculateTextSimilarity(text1: string, text2: string): number {
  // Simple Jaccard similarity on words (can be enhanced with more sophisticated NLP)
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}
