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
count = text.count(old)
if count == 1:
    path.write_text(text.replace(old, new), encoding='utf-8')
elif new not in text:
    raise SystemExit(f'Unexpected statistics helper state; malformed count={count}')
