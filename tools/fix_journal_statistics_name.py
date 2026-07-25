from pathlib import Path

path = Path('app/src/main/assets/apps/journal/app.js')
text = path.read_text(encoding='utf-8')
old = '''function renderStatistics(items) {
  renderDashboard(items);
  const card = document.createElement("div");
  card.className = "stat-card";

  const title = document.createElement("span");
  title.textContent = label;

  const number = document.createElement("strong");
  number.textContent = value;

  card.append(title, number);
  return card;
}'''
new = '''function makeStatCard(label, value) {
  const card = document.createElement("div");
  card.className = "stat-card";

  const title = document.createElement("span");
  title.textContent = label;

  const number = document.createElement("strong");
  number.textContent = value;

  card.append(title, number);
  return card;
}'''
if text.count(old) != 1:
    raise SystemExit(f'Expected one malformed statistics helper, found {text.count(old)}')
path.write_text(text.replace(old, new), encoding='utf-8')
