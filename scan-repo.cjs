const outputFile = path.join(root, 'scan-result.txt');
const writeLine = (line) => fs.appendFileSync(outputFile, line + '\n', 'utf8');

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (file === 'node_modules' || file === '.git') continue;
      walk(full);
    } else {
      const ext = path.extname(full).toLowerCase();
      if (!exts.includes(ext)) continue;
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split(/\r?\n/);
      patterns.forEach(p => {
        lines.forEach((ln, idx) => {
          if (p.re.test(ln)) {
            writeLine(`${p.name} | ${full}:${idx+1}: ${ln.trim()}`);
          }
        });
      });
    }
  }
}

writeLine('--- Scan start ---');
walk(root);
writeLine('--- Scan complete ---');
console.log('Scan complete, results saved to scan-result.txt');
