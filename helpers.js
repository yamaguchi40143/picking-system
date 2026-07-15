// 全画面共通の小さなヘルパー（HTMLエスケープ・スキャン結果のフラッシュ表示）
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function showFlash(kind, message) {
  var el = document.getElementById('flash');
  if (!el) return;
  el.className = 'flash show ' + kind;
  el.textContent = message;
  if (navigator.vibrate) {
    navigator.vibrate(kind === 'ok' ? 60 : [80, 60, 80]);
  }
  clearTimeout(showFlash._t);
  showFlash._t = setTimeout(function () {
    el.className = 'flash';
  }, kind === 'ok' ? 700 : 1600);
}
