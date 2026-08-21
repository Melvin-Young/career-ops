// Pure parser for data/pipeline.md. Keeping labeled-segment handling here gives
// the server reader and its tests one interface as the core adds lane/reason
// metadata without widening the positional row grammar.

const LABELED_SEGMENT = /^([a-z][a-z_-]*):\s*(.*)$/i;

export function parsePipelineInbox(markdown) {
  const jobs = [];
  for (const line of String(markdown ?? '').split('\n')) {
    const match = line.match(/^\s*-\s*\[([ xX])\]\s*(.+)$/);
    if (!match) continue;
    const all = match[2].split('|').map(value => value.trim());
    const labels = new Map();
    const parts = [];
    for (const [index, segment] of all.entries()) {
      const labeled = index >= 3 ? segment.match(LABELED_SEGMENT) : null;
      if (labeled) labels.set(labeled[1].toLowerCase(), labeled[2].trim());
      else parts.push(segment);
    }
    if (parts.length < 3 || !parts[0]) continue;
    const posted = labels.get('posted');
    const rawLane = labels.get('lane');
    const discoveryLane = rawLane === 'likely' || rawLane === 'verify' ? rawLane : undefined;
    jobs.push({
      done: match[1].toLowerCase() === 'x',
      url: parts[0],
      company: parts[1],
      role: parts[2],
      location: parts[3] || undefined,
      compensation: parts[4] || undefined,
      postedAt: posted && /^\d{4}-\d{2}-\d{2}$/.test(posted) ? posted : undefined,
      discoveryLane,
      discoveryReason: discoveryLane ? labels.get('reason') || undefined : undefined,
    });
  }
  return jobs;
}
