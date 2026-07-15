// ピッキング/チェック画面共通のバーコード入力部品。
// カメラスキャン・外付けリーダー（キーボード入力＋Enter）の両方を同じ入力欄で受ける。
// スキャンが確定すると、ホスト側が定義した window.handleScan(code) を呼ぶ。
// HTML側は各ページに #scanInput #cameraBtn #scanVideo を用意しておくこと。
(function () {
  var input = document.getElementById('scanInput');
  var cameraBtn = document.getElementById('cameraBtn');
  var video = document.getElementById('scanVideo');
  var stream = null;
  var detecting = false;
  var hasNativeDetector = ('BarcodeDetector' in window);
  var zxingReader = null; // ZXingフォールバック用（BarcodeDetector未対応ブラウザ。ただしiOSは除く、下記参照）
  var zxingLoadPromise = null;
  var zxingReady = false;
  // 2026-07、iOS（Safari・Chrome for iOS等）でカメラが起動しない問題を調査した結果、原因は
  // iOS自体の制約ではなくGoogle Apps ScriptがHtmlServiceでWebアプリを配信する仕組み側にあると
  // 判明した（GitHub Pagesにホストした同一コードでは問題無く動作することを実機で確認済み）。
  // この画面はGAS外にホストされている前提のため、iOSを特別扱いしてボタンを隠す処理は行わない。

  function focusInput() {
    if (input) input.focus();
  }
  window.addEventListener('load', focusInput);
  document.addEventListener('click', function (e) {
    // 外付けリーダーはどこにフォーカスがあってもキー入力を送るため、
    // カメラボタン以外をタップしたら常に入力欄へフォーカスを戻す。
    if (e.target !== cameraBtn) focusInput();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitScan(input.value);
    }
  });

  function submitScan(code) {
    code = (code || '').trim();
    input.value = '';
    if (!code) return;
    if (typeof window.handleScan === 'function') {
      window.handleScan(code);
    }
  }

  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    cameraBtn.style.display = 'none';
  } else {
    cameraBtn.addEventListener('click', function () {
      if (stream || zxingReader) { stopCamera(); return; }
      startCamera();
    });
    if (!hasNativeDetector) {
      // Safari等はgetUserMediaの呼び出しがユーザー操作（クリック）から間を置かずに
      // 実行されないと、実際には拒否していなくても「許可されていない」扱いになることがある。
      // ボタン押下後にCDNからZXingを読み込むと非同期待ちが挟まりこの制約に触れるため、
      // ページ読み込み時点で先読みしておき、ボタン押下時は間を置かずgetUserMediaを呼べるようにする。
      loadZXing().then(function () { zxingReady = true; }).catch(function () { /* ボタン押下時に再試行する */ });
    }
  }

  function startCamera() {
    if (hasNativeDetector) {
      startNativeCamera();
    } else if (zxingReady) {
      startZXingCameraNow();
    } else {
      // 先読みが間に合っていない場合はこの場で読み込むが、Safariではユーザー操作から
      // 間が空くため権限が下りない可能性がある（先読みが完了していれば通常はここに来ない）
      cameraBtn.disabled = true;
      cameraBtn.textContent = '起動中...';
      loadZXing().then(function () {
        zxingReady = true;
        cameraBtn.disabled = false;
        startZXingCameraNow();
      }).catch(function () {
        cameraBtn.disabled = false;
        cameraBtn.textContent = '📷 カメラでスキャン';
        alert('バーコード読み取りライブラリの読み込みに失敗しました。通信環境をご確認のうえ再度お試しください。');
      });
    }
  }

  function startNativeCamera() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (s) {
        stream = s;
        video.srcObject = s;
        video.style.display = 'block';
        video.play();
        cameraBtn.textContent = '✕ カメラを閉じる';
        detecting = true;
        var detector = new BarcodeDetector();
        var loop = function () {
          if (!detecting) return;
          detector.detect(video).then(function (codes) {
            if (codes && codes.length > 0) {
              submitScan(codes[0].rawValue);
              stopCamera();
              return;
            }
            requestAnimationFrame(loop);
          }).catch(function () { requestAnimationFrame(loop); });
        };
        requestAnimationFrame(loop);
      })
      .catch(function (err) {
        alert(cameraPermissionErrorMessage_(err));
      });
  }

  /**
   * SafariなどBarcodeDetector未対応ブラウザ向け：ZXingで映像から直接デコードする。
   * ZXingは先読み済み（zxingReady）である前提で、ボタン押下から間を置かずgetUserMediaを呼ぶ。
   * ZXingの decodeFromConstraints にgetUserMedia呼び出しを任せると、ライブラリ内部の処理が
   * わずかでも非同期を挟んだ場合にSafariがユーザー操作から離れたカメラ要求とみなして拒否することが
   * あるため、getUserMedia自体はこの関数内で直接（startNativeCameraと同じ形で）呼び、
   * 取得済みのストリームをdecodeFromStreamでZXingに渡してデコードだけを任せる。
   */
  function startZXingCameraNow() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function (s) {
        stream = s;
        video.srcObject = s;
        video.style.display = 'block';
        video.play();
        cameraBtn.textContent = '✕ カメラを閉じる';
        zxingReader = new ZXing.BrowserMultiFormatReader();
        zxingReader.decodeFromStream(s, video, function (result) {
          if (result) {
            submitScan(result.getText());
            stopCamera();
          }
          // result が無い呼び出し（コード未検出）は毎フレーム発生しうるので無視する
        });
      })
      .catch(function (err) {
        alert(cameraPermissionErrorMessage_(err));
      });
  }

  /** カメラ起動失敗時のメッセージ。権限がブロックされている場合の対処法も添える */
  function cameraPermissionErrorMessage_(err) {
    return 'カメラを起動できませんでした：' + (err && err.message ? err.message : String(err)) +
      '\nブラウザやOSの設定でこのサイトのカメラ権限がブロックされている場合は、' +
      '設定から許可に変更して再度お試しください。改善しない場合はUSB/Bluetoothバーコードリーダーをご利用ください。';
  }

  function loadZXing() {
    if (window.ZXing) return Promise.resolve();
    if (zxingLoadPromise) return zxingLoadPromise;
    zxingLoadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/@zxing/library@latest/umd/index.min.js';
      script.onload = function () { resolve(); };
      script.onerror = function () { zxingLoadPromise = null; reject(new Error('load failed')); };
      document.head.appendChild(script);
    });
    return zxingLoadPromise;
  }

  function stopCamera() {
    detecting = false;
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (zxingReader) {
      zxingReader.reset();
      zxingReader = null;
    }
    video.style.display = 'none';
    cameraBtn.disabled = false;
    cameraBtn.textContent = '📷 カメラでスキャン';
    focusInput();
  }
})();
