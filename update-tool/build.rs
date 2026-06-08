fn main() {
    let ico = std::path::Path::new("../src-tauri/icons/icon.ico");
    if ico.exists() {
        println!("cargo:rerun-if-changed={}", ico.display());
        let mut res = winresource::WindowsResource::new();
        res.set_icon(ico.to_str().unwrap());
        if let Err(e) = res.compile() {
            println!("cargo:warning=Failed to compile icon: {e}");
        }
    }
}
