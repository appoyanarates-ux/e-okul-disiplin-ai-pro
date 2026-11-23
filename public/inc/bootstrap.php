<?php
/**
 * E-Okul Disiplin AI Pro - evrakplus.com WordPress köprüsü (ortak kitaplık)
 *
 * - WordPress'i yükler (wp-load.php), üye oturumunu kontrol eder.
 * - Üyenin verisini kendi WordPress hesabında "<programkodu>_data" user meta alanında saklar.
 * - Eski sürümün disiplin_sync_storage/wp_user_<ID>.json dosyalarını bu alana taşır.
 * - Cihazlar arası değişiklikleri kayıt bazında (updatedAt) birleştirir.
 */
defined('DISIPLIN_APP') || exit;

require_once __DIR__ . '/config.php';

define('DISIPLIN_META_KEY', DISIPLIN_PROGRAM_CODE . '_data');
define('DISIPLIN_META_MIGRATED', DISIPLIN_PROGRAM_CODE . '_data_migrated');
define('DISIPLIN_META_TOKENS', DISIPLIN_PROGRAM_CODE . '_api_tokens');
define('DISIPLIN_SCHEMA', 2);
define('DISIPLIN_COLLECTIONS', 'students,incidents,writtenWarnings');

// ---------------------------------------------------------------------------
// WordPress yükleme
// ---------------------------------------------------------------------------
function disiplin_find_wp_load()
{
    $dir = dirname(__DIR__);
    for ($i = 0; $i < 5; $i++) {
        $dir = dirname($dir);
        if (file_exists($dir . '/wp-load.php')) return $dir . '/wp-load.php';
        if ($dir === '/' || $dir === '.' || $dir === '') break;
    }
    return null;
}

if (!defined('ABSPATH')) {
    $wpLoad = disiplin_find_wp_load();
    if (!$wpLoad) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo "WordPress bulunamadı (wp-load.php). Program klasörünü WordPress'in kurulu olduğu public_html içine yükleyin.";
        exit;
    }
    if (!defined('WP_USE_THEMES')) define('WP_USE_THEMES', false);
    if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true);   // önbellek eklentileri bu sayfaları saklamasın
    if (!defined('DONOTCACHEOBJECT')) define('DONOTCACHEOBJECT', false);
    require_once $wpLoad;
}

// ---------------------------------------------------------------------------
// Genel yardımcılar
// ---------------------------------------------------------------------------
function disiplin_no_cache()
{
    if (function_exists('nocache_headers')) nocache_headers();
    header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0, private');
    header('Pragma: no-cache');
    header('X-LiteSpeed-Cache-Control: no-cache');
    header('X-Accel-Expires: 0');
}

/** Programın tam adresi (klasör adından bağımsız) */
function disiplin_app_url($path = '')
{
    $https = (function_exists('is_ssl') && is_ssl()) || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : parse_url(home_url(), PHP_URL_HOST);
    $script = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '/';
    $dir = rtrim(str_replace('\\', '/', dirname($script)), '/');
    return ($https ? 'https' : 'http') . '://' . $host . $dir . '/' . ltrim($path, '/');
}

function disiplin_login_url($redirectTo)
{
    if (DISIPLIN_LOGIN_PAGE !== '') {
        $sep = strpos(DISIPLIN_LOGIN_PAGE, '?') === false ? '?' : '&';
        return DISIPLIN_LOGIN_PAGE . $sep . 'redirect_to=' . rawurlencode($redirectTo);
    }
    return wp_login_url($redirectTo);
}

function disiplin_is_electron()
{
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
    return stripos($ua, 'Electron/') !== false;
}

function disiplin_user_allowed($user)
{
    if (!$user || !$user->ID) return false;
    $roles = array_filter(array_map('trim', explode(',', (string)DISIPLIN_ALLOWED_ROLES)));
    if (empty($roles)) return true;
    if (user_can($user, 'manage_options')) return true;
    return count(array_intersect($roles, (array)$user->roles)) > 0;
}

function disiplin_json($payload, $status = 200)
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
    }
    echo wp_json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function disiplin_now_iso()
{
    $t = microtime(true);
    return gmdate('Y-m-d\TH:i:s', (int)$t) . sprintf('.%03dZ', (int)(($t - floor($t)) * 1000));
}

/** ISO tarih metnini milisaniye cinsinden sayıya çevirir (karşılaştırma için) */
function disiplin_ts($v)
{
    if (is_numeric($v)) return (float)$v;
    if (!is_string($v) || $v === '') return 0.0;
    $d = date_create($v);
    if (!$d) return 0.0;
    return (float)$d->format('U') * 1000 + (int)$d->format('v');
}

// ---------------------------------------------------------------------------
// Depolama klasörü (eski veriler, ekler, yedekler)
// ---------------------------------------------------------------------------
function disiplin_storage_dir($sub = '')
{
    $dir = DISIPLIN_STORAGE_DIR;
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $ht = $dir . '/.htaccess';
    if (!file_exists($ht)) {
        @file_put_contents($ht, "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n");
    }
    if (!file_exists($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
    if ($sub !== '') {
        $dir .= '/' . $sub;
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        if (!file_exists($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
    }
    return $dir;
}

// ---------------------------------------------------------------------------
// Veri biçimi
// ---------------------------------------------------------------------------
function disiplin_collections()
{
    return explode(',', DISIPLIN_COLLECTIONS);
}

function disiplin_empty_data()
{
    return array(
        'schema' => DISIPLIN_SCHEMA,
        'rev' => 0,
        'updatedAt' => null,
        'appVersion' => DISIPLIN_APP_VERSION,
        'institutionSettings' => array(),
        'boardSettings' => array(),
        'students' => array(),
        'incidents' => array(),
        'writtenWarnings' => array(),
        'gemini_api_key' => '',
        'settingsTs' => array(),
        'tombstones' => array('students' => array(), 'incidents' => array(), 'writtenWarnings' => array()),
    );
}

/** Kayıt listesini temizler: yalnızca id'si olan nesneler, aynı id tekrar ederse sonuncusu */
function disiplin_clean_list($list)
{
    if (!is_array($list)) return array();
    $out = array();
    foreach ($list as $item) {
        if (!is_array($item) || !isset($item['id']) || $item['id'] === '' || $item['id'] === null) continue;
        $out[(string)$item['id']] = $item;
    }
    return array_values($out);
}

/** Eski (v1) veya yeni (v2) biçimdeki veriyi v2 biçimine getirir */
function disiplin_normalize($raw)
{
    $d = disiplin_empty_data();
    if (!is_array($raw)) return $d;
    $d['rev'] = isset($raw['rev']) ? (int)$raw['rev'] : 0;
    $d['updatedAt'] = isset($raw['updatedAt']) ? $raw['updatedAt'] : null;
    if (isset($raw['institutionSettings']) && is_array($raw['institutionSettings'])) $d['institutionSettings'] = $raw['institutionSettings'];
    if (isset($raw['boardSettings']) && is_array($raw['boardSettings'])) $d['boardSettings'] = array_values($raw['boardSettings']);
    foreach (disiplin_collections() as $c) {
        if (isset($raw[$c])) $d[$c] = disiplin_clean_list($raw[$c]);
    }
    if (isset($raw['gemini_api_key']) && is_string($raw['gemini_api_key'])) $d['gemini_api_key'] = $raw['gemini_api_key'];
    if (isset($raw['settingsTs']) && is_array($raw['settingsTs'])) $d['settingsTs'] = $raw['settingsTs'];
    if (isset($raw['tombstones']) && is_array($raw['tombstones'])) {
        foreach (disiplin_collections() as $c) {
            if (isset($raw['tombstones'][$c]) && is_array($raw['tombstones'][$c])) $d['tombstones'][$c] = $raw['tombstones'][$c];
        }
    }
    // v1 (eski sürüm) silinen kayıt listeleri
    $legacyTs = isset($raw['updatedAt']) && $raw['updatedAt'] ? $raw['updatedAt'] : disiplin_now_iso();
    foreach (array('deletedStudentIds' => 'students', 'deletedIncidentIds' => 'incidents') as $k => $c) {
        if (!empty($raw[$k]) && is_array($raw[$k])) {
            foreach ($raw[$k] as $id) {
                if (is_scalar($id) && !isset($d['tombstones'][$c][(string)$id])) $d['tombstones'][$c][(string)$id] = $legacyTs;
            }
        }
    }
    return $d;
}

/** İstemciye gönderilecek biçim (eski masaüstü sürümleriyle de uyumlu alanlar eklenir) */
function disiplin_public_data($d)
{
    $out = $d;
    $out['version'] = DISIPLIN_APP_VERSION;
    $out['institutionSettings'] = empty($d['institutionSettings']) ? new stdClass() : $d['institutionSettings'];
    $out['settingsTs'] = empty($d['settingsTs']) ? new stdClass() : $d['settingsTs'];
    $t = array();
    foreach (disiplin_collections() as $c) {
        $t[$c] = empty($d['tombstones'][$c]) ? new stdClass() : $d['tombstones'][$c];
    }
    $out['tombstones'] = $t;
    $out['deletedStudentIds'] = array_values(array_map('strval', array_keys((array)$d['tombstones']['students'])));
    $out['deletedIncidentIds'] = array_values(array_map('strval', array_keys((array)$d['tombstones']['incidents'])));
    return $out;
}

// ---------------------------------------------------------------------------
// WordPress hesabında saklama ( <kod>_data user meta )
// ---------------------------------------------------------------------------
function disiplin_encode_store($d)
{
    $json = wp_json_encode($d, JSON_UNESCAPED_UNICODE);
    if ($json === false) return false;
    // Büyük veriler sıkıştırılır (WordPress her sayfada üye meta verisini yüklediği için site hızını korur)
    if (strlen($json) > 150000 && function_exists('gzcompress')) {
        $gz = gzcompress($json, 6);
        if ($gz !== false) return 'GZ1:' . base64_encode($gz);
    }
    return $json;
}

function disiplin_decode_store($raw)
{
    if (!is_string($raw) || $raw === '') return null;
    if (strncmp($raw, 'GZ1:', 4) === 0) {
        $bin = base64_decode(substr($raw, 4), true);
        if ($bin === false) return null;
        $json = @gzuncompress($bin);
        if ($json === false) return null;
        $raw = $json;
    }
    $d = json_decode($raw, true);
    return is_array($d) ? $d : null;
}

function disiplin_read_meta($uid)
{
    global $wpdb;
    // Önbellekte bayat kopya kalmasın diye doğrudan veritabanından okunur
    $raw = $wpdb->get_var($wpdb->prepare(
        "SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key = %s ORDER BY umeta_id ASC LIMIT 1",
        (int)$uid,
        DISIPLIN_META_KEY
    ));
    if ($raw === null) return null;
    $raw = maybe_unserialize($raw);
    if (is_array($raw)) return $raw; // olası dizi kaydı
    return disiplin_decode_store($raw);
}

function disiplin_write_meta($uid, $d)
{
    $enc = disiplin_encode_store($d);
    if ($enc === false) return false;
    // wp_slash: update_user_meta ters bölü işaretlerini sildiği için gereklidir (JSON bozulmasın)
    $res = update_user_meta((int)$uid, DISIPLIN_META_KEY, wp_slash($enc));
    if ($res === false) {
        // Değer aynıysa false döner; gerçekten yazıldı mı kontrol et
        $check = disiplin_read_meta($uid);
        return is_array($check) && isset($check['rev']) && (int)$check['rev'] === (int)$d['rev'];
    }
    return true;
}

function disiplin_lock($uid)
{
    global $wpdb;
    $got = $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, %d)', 'disiplin_u' . (int)$uid, 20));
    if ((string)$got === '1') {
        // exit ile çıkılsa da kilit bırakılsın
        register_shutdown_function('disiplin_unlock', (int)$uid);
        return true;
    }
    // Veritabanı GET_LOCK desteklemiyorsa (null) kilitsiz devam et; yalnızca zaman aşımında (0) reddet
    return $got === null;
}

function disiplin_unlock($uid)
{
    global $wpdb;
    $wpdb->query($wpdb->prepare('SELECT RELEASE_LOCK(%s)', 'disiplin_u' . (int)$uid));
}

/** Eski sürümün dosyası: disiplin_sync_storage/wp_user_<ID>.json */
function disiplin_legacy_file($uid)
{
    return rtrim(DISIPLIN_STORAGE_DIR, '/') . '/wp_user_' . (int)$uid . '.json';
}

/**
 * Üyenin verisini yükler. Hesapta veri yoksa eski sürüm dosyasını otomatik taşır.
 * Dönüş: v2 veri dizisi
 */
function disiplin_load_user($uid, &$migratedNow = false)
{
    $migratedNow = false;
    $raw = disiplin_read_meta($uid);
    if (is_array($raw)) return disiplin_normalize($raw);

    $file = disiplin_legacy_file($uid);
    if (file_exists($file)) {
        $legacy = json_decode((string)@file_get_contents($file), true);
        if (is_array($legacy)) {
            $d = disiplin_normalize($legacy);
            $d['rev'] = 1;
            $d['updatedAt'] = disiplin_now_iso();
            $d['appVersion'] = DISIPLIN_APP_VERSION;
            if (disiplin_write_meta($uid, $d)) {
                update_user_meta((int)$uid, DISIPLIN_META_MIGRATED, gmdate('c') . ' file:' . basename($file));
                $migratedNow = true;
                return $d;
            }
        }
    }
    return disiplin_empty_data();
}

/** Günlük yedek (sunucuda, korumalı klasörde) */
function disiplin_daily_backup($uid, $d)
{
    if (empty($d['rev'])) return;
    $dir = disiplin_storage_dir('backups/u' . (int)$uid);
    $file = $dir . '/' . gmdate('Y-m-d') . '.json.gz';
    if (file_exists($file)) return;
    $json = wp_json_encode($d, JSON_UNESCAPED_UNICODE);
    if ($json === false) return;
    @file_put_contents($file, function_exists('gzencode') ? gzencode($json, 6) : $json, LOCK_EX);
    $files = glob($dir . '/*.json.gz');
    if (is_array($files) && count($files) > DISIPLIN_BACKUP_KEEP) {
        sort($files);
        foreach (array_slice($files, 0, count($files) - DISIPLIN_BACKUP_KEEP) as $old) @unlink($old);
    }
}

/** Veriyi yeni sürüm numarasıyla kaydeder */
function disiplin_save_user($uid, $d, $previous)
{
    disiplin_daily_backup($uid, $previous);
    $d['rev'] = (int)$previous['rev'] + 1;
    $d['updatedAt'] = disiplin_now_iso();
    $d['appVersion'] = DISIPLIN_APP_VERSION;
    $d['schema'] = DISIPLIN_SCHEMA;
    $d = disiplin_prune_tombstones($d);
    return disiplin_write_meta($uid, $d) ? $d : false;
}

function disiplin_prune_tombstones($d)
{
    foreach (disiplin_collections() as $c) {
        $t = isset($d['tombstones'][$c]) && is_array($d['tombstones'][$c]) ? $d['tombstones'][$c] : array();
        if (count($t) > 3000) {
            uasort($t, function ($a, $b) { return disiplin_ts($b) <=> disiplin_ts($a); });
            $t = array_slice($t, 0, 3000, true);
        }
        $d['tombstones'][$c] = $t;
    }
    return $d;
}

// ---------------------------------------------------------------------------
// Birleştirme
// ---------------------------------------------------------------------------
/**
 * Sunucu ve istemci verisini kayıt bazında birleştirir.
 *  $mode = 'normal' : çakışmada updatedAt daha yeni olan kazanır; damgası olmayanlarda sunucu kazanır
 *  $mode = 'union'  : eski sürümden gelen tarayıcı verisi; hiçbir kayıt kaybolmaz, çakışmada sunucu kazanır
 *  $mode = 'legacy' : eski masaüstü sürümü (sync-api.php); eski davranış gibi istemci kazanır
 */
function disiplin_merge($server, $client, $clientHas, $mode)
{
    $out = $server;

    // Silinen kayıtlar (en yeni silinme zamanı)
    foreach (disiplin_collections() as $c) {
        $t = isset($server['tombstones'][$c]) ? (array)$server['tombstones'][$c] : array();
        foreach ((array)$client['tombstones'][$c] as $id => $ts) {
            if (!isset($t[$id]) || disiplin_ts($ts) > disiplin_ts($t[$id])) $t[$id] = $ts;
        }
        $out['tombstones'][$c] = $t;
    }

    foreach (disiplin_collections() as $c) {
        if (empty($clientHas[$c])) {
            $list = $server[$c];
        } else {
            $map = array();
            foreach ($server[$c] as $rec) $map[(string)$rec['id']] = $rec;
            foreach ($client[$c] as $rec) {
                $id = (string)$rec['id'];
                if (!isset($map[$id])) { $map[$id] = $rec; continue; }
                $sTs = disiplin_ts(isset($map[$id]['updatedAt']) ? $map[$id]['updatedAt'] : null);
                $cTs = disiplin_ts(isset($rec['updatedAt']) ? $rec['updatedAt'] : null);
                if ($mode === 'legacy') {
                    $map[$id] = ($c === 'students') ? array_merge($map[$id], $rec) : $rec;
                } elseif ($cTs > $sTs) {
                    $map[$id] = $rec;
                }
                // eşit veya sunucu daha yeni: sunucu kaydı kalır
            }
            $list = array_values($map);
        }
        // Silinmiş kayıtları çıkar (silindikten sonra yeniden düzenlenen kayıt korunur)
        $tomb = $out['tombstones'][$c];
        $kept = array();
        foreach ($list as $rec) {
            $id = (string)$rec['id'];
            if (isset($tomb[$id])) {
                $rTs = disiplin_ts(isset($rec['updatedAt']) ? $rec['updatedAt'] : null);
                if ($rTs <= disiplin_ts($tomb[$id])) continue;
            }
            $kept[] = $rec;
        }
        $out[$c] = $kept;
    }

    // Ayarlar
    foreach (array('institutionSettings', 'boardSettings', 'gemini_api_key') as $k) {
        if (empty($clientHas[$k])) continue;
        $cv = $client[$k];
        $sv = $server[$k];
        $cEmpty = empty($cv);
        if ($mode === 'legacy') {
            if (!$cEmpty) $out[$k] = $cv;
            continue;
        }
        $cTs = disiplin_ts(isset($client['settingsTs'][$k]) ? $client['settingsTs'][$k] : null);
        $sTs = disiplin_ts(isset($server['settingsTs'][$k]) ? $server['settingsTs'][$k] : null);
        if ($cTs > $sTs || (empty($sv) && !$cEmpty)) {
            $out[$k] = $cv;
            if ($cTs > 0) $out['settingsTs'][$k] = $client['settingsTs'][$k];
        }
    }
    return $out;
}

/** İstemcinin gönderdiği alanlar (göndermediği koleksiyonlar sunucuda korunur) */
function disiplin_client_has($raw)
{
    $has = array();
    foreach (array_merge(disiplin_collections(), array('institutionSettings', 'boardSettings', 'gemini_api_key')) as $k) {
        $has[$k] = is_array($raw) && array_key_exists($k, $raw);
    }
    if (isset($raw['institutionSettings']) && is_array($raw['institutionSettings']) && empty($raw['institutionSettings'])) {
        // boş ayar nesnesi "değişiklik yok" kabul edilir
        $has['institutionSettings'] = false;
    }
    return $has;
}

// ---------------------------------------------------------------------------
// Masaüstü (eski sync-api) erişim anahtarları
// ---------------------------------------------------------------------------
function disiplin_issue_token($uid)
{
    $secret = bin2hex(random_bytes(24));
    $token = 'u' . (int)$uid . '_' . $secret;
    $list = get_user_meta((int)$uid, DISIPLIN_META_TOKENS, true);
    if (!is_array($list)) $list = array();
    $list[] = array('h' => hash('sha256', $token), 't' => time());
    $list = array_slice($list, -8);
    update_user_meta((int)$uid, DISIPLIN_META_TOKENS, $list);
    return $token;
}

/** Anahtardan üye kimliğini bulur (yeni biçim u<ID>_..., eski biçim users_registry.json) */
function disiplin_user_from_token($token)
{
    $token = trim((string)$token);
    if ($token === '' || strlen($token) > 200) return 0;
    if (preg_match('/^u(\d+)_[a-f0-9]{48}$/', $token, $m)) {
        $uid = (int)$m[1];
        $list = get_user_meta($uid, DISIPLIN_META_TOKENS, true);
        if (is_array($list)) {
            $h = hash('sha256', $token);
            foreach ($list as $row) {
                if (isset($row['h']) && hash_equals($row['h'], $h)) return $uid;
            }
        }
        return 0;
    }
    // Eski sürüm anahtarları
    $reg = rtrim(DISIPLIN_STORAGE_DIR, '/') . '/users_registry.json';
    if (file_exists($reg)) {
        $users = json_decode((string)@file_get_contents($reg), true);
        if (is_array($users)) {
            foreach ($users as $u) {
                if (!empty($u['token']) && is_string($u['token']) && hash_equals($u['token'], $token) && !empty($u['wp_id'])) {
                    return (int)$u['wp_id'];
                }
            }
        }
    }
    return 0;
}
