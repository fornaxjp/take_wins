const output = `
Here is your table:

| Column A | Column B |
|----------|----------|
| Cell 1,1 | Cell 1,2 |
| Cell 2,1 | Cell 2,2 |
| Cell 3,1 | Cell 3,2 |

Enjoy!
`;

const lines = output.split('\n');
const newBlocks = [];
let currentTable = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('|') && line.endsWith('|')) {
    if (line.includes('---')) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (!currentTable) {
      currentTable = { rows: 1, cols: cells.length, cells: [cells] };
    } else {
      currentTable.rows++;
      currentTable.cells.push(cells);
    }
  } else {
    if (currentTable) {
      newBlocks.push({ type: 'table', data: currentTable });
      currentTable = null;
    }
    if (line) {
      if (line.startsWith('# ')) newBlocks.push({ type: 'h1', content: line.slice(2) });
      else newBlocks.push({ type: 'text', content: line });
    }
  }
}
if (currentTable) newBlocks.push({ type: 'table', data: currentTable });

console.log(JSON.stringify(newBlocks, null, 2));
