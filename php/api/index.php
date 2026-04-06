<?php
/**
 * Mötesplanering — PHP backend
 * Single-file API that replicates the Node.js server.js endpoints.
 * No dependencies, no Composer, no framework.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// ── Paths ────────────────────────────────────────────────────────────────────
define('ROOT_DIR', dirname(__DIR__));
define('DATA_DIR', ROOT_DIR . '/data');
define('DB_FILE', DATA_DIR . '/data.json');
define('CONFIG_FILE', DATA_DIR . '/config.json');
define('UPLOAD_DIR', ROOT_DIR . '/uploads');
define('BACKUP_DIR', ROOT_DIR . '/backups');
define('MAX_UPLOAD', 25 * 1024 * 1024); // 25 MB

// Ensure directories exist
foreach ([DATA_DIR, UPLOAD_DIR, BACKUP_DIR] as $dir) {
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
}

// ── CORS / Headers ───────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');

// ── Request parsing ──────────────────────────────────────────────────────────
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// Strip base path if app is in a subdirectory
$scriptDir = dirname($_SERVER['SCRIPT_NAME']); // e.g. /api
$basePath = dirname($scriptDir); // e.g. / or /subdir
if ($basePath !== '/' && strpos($path, $basePath) === 0) {
    $path = substr($path, strlen($basePath));
}
// Normalize: ensure leading slash, strip trailing
$path = '/' . ltrim($path, '/');
$path = rtrim($path, '/') ?: '/';

// ── Helpers ──────────────────────────────────────────────────────────────────
function jsonResponse($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readJsonBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function generateToken(): string {
    return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
}

// ── Database ─────────────────────────────────────────────────────────────────
function loadDb(): array {
    if (!file_exists(DB_FILE)) return [];
    $json = file_get_contents(DB_FILE);
    $data = json_decode($json, true);
    return is_array($data) ? $data : [];
}

function saveDb(array $data): int {
    $version = intval(microtime(true) * 1000);
    $data['_version'] = $version;
    $tmp = DB_FILE . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    rename($tmp, DB_FILE);
    return $version;
}

function withLock(callable $fn) {
    $lockFile = DATA_DIR . '/data.json.lock';
    $fp = fopen($lockFile, 'c');
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        jsonResponse(['error' => 'lock failed'], 500);
    }
    try {
        return $fn();
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }
}

// ── Config (admin credentials, stored separately from data) ──────────────────
function loadConfig(): array {
    if (!file_exists(CONFIG_FILE)) return [];
    $data = json_decode(file_get_contents(CONFIG_FILE), true);
    return is_array($data) ? $data : [];
}

function saveConfig(array $config): void {
    $tmp = CONFIG_FILE . '.tmp';
    file_put_contents($tmp, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    rename($tmp, CONFIG_FILE);
}

// ── Auth ─────────────────────────────────────────────────────────────────────
function checkAdmin(): bool {
    $config = loadConfig();
    $user = $config['adminUser'] ?? '';
    $passHash = $config['adminPass'] ?? '';
    if (!$user || !$passHash) return false;

    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$authHeader || stripos($authHeader, 'Basic ') !== 0) return false;
    $decoded = base64_decode(substr($authHeader, 6));
    if ($decoded === false) return false;
    $parts = explode(':', $decoded, 2);
    if (count($parts) !== 2) return false;
    return $parts[0] === $user && password_verify($parts[1], $passHash);
}

function checkMemberToken(): ?array {
    $token = $_GET['token'] ?? $_SERVER['HTTP_X_MEMBER_TOKEN'] ?? '';
    if (!$token) return null;
    $db = loadDb();
    foreach (($db['contacts'] ?? []) as $c) {
        if (isset($c['token']) && $c['token'] === $token) return $c;
    }
    return null;
}

function stripForViewer(array $data): array {
    if (isset($data['contacts'])) {
        $data['contacts'] = array_map(function ($c) {
            return ['id' => $c['id'], 'name' => $c['name']];
        }, $data['contacts']);
    }
    unset($data['settings']);
    return $data;
}

function stripForMember(array $data, int $myId): array {
    unset($data['settings']);
    if (isset($data['contacts'])) {
        $data['contacts'] = array_map(function ($c) use ($myId) {
            unset($c['token']);
            if ($c['id'] === $myId) return $c;
            return ['id' => $c['id'], 'name' => $c['name']];
        }, $data['contacts']);
    }
    return $data;
}

// ── iCal ─────────────────────────────────────────────────────────────────────
function slugifyEmail(string $email): string {
    $s = strtolower($email);
    $s = preg_replace('/[^a-z0-9]/', '-', $s);
    $s = preg_replace('/-+/', '-', $s);
    return trim($s, '-');
}

function slugifyCategory(string $name): string {
    $s = strtolower($name);
    $s = str_replace(['å', 'ä'], 'a', $s);
    $s = str_replace('ö', 'o', $s);
    $s = preg_replace('/[^a-z0-9]/', '-', $s);
    $s = preg_replace('/-+/', '-', $s);
    return trim($s, '-');
}

function icalEscape(string $s): string {
    $s = str_replace('\\', '\\\\', $s);
    $s = str_replace(';', '\\;', $s);
    $s = str_replace(',', '\\,', $s);
    $s = str_replace("\n", '\\n', $s);
    return $s;
}

function loadSchedules(array $db): array {
    $schedules = [];
    foreach (($db['events'] ?? []) as $e) {
        $schedules[$e['id']] = [];
    }
    foreach (($db['schedules'] ?? []) as $eid => $tasks) {
        $numEid = intval($eid);
        if (!isset($schedules[$numEid])) $schedules[$numEid] = [];
        foreach ($tasks as $tid => $asgn) {
            $schedules[$numEid][intval($tid)] = $asgn;
        }
    }
    return $schedules;
}

function findPersonTask(int $eventId, int $contactId, array $db, array $schedules): ?array {
    $asgn = $schedules[$eventId] ?? [];
    foreach ($asgn as $tid => $val) {
        $task = null;
        foreach (($db['tasks'] ?? []) as $t) {
            if ($t['id'] === intval($tid)) { $task = $t; break; }
        }
        if (!$task) continue;
        if (($val['type'] ?? '') === 'contact' && in_array($contactId, $val['ids'] ?? [])) return $task;
        if (($val['type'] ?? '') === 'team') {
            foreach (($db['teams'] ?? []) as $team) {
                if ($team['id'] === ($val['id'] ?? null) && in_array($contactId, $team['members'] ?? [])) return $task;
            }
        }
    }
    return null;
}

function buildIcalForContact(array $contact, array $db, array $schedules, string $baseUrl): string {
    $dayNames = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'];
    $events = array_filter($db['events'] ?? [], function ($ev) use ($contact, $schedules, $db) {
        $asgn = $schedules[$ev['id']] ?? [];
        foreach ($asgn as $val) {
            if (($val['type'] ?? '') === 'contact' && in_array($contact['id'], $val['ids'] ?? [])) return true;
            if (($val['type'] ?? '') === 'team') {
                foreach (($db['teams'] ?? []) as $team) {
                    if ($team['id'] === ($val['id'] ?? null) && in_array($contact['id'], $team['members'] ?? [])) return true;
                }
            }
        }
        return false;
    });

    $cal = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Motesplanering//EN\r\nX-WR-CALNAME:" . $contact['name'] . " schema\r\n";
    foreach ($events as $ev) {
        $task = findPersonTask($ev['id'], $contact['id'], $db, $schedules);
        $date = $ev['date'] ?? '';
        $time = $ev['time'] ?? '00:00';
        $dtStart = str_replace('-', '', $date) . 'T' . str_replace(':', '', $time) . '00';
        $startTs = strtotime($date . 'T' . $time . ':00');
        $endTs = $startTs + 3600;
        $dtEnd = date('Ymd\THis', $endTs);
        $summary = ($ev['title'] ?? 'Event') . ($task ? ' (' . $task['name'] . ')' : '');
        $dayName = $dayNames[date('w', $startTs)];
        $desc = '';
        if ($task) {
            $phrase = $task['phrase'] ?? '';
            $desc = 'Du ' . ($phrase ?: 'är ' . strtolower($task['name'])) . ' på ' . $dayName;
        }
        if (!empty($ev['description'])) {
            $desc .= ($desc ? '\\n\\n' : '') . icalEscape($ev['description']);
        }
        $eventUrl = $baseUrl ? $baseUrl . '/#/events/week/' . $date : '';

        $cal .= "BEGIN:VEVENT\r\n";
        $cal .= "UID:ev{$ev['id']}-{$contact['id']}@motesplanering\r\n";
        $cal .= "DTSTART:{$dtStart}\r\n";
        $cal .= "DTEND:{$dtEnd}\r\n";
        $cal .= "SUMMARY:{$summary}\r\n";
        if ($desc) $cal .= "DESCRIPTION:{$desc}\r\n";
        if ($eventUrl) $cal .= "URL:{$eventUrl}\r\n";
        $cal .= "END:VEVENT\r\n";
    }
    $cal .= "END:VCALENDAR\r\n";
    return $cal;
}

function buildIcalForCategory(array $category, array $db): string {
    $events = array_filter($db['events'] ?? [], function ($ev) use ($category) {
        return ($ev['category'] ?? '') === $category['name'];
    });
    $cal = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Motesplanering//EN\r\nX-WR-CALNAME:" . $category['name'] . "\r\n";
    foreach ($events as $ev) {
        $date = $ev['date'] ?? '';
        $time = $ev['time'] ?? '00:00';
        $dtStart = str_replace('-', '', $date) . 'T' . str_replace(':', '', $time) . '00';
        $startTs = strtotime($date . 'T' . $time . ':00');
        $dtEnd = date('Ymd\THis', $startTs + 3600);
        $cal .= "BEGIN:VEVENT\r\n";
        $cal .= "UID:ev{$ev['id']}-cat@motesplanering\r\n";
        $cal .= "DTSTART:{$dtStart}\r\n";
        $cal .= "DTEND:{$dtEnd}\r\n";
        $cal .= "SUMMARY:" . ($ev['title'] ?? 'Event') . "\r\n";
        if (!empty($ev['description'])) $cal .= "DESCRIPTION:" . str_replace("\n", '\\n', $ev['description']) . "\r\n";
        $cal .= "END:VEVENT\r\n";
    }
    $cal .= "END:VCALENDAR\r\n";
    return $cal;
}

// ── Email ────────────────────────────────────────────────────────────────────
function sendEmail(string $to, string $subject, string $html): array {
    $db = loadDb();
    $smtp = $db['settings']['smtp'] ?? [];
    if (empty($smtp['host'])) {
        // No SMTP configured — log and return dry run
        error_log("[mailbot] SMTP not configured — would send to: $to | subject: $subject");
        return ['ok' => true, 'dry' => true];
    }
    // Use PHP mail() as fallback — real SMTP would need a library
    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $from = $smtp['from'] ?? $smtp['user'] ?? 'noreply@example.com';
    $headers .= "From: {$from}\r\n";
    $ok = @mail($to, $subject, $html, $headers);
    return ['ok' => $ok];
}

// ── Backup ───────────────────────────────────────────────────────────────────
function runBackup(): void {
    if (!file_exists(DB_FILE)) return;
    $dest = BACKUP_DIR . '/' . date('Y-m-d') . '.json';
    copy(DB_FILE, $dest);
}

// ═════════════════════════════════════════════════════════════════════════════
// ── ROUTER ───────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// ── Setup wizard (first run) ─────────────────────────────────────────────────
if (!file_exists(DB_FILE)) {
    if ($method === 'GET' && ($path === '/api/' || $path === '/api')) {
        jsonResponse(['setup' => true]);
    }
    if ($method === 'GET' && $path === '/api/me') {
        jsonResponse(['setup' => true]);
    }
    if ($method === 'GET' && $path === '/api/auth-check') {
        jsonResponse(['ok' => false, 'setup' => true]);
    }
    if ($method === 'POST' && $path === '/api/setup') {
        $body = readJsonBody();
        $orgName = trim($body['orgName'] ?? '');
        $adminUser = trim($body['adminUser'] ?? '');
        $adminPass = $body['adminPass'] ?? '';
        if (!$orgName || !$adminUser || strlen($adminPass) < 4) {
            jsonResponse(['error' => 'Alla fält krävs (lösenord minst 4 tecken)'], 400);
        }
        // Create default database
        $db = [
            'events' => [],
            'contacts' => [],
            'tasks' => [],
            'teams' => [],
            'categories' => [
                ['id' => 1, 'name' => 'Söndag', 'color' => 'blue'],
                ['id' => 2, 'name' => 'Vardag', 'color' => 'green'],
                ['id' => 3, 'name' => 'Special', 'color' => 'amber'],
            ],
            'schedules' => (object)[],
            'recurring_events' => (object)[],
            'globalSlides' => [],
            'slideLogo' => '',
            'slideBackground' => ['color' => '#111', 'image' => ''],
            'settings' => ['orgName' => $orgName],
            'lateWithdrawals' => [],
            '_version' => 0,
        ];
        saveDb($db);
        saveConfig([
            'adminUser' => $adminUser,
            'adminPass' => password_hash($adminPass, PASSWORD_DEFAULT),
        ]);
        jsonResponse(['ok' => true]);
    }
    // Not set up yet — return setup flag for any other API call
    jsonResponse(['error' => 'not configured', 'setup' => true]);
}

// ── iCal feeds (no auth required) ────────────────────────────────────────────
if ($method === 'GET' && preg_match('#^/api/cal/cat/(.+)\.ics$#', $path, $m)) {
    $slug = $m[1];
    $db = loadDb();
    $category = null;
    foreach (($db['categories'] ?? []) as $cat) {
        if (slugifyCategory($cat['name']) === $slug) { $category = $cat; break; }
    }
    if (!$category) { http_response_code(404); echo 'Not found'; exit; }
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: inline; filename="' . $slug . '.ics"');
    echo buildIcalForCategory($category, $db);
    exit;
}

if ($method === 'GET' && preg_match('#^/api/cal/(.+)\.ics$#', $path, $m)) {
    $slug = $m[1];
    $db = loadDb();
    $contact = null;
    foreach (($db['contacts'] ?? []) as $c) {
        if (slugifyEmail($c['email'] ?? '') === $slug) { $contact = $c; break; }
    }
    if (!$contact) { http_response_code(404); echo 'Not found'; exit; }
    $schedules = loadSchedules($db);
    $proto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http');
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost';
    $baseUrl = $proto . '://' . $host;
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: inline; filename="' . $slug . '.ics"');
    echo buildIcalForContact($contact, $db, $schedules, $baseUrl);
    exit;
}

// ── Auth resolution ──────────────────────────────────────────────────────────
$isAdmin = checkAdmin();
$memberContact = !$isAdmin ? checkMemberToken() : null;
$isMember = $memberContact !== null;

// ── GET /api/me ──────────────────────────────────────────────────────────────
if ($method === 'GET' && $path === '/api/me') {
    if ($isAdmin) jsonResponse(['role' => 'admin']);
    if ($isMember) jsonResponse(['role' => 'member', 'contactId' => $memberContact['id'], 'name' => $memberContact['name']]);
    jsonResponse(['role' => 'viewer']);
}

// ── GET /api/auth-check ──────────────────────────────────────────────────────
if ($method === 'GET' && $path === '/api/auth-check') {
    jsonResponse(['ok' => $isAdmin]);
}

// ── PUT /api/me/contact (member) ─────────────────────────────────────────────
if ($method === 'PUT' && $path === '/api/me/contact' && $isMember) {
    $body = readJsonBody();
    $version = withLock(function () use ($body, $memberContact) {
        $db = loadDb();
        foreach ($db['contacts'] as &$c) {
            if ($c['id'] === $memberContact['id']) {
                if (isset($body['name'])) $c['name'] = (string)$body['name'];
                if (isset($body['email'])) $c['email'] = (string)$body['email'];
                if (isset($body['phone'])) $c['phone'] = (string)$body['phone'];
                break;
            }
        }
        return saveDb($db);
    });
    jsonResponse(['ok' => true, 'version' => $version]);
}

// ── POST /api/me/join-team, /api/me/leave-team (member) ──────────────────────
if ($method === 'POST' && ($path === '/api/me/join-team' || $path === '/api/me/leave-team') && $isMember) {
    $body = readJsonBody();
    $teamId = $body['teamId'] ?? null;
    if (!$teamId) jsonResponse(['error' => 'teamId required'], 400);
    $version = withLock(function () use ($path, $teamId, $memberContact) {
        $db = loadDb();
        $found = false;
        foreach ($db['teams'] as &$team) {
            if ($team['id'] === $teamId) {
                $found = true;
                if ($path === '/api/me/join-team') {
                    if (!in_array($memberContact['id'], $team['members'])) {
                        $team['members'][] = $memberContact['id'];
                    }
                } else {
                    $team['members'] = array_values(array_filter($team['members'], function ($id) use ($memberContact) {
                        return $id !== $memberContact['id'];
                    }));
                }
                break;
            }
        }
        if (!$found) jsonResponse(['error' => 'team not found'], 404);
        return saveDb($db);
    });
    jsonResponse(['ok' => true, 'version' => $version]);
}

// ── PUT /api/task/:id/manual (admin or responsible member) ───────────────────
if ($method === 'PUT' && preg_match('#^/api/task/(\d+)/manual$#', $path, $m) && ($isAdmin || $isMember)) {
    $taskId = intval($m[1]);
    $body = readJsonBody();
    $version = withLock(function () use ($taskId, $body, $isAdmin, $memberContact) {
        $db = loadDb();
        foreach ($db['tasks'] as &$task) {
            if ($task['id'] === $taskId) {
                if (!$isAdmin && ($task['responsibleId'] ?? null) !== ($memberContact['id'] ?? null)) {
                    jsonResponse(['error' => 'not responsible'], 403);
                }
                $task['manual'] = (string)($body['manual'] ?? '');
                return saveDb($db);
            }
        }
        jsonResponse(['error' => 'task not found'], 404);
    });
    jsonResponse(['ok' => true, 'version' => $version]);
}

// ── POST /api/presence ───────────────────────────────────────────────────────
if ($method === 'POST' && $path === '/api/presence') {
    // Simplified presence using a JSON file (no in-memory map like Node)
    $body = readJsonBody();
    $sessionId = $body['sessionId'] ?? '';
    if (!$sessionId) jsonResponse(['error' => 'sessionId required'], 400);
    $presenceFile = DATA_DIR . '/presence.json';
    $presence = file_exists($presenceFile) ? json_decode(file_get_contents($presenceFile), true) : [];
    if (!is_array($presence)) $presence = [];
    $name = $isAdmin ? 'Admin' : ($isMember ? $memberContact['name'] : 'Besökare');
    $role = $isAdmin ? 'admin' : ($isMember ? 'member' : 'viewer');
    $presence[$sessionId] = ['name' => $name, 'role' => $role, 'lastSeen' => time()];
    // Clean stale entries (>60s)
    $now = time();
    $presence = array_filter($presence, function ($v) use ($now) { return ($now - $v['lastSeen']) < 60; });
    file_put_contents($presenceFile, json_encode($presence));
    $online = array_map(function ($v) { return ['name' => $v['name'], 'role' => $v['role']]; }, array_values($presence));
    jsonResponse(['count' => count($online), 'online' => $online]);
}

// ── POST /api/generate-tokens (admin) ────────────────────────────────────────
if ($method === 'POST' && $path === '/api/generate-tokens' && $isAdmin) {
    $result = withLock(function () {
        $db = loadDb();
        $count = 0;
        foreach ($db['contacts'] as &$c) {
            if (empty($c['token'])) {
                $c['token'] = generateToken();
                $count++;
            }
        }
        $version = saveDb($db);
        return ['count' => $count, 'version' => $version];
    });
    jsonResponse(['ok' => true, 'generated' => $result['count'], 'version' => $result['version']]);
}

// ── POST /api/request-login (magic link) ─────────────────────────────────────
if ($method === 'POST' && $path === '/api/request-login') {
    $body = readJsonBody();
    $email = trim($body['email'] ?? '');
    if (!$email) jsonResponse(['error' => 'email required'], 400);
    // Always respond ok (don't reveal if email exists)
    $contact = withLock(function () use ($email) {
        $db = loadDb();
        foreach ($db['contacts'] as &$c) {
            if (!empty($c['email']) && strtolower($c['email']) === strtolower($email)) {
                if (empty($c['token'])) {
                    $c['token'] = generateToken();
                    saveDb($db);
                }
                return $c;
            }
        }
        return null;
    });
    if ($contact) {
        $proto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http');
        $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost';
        $loginUrl = $proto . '://' . $host . '/?token=' . $contact['token'];
        $firstName = explode(' ', $contact['name'])[0];
        $orgName = $db['settings']['orgName'] ?? 'Mötesplanering';
        sendEmail($contact['email'], 'Logga in — ' . $orgName,
            "<p>Hej {$firstName}!</p>" .
            "<p>Klicka på länken nedan för att logga in:</p>" .
            "<p><a href=\"{$loginUrl}\" style=\"display:inline-block;padding:10px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;\">Logga in</a></p>" .
            "<p style=\"color:#999;font-size:12px;\">Eller kopiera: {$loginUrl}</p>" .
            "<p style=\"color:#999;font-size:12px;\">Länken är personlig — dela den inte.</p>"
        );
    }
    jsonResponse(['ok' => true]);
}

// ── POST /api/send-email (admin) ─────────────────────────────────────────────
if ($method === 'POST' && $path === '/api/send-email' && $isAdmin) {
    $body = readJsonBody();
    $to = $body['to'] ?? '';
    $subject = $body['subject'] ?? '';
    $html = $body['html'] ?? '';
    if (!$to || !$subject || !$html) jsonResponse(['error' => 'missing fields'], 400);
    $result = sendEmail($to, $subject, $html);
    jsonResponse($result);
}

// ── POST /api/cron/run (admin) ───────────────────────────────────────────────
if ($method === 'POST' && $path === '/api/cron/run' && $isAdmin) {
    // Simplified: just run backup for now (email cron needs SMTP lib)
    runBackup();
    jsonResponse(['ok' => true, 'sent' => 0]);
}

// ── GET /api/cron (admin) ────────────────────────────────────────────────────
if ($method === 'GET' && $path === '/api/cron' && $isAdmin) {
    jsonResponse(['jobs' => [], 'cronAvailable' => false]);
}

// ── POST /api/cron/reload (admin) ────────────────────────────────────────────
if ($method === 'POST' && $path === '/api/cron/reload' && $isAdmin) {
    jsonResponse(['ok' => true, 'jobs' => 0]);
}

// ── Block non-GET for non-admins ─────────────────────────────────────────────
if ($method !== 'GET' && !$isAdmin) {
    jsonResponse(['error' => 'unauthorized'], 401);
}

// ── POST /api/publish (admin) ────────────────────────────────────────────────
if ($method === 'POST' && $path === '/api/publish') {
    $body = readJsonBody();
    $html = $body['html'] ?? '';
    if (!$html) jsonResponse(['error' => 'missing html'], 400);
    $db = loadDb();
    $sftp = $db['settings']['sftp'] ?? [];
    if (empty($sftp['host'])) jsonResponse(['ok' => false, 'error' => 'SFTP not configured']);
    // PHP FTP upload (basic — SFTP would need ssh2 extension)
    jsonResponse(['ok' => false, 'error' => 'SFTP publish not yet implemented in PHP backend']);
}

// ── POST /upload (admin) ─────────────────────────────────────────────────────
if ($method === 'POST' && $path === '/upload') {
    $raw = file_get_contents('php://input');
    if (strlen($raw) > MAX_UPLOAD) jsonResponse(['error' => 'File too large (max 25 MB)'], 413);
    $ct = $_SERVER['CONTENT_TYPE'] ?? '';
    $ext = '.jpg';
    if (strpos($ct, 'png') !== false) $ext = '.png';
    elseif (strpos($ct, 'gif') !== false) $ext = '.gif';
    elseif (strpos($ct, 'webp') !== false) $ext = '.webp';
    elseif (strpos($ct, 'svg') !== false) $ext = '.svg';
    $name = time() . '-' . substr(bin2hex(random_bytes(4)), 0, 8) . $ext;
    file_put_contents(UPLOAD_DIR . '/' . $name, $raw);
    jsonResponse(['url' => '/uploads/' . $name]);
}

// ── GET /uploads (admin) ─────────────────────────────────────────────────────
if ($method === 'GET' && $path === '/uploads') {
    $files = [];
    if (is_dir(UPLOAD_DIR)) {
        foreach (scandir(UPLOAD_DIR) as $f) {
            if ($f[0] !== '.') $files[] = '/uploads/' . $f;
        }
    }
    jsonResponse($files);
}

// ── KV API: GET /api/ (full database) ────────────────────────────────────────
if ($method === 'GET' && ($path === '/api/' || $path === '/api')) {
    $db = loadDb();
    if (!$isAdmin && !$isMember) jsonResponse(stripForViewer($db));
    if ($isMember) jsonResponse(stripForMember($db, $memberContact['id']));
    jsonResponse($db);
}

// ── KV API: GET /api/:key ────────────────────────────────────────────────────
if ($method === 'GET' && preg_match('#^/api/([a-zA-Z_]+)$#', $path, $m)) {
    $key = $m[1];
    $db = loadDb();
    if (!array_key_exists($key, $db)) jsonResponse(['error' => 'not found'], 404);
    $val = $db[$key];
    $canRead = $isAdmin || $isMember;
    if (!$canRead && $key === 'settings') jsonResponse(['error' => 'read-only'], 403);
    if (!$canRead && $key === 'contacts') {
        $val = array_map(function ($c) { return ['id' => $c['id'], 'name' => $c['name']]; }, $val);
    }
    if ($isMember && $key === 'settings') jsonResponse(['error' => 'read-only'], 403);
    if ($isMember && $key === 'contacts') {
        $val = array_map(function ($c) { unset($c['token']); return $c; }, $val);
    }
    jsonResponse($val);
}

// ── KV API: PUT /api/ (full database replace) ────────────────────────────────
if ($method === 'PUT' && ($path === '/api/' || $path === '/api')) {
    $body = readJsonBody();
    $clientVersion = intval($_GET['v'] ?? 0);
    $version = withLock(function () use ($body, $clientVersion) {
        $currentVersion = loadDb()['_version'] ?? 0;
        if ($clientVersion && $clientVersion !== $currentVersion) {
            jsonResponse(['error' => 'conflict', 'message' => 'Data har ändrats av någon annan. Ladda om sidan.', 'serverVersion' => $currentVersion], 409);
        }
        return saveDb($body);
    });
    jsonResponse(['ok' => true, 'version' => $version]);
}

// ── KV API: PUT /api/:key ────────────────────────────────────────────────────
if ($method === 'PUT' && preg_match('#^/api/([a-zA-Z_]+)$#', $path, $m)) {
    $key = $m[1];
    $body = readJsonBody();
    $clientVersion = intval($_GET['v'] ?? 0);
    $version = withLock(function () use ($key, $body, $clientVersion) {
        $db = loadDb();
        $currentVersion = $db['_version'] ?? 0;
        if ($clientVersion && $clientVersion !== $currentVersion) {
            jsonResponse(['error' => 'conflict', 'message' => 'Data har ändrats av någon annan. Ladda om sidan.', 'serverVersion' => $currentVersion], 409);
        }
        $db[$key] = $body;
        return saveDb($db);
    });
    jsonResponse(['ok' => true, 'version' => $version]);
}

// ── KV API: DELETE /api/:key ─────────────────────────────────────────────────
if ($method === 'DELETE' && preg_match('#^/api/([a-zA-Z_]+)$#', $path, $m)) {
    $key = $m[1];
    $version = withLock(function () use ($key) {
        $db = loadDb();
        unset($db[$key]);
        return saveDb($db);
    });
    jsonResponse(['ok' => true, 'version' => $version]);
}

// ── Self-update: GET /api/update/check (admin) ───────────────────────────────
if ($method === 'GET' && $path === '/api/update/check') {
    if (!$isAdmin) jsonResponse(['error' => 'unauthorized'], 401);
    $currentVersion = trim(file_get_contents(ROOT_DIR . '/VERSION'));
    $repo = loadDb()['settings']['githubRepo'] ?? '';
    if (!$repo) jsonResponse(['currentVersion' => $currentVersion, 'latestVersion' => null, 'error' => 'githubRepo not set in settings']);
    $ctx = stream_context_create(['http' => [
        'header' => "User-Agent: motesplanering\r\nAccept: application/vnd.github.v3+json\r\n",
        'timeout' => 10,
    ]]);
    $json = @file_get_contents("https://api.github.com/repos/{$repo}/releases/latest", false, $ctx);
    if (!$json) jsonResponse(['currentVersion' => $currentVersion, 'latestVersion' => null, 'error' => 'could not reach GitHub']);
    $release = json_decode($json, true);
    jsonResponse([
        'currentVersion' => $currentVersion,
        'latestVersion' => $release['tag_name'] ?? null,
        'changelog' => $release['body'] ?? '',
        'zipUrl' => $release['zipball_url'] ?? null,
    ]);
}

// ── Self-update: POST /api/update/apply (admin) ──────────────────────────────
if ($method === 'POST' && $path === '/api/update/apply') {
    if (!$isAdmin) jsonResponse(['error' => 'unauthorized'], 401);
    if (!class_exists('ZipArchive')) jsonResponse(['error' => 'ZipArchive extension not available'], 500);
    $body = readJsonBody();
    $zipUrl = $body['zipUrl'] ?? '';
    if (!$zipUrl || strpos($zipUrl, 'https://api.github.com/') !== 0) {
        jsonResponse(['error' => 'invalid zip URL'], 400);
    }
    // 1. Backup current files
    $currentVersion = trim(file_get_contents(ROOT_DIR . '/VERSION'));
    $backupDir = BACKUP_DIR . '/pre-update-' . $currentVersion;
    if (!is_dir($backupDir)) @mkdir($backupDir, 0755, true);
    // Copy key files to backup
    foreach (['api/index.php', 'VERSION', '.htaccess'] as $f) {
        $src = ROOT_DIR . '/' . $f;
        if (file_exists($src)) {
            $destDir = $backupDir . '/' . dirname($f);
            if (!is_dir($destDir)) @mkdir($destDir, 0755, true);
            copy($src, $backupDir . '/' . $f);
        }
    }
    // 2. Download zip
    $ctx = stream_context_create(['http' => [
        'header' => "User-Agent: motesplanering\r\nAccept: application/octet-stream\r\n",
        'timeout' => 30,
        'follow_location' => true,
    ]]);
    $tmpZip = tempnam(sys_get_temp_dir(), 'mp_update_');
    $zipData = @file_get_contents($zipUrl, false, $ctx);
    if (!$zipData) jsonResponse(['error' => 'failed to download update'], 500);
    file_put_contents($tmpZip, $zipData);
    // 3. Extract
    $zip = new ZipArchive();
    if ($zip->open($tmpZip) !== true) {
        @unlink($tmpZip);
        jsonResponse(['error' => 'failed to open zip'], 500);
    }
    $stagingDir = sys_get_temp_dir() . '/mp_update_staging_' . time();
    @mkdir($stagingDir, 0755, true);
    $zip->extractTo($stagingDir);
    $zip->close();
    @unlink($tmpZip);
    // GitHub zips have a top-level folder like "owner-repo-hash/"
    $entries = scandir($stagingDir);
    $topDir = $stagingDir;
    foreach ($entries as $e) {
        if ($e !== '.' && $e !== '..' && is_dir($stagingDir . '/' . $e)) {
            $topDir = $stagingDir . '/' . $e;
            break;
        }
    }
    // 4. Look for php/ subfolder in the release
    $sourceDir = is_dir($topDir . '/php') ? $topDir . '/php' : $topDir;
    // 5. Copy new files over, skip protected paths
    $protected = ['data', 'backups', 'uploads'];
    $copyDir = function ($src, $dst) use (&$copyDir, $protected, $sourceDir) {
        if (!is_dir($dst)) @mkdir($dst, 0755, true);
        foreach (scandir($src) as $item) {
            if ($item === '.' || $item === '..') continue;
            $srcPath = $src . '/' . $item;
            $dstPath = $dst . '/' . $item;
            // Check if this is a protected top-level directory
            $relPath = ltrim(str_replace($sourceDir, '', $srcPath), '/');
            $topLevel = explode('/', $relPath)[0];
            if (in_array($topLevel, $protected)) continue;
            if (is_dir($srcPath)) {
                $copyDir($srcPath, $dstPath);
            } else {
                copy($srcPath, $dstPath);
            }
        }
    };
    $copyDir($sourceDir, ROOT_DIR);
    // 6. Cleanup staging
    $rmDir = function ($dir) use (&$rmDir) {
        foreach (scandir($dir) as $item) {
            if ($item === '.' || $item === '..') continue;
            $p = $dir . '/' . $item;
            is_dir($p) ? $rmDir($p) : @unlink($p);
        }
        @rmdir($dir);
    };
    $rmDir($stagingDir);
    $newVersion = file_exists(ROOT_DIR . '/VERSION') ? trim(file_get_contents(ROOT_DIR . '/VERSION')) : 'unknown';
    jsonResponse(['ok' => true, 'version' => $newVersion, 'previousVersion' => $currentVersion]);
}

// ── 404 fallback ─────────────────────────────────────────────────────────────
jsonResponse(['error' => 'not found'], 404);
