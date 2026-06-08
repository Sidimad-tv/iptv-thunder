#![windows_subsystem = "windows"]

use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::ptr;

use windows_sys::Win32::Foundation::*;
use windows_sys::Win32::UI::WindowsAndMessaging::*;
use windows_sys::Win32::Graphics::Gdi::*;
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleA;

type PCSTR = *const u8;

#[derive(serde::Deserialize)]
struct Release {
    tag_name: String,
    html_url: String,
    assets: Vec<Asset>,
}

#[derive(serde::Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

#[derive(serde::Deserialize)]
struct VersionManifest {
    version: String,
    url: Option<String>,
    description: Option<String>,
}

const ID_STATIC_VERSION: i32 = 101;
const ID_STATIC_STATUS: i32 = 102;
const ID_PROGRESS: i32 = 103;
const SS_LEFT: u32 = 0x00000000;
const PBS_SMOOTH: u32 = 0x00000001;
const PBM_SETRANGE: u32 = 0x0401;
const PBM_SETSTEP: u32 = 0x0405;
const PBM_SETPOS: u32 = 0x0402;

static UPDATER_RUNNING: AtomicBool = AtomicBool::new(true);

#[derive(Clone, Copy)]
struct SafeHwnd(HWND);
unsafe impl Send for SafeHwnd {}
unsafe impl Sync for SafeHwnd {}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let current_ver = args.get(1).map(|s| s.trim_start_matches('v').to_string()).unwrap_or_else(|| "1.0.0".to_string());

    unsafe {
        let hinst = GetModuleHandleA(ptr::null());
        let class_name = "SidimadUpdateWindow\0";
        let title = "S!d!m@dtv-STB Updater\0";

        let wc = WNDCLASSA {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(window_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: hinst,
            hIcon: LoadIconA(hinst, 1 as PCSTR),
            hCursor: LoadCursorA(ptr::null_mut(), (32512 as isize) as PCSTR), // IDC_ARROW
            hbrBackground: (COLOR_WINDOW + 1) as HBRUSH,
            lpszMenuName: ptr::null(),
            lpszClassName: class_name.as_ptr(),
        };

        RegisterClassA(&wc);

        let hwnd = CreateWindowExA(
            0,
            class_name.as_ptr(),
            title.as_ptr(),
            WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
            CW_USEDEFAULT, CW_USEDEFAULT, 460, 200,
            ptr::null_mut(),
            ptr::null_mut(),
            hinst,
            ptr::null(),
        );

        if hwnd.is_null() { return; }

        let ver_text = format!("Current version: v{current_ver}\0");
        CreateWindowExA(
            0, "STATIC\0".as_ptr(), ver_text.as_ptr(),
            WS_CHILD | WS_VISIBLE | SS_LEFT,
            20, 15, 420, 20,
            hwnd, ID_STATIC_VERSION as *mut _, hinst, ptr::null(),
        );

        let initial_status = "Checking for updates...\0";
        CreateWindowExA(
            0, "STATIC\0".as_ptr(), initial_status.as_ptr(),
            WS_CHILD | WS_VISIBLE | SS_LEFT,
            20, 40, 420, 20,
            hwnd, ID_STATIC_STATUS as *mut _, hinst, ptr::null(),
        );

        let progress = CreateWindowExA(
            0, "msctls_progress32\0".as_ptr(), ptr::null(),
            WS_CHILD | WS_VISIBLE | PBS_SMOOTH,
            20, 70, 420, 25,
            hwnd, ID_PROGRESS as *mut _, hinst, ptr::null(),
        );
        if !progress.is_null() {
            SendMessageA(progress, PBM_SETRANGE, 0, 100);
            SendMessageA(progress, PBM_SETSTEP, 1, 0);
        }

        ShowWindow(hwnd, SW_SHOW);
        UpdateWindow(hwnd);

        let update_hwnd = SafeHwnd(hwnd);
        let progress_hwnd = SafeHwnd(progress);
        let ver = current_ver.clone();

        thread::spawn(move || {
            run_update_check(update_hwnd, progress_hwnd, &ver);
            UPDATER_RUNNING.store(false, Ordering::SeqCst);
        });

        let mut msg: MSG = std::mem::zeroed();
        while UPDATER_RUNNING.load(Ordering::SeqCst) {
            while PeekMessageA(&mut msg, ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                if msg.message == WM_QUIT { return; }
                TranslateMessage(&msg);
                DispatchMessageA(&msg);
            }
            thread::sleep(std::time::Duration::from_millis(50));
        }
    }
}

unsafe extern "system" fn window_proc(
    hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_CLOSE => {
            UPDATER_RUNNING.store(false, Ordering::SeqCst);
            DestroyWindow(hwnd);
            0
        }
        WM_DESTROY => {
            PostQuitMessage(0);
            0
        }
        _ => DefWindowProcA(hwnd, msg, wparam, lparam),
    }
}

unsafe fn set_text(hwnd: HWND, id: i32, text: &str) {
    let ctrl = GetDlgItem(hwnd, id);
    if !ctrl.is_null() {
        let cstr = format!("{}\0", text);
        SetWindowTextA(ctrl, cstr.as_ptr());
    }
}

unsafe fn set_progress(hwnd: HWND, pct: i32) {
    if !hwnd.is_null() {
        SendMessageA(hwnd, PBM_SETPOS, pct as WPARAM, 0);
    }
}

unsafe fn show_final_dialog(hwnd: HWND, title: &str, message: &str) {
    let t = format!("{}\0", title);
    let m = format!("{}\0", message);
    MessageBoxA(hwnd, m.as_ptr(), t.as_ptr(), MB_OK | MB_ICONINFORMATION);
    UPDATER_RUNNING.store(false, Ordering::SeqCst);
    DestroyWindow(hwnd);
}

unsafe fn run_update_check(hwnd: SafeHwnd, progress: SafeHwnd, current_ver: &str) {
    let hwnd = hwnd.0;
    let progress = progress.0;
    set_text(hwnd, ID_STATIC_STATUS, "Checking server...");
    set_progress(progress, 10);

    let client = match reqwest::blocking::Client::builder()
        .user_agent("sidimadtv-stb-updater/1.0")
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            set_text(hwnd, ID_STATIC_STATUS, &format!("Failed to create HTTP client: {e}"));
            return;
        }
    };

    match check_cdn_gui(&client, hwnd, progress, current_ver) {
        Ok(true) => return,
        Ok(false) => {}
        Err(e) => {
            set_text(hwnd, ID_STATIC_STATUS, &format!("CDN: {e}"));
        }
    }

    set_text(hwnd, ID_STATIC_STATUS, "Checking server database...");
    set_progress(progress, 40);

    match check_github_gui(&client, hwnd, progress, current_ver) {
        Ok(true) => {}
        Ok(false) => {
            show_final_dialog(hwnd, "Up to Date",
                &format!("You have the latest version (v{current_ver})."));
        }
        Err(e) => {
            set_text(hwnd, ID_STATIC_STATUS, &format!("Error: {e}"));
            show_final_dialog(hwnd, "Update Check Failed",
                &format!("Could not check for updates:\n{e}"));
        }
    }
}

unsafe fn check_cdn_gui(
    client: &reqwest::blocking::Client, hwnd: HWND, progress: HWND, current_ver: &str,
) -> Result<bool, String> {
    let url = "https://cdn.jsdelivr.net/gh/Sidimadtv/all/sidi/version.json";
    set_progress(progress, 20);

    let resp = client.get(url).send()        .map_err(|e| format!("Server unreachable: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Server HTTP {}", resp.status()));
    }

    set_progress(progress, 30);
    let manifest: VersionManifest = resp.json().map_err(|e| format!("Bad manifest: {e}"))?;
    let latest_ver = manifest.version.trim_start_matches('v');

    if latest_ver == current_ver {
        set_text(hwnd, ID_STATIC_STATUS, "Server: up to date.");
        return Ok(false);
    }

    set_text(hwnd, ID_STATIC_VERSION, &format!("v{current_ver} -> v{latest_ver}"));
    set_text(hwnd, ID_STATIC_STATUS, &format!("Update available: v{latest_ver}"));
    if let Some(ref desc) = manifest.description {
        set_text(hwnd, ID_STATIC_STATUS, desc);
    }

    let download_url = manifest.url.unwrap_or_else(|| {
        format!("https://github.com/Sidimad-tv/iptv-thunder/releases/tag/v{latest_ver}")
    });

    set_text(hwnd, ID_STATIC_STATUS, "Opening download page...");
    let _ = Command::new("cmd").args(["/c", "start", &download_url]).spawn();
    show_final_dialog(hwnd, "Update Available",
        &format!("Version v{latest_ver} is available.\nOpened download page in your browser.\n\nCurrent: v{current_ver}"));
    Ok(true)
}

unsafe fn check_github_gui(
    client: &reqwest::blocking::Client, hwnd: HWND, progress: HWND, current_ver: &str,
) -> Result<bool, String> {
    set_progress(progress, 50);

    let resp = client
        .get("https://api.github.com/repos/Sidimad-tv/iptv-thunder/releases/latest")
        .send()
        .map_err(|e| format!("Server API unreachable: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Server HTTP {}", resp.status()));
    }

    set_progress(progress, 60);
    let release: Release = resp.json().map_err(|e| format!("Bad release data: {e}"))?;
    let latest_ver = release.tag_name.trim_start_matches('v');

    if latest_ver == current_ver {
        set_text(hwnd, ID_STATIC_VERSION, &format!("v{current_ver} (latest on server)"));
        set_text(hwnd, ID_STATIC_STATUS, "Up to date.");
        return Ok(false);
    }

    set_text(hwnd, ID_STATIC_VERSION, &format!("v{current_ver} -> v{latest_ver}"));
    set_text(hwnd, ID_STATIC_STATUS, &format!("Downloading v{latest_ver}..."));

    let asset = release.assets.iter().find(|a| {
        a.name.ends_with(".msi") || a.name.ends_with("-setup.exe")
    });

    if let Some(asset) = &asset {
        set_progress(progress, 70);
        set_text(hwnd, ID_STATIC_STATUS, &format!("Downloading {}...", asset.name));
        match download_file_gui(client, &asset.browser_download_url, &asset.name, progress) {
            Ok(path) => {
                set_progress(progress, 100);
                set_text(hwnd, ID_STATIC_STATUS, "Download complete. Launching installer...");
                let _ = Command::new(&path).spawn();
                show_final_dialog(hwnd, "Update Ready",
                    &format!("Version v{latest_ver} downloaded.\nInstaller launched."));
                return Ok(true);
            }
            Err(e) => {
                set_text(hwnd, ID_STATIC_STATUS, &format!("Download failed: {e}"));
            }
        }
    }

        set_text(hwnd, ID_STATIC_STATUS, "Opening download page...");
    let _ = Command::new("cmd").args(["/c", "start", &release.html_url]).spawn();
    show_final_dialog(hwnd, "Update Available",
        &format!("Version v{latest_ver} is available.\nDownload page opened in your browser."));
    Ok(true)
}

unsafe fn download_file_gui(
    client: &reqwest::blocking::Client, url: &str, filename: &str, progress: HWND,
) -> Result<PathBuf, String> {
    let resp = client.get(url).send().map_err(|e| e.to_string())?;
    let total = resp.content_length().unwrap_or(0);
    let bytes = resp.bytes().map_err(|e| e.to_string())?;

    if total > 0 {
        let pct = ((bytes.len() as f64 / total as f64) * 100.0) as i32;
        set_progress(progress, pct.min(99));
    } else {
        set_progress(progress, 90);
    }

    let path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")).join(filename);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path)
}
