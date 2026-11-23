<?php
/**
 * E-Okul Disiplin AI Pro - evrakplus.com köprüsü
 *
 * Yalnızca evrakplus.com'a (WordPress) giriş yapmış üyeler programı açabilir; ayrı şifre yoktur.
 * Giriş yapmamış ziyaretçi evrakplus.com giriş sayfasına yönlendirilir, girişten sonra buraya döner.
 */
define('DISIPLIN_APP', true);
require __DIR__ . '/inc/bootstrap.php';

disiplin_no_cache();
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: same-origin');

$appUrl = disiplin_app_url();
$loggedIn = is_user_logged_in();
$user = $loggedIn ? wp_get_current_user() : null;
$allowed = $loggedIn && $user && disiplin_user_allowed($user);

$shellFile = __DIR__ . '/app-shell.php';
if (!file_exists($shellFile)) {
    status_header(500);
    echo 'app-shell.php bulunamadı. Lütfen paketin tamamını yükleyin.';
    exit;
}

$bridge = array(
    'v' => 1,
    'apiUrl' => 'api.php',
    'nonce' => $allowed ? wp_create_nonce('disiplin_api') : '',
    'user' => $allowed ? array(
        'id' => (int)$user->ID,
        'login' => $user->user_login,
        'displayName' => $user->display_name ? $user->display_name : $user->user_login,
        'email' => $user->user_email,
    ) : null,
    'loginUrl' => disiplin_is_electron() ? disiplin_app_url('giris.php') : disiplin_login_url($appUrl),
    'logoutUrl' => 'cikis.php',
    'homeUrl' => home_url('/'),
    'programKey' => DISIPLIN_META_KEY,
    'appVersion' => DISIPLIN_APP_VERSION,
);

$headInject = '<script>window.__DISIPLIN_BRIDGE__=' . wp_json_encode($bridge, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) . ';</script>' . "\n"
    . '    <link rel="manifest" href="manifest.webmanifest">' . "\n"
    . '    <meta name="theme-color" content="#0f172a">' . "\n"
    . '    <meta name="mobile-web-app-capable" content="yes">' . "\n"
    . '    <meta name="apple-mobile-web-app-capable" content="yes">' . "\n"
    . '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' . "\n"
    . '    <meta name="apple-mobile-web-app-title" content="Disiplin">' . "\n"
    . '    <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">' . "\n"
    . '    <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">';

ob_start();
include $shellFile;
$html = ob_get_clean();
$html = str_replace('<!--DISIPLIN_BRIDGE-->', $headInject, $html);

header('Content-Type: text/html; charset=utf-8');
echo $html;
