<?php
/**
 * E-Okul Disiplin AI Pro - evrakplus.com köprü ayarları
 * Bu dosyadaki değerleri ihtiyaca göre değiştirebilirsiniz.
 */
defined('DISIPLIN_APP') || exit;

// Program kodu: Üye verisi WordPress hesabında "<kod>_data" adlı kullanıcı alanında (user meta) saklanır.
// ÖNEMLİ: Kullanıcılar veri girdikten sonra değiştirmeyin; aksi hâlde eski veriler görünmez.
if (!defined('DISIPLIN_PROGRAM_CODE')) define('DISIPLIN_PROGRAM_CODE', 'disiplin');

// Sürüm (önbellek ve teşhis için)
if (!defined('DISIPLIN_APP_VERSION')) define('DISIPLIN_APP_VERSION', '1.1.9');

// Giriş sayfası. Varsayılan olarak evrakplus.com giriş sayfası kullanılır.
// (Programa geri dönüş adresi "redirect_to" parametresiyle eklenir.)
if (!defined('DISIPLIN_LOGIN_PAGE')) define('DISIPLIN_LOGIN_PAGE', 'https://www.evrakplus.com/giris');

// Programı yalnızca belirli üyelik rollerine açmak isterseniz rol adlarını yazın.
// Boş = giriş yapmış TÜM üyeler kullanabilir. Virgülle ayırın, örnek: 'subscriber,customer,editor'
// (Yöneticiler her zaman erişebilir.)
if (!defined('DISIPLIN_ALLOWED_ROLES')) define('DISIPLIN_ALLOWED_ROLES', '');

// Erişimi olmayan üyelerin yönlendirileceği sayfa (boşsa bilgi mesajı gösterilir)
if (!defined('DISIPLIN_NO_ACCESS_URL')) define('DISIPLIN_NO_ACCESS_URL', '');

// Eski sürümün veri klasörü (wp_user_<ID>.json dosyaları burada). Eklenen tutanak dosyaları ve
// günlük yedekler de bu korumalı klasörde saklanır.
if (!defined('DISIPLIN_STORAGE_DIR')) define('DISIPLIN_STORAGE_DIR', dirname(__DIR__) . '/disiplin_sync_storage');

// Her üye için sunucuda tutulacak günlük yedek sayısı
if (!defined('DISIPLIN_BACKUP_KEEP')) define('DISIPLIN_BACKUP_KEEP', 14);

// Ek dosya (imzalı tutanak taraması) azami boyutu (bayt)
if (!defined('DISIPLIN_MAX_ATTACHMENT')) define('DISIPLIN_MAX_ATTACHMENT', 6 * 1024 * 1024);
