<?php
/**
 * E-Okul Disiplin AI Pro - Evrakplus.com WordPress & Bulut Senkronizasyon API'si (v1.1.7)
 * Konum: https://www.evrakplus.com/disiplin-cezasi-programi/sync-api.php
 * Geliştirici: Abdullah Yanarateş
 */

// CORS & HTTP Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Sync-Key, X-Auth-Token');
header('Content-Type: application/json; charset=utf-8');

// OPTIONS pre-flight check
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 1. WORDPRESS ENTEGRASYONU (wp-load.php)
$wpLoaded = false;
$wpLoadPath = dirname(__DIR__) . '/wp-load.php';
if (file_exists($wpLoadPath)) {
    define('WP_USE_THEMES', false);
    @require_once $wpLoadPath;
    if (function_exists('wp_authenticate')) {
        $wpLoaded = true;
    }
}

// 2. GÜVENLİ DEPOLAMA KLASÖRÜ (.htaccess korumalı)
$dataDir = __DIR__ . '/disiplin_sync_storage';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

// .htaccess koruması: Dışarıdan doğrudan JSON erişimini engeller
$htaccessFile = $dataDir . '/.htaccess';
if (!file_exists($htaccessFile)) {
    $htaccessRules = "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n";
    @file_put_contents($htaccessFile, $htaccessRules);
}

$indexFile = $dataDir . '/index.html';
if (!file_exists($indexFile)) {
    @file_put_contents($indexFile, "<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>Yetkisiz Erisim</body></html>");
}

$usersDbFile = $dataDir . '/users_registry.json';
if (!file_exists($usersDbFile)) {
    @file_put_contents($usersDbFile, "{}", LOCK_EX);
}

// Yardımcı Fonksiyonlar
function loadUsersDb($file) {
    if (!file_exists($file)) return [];
    $raw = @file_get_contents($file);
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function saveUsersDb($file, $users) {
    $json = json_encode((object)$users, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return @file_put_contents($file, $json, LOCK_EX) !== false;
}

function generateSecureToken() {
    if (function_exists('random_bytes')) {
        try {
            return bin2hex(random_bytes(24));
        } catch (Exception $e) {}
    }
    if (function_exists('openssl_random_pseudo_bytes')) {
        return bin2hex(openssl_random_pseudo_bytes(24));
    }
    return hash('sha256', uniqid('eokul_', true) . mt_rand());
}

function loadUserData($file) {
    $default = [
        'version' => '1.1.7',
        'updatedAt' => null,
        'institutionSettings' => new stdClass(),
        'boardSettings' => [],
        'students' => [],
        'incidents' => [],
        'gemini_api_key' => '',
        'deletedStudentIds' => [],
        'deletedIncidentIds' => []
    ];
    if (!file_exists($file)) return $default;
    $content = @file_get_contents($file);
    if (!$content) return $default;
    $data = json_decode($content, true);
    if (!is_array($data)) return $default;

    return [
        'version' => isset($data['version']) ? $data['version'] : '1.1.7',
        'updatedAt' => isset($data['updatedAt']) ? $data['updatedAt'] : null,
        'institutionSettings' => isset($data['institutionSettings']) && is_array($data['institutionSettings']) ? $data['institutionSettings'] : new stdClass(),
        'boardSettings' => isset($data['boardSettings']) && is_array($data['boardSettings']) ? $data['boardSettings'] : [],
        'students' => isset($data['students']) && is_array($data['students']) ? $data['students'] : [],
        'incidents' => isset($data['incidents']) && is_array($data['incidents']) ? $data['incidents'] : [],
        'gemini_api_key' => isset($data['gemini_api_key']) ? (string)$data['gemini_api_key'] : '',
        'deletedStudentIds' => isset($data['deletedStudentIds']) && is_array($data['deletedStudentIds']) ? $data['deletedStudentIds'] : [],
        'deletedIncidentIds' => isset($data['deletedIncidentIds']) && is_array($data['deletedIncidentIds']) ? $data['deletedIncidentIds'] : []
    ];
}

function saveUserData($file, $data) {
    $data['updatedAt'] = gmdate('Y-m-d\TH:i:s\Z');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $res = @file_put_contents($file, $json, LOCK_EX);
    return $res !== false ? $data : false;
}

// İki taraflı Akıllı Birleştirme (Smart Merge)
function performSmartSync($storageFile, $clientData) {
    $serverData = loadUserData($storageFile);

    // 1. Silinen ID'leri birleştir (tombstones)
    $clientDelStudents = isset($clientData['deletedStudentIds']) && is_array($clientData['deletedStudentIds']) ? $clientData['deletedStudentIds'] : [];
    $allDelStudents = array_values(array_unique(array_merge($serverData['deletedStudentIds'], $clientDelStudents)));
    $lookupDelStudents = array_flip($allDelStudents);

    $clientDelIncidents = isset($clientData['deletedIncidentIds']) && is_array($clientData['deletedIncidentIds']) ? $clientData['deletedIncidentIds'] : [];
    $allDelIncidents = array_values(array_unique(array_merge($serverData['deletedIncidentIds'], $clientDelIncidents)));
    $lookupDelIncidents = array_flip($allDelIncidents);

    // 2. Öğrencileri (Students) birleştir
    $studentMap = [];
    foreach ($serverData['students'] as $s) {
        if (!isset($s['id'])) continue;
        $id = $s['id'];
        if (isset($lookupDelStudents[$id])) continue;
        $studentMap[$id] = $s;
    }

    $clientStudents = isset($clientData['students']) && is_array($clientData['students']) ? $clientData['students'] : [];
    foreach ($clientStudents as $cs) {
        if (!isset($cs['id'])) continue;
        $id = $cs['id'];
        if (isset($lookupDelStudents[$id])) continue;

        if (!isset($studentMap[$id])) {
            $studentMap[$id] = $cs;
        } else {
            $studentMap[$id] = array_merge($studentMap[$id], $cs);
        }
    }
    $mergedStudents = array_values($studentMap);

    // 3. Olayları (Incidents) birleştir
    $incidentMap = [];
    foreach ($serverData['incidents'] as $inc) {
        if (!isset($inc['id'])) continue;
        $id = $inc['id'];
        if (isset($lookupDelIncidents[$id])) continue;
        $incidentMap[$id] = $inc;
    }

    $clientIncidents = isset($clientData['incidents']) && is_array($clientData['incidents']) ? $clientData['incidents'] : [];
    foreach ($clientIncidents as $ci) {
        if (!isset($ci['id'])) continue;
        $id = $ci['id'];
        if (isset($lookupDelIncidents[$id])) continue;

        if (!isset($incidentMap[$id])) {
            $incidentMap[$id] = $ci;
        } else {
            $serverTime = isset($incidentMap[$id]['updatedAt']) ? strtotime($incidentMap[$id]['updatedAt']) : 0;
            $clientTime = isset($ci['updatedAt']) ? strtotime($ci['updatedAt']) : 0;
            if ($clientTime >= $serverTime) {
                $incidentMap[$id] = $ci;
            }
        }
    }
    $mergedIncidents = array_values($incidentMap);

    // 4. Kurum ve Kurul Ayarları
    $clientInst = isset($clientData['institutionSettings']) && is_array($clientData['institutionSettings']) && !empty($clientData['institutionSettings'])
        ? $clientData['institutionSettings']
        : $serverData['institutionSettings'];

    $clientBoard = isset($clientData['boardSettings']) && is_array($clientData['boardSettings']) && !empty($clientData['boardSettings'])
        ? $clientData['boardSettings']
        : $serverData['boardSettings'];

    $geminiKey = !empty($clientData['gemini_api_key'])
        ? $clientData['gemini_api_key']
        : (!empty($serverData['gemini_api_key']) ? $serverData['gemini_api_key'] : '');

    $mergedData = [
        'version' => '1.1.7',
        'updatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
        'institutionSettings' => $clientInst,
        'boardSettings' => $clientBoard,
        'students' => $mergedStudents,
        'incidents' => $mergedIncidents,
        'gemini_api_key' => $geminiKey,
        'deletedStudentIds' => array_slice($allDelStudents, -200),
        'deletedIncidentIds' => array_slice($allDelIncidents, -200)
    ];

    return saveUserData($storageFile, $mergedData);
}

// Request Body Ayrıştırma
$rawInput = file_get_contents('php://input');
$body = [];
if (!empty($rawInput)) {
    $decoded = json_decode($rawInput, true);
    if (is_array($decoded)) {
        $body = $decoded;
    }
}

// Token veya Sync-Key Doğrulama
function authenticateUser($dataDir, $usersDbFile, $token, $syncKey) {
    $users = loadUsersDb($usersDbFile);
    foreach ($users as $u) {
        if (!empty($token) && isset($u['token']) && $u['token'] === $token) {
            return $u;
        }
        if (!empty($syncKey) && isset($u['syncKey']) && $u['syncKey'] === $syncKey) {
            return $u;
        }
    }
    return null;
}

$action = isset($_GET['action']) ? $_GET['action'] : (isset($body['action']) ? $body['action'] : 'ping');

// 0. PING / STATUS
if ($action === 'ping') {
    echo json_encode([
        'ok' => true,
        'service' => 'E-Okul Disiplin AI Pro Sync API',
        'version' => '1.1.7',
        'wpIntegrated' => $wpLoaded,
        'serverTime' => gmdate('Y-m-d\TH:i:s\Z')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 1. WEB SSO: EVRAKPLUS.COM AÇIK OTURUM KONTROLÜ (CHECK-SESSION)
// Kullanıcı evrakplus.com'da daha önce giriş yapmışsa webde otomatik tanır
if ($action === 'check-session') {
    if ($wpLoaded && function_exists('is_user_logged_in') && is_user_logged_in()) {
        $wpUser = wp_get_current_user();
        if ($wpUser && $wpUser->ID) {
            $syncKey = 'wp_user_' . $wpUser->ID;
            $token = generateSecureToken();

            $users = loadUsersDb($usersDbFile);
            $users[$wpUser->user_login] = [
                'wp_id' => $wpUser->ID,
                'username' => $wpUser->user_login,
                'email' => $wpUser->user_email,
                'displayName' => $wpUser->display_name ?: $wpUser->user_login,
                'syncKey' => $syncKey,
                'token' => $token,
                'lastLogin' => gmdate('Y-m-d\TH:i:s\Z')
            ];
            saveUsersDb($usersDbFile, $users);

            $storageFile = $dataDir . '/' . $syncKey . '.json';
            $data = loadUserData($storageFile);

            echo json_encode([
                'ok' => true,
                'isLoggedIn' => true,
                'user' => [
                    'wp_id' => $wpUser->ID,
                    'username' => $wpUser->user_login,
                    'email' => $wpUser->user_email,
                    'displayName' => $wpUser->display_name ?: $wpUser->user_login,
                    'syncKey' => $syncKey,
                    'token' => $token
                ],
                'data' => $data
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    echo json_encode(['ok' => false, 'isLoggedIn' => false], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. GİRİŞ YAP (LOGIN) - DOĞRUDAN EVRAKPLUS.COM WP HESABIYLA
if ($action === 'login') {
    $identifier = trim($body['username'] ?? '');
    $password = (string)($body['password'] ?? '');

    if (empty($identifier) || empty($password)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Lütfen evrakplus.com kullanıcı adı/e-postası ve şifrenizi girin.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // A) WordPress Entegrasyonu Aktifse: Doğrudan wp_users üzerinden doğrula
    if ($wpLoaded) {
        // Eğer e-posta ile giriş yapılmak isteniyorsa kullanıcı adını bul
        $loginName = $identifier;
        if (function_exists('is_email') && is_email($identifier) && function_exists('get_user_by')) {
            $userObj = get_user_by('email', $identifier);
            if ($userObj) {
                $loginName = $userObj->user_login;
            }
        }

        $authResult = wp_authenticate($loginName, $password);

        if (is_wp_error($authResult)) {
            http_response_code(401);
            echo json_encode([
                'ok' => false,
                'error' => 'Evrakplus.com kullanıcı bilgileri doğrulanamadı. Lütfen e-posta ve şifrenizi kontrol edin.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Giriş Başarılı: WordPress kullanıcısının sabit ID'sine bağlı syncKey üret
        $syncKey = 'wp_user_' . $authResult->ID;
        $token = generateSecureToken();

        $users = loadUsersDb($usersDbFile);
        $users[$authResult->user_login] = [
            'wp_id' => $authResult->ID,
            'username' => $authResult->user_login,
            'email' => $authResult->user_email,
            'displayName' => $authResult->display_name ?: $authResult->user_login,
            'syncKey' => $syncKey,
            'token' => $token,
            'lastLogin' => gmdate('Y-m-d\TH:i:s\Z')
        ];
        saveUsersDb($usersDbFile, $users);

        $storageFile = $dataDir . '/' . $syncKey . '.json';
        $hasClientData = (!empty($body['students']) || !empty($body['incidents']));
        $data = $hasClientData ? performSmartSync($storageFile, $body) : loadUserData($storageFile);

        echo json_encode([
            'ok' => true,
            'user' => [
                'wp_id' => $authResult->ID,
                'username' => $authResult->user_login,
                'email' => $authResult->user_email,
                'displayName' => $authResult->display_name ?: $authResult->user_login,
                'syncKey' => $syncKey,
                'token' => $token
            ],
            'data' => $data
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // B) Fallback: Eğer WordPress henüz yoksa bağımsız JSON doğrulama
    $users = loadUsersDb($usersDbFile);
    if (!isset($users[$identifier])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Kullanıcı bulunamadı.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $user = $users[$identifier];
    if (!password_verify($password, $user['passwordHash'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Şifre hatalı.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $token = generateSecureToken();
    $users[$identifier]['token'] = $token;
    saveUsersDb($usersDbFile, $users);

    $syncKey = $user['syncKey'];
    $storageFile = $dataDir . '/' . $syncKey . '.json';
    $hasClientData = (!empty($body['students']) || !empty($body['incidents']));
    $data = $hasClientData ? performSmartSync($storageFile, $body) : loadUserData($storageFile);

    echo json_encode([
        'ok' => true,
        'user' => [
            'username' => $identifier,
            'displayName' => $user['displayName'],
            'token' => $token,
            'syncKey' => $syncKey
        ],
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. EŞİTLE (SYNC - İKİ TARAFLI AKILLI SENKRONİZASYON)
if ($action === 'sync' || $action === 'push') {
    $authToken = isset($_SERVER['HTTP_AUTHORIZATION']) ? str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']) : (isset($body['token']) ? $body['token'] : '');
    $syncKeyHeader = isset($_SERVER['HTTP_X_SYNC_KEY']) ? $_SERVER['HTTP_X_SYNC_KEY'] : (isset($body['syncKey']) ? $body['syncKey'] : '');

    $user = authenticateUser($dataDir, $usersDbFile, $authToken, $syncKeyHeader);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Yetkisiz erişim. Lütfen Evrakplus hesabınızla tekrar giriş yapın.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $storageFile = $dataDir . '/' . $user['syncKey'] . '.json';
    $saved = performSmartSync($storageFile, $body);

    echo json_encode([
        'ok' => true,
        'updatedAt' => $saved ? $saved['updatedAt'] : gmdate('Y-m-d\TH:i:s\Z'),
        'data' => $saved
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 4. VERİ ÇEK (PULL)
if ($action === 'pull') {
    $authToken = isset($_SERVER['HTTP_AUTHORIZATION']) ? str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']) : (isset($_GET['token']) ? $_GET['token'] : '');
    $syncKeyHeader = isset($_SERVER['HTTP_X_SYNC_KEY']) ? $_SERVER['HTTP_X_SYNC_KEY'] : (isset($_GET['syncKey']) ? $_GET['syncKey'] : '');

    $user = authenticateUser($dataDir, $usersDbFile, $authToken, $syncKeyHeader);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Yetkisiz erişim.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $storageFile = $dataDir . '/' . $user['syncKey'] . '.json';
    $data = loadUserData($storageFile);

    echo json_encode([
        'ok' => true,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Tanınmayan eylem
http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'Geçersiz işlem: ' . htmlspecialchars($action)], JSON_UNESCAPED_UNICODE);
