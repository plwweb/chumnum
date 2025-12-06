<?php
// ตั้งค่า Database (InfinityFree)
$servername = "sql309.infinityfree.com"; 
$username = "if0_40422846";               
$password = "pee115500"; // ⚠️ ใส่รหัสผ่านใหม่ที่คุณเพิ่งเปลี่ยนตรงนี้
$dbname = "if0_40422846_vote";     

// เชื่อมต่อ
$conn = new mysqli($servername, $username, $password, $dbname);

// เช็ค Error
if ($conn->connect_error) {
    die(json_encode(["status" => "error", "message" => "Database Connection Failed: " . $conn->connect_error]));
}

// ✅ 1. ตั้งค่าภาษาให้รองรับภาษาไทย
$conn->set_charset("utf8mb4");

// ✅ 2. บังคับให้ MySQL ใช้เวลาประเทศไทย (UTC+7)
$conn->query("SET time_zone = '+07:00'");

?>