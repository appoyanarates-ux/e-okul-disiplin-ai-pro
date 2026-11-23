<?php
/**
 * Çıkış: Bu cihazdaki program verisini (tarayıcı depolaması ve çevrimdışı önbellek) temizler,
 * ardından evrakplus.com oturumunu kapatır. Veriler üyenin WordPress hesabında kalır.
 */
define('DISIPLIN_APP', true);
require __DIR__ . '/inc/bootstrap.php';

disiplin_no_cache();

if (isset($_GET['do']) && is_user_logged_in()) {
    if (isset($_GET['_n']) && wp_verify_nonce($_GET['_n'], 'disiplin_logout')) {
        wp_logout();
    }
    wp_safe_redirect(home_url('/'));
    exit;
}

$next = is_user_logged_in()
    ? disiplin_app_url('cikis.php?do=1&_n=' . wp_create_nonce('disiplin_logout'))
    : home_url('/');
header('Content-Type: text/html; charset=utf-8');
?><!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Çıkış yapılıyor…</title></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;color:#334155">
<div>Çıkış yapılıyor…</div>
<script>
(function () {
  var keys = ['students','incidents','institutionSettings','boardSettings','gemini_api_key','gemini_preferred_model',
    'writtenWarnings','disiplin_tombstones','disiplin_settings_ts','eokul_deleted_students','eokul_deleted_incidents',
    'eokul_cloud_sync_config','disiplin_sync_rev','disiplin_sync_hash','disiplin_last_sync','disiplin_owner_uid','eokul_legacy_local_backup'];
  try { keys.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
  var go = function () { location.replace(<?php echo wp_json_encode($next); ?>); };
  try {
    if (window.caches && caches.keys) {
      caches.keys().then(function (names) {
        return Promise.all(names.filter(function (n) { return n.indexOf('disiplin-shell') === 0; }).map(function (n) { return caches.delete(n); }));
      }).then(go, go);
      setTimeout(go, 1500);
    } else { go(); }
  } catch (e) { go(); }
})();
</script>
</body></html>
