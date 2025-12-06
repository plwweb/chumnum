<?php
// ==========================================
// 1. การตั้งค่าและ Headers (Configuration)
// ==========================================
// ✅ ตั้งเวลาของ PHP ให้เป็นประเทศไทย
date_default_timezone_set('Asia/Bangkok');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { 
    http_response_code(200); 
    exit; 
}

// เรียกไฟล์เชื่อมต่อฐานข้อมูล (ซึ่งเราตั้งค่า Timezone MySQL ไว้ในนั้นแล้ว)
include 'db.php';

// ==========================================
// 2. ฟังก์ชันช่วย (Helper Functions)
// ==========================================
function clean($conn, $str) { 
    return $conn->real_escape_string(trim($str)); 
}

// ฟังก์ชันบันทึกรูปภาพ
function saveImage($base64_string) {
    if (strpos($base64_string, 'data:image') === false) return $base64_string;
    $data = explode(',', $base64_string);
    $meta = $data[0]; 
    $content = base64_decode($data[1]);
    $ext = 'jpg'; 
    if (strpos($meta, 'png') !== false) $ext = 'png';
    elseif (strpos($meta, 'jpeg') !== false) $ext = 'jpg';
    elseif (strpos($meta, 'gif') !== false) $ext = 'gif';
    $filename = 'design_' . time() . '_' . rand(1000, 9999) . '.' . $ext;
    $filepath = 'uploads/' . $filename;
    if (!is_dir('uploads')) mkdir('uploads', 0755, true);
    file_put_contents($filepath, $content);
    return $filepath; 
}

// ==========================================
// 3. รับข้อมูลและประมวลผล
// ==========================================
$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);
$action = isset($data['action']) ? $data['action'] : '';

if (empty($action)) {
    echo json_encode(["status" => "error", "message" => "API Ready. Time: " . date('Y-m-d H:i:s')]);
    exit;
}

$response = ["status" => "error", "message" => "Invalid Action"];

switch ($action) {

    // --- User & Vote ---
    case 'getStudentDetails':
        $u = clean($conn, $data['studentId']);
        $p = clean($conn, $data['password']);
        $sql = "SELECT * FROM students WHERE student_id = '$u' AND password = '$p'";
        $result = $conn->query($sql);
        if ($result->num_rows > 0) {
            $row = $result->fetch_assoc();
            $response = ["status" => "success", "fullName" => $row['full_name'], "grade" => $row['grade'], "room" => $row['room'], "hasVoted" => (bool)$row['has_voted'], "voteChoice" => $row['vote_choice']];
        } else {
            $response = ["status" => "error", "message" => "รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง"];
        }
        break;

    case 'getVotePageData':
        $settings = [];
        $sRes = $conn->query("SELECT * FROM settings");
        while($r = $sRes->fetch_assoc()) $settings[$r['setting_key']] = $r['setting_value'];
        $designs = [];
        $dRes = $conn->query("SELECT design_id as designId, design_name as designName, image_url as imageUrl, vote_count as voteCount FROM designs");
        while($r = $dRes->fetch_assoc()) $designs[] = $r;
        $totalStd = $conn->query("SELECT COUNT(*) as c FROM students")->fetch_assoc()['c'];
        $votedStd = $conn->query("SELECT COUNT(*) as c FROM students WHERE has_voted=1")->fetch_assoc()['c'];
        $topGrade = $conn->query("SELECT grade FROM students WHERE has_voted=1 GROUP BY grade ORDER BY COUNT(*) DESC LIMIT 1")->fetch_assoc()['grade'] ?? '-';
        $response = [
            "status" => "success",
            "announcement" => $settings['announcement'] ?? '',
            "helpContent" => $settings['help_content'] ?? '',
            "voteTime" => ["startTime" => $settings['vote_start_time'] ?? '', "endTime" => $settings['vote_end_time'] ?? ''],
            "results" => $designs,
            "stats" => ["votedCount" => $votedStd, "totalStudents" => $totalStd, "turnoutPercentage" => $totalStd > 0 ? ($votedStd / $totalStd) * 100 : 0, "topGrade" => $topGrade]
        ];
        break;

    case 'registerAndVote':
        $sid = clean($conn, $data['studentId']);
        $choice = clean($conn, $data['voteChoice']);
        $check = $conn->query("SELECT has_voted FROM students WHERE student_id = '$sid'");
        $row = $check->fetch_assoc();
        if ($row['has_voted']) {
            $response = ["status" => "error", "message" => "คุณได้ใช้สิทธิ์ไปแล้ว"];
        } else {
            $conn->begin_transaction();
            try {
                // ใช้ NOW() ของ SQL ซึ่งเราตั้งค่า Timezone ไว้แล้วใน db.php
                $conn->query("UPDATE students SET has_voted=1, vote_choice='$choice', vote_timestamp=NOW() WHERE student_id='$sid'");
                $conn->query("UPDATE designs SET vote_count = vote_count + 1 WHERE design_id='$choice'");
                $conn->commit();
                $response = ["status" => "success"];
            } catch (Exception $e) {
                $conn->rollback();
                $response = ["status" => "error", "message" => $e->getMessage()];
            }
        }
        break;

    case 'changeStudentPassword':
        $sid = clean($conn, $data['username']);
        $oldP = clean($conn, $data['oldPassword']);
        $newP = clean($conn, $data['newPassword']);
        $check = $conn->query("SELECT * FROM students WHERE student_id = '$sid' AND password = '$oldP'");
        if ($check->num_rows > 0) {
            $conn->query("UPDATE students SET password = '$newP' WHERE student_id = '$sid'");
            $response = ["status" => "success", "message" => "เปลี่ยนรหัสผ่านสำเร็จ"];
        } else {
            $response = ["status" => "error", "message" => "รหัสผ่านเดิมไม่ถูกต้อง"];
        }
        break;

    case 'submitFeedback':
        $msg = clean($conn, $data['feedbackText']);
        $u = isset($data['username']) ? clean($conn, $data['username']) : 'Anonymous';
        // ใช้ NOW() ของ SQL
        $conn->query("INSERT INTO feedbacks (student_id, message, timestamp) VALUES ('$u', '$msg', NOW())");
        $response = ["status" => "success"];
        break;

    // --- Admin ---
    case 'login':
        $u = clean($conn, $data['username']);
        $p = clean($conn, $data['password']);
        $sql = "SELECT * FROM admins WHERE username = '$u' AND password = '$p'";
        $result = $conn->query($sql);
        if ($result->num_rows > 0) {
            $row = $result->fetch_assoc();
            $response = ["status" => "success", "fullName" => $row['full_name']];
        } else {
            $response = ["status" => "error", "message" => "Username หรือ Password ผิดพลาด"];
        }
        break;

    case 'getAdminData':
        $users = [];
        // เรียง ม. ก่อน แล้วค่อยเรียงห้อง แล้วค่อยเรียงรหัส
$uRes = $conn->query("SELECT student_id, full_name, grade, room, vote_timestamp, vote_choice, has_voted FROM students ORDER BY grade ASC, room ASC, student_id ASC");
        while($r = $uRes->fetch_row()) { $r[6] = (bool)$r[6]; $users[] = $r; }
        $votes = [];
        $vRes = $conn->query("SELECT design_id, design_name, vote_count, image_url FROM designs");
        while($r = $vRes->fetch_row()) { $votes[] = $r; }
        $response = ["status" => "success", "allStudents" => $users, "votes" => $votes];
        break;

    case 'getAdminDashboardData':
        $total = $conn->query("SELECT COUNT(*) as c FROM students")->fetch_assoc()['c'];
        $voted = $conn->query("SELECT COUNT(*) as c FROM students WHERE has_voted=1")->fetch_assoc()['c'];
        $turnout = $total > 0 ? number_format(($voted/$total)*100, 2) : 0;
        $totalVotes = $conn->query("SELECT SUM(vote_count) as s FROM designs")->fetch_assoc()['s'] ?? 0;
        $byGrade = [];
        $gRes = $conn->query("SELECT grade, room, COUNT(*) as c FROM students WHERE has_voted=1 GROUP BY grade, room");
        while($r = $gRes->fetch_assoc()) {
            $g = $r['grade']; $rm = $r['room']; $c = $r['c'];
            if(!isset($byGrade[$g])) $byGrade[$g] = ["total"=>0, "rooms"=>[]];
            $byGrade[$g]['total'] += $c;
            $byGrade[$g]['rooms'][$rm] = $c;
        }
        $response = ["status" => "success", "totalStudentsCount" => $total, "totalVoters" => $voted, "totalVotes" => $totalVotes, "turnoutPercentage" => $turnout, "votesByGradeAndRoom" => $byGrade];
        break;

    case 'addDesign': 
        $id = clean($conn, $data['designId']);
        $name = clean($conn, $data['designName']);
        $img = isset($data['imageUrl']) ? saveImage($data['imageUrl']) : ''; 
        if($conn->query("INSERT INTO designs (design_id, design_name, image_url) VALUES ('$id', '$name', '$img')")) {
            $response = ["status" => "success"];
        } else {
            $response = ["status" => "error", "message" => "Duplicate ID or Error: ".$conn->error];
        }
        break;
    
    case 'editDesign': 
        $id = clean($conn, $data['designId']);
        $name = clean($conn, $data['designName']);
        $img = isset($data['imageUrl']) ? saveImage($data['imageUrl']) : '';
        $conn->query("UPDATE designs SET design_name='$name', image_url='$img' WHERE design_id='$id'");
        $response = ["status" => "success"];
        break;

    case 'deleteDesign':
        $id = clean($conn, $data['designId']);
        $conn->query("DELETE FROM designs WHERE design_id='$id'");
        $response = ["status" => "success"];
        break;

    case 'adminUpdateVote':
        $sid = clean($conn, $data['studentId']);
        $oldC = clean($conn, $data['oldVoteChoice']);
        $newC = clean($conn, $data['newVoteChoice']);
        $conn->begin_transaction();
        try {
            if($oldC) $conn->query("UPDATE designs SET vote_count = GREATEST(vote_count - 1, 0) WHERE design_id='$oldC'");
            if($newC) $conn->query("UPDATE designs SET vote_count = vote_count + 1 WHERE design_id='$newC'");
            $conn->query("UPDATE students SET vote_choice='$newC', vote_timestamp=NOW() WHERE student_id='$sid'");
            $conn->commit();
            $response = ["status" => "success"];
        } catch(Exception $e) { $conn->rollback(); $response = ["status" => "error", "message" => $e->getMessage()]; }
        break;

    case 'deleteUser':
        $sid = clean($conn, $data['studentId']);
        $res = $conn->query("SELECT vote_choice FROM students WHERE student_id='$sid'");
        $row = $res->fetch_assoc();
        if ($row && $row['vote_choice']) {
            $choice = $row['vote_choice'];
            $conn->query("UPDATE designs SET vote_count = GREATEST(vote_count - 1, 0) WHERE design_id='$choice'");
        }
        $conn->query("UPDATE students SET has_voted=0, vote_choice=NULL, vote_timestamp=NULL WHERE student_id='$sid'");
        $response = ["status" => "success"];
        break;

    case 'clearUsers':
        $conn->query("UPDATE students SET has_voted=0, vote_choice=NULL, vote_timestamp=NULL");
        $conn->query("UPDATE designs SET vote_count=0");
        $response = ["status" => "success"];
        break;

    case 'resetVotes':
        $conn->query("UPDATE designs SET vote_count=0");
        $conn->query("UPDATE students SET has_voted=0, vote_choice=NULL, vote_timestamp=NULL");
        $response = ["status" => "success"];
        break;
        
    case 'recalculateVotes':
        $conn->query("UPDATE designs SET vote_count = 0");
        $sql = "SELECT vote_choice, COUNT(*) as c FROM students WHERE has_voted=1 AND vote_choice IS NOT NULL GROUP BY vote_choice";
        $res = $conn->query($sql);
        while($r = $res->fetch_assoc()) {
            $c = $r['c'];
            $d = $r['vote_choice'];
            $conn->query("UPDATE designs SET vote_count = $c WHERE design_id='$d'");
        }
        $response = ["status" => "success", "message" => "คำนวณคะแนนใหม่เสร็จสิ้น"];
        break;

    case 'addOrUpdateStudent':
        $sid = clean($conn, $data['studentId']);
        $name = clean($conn, $data['fullName']);
        $grade = clean($conn, $data['grade']);
        $room = clean($conn, $data['room']);
        $pass = (isset($data['password']) && !empty($data['password'])) ? clean($conn, $data['password']) : $sid;
        $sql = "INSERT INTO students (student_id, full_name, grade, room, password) VALUES ('$sid', '$name', '$grade', '$room', '$pass') ON DUPLICATE KEY UPDATE full_name='$name', grade='$grade', room='$room', password='$pass'";
        if($conn->query($sql)) $response = ["status" => "success"];
        else $response = ["status" => "error", "message" => $conn->error];
        break;

    case 'importStudents':
        $base64 = $data['base64Data'];
        $csvData = base64_decode($base64);
        $lines = explode("\n", $csvData);
        $count = 0;
        foreach ($lines as $line) {
            $line = trim($line);
            if(empty($line)) continue;
            $cols = str_getcsv($line);
            if(count($cols) >= 4) {
                $sid = clean($conn, $cols[0]);
                $name = clean($conn, $cols[1]);
                $grade = clean($conn, $cols[2]);
                $room = clean($conn, $cols[3]);
                $pass = $sid;
                if(!is_numeric($sid) && $count == 0) continue; 
                $sql = "INSERT INTO students (student_id, full_name, grade, room, password) VALUES ('$sid', '$name', '$grade', '$room', '$pass') ON DUPLICATE KEY UPDATE full_name='$name', grade='$grade', room='$room'";
                $conn->query($sql);
                $count++;
            }
        }
        $response = ["status" => "success", "message" => "Imported $count students."];
        break;

    case 'getAdminAccounts':
        $res = [];
        $q = $conn->query("SELECT username, '', full_name FROM admins");
        while($r = $q->fetch_row()) $res[] = $r;
        $response = ["accounts" => $res];
        break;

    case 'addAdminAccount':
        $u = clean($conn, $data['usernameToAdd']);
        $p = clean($conn, $data['passwordToAdd']);
        $n = clean($conn, $data['fullNameToAdd']);
        if($conn->query("INSERT INTO admins (username, password, full_name) VALUES ('$u', '$p', '$n')")) {
            $response = ["status" => "success"];
        } else {
            $response = ["status" => "error", "message" => "Username ซ้ำ"];
        }
        break;

    case 'deleteAdminAccount':
        $u = clean($conn, $data['usernameToDelete']);
        if($u == 'admin') { $response = ["status" => "error", "message" => "ไม่สามารถลบบัญชีหลักได้"]; } 
        else { $conn->query("DELETE FROM admins WHERE username='$u'"); $response = ["status" => "success"]; }
        break;

    case 'getFeedbackLogs':
        $logs = [];
        $q = $conn->query("SELECT * FROM feedbacks ORDER BY timestamp DESC LIMIT 50");
        while($r = $q->fetch_assoc()) {
            $logs[] = ["timestamp" => $r['timestamp'], "studentId" => $r['student_id'], "message" => $r['message']];
        }
        $response = ["status" => "success", "logs" => $logs];
        break;

    case 'updateHelpContent':
        $txt = $conn->real_escape_string($data['text']);
        $conn->query("INSERT INTO settings (setting_key, setting_value) VALUES ('help_content', '$txt') ON DUPLICATE KEY UPDATE setting_value='$txt'");
        $response = ["status" => "success"];
        break;

    case 'getHelpContent':
        $txt = $conn->query("SELECT setting_value FROM settings WHERE setting_key='help_content'")->fetch_assoc()['setting_value'] ?? '';
        $response = ["status" => "success", "text" => $txt];
        break;

    case 'updateAnnouncementText':
        $txt = clean($conn, $data['text']);
        $conn->query("INSERT INTO settings (setting_key, setting_value) VALUES ('announcement', '$txt') ON DUPLICATE KEY UPDATE setting_value='$txt'");
        $response = ["status" => "success"];
        break;

    case 'getAnnouncementText':
        $txt = $conn->query("SELECT setting_value FROM settings WHERE setting_key='announcement'")->fetch_assoc()['setting_value'] ?? '';
        $response = ["text" => $txt];
        break;

    case 'updateVoteTime':
        $start = clean($conn, $data['startTime']);
        $end = clean($conn, $data['endTime']);
        $conn->query("INSERT INTO settings (setting_key, setting_value) VALUES ('vote_start_time', '$start') ON DUPLICATE KEY UPDATE setting_value='$start'");
        $conn->query("INSERT INTO settings (setting_key, setting_value) VALUES ('vote_end_time', '$end') ON DUPLICATE KEY UPDATE setting_value='$end'");
        $response = ["status" => "success"];
        break;

    case 'getVoteTime':
        $s = $conn->query("SELECT setting_value FROM settings WHERE setting_key='vote_start_time'")->fetch_assoc()['setting_value'] ?? '';
        $e = $conn->query("SELECT setting_value FROM settings WHERE setting_key='vote_end_time'")->fetch_assoc()['setting_value'] ?? '';
        $response = ["startTime" => $s, "endTime" => $e];
        break;

    case 'closeVotingNow':
        $now = date('Y-m-d H:i:s');
        $conn->query("UPDATE settings SET setting_value='$now' WHERE setting_key='vote_end_time'");
        $response = ["status" => "success"];
        break;

    case 'getVoteResults':
        $res = [];
        $q = $conn->query("SELECT design_id as designId, design_name as designName, vote_count as voteCount FROM designs");
        while($r = $q->fetch_assoc()) $res[] = $r;
        $response = ["status" => "success", "results" => $res];
        break;

    case 'getSystemNotifications':
        $notifs = [];
        $q = $conn->query("SELECT full_name, vote_timestamp FROM students WHERE has_voted=1 ORDER BY vote_timestamp DESC LIMIT 5");
        while($r = $q->fetch_assoc()) {
            $notifs[] = ["type" => "Vote", "message" => "{$r['full_name']} ได้ลงคะแนนแล้ว", "timestamp" => $r['vote_timestamp']];
        }
        $response = ["status" => "success", "notifications" => $notifs];
        break;
}

echo json_encode($response);
$conn->close();
exit;
?>