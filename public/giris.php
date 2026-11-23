<?php
/**
 * Program içi giriş ekranı (evrakplus.com hesabıyla).
 * Masaüstü uygulaması (Electron) evrakplus.com giriş sayfasına çıkamadığı için kullanılır.
 * Ayrı şifre yoktur: evrakplus.com kullanıcı adı / e-posta ve şifresi ile WordPress oturumu açılır.
 */
define('DISIPLIN_APP', true);
require __DIR__ . '/inc/bootstrap.php';

disiplin_no_cache();
header('X-Frame-Options: SAMEORIGIN');

$appUrl = disiplin_app_url();
if (is_user_logged_in()) {
    wp_safe_redirect($appUrl);
    exit;
}

$error = '';
$login = '';
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $login = isset($_POST['log']) ? sanitize_text_field(wp_unslash($_POST['log'])) : '';
    $pass = isset($_POST['pwd']) ? (string)wp_unslash($_POST['pwd']) : '';
    if (!isset($_POST['_dn']) || !wp_verify_nonce($_POST['_dn'], 'disiplin_login')) {
        $error = 'Sayfanın süresi doldu, lütfen tekrar deneyin.';
    } elseif ($login === '' || $pass === '') {
        $error = 'Lütfen kullanıcı adı / e-posta ve şifrenizi girin.';
    } else {
        if (is_email($login)) {
            $u = get_user_by('email', $login);
            if ($u) $login = $u->user_login;
        }
        $res = wp_signon(array('user_login' => $login, 'user_password' => $pass, 'remember' => !empty($_POST['rememberme'])), is_ssl());
        if (is_wp_error($res)) {
            $error = 'Giriş bilgileri doğrulanamadı. Lütfen evrakplus.com kullanıcı adı / e-posta ve şifrenizi kontrol edin.';
        } else {
            wp_safe_redirect($appUrl);
            exit;
        }
    }
}

$wpLogin = disiplin_login_url($appUrl);
$lost = wp_lostpassword_url();
$register = wp_registration_url();
header('Content-Type: text/html; charset=utf-8');
?><!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Giriş - E-Okul Disiplin AI Pro</title>
<link rel="icon" href="favicon.ico">
<meta name="theme-color" content="#0f172a">
<style>
  *{box-sizing:border-box} body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a,#1e3a8a);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px}
  .card{background:#fff;border-radius:18px;padding:28px 26px;width:100%;max-width:400px;box-shadow:0 20px 50px rgba(0,0,0,.35)}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:18px} .logo img{width:46px;height:46px}
  h1{font-size:18px;margin:0;color:#0f172a} .sub{font-size:12px;color:#64748b;margin-top:2px}
  label{display:block;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;margin:14px 0 5px}
  input[type=text],input[type=password]{width:100%;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px}
  input:focus{outline:2px solid #2563eb;border-color:#2563eb}
  .row{display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:#334155}
  button{width:100%;margin-top:18px;padding:12px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;font-size:15px;cursor:pointer}
  button:hover{background:#1d4ed8}
  .err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 12px;border-radius:10px;font-size:13px;margin-top:10px}
  .info{font-size:12px;color:#64748b;margin-top:16px;line-height:1.5;text-align:center}
  .info a{color:#2563eb;text-decoration:none}
</style>
</head>
<body>
  <form class="card" method="post" action="giris.php" autocomplete="on">
    <div class="logo"><img src="icons/icon-192.png" alt=""><div><h1>E-Okul Disiplin AI Pro</h1><div class="sub">evrakplus.com hesabınızla giriş yapın</div></div></div>
    <?php if ($error !== '') : ?><div class="err"><?php echo esc_html($error); ?></div><?php endif; ?>
    <label for="log">Kullanıcı adı veya e-posta</label>
    <input type="text" id="log" name="log" value="<?php echo esc_attr($login); ?>" autocomplete="username" required autofocus>
    <label for="pwd">Şifre</label>
    <input type="password" id="pwd" name="pwd" autocomplete="current-password" required>
    <div class="row"><input type="checkbox" id="rememberme" name="rememberme" value="1" checked><label for="rememberme" style="margin:0;text-transform:none;font-size:13px;font-weight:500">Beni hatırla</label></div>
    <input type="hidden" name="_dn" value="<?php echo esc_attr(wp_create_nonce('disiplin_login')); ?>">
    <button type="submit">Giriş Yap</button>
    <div class="info">
      Ayrı bir şifre yoktur; evrakplus.com üyelik bilgilerinizi kullanın.<br>
      <a href="<?php echo esc_url($lost); ?>" target="_blank" rel="noopener">Şifremi unuttum</a> ·
      <a href="<?php echo esc_url($register); ?>" target="_blank" rel="noopener">Üye ol</a> ·
      <a href="<?php echo esc_url($wpLogin); ?>">evrakplus.com giriş sayfası</a>
    </div>
  </form>
</body>
</html>
