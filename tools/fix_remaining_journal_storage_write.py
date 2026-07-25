from pathlib import Path

path = Path('app/src/main/assets/apps/journal/app.js')
text = path.read_text(encoding='utf-8')

old_call = '''      saveItemsWithoutInsightRefresh();
      applyCachedVideoThumbnailToDom(item.id, thumb);'''
new_call = '''      await saveItemsWithoutInsightRefresh();
      applyCachedVideoThumbnailToDom(item.id, thumb);'''

old_function = '''function saveItemsWithoutInsightRefresh(items = state.items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(cleanItemForStorage)));
  invalidateRenderCache();
}'''
new_function = '''async function saveItemsWithoutInsightRefresh(items = state.items) {
  const cleaned = items.map(cleanItemForStorage);
  const saved = await saveMetadataArray(ITEMS_META_RECORD, STORAGE_KEY, cleaned);
  invalidateRenderCache();
  return saved;
}'''

for old, new in ((old_call, new_call), (old_function, new_function)):
    count = text.count(old)
    if count == 1:
        text = text.replace(old, new)
    elif new not in text:
        raise SystemExit(f'Unexpected remaining storage patch state; count={count}: {old[:80]!r}')

path.write_text(text, encoding='utf-8')
