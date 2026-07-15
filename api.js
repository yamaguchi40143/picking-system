/**
 * GAS JSON APIとの通信用共通ヘルパー。
 * GAS_API_URLはApps Scriptの「デプロイ」→「ウェブアプリ」で発行されたURL（.../exec）に
 * 書き換えること（デプロイのたびにURLが変わるわけではないが、初回セットアップ時に必ず設定する）。
 */
var GAS_API_URL = 'https://script.google.com/macros/s/AKfycbybFqZKQ3uyzxqtSJJWDCCwwWgjHlOXVEnf-rzsoSl5F1uoHLK6DXeunSduWNucuBJ7/exec';

// 通信がハングした場合に「案件を読み込み中...」等の表示のまま止まって見えないよう、
// 一定時間で打ち切ってエラーとして表示するためのタイムアウト（ミリ秒）。
var API_TIMEOUT_MS = 25000;

function fetchWithTimeout_(url, options) {
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS);
  var opts = Object.assign({}, options, { signal: controller.signal });
  return fetch(url, opts)
    .catch(function (err) {
      if (err && err.name === 'AbortError') {
        throw new Error('通信がタイムアウトしました。電波状況／Wi-Fi接続をご確認のうえ、もう一度お試しください。');
      }
      throw err;
    })
    .finally(function () { clearTimeout(timer); });
}

/** 参照系：GETクエリで呼ぶ（CORSのプリフライトが発生しないようにするため） */
function apiGet(action, params) {
  var qs = Object.keys(params || {}).map(function (k) {
    var v = params[k];
    return encodeURIComponent(k) + '=' + encodeURIComponent(v == null ? '' : v);
  }).join('&');
  return fetchWithTimeout_(GAS_API_URL + '?action=' + encodeURIComponent(action) + (qs ? '&' + qs : ''))
    .then(function (r) { return r.json(); })
    .then(unwrapApiResult_);
}

/**
 * 更新系：POSTだがContent-Type: text/plainで送る。
 * application/jsonにするとブラウザがCORSプリフライト（OPTIONSリクエスト）を送ってしまい、
 * GASはこれを正しく処理できないため、意図的にtext/plain（CORSのsimple requestの範囲内）にしている。
 * このヘッダーは変更しないこと。
 */
function apiPost(action, params) {
  return fetchWithTimeout_(GAS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: action, params: params || {} })
  })
    .then(function (r) { return r.json(); })
    .then(unwrapApiResult_);
}

/** サーバーの{ok, data}/{ok, error}形式を、既存コードのPromise/エラー処理と互換になるよう変換する */
function unwrapApiResult_(res) {
  if (!res || !res.ok) {
    throw new Error((res && res.error) || 'サーバーエラーが発生しました。');
  }
  return res.data;
}
