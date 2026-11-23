<?php
/**
 * E-Okul Disiplin AI Pro - Eski sürüm uyumluluk API'si (v1.1.7 / v1.1.8 masaüstü uygulaması)
 *
 * Masaüstü uygulamasının çevrimdışı kopyası bu adrese bağlanır. v1.1.9 ile birlikte veriler artık
 * üyenin WordPress hesabında ("<programkodu>_data") saklanır; bu dosya da aynı kaydı kullanır.
 *
 * Güvenlik: Eski sürümdeki tahmin edilebilir "syncKey" (wp_user_<ID>) ile erişim KALDIRILDI.
 * Yalnızca giriş sonrası verilen gizli anahtar (token) veya açık WordPress oturumu kabul edilir.
 */
define('DISIPLIN_APP', true);
require __DIR__ . '/inc/bootstrap.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Sync-Key, X-Auth-Token');
disiplin_no_cache();

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$rawInput = file_get_contents('php://input');
$body = array();
if (!empty($rawInput)) {
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded)) $body = $decoded;
}
$action = isset($_GET['action']) ? (string)$_GET['action'] : (isset($body['action']) ? (string)$body['action'] : 'ping');

function disiplin_legacy_user_payload($user, $token)
{
    return array(
        'wp_id' => (int)$user->ID,
        'username' => $user->user_login,
        'email' => $user->user_email,
        'displayName' => $user->display_name ? $user->display_name : $user->user_login,
        'syncKey' => 'wp_user_' . (int)$user->ID,
        'token' => $token,
    );
}

/** Eski istemciden gelen veriyi üyenin kaydıyla birleştirir ve kaydeder */
function disiplin_legacy_sync($uid, $body)
{
    if (!disiplin_lock($uid)) disiplin_json(array('ok' => false, 'error' => 'Sunucu meşgul, lütfen tekrar deneyin.'), 503);
    $migrated = false;
    $server = disiplin_load_user($uid, $migrated);
    $hasData = !empty($body['students']) || !empty($body['incidents']) || !empty($body['institutionSettings']);
    if (!$hasData) return $server;
    $client = disiplin_normalize($body);
    $has = disiplin_client_has($body);
    $merged = disiplin_merge($server, $client, $has, 'legacy');
    $saved = disiplin_save_user($uid, $merged, $server);
    return $saved ? $saved : $server;
}

function disiplin_request_token($body)
{
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) return trim(str_replace('Bearer ', '', (string)$_SERVER['HTTP_AUTHORIZATION']));
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return trim(str_replace('Bearer ', '', (string)$_SERVER['REDIRECT_HTTP_AUTHORIZATION']));
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) return trim((string)$_SERVER['HTTP_X_AUTH_TOKEN']);
    if (!empty($body['token'])) return (string)$body['token'];
    if (!empty($_GET['token'])) return (string)$_GET['token'];
    return '';
}

if ($action === 'ping') {
    disiplin_json(array(
        'ok' => true,
        'service' => 'E-Okul Disiplin AI Pro Sync API',
        'version' => DISIPLIN_APP_VERSION,
        'wpIntegrated' => true,
        'storage' => 'wp_usermeta:' . DISIPLIN_META_KEY,
        'serverTime' => gmdate('Y-m-d\TH:i:s\Z'),
    ));
}

if ($action === 'check-session') {
    if (is_user_logged_in()) {
        $user = wp_get_current_user();
        if (disiplin_user_allowed($user)) {
            $token = disiplin_issue_token($user->ID);
            $migrated = false;
            $d = disiplin_load_user($user->ID, $migrated);
            disiplin_json(array('ok' => true, 'isLoggedIn' => true, 'user' => disiplin_legacy_user_payload($user, $token), 'data' => disiplin_public_data($d)));
        }
    }
    disiplin_json(array('ok' => false, 'isLoggedIn' => false));
}

if ($action === 'login') {
    $identifier = trim(isset($body['username']) ? (string)$body['username'] : '');
    $password = isset($body['password']) ? (string)$body['password'] : '';
    if ($identifier === '' || $password === '') {
        disiplin_json(array('ok' => false, 'error' => 'Lütfen evrakplus.com kullanıcı adı/e-postası ve şifrenizi girin.'), 400);
    }
    $loginName = $identifier;
    if (is_email($identifier)) {
        $u = get_user_by('email', $identifier);
        if ($u) $loginName = $u->user_login;
    }
    $auth = wp_authenticate($loginName, $password);
    if (is_wp_error($auth)) {
        disiplin_json(array('ok' => false, 'error' => 'Evrakplus.com kullanıcı bilgileri doğrulanamadı. Lütfen e-posta ve şifrenizi kontrol edin.'), 401);
    }
    if (!disiplin_user_allowed($auth)) {
        disiplin_json(array('ok' => false, 'error' => 'Üyeliğiniz bu programı kullanmaya yetkili değil.'), 403);
    }
    $token = disiplin_issue_token($auth->ID);
    $d = disiplin_legacy_sync($auth->ID, $body);
    disiplin_json(array('ok' => true, 'user' => disiplin_legacy_user_payload($auth, $token), 'data' => disiplin_public_data($d)));
}

if ($action === 'sync' || $action === 'push' || $action === 'pull') {
    $uid = disiplin_user_from_token(disiplin_request_token($body));
    if (!$uid || !get_userdata($uid)) {
        disiplin_json(array('ok' => false, 'error' => 'Yetkisiz erişim. Lütfen evrakplus.com hesabınızla tekrar giriş yapın.'), 401);
    }
    if (!disiplin_user_allowed(get_userdata($uid))) {
        disiplin_json(array('ok' => false, 'error' => 'Üyeliğiniz bu programı kullanmaya yetkili değil.'), 403);
    }
    if ($action === 'pull') {
        $migrated = false;
        $d = disiplin_load_user($uid, $migrated);
        disiplin_json(array('ok' => true, 'data' => disiplin_public_data($d)));
    }
    $d = disiplin_legacy_sync($uid, $body);
    disiplin_json(array('ok' => true, 'updatedAt' => $d['updatedAt'], 'data' => disiplin_public_data($d)));
}

disiplin_json(array('ok' => false, 'error' => 'Geçersiz işlem: ' . preg_replace('/[^a-z_-]/i', '', $action)), 400);
