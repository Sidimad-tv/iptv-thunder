// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::sync::{LazyLock, Mutex};
use std::collections::HashMap;
use tokio::sync::oneshot;
use tokio::sync::Mutex as AsyncMutex;

static CANCEL_MAP: LazyLock<Mutex<HashMap<String, oneshot::Sender<()>>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

// Async mutex to serialize requests to avoid server rate limiting
static REQUEST_MUTEX: LazyLock<AsyncMutex<()>> = LazyLock::new(|| AsyncMutex::new(()));

// Static HTTP client shared across all requests
static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .expect("Failed to create HTTP client")
});

#[tauri::command]
async fn stalker_request(
    url: String,
    method: String,
    headers: Option<Vec<String>>,
    body: Option<String>,
    _timeout_ms: Option<u64>,
    request_id: Option<String>,
) -> Result<serde_json::Value, String> {
    use reqwest;
    use serde_json::json;

    // Use static client
    let client = &*HTTP_CLIENT;

    let http_method = match method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        _ => return Err("Invalid method".to_string()),
    };

    // Extract MAC from URL query parameters with proper URL decoding
    let mut mac_address = String::new();

    if let Some(mac_start) = url.find("mac=") {
        let mac_end = url[mac_start..]
            .find('&')
            .map(|i| i + mac_start)
            .unwrap_or(url.len());
        let mac_param = &url[mac_start..mac_end];
        mac_address = mac_param.trim_start_matches("mac=").to_string();
        mac_address = mac_address.replace("%3A", ":").replace("%3D", "=");
    }

    if mac_address.is_empty() {
        if let Some(cmd_start) = url.find("cmd=") {
            let cmd_end = url[cmd_start..]
                .find('&')
                .map(|i| i + cmd_start)
                .unwrap_or(url.len());
            let cmd_param = url[cmd_start..cmd_end].to_string();
            
            if let Some(mac_idx) = cmd_param.find("mac%3D") {
                let mac_start = mac_idx + 6;
                let mac_end = cmd_param[mac_start..].find("%26").unwrap_or(cmd_param.len());
                let mac_encoded = &cmd_param[mac_start..mac_start+mac_end];
                mac_address = mac_encoded.replace("%3A", ":");
            }
            else if let Some(mac_idx) = cmd_param.find("mac=") {
                let mac_start = mac_idx + 4;
                let mac_end = cmd_param[mac_start..].find(&['&', '%'][..]).unwrap_or(cmd_param.len());
                mac_address = cmd_param[mac_start..mac_start+mac_end].to_string();
            }
        }
    }

    let mut cookies: Vec<String> = Vec::new();
    
    if !mac_address.is_empty() {
        cookies.push(format!("mac={}", mac_address));
    }
    
    // Extract token from headers first (before creating request)
    let mut token = String::new();
    let mut custom_headers: Vec<(String, String)> = Vec::new();
    if let Some(ref headers_list) = headers {
        for header in headers_list {
            if header.starts_with("Authorization: Bearer ") {
                token = header
                    .trim_start_matches("Authorization: Bearer ")
                    .trim()
                    .to_string();
            } else if !header.to_lowercase().starts_with("authorization:") {
                // Skip Authorization header - token is sent via cookies
                if let Some((key, value)) = header.split_once(':') {
                    custom_headers.push((key.trim().to_string(), value.trim().to_string()));
                }
            }
        }
    }
    
    // Use original URL (token will be in cookies only)
    let final_url = url;
    
    // Create request with final URL
    let mut request = client.request(http_method, &final_url);
    
    // Add custom headers from frontend
    for (key, value) in custom_headers {
        request = request.header(&key, &value);
    }
    
    if !token.is_empty() {
        cookies.push(format!("stb_token={}", token));
    }
    
    // Only add these if they were in original request
    // cookies.push("stb_lang=en_US".to_string());
    // cookies.push("timezone=Europe%2FWarsaw".to_string());
    
    let cookie_string = cookies.join("; ");
    request = request.header("Cookie", &cookie_string);

    // Minimal headers - server might be blocking based on specific headers
    request = request.header("Accept", "*/*");
    request = request.header("Accept-Language", "en-US,en;q=0.9");
    request = request.header("Connection", "keep-alive");
    request = request.header("User-Agent", "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250 Safari/533.3");

    // Add body if provided
    if let Some(request_body) = body {
        request = request.body(request_body);
    }

    // Register cancellation channel if request_id provided
    let cancel_rx = if let Some(ref rid) = request_id {
        let (tx, rx) = oneshot::channel();
        CANCEL_MAP.lock().unwrap().insert(rid.clone(), tx);
        Some(rx)
    } else {
        None
    };

    let do_request = async {
        // Serialize requests to avoid server rate limiting
        let _lock = REQUEST_MUTEX.lock().await;
        
        // Small delay to avoid rate limiting
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        
        let response = request.send().await.map_err(|e| {
            let err_msg = e.to_string();
            if err_msg.contains("dns") || err_msg.contains("DNS") {
                format!("DNS error - cannot resolve domain: {}", err_msg)
            } else if err_msg.contains("connection refused") {
                format!("Connection refused - server not reachable: {}", err_msg)
            } else if err_msg.contains("timeout") {
                format!("Connection timeout: {}", err_msg)
            } else if err_msg.contains("connection closed") || err_msg.contains("connection reset") {
                format!("Connection closed unexpectedly: {}", err_msg)
            } else {
                format!("Request failed: {}", e)
            }
        })?;
        let status = response.status().as_u16();
        let response_headers: std::collections::HashMap<String, String> = response
            .headers()
            .iter()
            .filter_map(|(k, v)| {
                v.to_str().ok().map(|s| (k.to_string(), s.to_string()))
            })
            .collect();
        
        // Use bytes() to get raw response, then convert to string
        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        let response_text = String::from_utf8_lossy(&bytes).to_string();
        
        // Parse the JSON body to include js at top level
        let parsed: serde_json::Value = serde_json::from_str(&response_text).unwrap_or(json!({}));
        
        Ok(json!({
            "status": status,
            "headers": response_headers,
            "body": response_text,
            "js": parsed
        }))
    };

    let result = if let Some(rx) = cancel_rx {
        tokio::select! {
            r = do_request => r,
            _ = rx => Err("Request cancelled".to_string()),
        }
    } else {
        do_request.await
    };

    // Always cleanup cancellation entry
    if let Some(ref rid) = request_id {
        CANCEL_MAP.lock().unwrap().remove(rid);
    }

    result
}

#[tauri::command]
async fn cancel_request(request_id: String) -> Result<bool, String> {
    let tx = CANCEL_MAP.lock().unwrap().remove(&request_id);
    if let Some(sender) = tx {
        let _ = sender.send(());
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn fetch_image(url: String, timeout: u64) -> Result<serde_json::Value, String> {
    use reqwest;
    use serde_json::json;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(timeout))
        .build()
        .map_err(|e| e.to_string())?;

    let response_result = client
        .get(&url)
        .header("Accept", "image/*,*/*")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send()
        .await;

    match response_result {
        Ok(response) => {
            let status = response.status().as_u16();
            let headers: std::collections::HashMap<String, String> = response
                .headers()
                .iter()
                .filter_map(|(k, v)| {
                    v.to_str().ok().map(|s| (k.to_string(), s.to_string()))
                })
                .collect();

            let bytes = response.bytes().await.map_err(|e| e.to_string())?;
            let body: Vec<u8> = bytes.to_vec();

            Ok(json!({
                "status": status,
                "headers": headers,
                "body": body
            }))
        }
        Err(e) => {
            // Return error as 0 status so frontend can handle it gracefully
            // This prevents throwing errors for expected failures (404s, DNS failures, etc.)
            Ok(json!({
                "status": 0,
                "headers": {},
                "body": [],
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250 Safari/533.3")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .header("Accept", "application/json, text/plain, */*")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    resp.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_mpv_available() -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
async fn export_portals(_app_handle: tauri::AppHandle, data: String, export_type: String) -> Result<String, String> {
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    // Save to Downloads folder
    let downloads = PathBuf::from(
        std::env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string())
    ).join("Downloads");
    std::fs::create_dir_all(&downloads).map_err(|e| e.to_string())?;

    // Format: S!d!m@dtv-STB-{type}-YYYY-MM-DD-HHMM.json
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let mins = (time_secs % 3600) / 60;

    // Approximate date calculation from epoch
    let mut y = 1970i64;
    let mut remaining = days as i64;
    loop {
        let days_in_year = if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) { 366 } else { 365 };
        if remaining < days_in_year { break; }
        remaining -= days_in_year;
        y += 1;
    }
    let month_days = if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) {
        [31,29,31,30,31,30,31,31,30,31,30,31]
    } else {
        [31,28,31,30,31,30,31,31,30,31,30,31]
    };
    let mut m = 1usize;
    for &md in &month_days {
        if remaining < md { break; }
        remaining -= md;
        m += 1;
    }
    let d = remaining + 1;

    let ftype = if export_type == "m3u" { "M3U" } else { "MAC" };
    let filename = format!("S!d!m@dtv-STB-{ftype}-{y:04}-{m:02}-{d:02}-{hours:02}{mins:02}.json");
    let path = downloads.join(&filename);

    std::fs::write(&path, &data).map_err(|e| e.to_string())?;

    // Open folder containing the file
    let _ = std::process::Command::new("explorer")
        .arg("/select,")
        .arg(&path)
        .spawn();

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn run_updater(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Try resource dir first (bundled resource)
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    let updater_path = resource_path.join("exec").join("update.exe");

    // If not found at resource dir, try alongside the executable
    let updater_path = if updater_path.exists() {
        updater_path
    } else {
        let exe_dir = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .parent()
            .ok_or("No parent directory")?
            .to_path_buf();
        let fallback = exe_dir.join("update.exe");
        if fallback.exists() {
            fallback
        } else {
            return Err("update.exe not found. Please ensure the updater is bundled with the application or placed alongside the executable.".to_string());
        }
    };

    let current_ver = app_handle.package_info().version.to_string();

    std::process::Command::new(&updater_path)
        .arg(&current_ver)
        .spawn()
        .map_err(|e| format!("Failed to launch updater: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn fetch_epg_gz(url: String) -> Result<String, String> {
    use reqwest;
    use flate2::read::GzDecoder;
    use std::io::Read;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("Accept", "application/gzip, */*")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    // Check if data is gzipped by magic bytes
    if bytes.len() >= 2 && bytes[0] == 0x1f && bytes[1] == 0x8b {
        // Decompress gzip
        let mut decoder = GzDecoder::new(&bytes[..]);
        let mut decompressed = Vec::new();
        decoder
            .read_to_end(&mut decompressed)
            .map_err(|e| e.to_string())?;
        String::from_utf8(decompressed).map_err(|e| e.to_string())
    } else {
        // Not gzipped, return as string
        String::from_utf8(bytes.to_vec()).map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg_attr(target_os = "android", allow(unused_mut))]
    let mut builder = tauri::Builder::default();

    // Desktop-only plugins (stronghold and libmpv not available on Android)
    #[cfg(not(target_os = "android"))]
    {
        builder = builder
            .plugin(
                tauri_plugin_stronghold::Builder::new(|password| {
                    let mut key = vec![0u8; 32];
                    let pwd_bytes = password.as_bytes();
                    for (i, byte) in pwd_bytes.iter().enumerate().take(32) {
                        key[i] = *byte;
                    }
                    key
                })
                .build(),
            )
            .plugin(tauri_plugin_libmpv::init());
    }

    let builder = builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .invoke_handler(tauri::generate_handler![
            stalker_request,
            cancel_request,
            fetch_image,
            check_mpv_available,
            fetch_epg_gz,
            run_updater,
            export_portals,
            fetch_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
