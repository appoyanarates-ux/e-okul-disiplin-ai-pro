<?php
/**
 * E-Okul Disiplin AI Pro - Veri API'si (yalnızca giriş yapmış evrakplus.com üyeleri)
 *
 *  GET  api.php?action=nonce                 -> yeni güvenlik anahtarı
 *  GET  api.php?action=load[&knownRev=N]     -> üyenin verisi (disiplin_data)
 *  POST api.php?action=save                  -> {baseRev, mode, data, tombstones}
 *  POST api.php?action=att_put               -> imzalı tutanak taraması yükle
 *  GET  api.php?action=att_get&id=..&_n=..   -> ek dosyayı görüntüle
 *  POST api.php?action=att_del               -> ek dosyayı sil
 */
define('DISIPLIN_APP', true);
require __DIR__ . '/inc/bootstrap.php';

disiplin_no_cache();

if (!is_user_logged_in()) {
    disiplin_json(array('ok' => false, 'code' => 'auth', 'error' => 'evrakplus.com oturumunuz bulunamadı. Lütfen tekrar giriş yapın.', 'loginUrl' => disiplin_login_url(disiplin_app_url())), 401);
}
$user = wp_get_current_user();
$uid = (int)$user->ID;
if (!disiplin_user_allowed($user)) {
    disiplin_json(array('ok' => false, 'code' => 'forbidden', 'error' => 'Üyeliğiniz bu programı kullanmaya yetkili değil.'), 403);
}

$action = isset($_GET['action']) ? preg_replace('/[^a-z_]/', '', (string)$_GET['action']) : '';
$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';

if ($action === 'nonce') {
    disiplin_json(array('ok' => true, 'nonce' => wp_create_nonce('disiplin_api')));
}

// --- CSRF koruması ---
$nonce = isset($_SERVER['HTTP_X_WP_NONCE']) ? (string)$_SERVER['HTTP_X_WP_NONCE'] : (isset($_GET['_n']) ? (string)$_GET['_n'] : '');
if (!wp_verify_nonce($nonce, 'disiplin_api')) {
    disiplin_json(array('ok' => false, 'code' => 'bad_nonce', 'error' => 'Güvenlik anahtarının süresi doldu.'), 403);
}

/** İstek gövdesini okur (gzip sıkıştırılmış olabilir) */
function disiplin_read_body()
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return array();
    $enc = isset($_SERVER['HTTP_X_BODY_ENCODING']) ? strtolower((string)$_SERVER['HTTP_X_BODY_ENCODING']) : '';
    if ($enc === 'gzip') {
        if (!function_exists('gzdecode')) disiplin_json(array('ok' => false, 'code' => 'bad_body', 'error' => 'Sunucu sıkıştırmayı desteklemiyor.'), 415);
        $dec = @gzdecode($raw, 128 * 1024 * 1024);
        if ($dec === false) disiplin_json(array('ok' => false, 'code' => 'bad_body', 'error' => 'Sıkıştırılmış veri çözülemedi.'), 400);
        $raw = $dec;
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) disiplin_json(array('ok' => false, 'code' => 'bad_body', 'error' => 'Geçersiz veri biçimi.'), 400);
    return $body;
}

// ---------------------------------------------------------------------------
if ($action === 'load') {
    $migrated = false;
    $d = disiplin_load_user($uid, $migrated);
    $known = isset($_GET['knownRev']) ? (int)$_GET['knownRev'] : -1;
    if ($known === (int)$d['rev'] && $known > 0 && !$migrated) {
        disiplin_json(array('ok' => true, 'unchanged' => true, 'rev' => (int)$d['rev']));
    }
    disiplin_json(array('ok' => true, 'rev' => (int)$d['rev'], 'migrated' => $migrated, 'data' => disiplin_public_data($d)));
}

// ---------------------------------------------------------------------------
if ($action === 'save') {
    if ($method !== 'POST') disiplin_json(array('ok' => false, 'error' => 'POST gerekli'), 405);
    $body = disiplin_read_body();
    $clientRaw = isset($body['data']) && is_array($body['data']) ? $body['data'] : array();
    if (isset($body['tombstones']) && is_array($body['tombstones'])) $clientRaw['tombstones'] = $body['tombstones'];
    $client = disiplin_normalize($clientRaw);
    $has = disiplin_client_has($clientRaw);
    $baseRev = isset($body['baseRev']) ? (int)$body['baseRev'] : -1;
    $mode = isset($body['mode']) && in_array($body['mode'], array('normal', 'union'), true) ? $body['mode'] : 'normal';

    if (!disiplin_lock($uid)) disiplin_json(array('ok' => false, 'error' => 'Sunucu meşgul, lütfen tekrar deneyin.'), 503);
    try {
        $migrated = false;
        $server = disiplin_load_user($uid, $migrated);
        $serverRev = (int)$server['rev'];

        if ($mode === 'normal' && $baseRev === $serverRev && !$migrated) {
            // Bu cihaz sunucudaki son sürümü biliyor: gönderdiği veri esastır
            $next = $server;
            foreach (disiplin_collections() as $c) if (!empty($has[$c])) $next[$c] = $client[$c];
            foreach (array('institutionSettings', 'boardSettings', 'gemini_api_key') as $k) if (!empty($has[$k])) $next[$k] = $client[$k];
            if (!empty($client['settingsTs'])) $next['settingsTs'] = array_merge((array)$server['settingsTs'], $client['settingsTs']);
            foreach (disiplin_collections() as $c) {
                $next['tombstones'][$c] = array_merge((array)$server['tombstones'][$c], (array)$client['tombstones'][$c]);
            }
            $saved = disiplin_save_user($uid, $next, $server);
            if (!$saved) disiplin_json(array('ok' => false, 'error' => 'Veri WordPress hesabınıza kaydedilemedi.'), 500);
            disiplin_json(array('ok' => true, 'rev' => (int)$saved['rev'], 'merged' => false));
        }

        // Başka cihazda değişiklik olmuş (veya eski sürüm verisi): kayıt bazında birleştir
        $merged = disiplin_merge($server, $client, $has, $mode);
        $saved = disiplin_save_user($uid, $merged, $server);
        if (!$saved) disiplin_json(array('ok' => false, 'error' => 'Veri WordPress hesabınıza kaydedilemedi.'), 500);
        disiplin_json(array('ok' => true, 'rev' => (int)$saved['rev'], 'merged' => true, 'data' => disiplin_public_data($saved)));
    } finally {
        disiplin_unlock($uid);
    }
}

// ---------------------------------------------------------------------------
// Ekler: disiplin_sync_storage/files/u<ID>/<ekID>.bin (+ .json bilgi dosyası)
// ---------------------------------------------------------------------------
function disiplin_att_id($id)
{
    $id = (string)$id;
    return preg_match('/^[A-Za-z0-9_-]{8,80}$/', $id) ? $id : '';
}

if ($action === 'att_put') {
    if ($method !== 'POST') disiplin_json(array('ok' => false, 'error' => 'POST gerekli'), 405);
    $body = disiplin_read_body();
    $id = disiplin_att_id(isset($body['id']) ? $body['id'] : '');
    if ($id === '') disiplin_json(array('ok' => false, 'error' => 'Geçersiz ek kimliği.'), 400);
    $bin = base64_decode(isset($body['data']) ? (string)$body['data'] : '', true);
    if ($bin === false || $bin === '') disiplin_json(array('ok' => false, 'error' => 'Dosya okunamadı.'), 400);
    if (strlen($bin) > DISIPLIN_MAX_ATTACHMENT) disiplin_json(array('ok' => false, 'error' => 'Dosya çok büyük.'), 413);
    $type = isset($body['type']) ? (string)$body['type'] : 'application/octet-stream';
    if (!preg_match('#^(image/(jpeg|png|webp|gif|heic|heif)|application/pdf)$#', $type)) {
        disiplin_json(array('ok' => false, 'error' => 'Yalnızca fotoğraf (JPG/PNG) veya PDF yüklenebilir.'), 415);
    }
    $dir = disiplin_storage_dir('files/u' . $uid);
    if (@file_put_contents($dir . '/' . $id . '.bin', $bin, LOCK_EX) === false) {
        disiplin_json(array('ok' => false, 'error' => 'Dosya sunucuya yazılamadı.'), 500);
    }
    $meta = array(
        'id' => $id,
        'warningId' => isset($body['warningId']) ? substr((string)$body['warningId'], 0, 80) : '',
        'name' => sanitize_file_name(isset($body['name']) ? (string)$body['name'] : 'ek'),
        'type' => $type,
        'size' => strlen($bin),
        'uploadedAt' => gmdate('c'),
    );
    @file_put_contents($dir . '/' . $id . '.json', wp_json_encode($meta), LOCK_EX);
    disiplin_json(array('ok' => true, 'attachment' => $meta));
}

if ($action === 'att_get') {
    $id = disiplin_att_id(isset($_GET['id']) ? $_GET['id'] : '');
    $dir = rtrim(DISIPLIN_STORAGE_DIR, '/') . '/files/u' . $uid;
    if ($id === '' || !file_exists($dir . '/' . $id . '.bin')) {
        status_header(404);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Dosya bulunamadı.';
        exit;
    }
    $meta = json_decode((string)@file_get_contents($dir . '/' . $id . '.json'), true);
    $type = is_array($meta) && !empty($meta['type']) ? $meta['type'] : 'application/octet-stream';
    $name = is_array($meta) && !empty($meta['name']) ? $meta['name'] : ($id . '.bin');
    header('Content-Type: ' . $type);
    header('Content-Length: ' . filesize($dir . '/' . $id . '.bin'));
    header('Content-Disposition: inline; filename="' . str_replace('"', '', $name) . '"');
    header('X-Content-Type-Options: nosniff');
    readfile($dir . '/' . $id . '.bin');
    exit;
}

if ($action === 'att_del') {
    if ($method !== 'POST') disiplin_json(array('ok' => false, 'error' => 'POST gerekli'), 405);
    $body = disiplin_read_body();
    $id = disiplin_att_id(isset($body['id']) ? $body['id'] : '');
    if ($id === '') disiplin_json(array('ok' => false, 'error' => 'Geçersiz ek kimliği.'), 400);
    $dir = rtrim(DISIPLIN_STORAGE_DIR, '/') . '/files/u' . $uid;
    @unlink($dir . '/' . $id . '.bin');
    @unlink($dir . '/' . $id . '.json');
    disiplin_json(array('ok' => true));
}

disiplin_json(array('ok' => false, 'error' => 'Geçersiz işlem.'), 400);
