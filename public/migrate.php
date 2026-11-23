<?php
/**
 * Toplu veri taşıma aracı (yalnızca site yöneticileri)
 *
 * Eski sürümün disiplin_sync_storage/wp_user_<ID>.json dosyalarındaki verileri,
 * ilgili üyenin WordPress hesabındaki "<programkodu>_data" alanına taşır.
 * Not: Bu işlem ayrıca her üyenin ilk girişinde otomatik olarak da yapılır; bu araç hepsini tek seferde yapar.
 * Eski dosyalar silinmez (güvenlik için yerinde kalır).
 */
define('DISIPLIN_APP', true);
require __DIR__ . '/inc/bootstrap.php';

disiplin_no_cache();
header('Content-Type: text/html; charset=utf-8');

if (!is_user_logged_in()) {
    wp_redirect(disiplin_login_url(disiplin_app_url('migrate.php')));
    exit;
}
if (!current_user_can('manage_options')) {
    status_header(403);
    echo 'Bu sayfa yalnızca site yöneticileri içindir.';
    exit;
}

$run = isset($_POST['run']) && isset($_POST['_mn']) && wp_verify_nonce($_POST['_mn'], 'disiplin_migrate');
$files = glob(rtrim(DISIPLIN_STORAGE_DIR, '/') . '/wp_user_*.json');
$rows = array();
foreach ((array)$files as $f) {
    if (!preg_match('/wp_user_(\d+)\.json$/', $f, $m)) continue;
    $uid = (int)$m[1];
    $u = get_userdata($uid);
    $legacy = json_decode((string)@file_get_contents($f), true);
    $counts = is_array($legacy)
        ? sprintf('%d öğrenci, %d olay', isset($legacy['students']) ? count((array)$legacy['students']) : 0, isset($legacy['incidents']) ? count((array)$legacy['incidents']) : 0)
        : 'okunamadı';
    $existing = disiplin_read_meta($uid);
    $status = '';
    if (!$u) {
        $status = 'Üye bulunamadı (atlandı)';
    } elseif (is_array($existing)) {
        $n = disiplin_normalize($existing);
        $status = sprintf('Zaten taşınmış (hesapta %d öğrenci, %d olay, %d yazılı uyarı)', count($n['students']), count($n['incidents']), count($n['writtenWarnings']));
    } elseif (!is_array($legacy)) {
        $status = 'Dosya bozuk (atlandı)';
    } elseif ($run) {
        $migrated = false;
        disiplin_load_user($uid, $migrated);
        $status = $migrated ? '✔ Taşındı' : '✖ Taşınamadı';
    } else {
        $status = 'Taşınmayı bekliyor';
    }
    $rows[] = array($uid, $u ? $u->user_login : '-', basename($f), size_format(filesize($f)), $counts, $status);
}
?><!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Veri Taşıma - E-Okul Disiplin</title>
<style>body{font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:24px;color:#0f172a}.box{background:#fff;border-radius:14px;padding:22px;max-width:1000px;margin:auto;box-shadow:0 6px 20px rgba(0,0,0,.06)}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:14px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#475569}button{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer}.muted{color:#64748b;font-size:13px}</style>
</head><body><div class="box">
<h2 style="margin-top:0">Eski Sürüm Verilerini Üye Hesaplarına Taşı</h2>
<p class="muted">Kaynak: <code><?php echo esc_html(DISIPLIN_STORAGE_DIR); ?>/wp_user_*.json</code> → Hedef: WordPress üye alanı <code><?php echo esc_html(DISIPLIN_META_KEY); ?></code>.
Eski dosyalar silinmez. Taşıma her üyenin ilk girişinde otomatik olarak da yapılır.</p>
<?php if (empty($rows)) : ?>
  <p><b>Taşınacak eski veri dosyası bulunamadı.</b></p>
<?php else : ?>
  <table><thead><tr><th>Üye ID</th><th>Kullanıcı</th><th>Dosya</th><th>Boyut</th><th>İçerik</th><th>Durum</th></tr></thead><tbody>
  <?php foreach ($rows as $r) : ?>
    <tr><?php foreach ($r as $c) echo '<td>' . esc_html((string)$c) . '</td>'; ?></tr>
  <?php endforeach; ?>
  </tbody></table>
  <form method="post" style="margin-top:16px">
    <input type="hidden" name="_mn" value="<?php echo esc_attr(wp_create_nonce('disiplin_migrate')); ?>">
    <button name="run" value="1" type="submit">Bekleyenlerin Hepsini Şimdi Taşı</button>
  </form>
<?php endif; ?>
<p class="muted" style="margin-top:18px"><a href="./">Programa dön</a></p>
</div></body></html>
