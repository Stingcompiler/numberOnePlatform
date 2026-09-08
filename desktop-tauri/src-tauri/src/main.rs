// Hides the console window that would otherwise open behind a release build.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    numberone_desktop_lib::run()
}
