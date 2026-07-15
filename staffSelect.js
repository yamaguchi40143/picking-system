// ピッキング/チェック画面共通の担当者選択（ログイン無し）。
// 一度選ぶとブラウザのlocalStorageに保存され、同じ端末・同じブラウザなら次回から聞かれない。
// 「担当者切替」でいつでも選び直せる（共有タブレットでの交代を想定）。
var STAFF_STORAGE_KEY_ID = 'pickingStaffId';
var STAFF_STORAGE_KEY_NAME = 'pickingStaffName';

function requireStaff(onReady) {
  var id = localStorage.getItem(STAFF_STORAGE_KEY_ID);
  var name = localStorage.getItem(STAFF_STORAGE_KEY_NAME);
  if (id && name) {
    onReady({ id: id, name: name });
    return;
  }
  apiGet('getStaffList', {})
    .then(function (list) { renderStaffPicker(list, onReady); })
    .catch(function (err) {
      document.getElementById('screen').innerHTML =
        '<div class="card"><div class="error-banner">エラー：' + escapeHtml(err.message || String(err)) + '</div></div>';
    });
}

function renderStaffPicker(list, onReady) {
  if (!list.length) {
    document.getElementById('screen').innerHTML =
      '<div class="card"><div class="error-banner">担当者マスタに有効な担当者が登録されていません。管理者に連絡してください。</div></div>';
    return;
  }
  var options = list.map(function (s) {
    return '<option value="' + s.id + '">' + escapeHtml(s.name) + '</option>';
  }).join('');
  document.getElementById('screen').innerHTML =
    '<div class="card">' +
    '<h2>担当者を選択してください</h2>' +
    '<select id="staffPick">' + options + '</select>' +
    '<button class="primary" style="margin-top:14px" onclick="confirmStaffPick()">この担当者で開始</button>' +
    '</div>';
  window._staffList = list;
  window._onStaffReady = onReady;
}

function confirmStaffPick() {
  var id = document.getElementById('staffPick').value;
  var s = window._staffList.find(function (x) { return String(x.id) === String(id); });
  if (!s) return;
  localStorage.setItem(STAFF_STORAGE_KEY_ID, s.id);
  localStorage.setItem(STAFF_STORAGE_KEY_NAME, s.name);
  window._onStaffReady(s);
}

/**
 * 画面右上などに置く「担当者切替」ボタン用。
 * ホスト側（picking.html/check.html）が定義したwindow.onStaffSwitched()を呼んで
 * その場で担当者選択画面を再表示する（フルリロードはしない）。
 */
function switchStaff() {
  localStorage.removeItem(STAFF_STORAGE_KEY_ID);
  localStorage.removeItem(STAFF_STORAGE_KEY_NAME);
  if (typeof window.onStaffSwitched === 'function') {
    window.onStaffSwitched();
  } else {
    location.reload();
  }
}
