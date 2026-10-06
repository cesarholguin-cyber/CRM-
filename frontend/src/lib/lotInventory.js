const naturalOrder = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export function blockLabel(block) {
  const value = String(block ?? '').trim();
  return value ? `Manzana ${value.replace(/^M(?=\d)/i, '')}` : 'Sin manzana asignada';
}

export function groupLotsByBlock(lots) {
  const groups = new Map();
  for (const lot of lots) {
    const key = String(lot.block ?? '').trim();
    if (!groups.has(key)) groups.set(key, { key, label: blockLabel(key), lots: [] });
    groups.get(key).lots.push(lot);
  }
  return [...groups.values()]
    .sort((a, b) => !a.key ? 1 : !b.key ? -1 : naturalOrder.compare(a.label, b.label) || naturalOrder.compare(a.key, b.key))
    .map(group => ({ ...group, lots: group.lots.sort((a, b) => naturalOrder.compare(String(a.lot_number), String(b.lot_number)) || a.id - b.id) }));
}
