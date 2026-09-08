//! Refusing to run inside a virtual machine.
//!
//! WHY THIS EXISTS. Capture protection is applied inside the GUEST:
//! SetWindowDisplayAffinity succeeds there, the read-back reports 0x11, and the
//! app tells the student recording is disabled — while the HOST is recording
//! the whole guest window and the guest has no way to know. So on a virtual
//! machine the strongest protection layer does not merely weaken, it lies. A
//! lecture must not play where the app cannot keep the promise it prints.
//!
//! WHAT THIS IS NOT. It is not proof against a determined person: hiding a
//! hypervisor's fingerprints is published knowledge, and a phone camera pointed
//! at a screen defeats everything here regardless. This raises the floor; the
//! watermark is what survives when someone clears it.
//!
//! EVIDENCE, NOT A SINGLE BIT. The CPUID hypervisor-present flag is set on
//! ORDINARY Windows 11 machines — Virtualisation-Based Security, Credential
//! Guard, WSL2 and Windows Sandbox all turn the host into a root partition and
//! set it. Refusing on that bit alone would lock students out of real school
//! computers, which is a worse failure than the one being prevented. So a
//! finding needs a hypervisor VENDOR that only a guest reports, or hardware
//! identity that only a guest carries.
//!
//! AND NOT INSTALLED SOFTWARE. An earlier version also refused when a
//! guest-additions driver service was REGISTERED — VBoxGuest, vmci, vmhgfs,
//! vmmouse, prl_fs, netkvm. It refused to start on the physical Lenovo laptop
//! this was written on, which has every one of those keys simply because
//! VirtualBox, VMware and QEMU are installed on it as HOSTS. A registered
//! driver describes what somebody installed, not what the machine is. School
//! IT machines are exactly where such software lives, so that check would have
//! locked out the administrators deploying the app. Do not add it back.

/// What was found, in the student's language, or nothing on real hardware.
///
/// The detail is deliberately concrete — "VirtualBox" rather than "a virtual
/// machine" — because the person who has to act on it is an administrator
/// reading it over a student's shoulder.
pub type Finding = Option<String>;

/// CPUID leaf 0x4000_0000 vendor strings that ONLY a guest reports.
///
/// "Microsoft Hv" is deliberately ABSENT: a physical Windows 11 host running
/// Hyper-V, VBS or WSL2 reports it about itself. It is corroborated through
/// hardware identity below instead.
const GUEST_ONLY_VENDORS: &[(&str, &str)] = &[
    ("VMwareVMware", "VMware"),
    ("VBoxVBoxVBox", "VirtualBox"),
    ("KVMKVMKVM", "KVM"),
    ("XenVMMXenVMM", "Xen"),
    ("TCGTCGTCGTCG", "QEMU"),
    ("prl hyperv", "Parallels"),
    ("bhyve bhyve", "bhyve"),
    ("ACRNACRNACRN", "ACRN"),
];

/// Manufacturer / product values that identify emulated firmware.
///
/// Matched case-insensitively against the BIOS keys, which a guest fills in
/// with its own vendor's name.
const FIRMWARE_MARKERS: &[(&str, &str)] = &[
    ("vmware", "VMware"),
    ("virtualbox", "VirtualBox"),
    ("innotek", "VirtualBox"),
    ("oracle vm", "VirtualBox"),
    ("qemu", "QEMU"),
    ("bochs", "QEMU"),
    ("bhyve", "bhyve"),
    ("parallels", "Parallels"),
    ("xen", "Xen"),
    ("virtual machine", "Hyper-V"),
    ("hyper-v", "Hyper-V"),
    ("kvm", "KVM"),
    ("google compute engine", "Google Compute Engine"),
    ("amazon ec2", "Amazon EC2"),
];

/// Everything, in the order that costs least.
pub fn detect() -> Finding {
    if let Some(name) = hypervisor_vendor() {
        return Some(format!("مُشرِف نظام: {name}"));
    }

    platform_detect()
}

/// The CPUID hypervisor vendor, when it is one only a guest reports.
///
/// Reading leaf 0x4000_0000 is meaningless unless the hypervisor-present bit is
/// set, so that is checked first — the leaf is otherwise whatever the CPU
/// happens to return for an unimplemented one.
#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
fn hypervisor_vendor() -> Option<&'static str> {
    #[cfg(target_arch = "x86_64")]
    use std::arch::x86_64::__cpuid;
    #[cfg(target_arch = "x86")]
    use std::arch::x86::__cpuid;

    // __cpuid is safe on x86_64: the target guarantees the instruction, and
    // leaf 1 is architectural.
    let present = __cpuid(1).ecx & (1 << 31) != 0;
    if !present {
        return None;
    }

    // Meaningful only because the hypervisor-present bit above is set; the
    // leaf is otherwise whatever the CPU returns for an unimplemented one.
    let leaf = __cpuid(0x4000_0000);

    let mut vendor = Vec::with_capacity(12);
    for word in [leaf.ebx, leaf.ecx, leaf.edx] {
        vendor.extend_from_slice(&word.to_le_bytes());
    }

    let vendor = String::from_utf8_lossy(&vendor);
    let vendor = vendor.trim_matches(char::from(0));

    GUEST_ONLY_VENDORS
        .iter()
        .find(|(id, _)| vendor.eq_ignore_ascii_case(id))
        .map(|(_, name)| *name)
}

#[cfg(not(any(target_arch = "x86", target_arch = "x86_64")))]
fn hypervisor_vendor() -> Option<&'static str> {
    // Apple silicon and ARM64 Windows have no equivalent leaf. The registry and
    // firmware checks below still apply on Windows.
    None
}

#[cfg(windows)]
fn platform_detect() -> Finding {
    use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_64KEY};
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    // ── Firmware identity ──────────────────────────────────────────────────
    // A guest names its own vendor here. This is also what corroborates
    // "Microsoft Hv", which on its own means only that Hyper-V is present —
    // true of a physical host running WSL2 or Credential Guard.
    if let Ok(bios) = hklm.open_subkey_with_flags(
        r"HARDWARE\DESCRIPTION\System\BIOS",
        KEY_READ | KEY_WOW64_64KEY,
    ) {
        for value in [
            "SystemManufacturer",
            "SystemProductName",
            "BaseBoardManufacturer",
            "BaseBoardProduct",
            "SystemFamily",
        ] {
            let Ok(text) = bios.get_value::<String, _>(value) else {
                continue;
            };
            if let Some(name) = firmware_marker(&text) {
                return Some(format!("عتاد {name} ({})", text.trim()));
            }
        }
    }

    // ── BIOS strings ───────────────────────────────────────────────────────
    if let Ok(system) = hklm.open_subkey_with_flags(
        r"HARDWARE\DESCRIPTION\System",
        KEY_READ | KEY_WOW64_64KEY,
    ) {
        for value in ["SystemBiosVersion", "VideoBiosVersion"] {
            // These are REG_MULTI_SZ; winreg surfaces them as a vector.
            let joined = system
                .get_value::<Vec<String>, _>(value)
                .map(|v| v.join(" "))
                .or_else(|_| system.get_value::<String, _>(value))
                .unwrap_or_default();

            if let Some(name) = firmware_marker(&joined) {
                return Some(format!("BIOS {name}"));
            }
        }
    }

    // ── The virtual disk ───────────────────────────────────────────────────
    // The enumerated disk carries the emulating vendor's name.
    if let Ok(disks) = hklm.open_subkey_with_flags(
        r"SYSTEM\CurrentControlSet\Services\Disk\Enum",
        KEY_READ | KEY_WOW64_64KEY,
    ) {
        if let Ok(first) = disks.get_value::<String, _>("0") {
            if let Some(name) = firmware_marker(&first) {
                return Some(format!("قرص {name}"));
            }
        }
    }

    None
}

#[cfg(not(windows))]
fn platform_detect() -> Finding {
    // macOS ships with its own batch; saying nothing here beats reporting a
    // clean result that was never actually checked.
    None
}

/// The vendor a firmware string names, matched case-insensitively.
fn firmware_marker(text: &str) -> Option<&'static str> {
    let lower = text.to_ascii_lowercase();

    FIRMWARE_MARKERS
        .iter()
        .find(|(needle, _)| lower.contains(needle))
        .map(|(_, name)| *name)
}

/// The finding, for the screen that refuses to start.
#[tauri::command]
pub fn virtualization_finding(app: tauri::AppHandle) -> Option<String> {
    use tauri::Manager;
    app.state::<VirtualizationState>().0.clone()
}

/// Detected once at startup. Re-running it per call would let a guest that
/// cleared its fingerprints mid-session become allowed.
pub struct VirtualizationState(pub Finding);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_vendor_a_firmware_string_carries() {
        assert_eq!(firmware_marker("VMware, Inc."), Some("VMware"));
        assert_eq!(firmware_marker("innotek GmbH"), Some("VirtualBox"));
        assert_eq!(firmware_marker("QEMU Standard PC"), Some("QEMU"));
        assert_eq!(firmware_marker("Microsoft Corporation Virtual Machine"), Some("Hyper-V"));
        assert_eq!(firmware_marker("Parallels Software"), Some("Parallels"));
    }

    #[test]
    fn matching_ignores_case() {
        assert_eq!(firmware_marker("VIRTUALBOX"), Some("VirtualBox"));
        assert_eq!(firmware_marker("vmware"), Some("VMware"));
    }

    #[test]
    fn real_hardware_is_not_named() {
        // Manufacturers a school's actual machines carry.
        for text in [
            "Dell Inc.",
            "LENOVO",
            "HP",
            "ASUSTeK COMPUTER INC.",
            "Micro-Star International Co., Ltd.",
            "Apple Inc.",
            "Intel Corporation",
            "Gigabyte Technology Co., Ltd.",
            "",
        ] {
            assert_eq!(firmware_marker(text), None, "should not flag {text:?}");
        }
    }

    #[test]
    fn the_physical_laptop_that_caught_this_is_not_flagged() {
        // Measured on the machine this was developed on: a physical Lenovo
        // ThinkPad with VirtualBox, VMware and QEMU installed as HOSTS. The
        // first version refused to start on it. Nothing in its firmware or
        // disk identity names an emulator, and installed software is no longer
        // consulted at all.
        for text in [
            "LENOVO",
            "20BS005YAD",
            r"SCSI\Disk&Ven_SAMSUNG&Prod_MZHPV512HDGL-000\5&26a5488&0&000000",
        ] {
            assert_eq!(firmware_marker(text), None, "should not flag {text:?}");
        }
    }

    #[test]
    fn microsoft_hv_alone_is_not_a_guest_vendor() {
        // The one that would lock students out of real Windows 11 machines:
        // VBS, Credential Guard, WSL2 and Windows Sandbox all set the
        // hypervisor bit and report this on PHYSICAL hardware. It is corroborated
        // through firmware identity instead, never trusted on its own.
        assert!(!GUEST_ONLY_VENDORS.iter().any(|(id, _)| *id == "Microsoft Hv"));
    }

    #[test]
    fn every_guest_vendor_id_is_the_twelve_bytes_cpuid_returns() {
        // The leaf yields exactly twelve bytes from ebx:ecx:edx. An entry of
        // another length could never match, and would be dead weight nobody
        // noticed.
        for (id, name) in GUEST_ONLY_VENDORS {
            assert!(
                id.len() <= 12,
                "{name}: vendor id {id:?} is longer than CPUID returns"
            );
        }
    }
}
